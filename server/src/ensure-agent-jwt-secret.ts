import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { resolveAideveloEnvPath } from "./paths.js";

const JWT_SECRET_ENV_KEY = "AIDEVELO_AGENT_JWT_SECRET";

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function readSecretFromEnvFile(envFilePath: string): string | null {
  if (!fs.existsSync(envFilePath)) return null;

  const contents = fs.readFileSync(envFilePath, "utf-8");
  const match = contents.match(new RegExp(`^${JWT_SECRET_ENV_KEY}=([^\\r\\n]*)$`, "m"));
  if (!match) return null;

  const raw = match[1] ?? "";
  const secret = stripQuotes(raw);
  return secret.length > 0 ? secret : null;
}

function upsertSecretInEnvFile(envFilePath: string, secret: string) {
  const dir = path.dirname(envFilePath);
  fs.mkdirSync(dir, { recursive: true });

  const existing = fs.existsSync(envFilePath) ? fs.readFileSync(envFilePath, "utf-8") : "";
  const next = (() => {
    const secretLine = `${JWT_SECRET_ENV_KEY}=${secret}`;
    const keyRe = new RegExp(`^${JWT_SECRET_ENV_KEY}=([^\\r\\n]*)$`, "m");
    if (keyRe.test(existing)) {
      return existing.replace(keyRe, secretLine);
    }
    const needsLeadingNewline = existing.length > 0 && !existing.endsWith("\n");
    return `${existing}${needsLeadingNewline ? "\n" : ""}${secretLine}\n`;
  })();

  fs.writeFileSync(envFilePath, next, "utf-8");
}

export async function ensureAgentJwtSecret(
  configPath?: string,
): Promise<{ secret: string; created: boolean }> {
  const existingEnv = process.env[JWT_SECRET_ENV_KEY]?.trim();
  if (existingEnv) {
    return { secret: existingEnv, created: false };
  }

  const envFilePath = resolveAideveloEnvPath(configPath);
  const existingFile = readSecretFromEnvFile(envFilePath);
  if (existingFile) {
    process.env[JWT_SECRET_ENV_KEY] = existingFile;
    return { secret: existingFile, created: false };
  }

  const secret = randomBytes(32).toString("hex");
  upsertSecretInEnvFile(envFilePath, secret);
  process.env[JWT_SECRET_ENV_KEY] = secret;
  return { secret, created: true };
}

