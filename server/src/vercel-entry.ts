// Vercel serverless entrypoint for the Express API.
// Used by vercel.json's services.api.entrypoint.
// On Vercel, long-running services (heartbeat scheduler, plugin workers, etc.)
// are replaced by Vercel Cron routes and per-invocation stateless execution.
import { createServer } from "node:http";
import { createApp } from "./app.js";
import { createDb } from "@aideveloai/db";
import { loadConfig } from "./config.js";
import { createStorageServiceFromConfig } from "./storage/index.js";
import { logger } from "./middleware/logger.js";
import { cronDispatchRoutes } from "./routes/worker/cron-dispatch.js";
import { cronHeartbeatTickRoutes } from "./routes/worker/cron-heartbeat-tick.js";
import { cronUnifiedRoutes } from "./routes/worker/cron-unified.js";

const isVercel = process.env.VERCEL === "true" || process.env.VERCEL === "1";

// Guard: skip all process-long services on Vercel serverless
if (!isVercel) {
  throw new Error(
    "vercel-entry.ts is designed for Vercel serverless execution. " +
    "Use server/src/index.ts for local/Render deployments.",
  );
}

const config = loadConfig();

if (process.env.AIDEVELO_SECRETS_PROVIDER === undefined) {
  process.env.AIDEVELO_SECRETS_PROVIDER = config.secretsProvider;
}
if (process.env.AIDEVELO_SECRETS_STRICT_MODE === undefined) {
  process.env.AIDEVELO_SECRETS_STRICT_MODE = config.secretsStrictMode ? "true" : "false";
}
if (process.env.AIDEVELO_SECRETS_MASTER_KEY_FILE === undefined) {
  process.env.AIDEVELO_SECRETS_MASTER_KEY_FILE = config.secretsMasterKeyFilePath;
}

if (!config.databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required on Vercel");
}

const db = createDb(config.databaseUrl);
const storageService = createStorageServiceFromConfig(config);

async function buildApp() {
  let authReady = config.deploymentMode === "local_trusted";
  let betterAuthHandler: any;
  let resolveSession: any;
  let resolveSessionFromHeaders: any;

  if (config.deploymentMode === "authenticated") {
    const {
      createBetterAuthInstance,
      deriveAuthTrustedOrigins,
      resolveBetterAuthSession,
      resolveBetterAuthSessionFromHeaders: rsFromHeaders,
    } = await import("./auth/better-auth.js");

    const betterAuthSecret =
      process.env.BETTER_AUTH_SECRET?.trim() ?? process.env.AIDEVELO_AGENT_JWT_SECRET?.trim();

    if (!betterAuthSecret) {
      throw new Error("BETTER_AUTH_SECRET (or AIDEVELO_AGENT_JWT_SECRET) is required on Vercel");
    }

    const derivedTrustedOrigins = deriveAuthTrustedOrigins(config);
    const envTrustedOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    const effectiveTrustedOrigins = Array.from(new Set([...derivedTrustedOrigins, ...envTrustedOrigins]));

    const auth = createBetterAuthInstance(db, config, effectiveTrustedOrigins);
    resolveSession = (req: any) => resolveBetterAuthSession(auth, req);
    resolveSessionFromHeaders = (headers: Headers) => rsFromHeaders(auth, headers);

    await import("./board-claim.js").then(({ initializeBoardClaimChallenge }) =>
      initializeBoardClaimChallenge(db, { deploymentMode: config.deploymentMode }),
    );

    authReady = true;
  }

  const app = await createApp(db, {
    uiMode: "none",
    serverPort: config.port,
    storageService,
    deploymentMode: config.deploymentMode,
    deploymentExposure: config.deploymentExposure,
    authAllowLocalImplicitBoard: config.authAllowLocalImplicitBoard,
    allowedHostnames: config.allowedHostnames,
    bindHost: config.host,
    authReady,
    companyDeletionEnabled: config.companyDeletionEnabled,
    betterAuthHandler,
    resolveSession,
  });

  // Mount Vercel Cron routes under /api/worker/
  // vercel.json routes these based on path, but we also mount here for local testing
  const workerApi = cronDispatchRoutes(db);
  const heartbeatApi = cronHeartbeatTickRoutes(db);
  const unifiedApi = cronUnifiedRoutes();
  app.use("/api/worker", workerApi);
  app.use("/api/worker", heartbeatApi);
  app.use("/api/worker", unifiedApi);

  return app;
}

// Cache the built app across warm invocations
let appPromise: ReturnType<typeof buildApp> | null = null;
let cachedApp: any = null;

async function getApp() {
  if (cachedApp) return cachedApp;
  if (!appPromise) appPromise = buildApp();
  cachedApp = await appPromise;
  return cachedApp;
}

export default async function handler(req: any, res: any) {
  try {
    const app = await getApp();
    const server = createServer(app as any);

    await new Promise<void>((resolve, reject) => {
      server.emit("request", req, res);
      res.on("finish", () => server.close());
      server.on("close", resolve);
      server.on("error", reject);
    });
  } catch (err) {
    logger.error({ err }, "Vercel handler error");
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  }
}
