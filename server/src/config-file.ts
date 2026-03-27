import fs from "node:fs";
import { aideveloConfigSchema, type AideveloConfig } from "@aideveloai/shared";
import { resolveAideveloConfigPath } from "./paths.js";

export function readConfigFile(): AideveloConfig | null {
  const configPath = resolveAideveloConfigPath();

  if (!fs.existsSync(configPath)) return null;

  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return aideveloConfigSchema.parse(raw);
  } catch {
    return null;
  }
}
