import { createHash } from "node:crypto";
import type { Request, RequestHandler } from "express";
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@aideveloai/db";
import { agentApiKeys, agents, companyMemberships, instanceUserRoles } from "@aideveloai/db";
import { verifyLocalAgentJwt } from "../agent-auth-jwt.js";
import type { DeploymentMode } from "@aideveloai/shared";
import type { BetterAuthSessionResult } from "../auth/better-auth.js";
import { logger } from "./logger.js";
import { getCachedBoardActor, setCachedBoardActor } from "../services/user-auth-cache.js";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

// --- API key lookup cache (10-minute TTL) ---
const API_KEY_CACHE_TTL_MS = 10 * 60 * 1000;
type CachedApiKey = {
  key: { id: string; agentId: string; companyId: string } | null;
  expiresAt: number;
};
const apiKeyCache = new Map<string, CachedApiKey>();

function getCachedApiKey(tokenHash: string): CachedApiKey["key"] | undefined {
  const entry = apiKeyCache.get(tokenHash);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    apiKeyCache.delete(tokenHash);
    return undefined;
  }
  return entry.key;
}

function setCachedApiKey(tokenHash: string, key: CachedApiKey["key"]): void {
  // Cap cache size to prevent unbounded growth
  if (apiKeyCache.size > 10_000) {
    const firstKey = apiKeyCache.keys().next().value;
    if (firstKey) apiKeyCache.delete(firstKey);
  }
  apiKeyCache.set(tokenHash, { key, expiresAt: Date.now() + API_KEY_CACHE_TTL_MS });
}

interface ActorMiddlewareOptions {
  deploymentMode: DeploymentMode;
  authAllowLocalImplicitBoard?: boolean;
  resolveSession?: (req: Request) => Promise<BetterAuthSessionResult | null>;
}

export function actorMiddleware(db: Db, opts: ActorMiddlewareOptions): RequestHandler {
  return async (req, _res, next) => {
    req.actor =
      opts.deploymentMode === "local_trusted"
        ? { type: "board", userId: "local-board", isInstanceAdmin: true, source: "local_implicit" }
        : { type: "none", source: "none" };

    const runIdHeader = req.header("x-aidevelo-run-id");

    const authHeader = req.header("authorization");
    if (!authHeader?.toLowerCase().startsWith("bearer ")) {
      if (opts.deploymentMode === "authenticated" && opts.authAllowLocalImplicitBoard) {
        req.actor = {
          type: "board",
          userId: "local-board",
          isInstanceAdmin: true,
          runId: runIdHeader ?? undefined,
          source: "local_implicit",
        };
        next();
        return;
      }

      if (opts.deploymentMode === "authenticated" && opts.resolveSession) {
        let session: BetterAuthSessionResult | null = null;
        try {
          session = await opts.resolveSession(req);
        } catch (err) {
          logger.warn(
            { err, method: req.method, url: req.originalUrl },
            "Failed to resolve auth session from request headers",
          );
        }
        if (session?.user?.id) {
          const userId = session.user.id;
          const cachedActor = getCachedBoardActor(userId);
          let isInstanceAdmin: boolean;
          let companyIds: string[];
          if (cachedActor) {
            isInstanceAdmin = cachedActor.isInstanceAdmin;
            companyIds = cachedActor.companyIds;
          } else {
            const [roleRow, memberships] = await Promise.all([
              db
                .select({ id: instanceUserRoles.id })
                .from(instanceUserRoles)
                .where(and(eq(instanceUserRoles.userId, userId), eq(instanceUserRoles.role, "instance_admin")))
                .then((rows) => rows[0] ?? null),
              db
                .select({ companyId: companyMemberships.companyId })
                .from(companyMemberships)
                .where(
                  and(
                    eq(companyMemberships.principalType, "user"),
                    eq(companyMemberships.principalId, userId),
                    eq(companyMemberships.status, "active"),
                  ),
                ),
            ]);
            isInstanceAdmin = Boolean(roleRow);
            companyIds = memberships.map((row) => row.companyId);
            setCachedBoardActor(userId, { isInstanceAdmin, companyIds });
          }
          req.actor = {
            type: "board",
            userId,
            companyIds,
            isInstanceAdmin,
            runId: runIdHeader ?? undefined,
            source: "session",
          };
          next();
          return;
        }
      }
      if (runIdHeader) req.actor.runId = runIdHeader;
      next();
      return;
    }

    const token = authHeader.slice("bearer ".length).trim();
    if (!token) {
      next();
      return;
    }

    const tokenHash = hashToken(token);

    // Check cache first, fall back to DB
    let cachedHit = getCachedApiKey(tokenHash);
    if (cachedHit === undefined) {
      const dbRow = await db
        .select({ id: agentApiKeys.id, agentId: agentApiKeys.agentId, companyId: agentApiKeys.companyId })
        .from(agentApiKeys)
        .where(and(eq(agentApiKeys.keyHash, tokenHash), isNull(agentApiKeys.revokedAt)))
        .then((rows) => rows[0] ?? null);
      setCachedApiKey(tokenHash, dbRow);
      cachedHit = dbRow;
    }
    const key = cachedHit;

    if (!key) {
      const claims = verifyLocalAgentJwt(token);
      if (!claims) {
        next();
        return;
      }

      const agentRecord = await db
        .select()
        .from(agents)
        .where(eq(agents.id, claims.sub))
        .then((rows) => rows[0] ?? null);

      if (!agentRecord || agentRecord.companyId !== claims.company_id) {
        next();
        return;
      }

      if (agentRecord.status === "terminated" || agentRecord.status === "pending_approval") {
        next();
        return;
      }

      req.actor = {
        type: "agent",
        agentId: claims.sub,
        companyId: claims.company_id,
        keyId: undefined,
        runId: runIdHeader || claims.run_id || undefined,
        source: "agent_jwt",
      };
      next();
      return;
    }

    // Fire-and-forget: don't block the request for a timestamp update
    db.update(agentApiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(agentApiKeys.id, key.id))
      .catch(() => {});

    const agentRecord = await db
      .select()
      .from(agents)
      .where(eq(agents.id, key.agentId))
      .then((rows) => rows[0] ?? null);

    if (!agentRecord || agentRecord.status === "terminated" || agentRecord.status === "pending_approval") {
      next();
      return;
    }

    req.actor = {
      type: "agent",
      agentId: key.agentId,
      companyId: key.companyId,
      keyId: key.id,
      runId: runIdHeader || undefined,
      source: "agent_key",
    };

    next();
  };
}

export function requireBoard(req: Express.Request) {
  return req.actor.type === "board";
}
