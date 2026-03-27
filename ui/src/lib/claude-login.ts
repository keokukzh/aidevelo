import { CLAUDE_LOGIN_COMPATIBLE_ADAPTER_TYPES } from "@aideveloai/shared";

const CLAUDE_LOGIN_COMPATIBLE_ADAPTER_TYPE_SET = new Set<string>(
  CLAUDE_LOGIN_COMPATIBLE_ADAPTER_TYPES,
);

export function supportsClaudeLoginAdapter(adapterType: string | null | undefined) {
  return typeof adapterType === "string" && CLAUDE_LOGIN_COMPATIBLE_ADAPTER_TYPE_SET.has(adapterType);
}
