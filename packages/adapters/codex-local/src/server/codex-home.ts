import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AdapterExecutionContext } from "@aideveloai/adapter-utils";

const TRUTHY_ENV_RE = /^(1|true|yes|on)$/i;
const COPIED_SHARED_FILES = ["config.json", "config.toml", "instructions.md"] as const;
const SYMLINKED_SHARED_FILES = ["auth.json"] as const;
const DEFAULT_AIDEVELO_INSTANCE_ID = "default";
const MANAGED_PROVIDER_BLOCK_START = "# aidevelo-managed-provider:start";
const MANAGED_PROVIDER_BLOCK_END = "# aidevelo-managed-provider:end";
const DEFAULT_MINIMAX_BASE_URL = "https://api.minimax.io/v1";
const DEFAULT_MINIMAX_MODEL = "codex-MiniMax-M2.7";
const DEFAULT_MANAGED_CODEX_PROFILE = "aidevelo_managed";

function nonEmpty(value: string | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asNonEmptyConfigString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function escapeTomlString(value: string): string {
  return JSON.stringify(value);
}

function removeManagedProviderBlock(input: string): string {
  const start = input.indexOf(MANAGED_PROVIDER_BLOCK_START);
  if (start < 0) return input;
  const end = input.indexOf(MANAGED_PROVIDER_BLOCK_END, start);
  if (end < 0) return input.slice(0, start).trimEnd();
  return `${input.slice(0, start).trimEnd()}\n${input.slice(end + MANAGED_PROVIDER_BLOCK_END.length).trimStart()}`.trim();
}

export type ManagedCodexProviderConfig = {
  providerId: string;
  providerLabel: string;
  profileId: string;
  baseUrl: string;
  envKey: string;
  model: string | null;
  wireApi: "chat" | "responses";
  requiresOpenAiAuth: boolean;
  requestMaxRetries?: number;
  streamMaxRetries?: number;
  streamIdleTimeoutMs?: number;
};

function renderManagedProviderBlock(config: ManagedCodexProviderConfig): string {
  const lines = [
    MANAGED_PROVIDER_BLOCK_START,
    `[model_providers.${config.providerId}]`,
    `name = ${escapeTomlString(config.providerLabel)}`,
    `base_url = ${escapeTomlString(config.baseUrl)}`,
    `env_key = ${escapeTomlString(config.envKey)}`,
    `wire_api = ${escapeTomlString(config.wireApi)}`,
    `requires_openai_auth = ${config.requiresOpenAiAuth ? "true" : "false"}`,
    ...(typeof config.requestMaxRetries === "number"
      ? [`request_max_retries = ${config.requestMaxRetries}`]
      : []),
    ...(typeof config.streamMaxRetries === "number"
      ? [`stream_max_retries = ${config.streamMaxRetries}`]
      : []),
    ...(typeof config.streamIdleTimeoutMs === "number"
      ? [`stream_idle_timeout_ms = ${config.streamIdleTimeoutMs}`]
      : []),
    "",
    `[profiles.${config.profileId}]`,
    `model_provider = ${escapeTomlString(config.providerId)}`,
    ...(config.model ? [`model = ${escapeTomlString(config.model)}`] : []),
    MANAGED_PROVIDER_BLOCK_END,
  ];
  return `${lines.join("\n")}\n`;
}

function mergeManagedProviderBlock(
  existing: string,
  providerConfig: ManagedCodexProviderConfig,
): string {
  const stripped = removeManagedProviderBlock(existing);
  const block = renderManagedProviderBlock(providerConfig).trim();
  return `${stripped.trim()}\n\n${block}\n`.trimStart();
}

export function resolveManagedCodexProviderConfig(
  config: Record<string, unknown>,
  env: Record<string, string>,
): ManagedCodexProviderConfig | null {
  const configuredProvider =
    asRecord(config.codexProvider) ??
    asRecord(config.openAiCompatibleProvider);
  if (configuredProvider) {
    const providerId = asNonEmptyConfigString(configuredProvider.providerId);
    const providerLabel = asNonEmptyConfigString(configuredProvider.providerLabel);
    const profileId = asNonEmptyConfigString(configuredProvider.profileId);
    const baseUrl = asNonEmptyConfigString(configuredProvider.baseUrl);
    const envKey = asNonEmptyConfigString(configuredProvider.envKey);
    const model =
      asNonEmptyConfigString(configuredProvider.model) ??
      asNonEmptyConfigString(config.model);
    const wireApi = asNonEmptyConfigString(configuredProvider.wireApi);

    if (providerId && providerLabel && profileId && baseUrl && envKey) {
      return {
        providerId,
        providerLabel,
        profileId,
        baseUrl,
        envKey,
        model,
        wireApi: wireApi === "chat" ? "chat" : "responses",
        requiresOpenAiAuth: configuredProvider.requiresOpenAiAuth === true,
        ...(typeof configuredProvider.requestMaxRetries === "number"
          ? { requestMaxRetries: configuredProvider.requestMaxRetries }
          : {}),
        ...(typeof configuredProvider.streamMaxRetries === "number"
          ? { streamMaxRetries: configuredProvider.streamMaxRetries }
          : {}),
        ...(typeof configuredProvider.streamIdleTimeoutMs === "number"
          ? { streamIdleTimeoutMs: configuredProvider.streamIdleTimeoutMs }
          : {}),
      };
    }
  }

  if (nonEmpty(env.MINIMAX_API_KEY)) {
    return {
      providerId: "minimax",
      providerLabel: "MiniMax",
      profileId: DEFAULT_MANAGED_CODEX_PROFILE,
      baseUrl: DEFAULT_MINIMAX_BASE_URL,
      envKey: "MINIMAX_API_KEY",
      model: asNonEmptyConfigString(config.model) ?? DEFAULT_MINIMAX_MODEL,
      wireApi: "chat",
      requiresOpenAiAuth: false,
      requestMaxRetries: 4,
      streamMaxRetries: 10,
      streamIdleTimeoutMs: 300000,
    };
  }

  return null;
}

export async function syncManagedCodexProviderConfig(
  codexHome: string,
  providerConfig: ManagedCodexProviderConfig | null,
): Promise<void> {
  const configPath = path.join(codexHome, "config.toml");
  const existing = await fs.readFile(configPath, "utf8").catch(() => "");
  const next = providerConfig
    ? mergeManagedProviderBlock(existing, providerConfig)
    : removeManagedProviderBlock(existing).trim();

  if (!providerConfig && !existing) return;

  const normalizedNext = next ? `${next.trim()}\n` : "";
  if (normalizedNext === existing) return;

  await ensureParentDir(configPath);
  if (!normalizedNext) {
    await fs.rm(configPath, { force: true });
    return;
  }
  await fs.writeFile(configPath, normalizedNext, "utf8");
}

export async function pathExists(candidate: string): Promise<boolean> {
  return fs.access(candidate).then(() => true).catch(() => false);
}

export function resolveSharedCodexHomeDir(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const fromEnv = nonEmpty(env.CODEX_HOME);
  return fromEnv ? path.resolve(fromEnv) : path.join(os.homedir(), ".codex");
}

function isWorktreeMode(env: NodeJS.ProcessEnv): boolean {
  return TRUTHY_ENV_RE.test(env.AIDEVELO_IN_WORKTREE ?? "");
}

export function resolveManagedCodexHomeDir(
  env: NodeJS.ProcessEnv,
  companyId?: string,
): string {
  const aideveloHome = nonEmpty(env.AIDEVELO_HOME) ?? path.resolve(os.homedir(), ".aidevelo");
  const instanceId = nonEmpty(env.AIDEVELO_INSTANCE_ID) ?? DEFAULT_AIDEVELO_INSTANCE_ID;
  return companyId
    ? path.resolve(aideveloHome, "instances", instanceId, "companies", companyId, "codex-home")
    : path.resolve(aideveloHome, "instances", instanceId, "codex-home");
}

async function ensureParentDir(target: string): Promise<void> {
  await fs.mkdir(path.dirname(target), { recursive: true });
}

async function ensureSymlink(target: string, source: string): Promise<void> {
  const existing = await fs.lstat(target).catch(() => null);
  if (!existing) {
    await ensureParentDir(target);
    await fs.symlink(source, target);
    return;
  }

  if (!existing.isSymbolicLink()) {
    return;
  }

  const linkedPath = await fs.readlink(target).catch(() => null);
  if (!linkedPath) return;

  const resolvedLinkedPath = path.resolve(path.dirname(target), linkedPath);
  if (resolvedLinkedPath === source) return;

  await fs.unlink(target);
  await fs.symlink(source, target);
}

async function ensureCopiedFile(target: string, source: string): Promise<void> {
  const existing = await fs.lstat(target).catch(() => null);
  if (existing) return;
  await ensureParentDir(target);
  await fs.copyFile(source, target);
}

export async function prepareManagedCodexHome(
  env: NodeJS.ProcessEnv,
  onLog: AdapterExecutionContext["onLog"],
  companyId?: string,
): Promise<string> {
  const targetHome = resolveManagedCodexHomeDir(env, companyId);

  const sourceHome = resolveSharedCodexHomeDir(env);
  if (path.resolve(sourceHome) === path.resolve(targetHome)) return targetHome;

  await fs.mkdir(targetHome, { recursive: true });

  for (const name of SYMLINKED_SHARED_FILES) {
    const source = path.join(sourceHome, name);
    if (!(await pathExists(source))) continue;
    await ensureSymlink(path.join(targetHome, name), source);
  }

  for (const name of COPIED_SHARED_FILES) {
    const source = path.join(sourceHome, name);
    if (!(await pathExists(source))) continue;
    await ensureCopiedFile(path.join(targetHome, name), source);
  }

  await onLog(
    "stdout",
    `[aidevelo] Using ${isWorktreeMode(env) ? "worktree-isolated" : "Aidevelo-managed"} Codex home "${targetHome}" (seeded from "${sourceHome}").\n`,
  );
  return targetHome;
}
