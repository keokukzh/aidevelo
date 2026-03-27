import type { Db } from "@aideveloai/db";
import type {
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
  AdapterExecutionContext,
  AdapterExecutionResult,
  ServerAdapterModule,
} from "../types.js";
import { getAdapterSessionManagement } from "@aideveloai/adapter-utils";
import {
  execute as claudeExecute,
  listClaudeSkills,
  syncClaudeSkills,
  testEnvironment as claudeTestEnvironment,
  sessionCodec as claudeSessionCodec,
  getQuotaWindows as claudeGetQuotaWindows,
} from "@aideveloai/adapter-claude-local/server";
import { models as claudeModels } from "@aideveloai/adapter-claude-local";
import {
  execute as codexExecute,
  listCodexSkills,
  syncCodexSkills,
  testEnvironment as codexTestEnvironment,
  sessionCodec as codexSessionCodec,
  getQuotaWindows as codexGetQuotaWindows,
} from "@aideveloai/adapter-codex-local/server";
import { models as codexModels } from "@aideveloai/adapter-codex-local";
import { classifyTask } from "../../services/task-classifier.js";
import { createModelRouter, isProviderError } from "../../services/model-router.js";
import type { ModelId } from "../../services/model-router.js";

const MANAGED_CLAUDE_DELEGATE_ADAPTER = "claude_local";
const MANAGED_CODEX_DELEGATE_ADAPTER = "codex_local";

// Singleton model router keyed by db instance
const modelRouters = new WeakMap<Db, ReturnType<typeof createModelRouter>>();

function getOrCreateModelRouter(db: Db) {
  let router = modelRouters.get(db);
  if (!router) {
    router = createModelRouter(db);
    modelRouters.set(db, router);
  }
  return router;
}

/**
 * With MINIMAX_API_KEY, default to Claude Code + MiniMax Anthropic-compatible API (token plan).
 * Set AIDEVELO_MINIMAX_DELEGATE=codex to use the OpenAI Codex CLI against MiniMax instead.
 */
function resolveManagedMinimaxDelegateAdapter(): string {
  const raw = process.env.AIDEVELO_MINIMAX_DELEGATE?.trim().toLowerCase();
  if (raw === MANAGED_CODEX_DELEGATE_ADAPTER || raw === "codex") {
    return MANAGED_CODEX_DELEGATE_ADAPTER;
  }
  return MANAGED_CLAUDE_DELEGATE_ADAPTER;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return { ...(value as Record<string, unknown>) };
}

function resolveManagedDelegateAdapter(config: Record<string, unknown>) {
  const explicit = typeof config.localDelegateAdapter === "string" ? config.localDelegateAdapter.trim() : "";
  if (explicit === MANAGED_CODEX_DELEGATE_ADAPTER || explicit === MANAGED_CLAUDE_DELEGATE_ADAPTER) {
    return explicit;
  }

  const instanceMinimax =
    typeof process.env.MINIMAX_API_KEY === "string" && process.env.MINIMAX_API_KEY.trim().length > 0;
  if (instanceMinimax) {
    return resolveManagedMinimaxDelegateAdapter();
  }

  const env = toRecord(config.env);
  if (typeof env.MINIMAX_API_KEY === "string" && env.MINIMAX_API_KEY.trim().length > 0) {
    return resolveManagedMinimaxDelegateAdapter();
  }

  const primaryProvider = typeof config.primaryProvider === "string" ? config.primaryProvider.trim().toLowerCase() : "";
  const fallbackProvider = typeof config.fallbackProvider === "string" ? config.fallbackProvider.trim().toLowerCase() : "";
  if (primaryProvider === "minimax" || fallbackProvider === "minimax") {
    return resolveManagedMinimaxDelegateAdapter();
  }

  const codexProvider = toRecord(config.codexProvider);
  if (typeof codexProvider.providerId === "string" && codexProvider.providerId.trim().toLowerCase() === "minimax") {
    return MANAGED_CODEX_DELEGATE_ADAPTER;
  }

  return MANAGED_CLAUDE_DELEGATE_ADAPTER;
}

function buildDelegateConfig(config: Record<string, unknown>, delegateAdapter: string) {
  const next = toRecord(config);
  const workspaceStrategy = toRecord(next.workspaceStrategy);

  const minimaxKey = typeof process.env.MINIMAX_API_KEY === "string" ? process.env.MINIMAX_API_KEY.trim() : "";
  const minimaxAnthropicBase =
    (typeof process.env.MINIMAX_ANTHROPIC_BASE_URL === "string" && process.env.MINIMAX_ANTHROPIC_BASE_URL.trim()) ||
    (typeof process.env.AIDEVELO_MINIMAX_ANTHROPIC_BASE_URL === "string" &&
      process.env.AIDEVELO_MINIMAX_ANTHROPIC_BASE_URL.trim()) ||
    "";
  if (minimaxKey || minimaxAnthropicBase) {
    const env = toRecord(next.env);
    const merged: Record<string, unknown> = { ...env };
    if (minimaxKey && !(typeof merged.MINIMAX_API_KEY === "string" && merged.MINIMAX_API_KEY.trim().length > 0)) {
      merged.MINIMAX_API_KEY = minimaxKey;
    }
    if (
      minimaxAnthropicBase &&
      !(typeof merged.MINIMAX_ANTHROPIC_BASE_URL === "string" && merged.MINIMAX_ANTHROPIC_BASE_URL.trim().length > 0)
    ) {
      merged.MINIMAX_ANTHROPIC_BASE_URL = minimaxAnthropicBase;
    }
    next.env = merged;
  }

  if (typeof next.command !== "string" || next.command.trim().length === 0) {
    next.command = delegateAdapter === MANAGED_CODEX_DELEGATE_ADAPTER ? "codex" : "claude";
  }
  if (delegateAdapter === MANAGED_CODEX_DELEGATE_ADAPTER) {
    if (typeof next.dangerouslyBypassApprovalsAndSandbox !== "boolean") {
      next.dangerouslyBypassApprovalsAndSandbox = true;
    }
    const existingExtraArgs = Array.isArray(next.extraArgs)
      ? next.extraArgs.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : [];
    if (!existingExtraArgs.includes("--skip-git-repo-check")) {
      next.extraArgs = ["--skip-git-repo-check", ...existingExtraArgs];
    }
  } else if (typeof next.dangerouslySkipPermissions !== "boolean") {
    next.dangerouslySkipPermissions = true;
  }
  if (typeof workspaceStrategy.type !== "string") {
    workspaceStrategy.type = "project_primary";
  }

  next.workspaceStrategy = workspaceStrategy;
  next.managedService = {
    routingMode:
      typeof next.routingMode === "string" ? next.routingMode : "primary_with_fallback",
    providerStrategy:
      typeof next.providerStrategy === "string"
        ? next.providerStrategy
        : "company_managed",
    primaryProvider:
      typeof next.primaryProvider === "string" ? next.primaryProvider : "main_api",
    fallbackProvider:
      typeof next.fallbackProvider === "string" ? next.fallbackProvider : "fallback_api",
    modelSelection:
      typeof next.modelSelection === "string" ? next.modelSelection : "managed",
    localDelegateAdapter: delegateAdapter,
  };

  return next;
}

function injectModelOverride(config: Record<string, unknown>, modelId: ModelId) {
  const env = toRecord(config.env);
  env["AIDEVELO_MODEL_OVERRIDE"] = modelId;
  config.env = env;
}

async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const db = ctx.config.db as Db | undefined;
  if (!db) {
    // Fallback: direct execution without routing
    const delegateAdapter = resolveManagedDelegateAdapter(ctx.config);
    const delegateConfig = buildDelegateConfig(ctx.config, delegateAdapter);
    const executor = delegateAdapter === MANAGED_CODEX_DELEGATE_ADAPTER ? codexExecute : claudeExecute;
    const result = await executor({ ...ctx, config: delegateConfig });
    return {
      ...result,
      provider: result.provider ?? "managed_service",
      summary: result.summary ?? "Managed service routed execution through the local company-managed runtime.",
    };
  }

  const router = getOrCreateModelRouter(db);
  const complexity = classifyTask(ctx);

  let selectedModel = await router.selectModel(complexity, ctx.agent.companyId);

  for (let attempt = 0; attempt < 3; attempt++) {
    if (!selectedModel) break;

    const delegateAdapter = resolveManagedDelegateAdapter(ctx.config);
    const delegateConfig = buildDelegateConfig(ctx.config, delegateAdapter);
    injectModelOverride(delegateConfig, selectedModel.id);

    const executor = delegateAdapter === MANAGED_CODEX_DELEGATE_ADAPTER ? codexExecute : claudeExecute;

    try {
      const result = await executor({ ...ctx, config: delegateConfig });

      if (isProviderError(result)) {
        router.recordFailure(selectedModel.id, result.errorMessage ?? result);
        const nextTier = router.getNextTier(selectedModel.id);
        selectedModel = nextTier ? { id: nextTier, complexity } : null;
        continue;
      }

      router.recordSuccess(selectedModel.id);
      return {
        ...result,
        provider: result.provider ?? "managed_service",
        model: selectedModel.id,
        summary: result.summary ?? "Managed service routed execution through the local company-managed runtime.",
      };
    } catch (error) {
      // selectedModel is guaranteed non-null here (checked at loop start)
      router.recordFailure(selectedModel!.id, error);
      const nextTier = router.getNextTier(selectedModel!.id);
      selectedModel = nextTier ? { id: nextTier, complexity } : null;
    }
  }

  return {
    exitCode: null,
    signal: null,
    timedOut: false,
    errorMessage: "All model tiers exhausted",
    provider: "managed_service",
  };
}

async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const delegateAdapter = resolveManagedDelegateAdapter(ctx.config);
  const delegateConfig = buildDelegateConfig(ctx.config, delegateAdapter);
  const tester = delegateAdapter === MANAGED_CODEX_DELEGATE_ADAPTER ? codexTestEnvironment : claudeTestEnvironment;
  const result = await tester({
    ...ctx,
    config: delegateConfig,
  });

  return {
    ...result,
    adapterType: "managed_service",
    checks: [
      {
        code: "managed_service_local_delegate",
        level: "info",
        message:
          delegateAdapter === MANAGED_CODEX_DELEGATE_ADAPTER
            ? "Managed service routes local execution through the built-in Codex runtime in this deployment."
            : "Managed service routes local execution through the built-in Claude runtime in this deployment.",
        hint:
          delegateAdapter === MANAGED_CODEX_DELEGATE_ADAPTER
            ? "Aidevelo keeps provider routing managed while reusing the local Codex adapter for execution."
            : "Aidevelo keeps provider routing managed while reusing the local Claude adapter for execution.",
      },
      ...result.checks,
    ],
  };
}

async function listSkills(ctx: Parameters<NonNullable<ServerAdapterModule["listSkills"]>>[0]) {
  const delegateAdapter = resolveManagedDelegateAdapter(ctx.config);
  const delegateConfig = buildDelegateConfig(ctx.config, delegateAdapter);
  if (delegateAdapter === MANAGED_CODEX_DELEGATE_ADAPTER) {
    return listCodexSkills({ ...ctx, config: delegateConfig });
  }
  return listClaudeSkills({ ...ctx, config: delegateConfig });
}

async function syncSkills(
  ctx: Parameters<NonNullable<ServerAdapterModule["syncSkills"]>>[0],
  desiredSkills: string[],
) {
  const delegateAdapter = resolveManagedDelegateAdapter(ctx.config);
  const delegateConfig = buildDelegateConfig(ctx.config, delegateAdapter);
  if (delegateAdapter === MANAGED_CODEX_DELEGATE_ADAPTER) {
    return syncCodexSkills({ ...ctx, config: delegateConfig }, desiredSkills);
  }
  return syncClaudeSkills({ ...ctx, config: delegateConfig }, desiredSkills);
}

export const managedServiceAdapter: ServerAdapterModule = {
  type: "managed_service",
  execute,
  testEnvironment,
  listSkills,
  syncSkills,
  sessionCodec: {
    deserialize(raw) {
      return codexSessionCodec.deserialize(raw) ?? claudeSessionCodec.deserialize(raw);
    },
    serialize(params) {
      return codexSessionCodec.serialize(params) ?? claudeSessionCodec.serialize(params);
    },
    getDisplayId(params) {
      return codexSessionCodec.getDisplayId?.(params) ?? claudeSessionCodec.getDisplayId?.(params) ?? null;
    },
  },
  sessionManagement: getAdapterSessionManagement(MANAGED_CLAUDE_DELEGATE_ADAPTER) ?? undefined,
  models: [...claudeModels, ...codexModels],
  supportsLocalAgentJwt: true,
  agentConfigurationDoc: `# managed_service agent configuration

Adapter: managed_service

Use when:
- This company runs on Aidevelo-managed inference routing
- The operator should not configure provider-specific runtime details per agent

Do not use when:
- The company expects direct local CLI adapter control
- The deployment is self-hosted and adapter-specific runtime configuration is required

Core fields:
- routingMode (string, optional): managed routing policy, defaults to primary_with_fallback
- providerStrategy (string, optional): strategy label for server-managed provider selection
- primaryProvider (string, optional): logical primary provider identifier
- fallbackProvider (string, optional): logical fallback provider identifier
- modelSelection (string, optional): managed model selection policy
- localDelegateAdapter (string, optional): server-selected runtime override; supports claude_local or codex_local
- codexProvider (object, optional): openai-compatible Codex provider config; when providerId is minimax, execution uses codex_local
- env (object, optional): runtime env bindings; use secret refs for provider keys such as MINIMAX_API_KEY

Execution notes:
- In local/private deployments, managed_service delegates execution to the built-in Claude or Codex local runtime.
- When MINIMAX_API_KEY is set (Docker or agent env), the default delegate is claude_local: Claude Code uses MiniMax's Anthropic-compatible token plan (ANTHROPIC_BASE_URL / ANTHROPIC_AUTH_TOKEN). Set AIDEVELO_MINIMAX_DELEGATE=codex to force the Codex CLI + MiniMax OpenAI-compatible path instead.
- The operator still configures the company at the managed-service level; provider/runtime wiring remains server-controlled.
`,
  getQuotaWindows: async () => {
    const codex = await codexGetQuotaWindows().catch(() => null);
    if (codex?.ok) return codex;
    return claudeGetQuotaWindows();
  },
};
