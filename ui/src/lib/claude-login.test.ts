import { describe, expect, it } from "vitest";
import { supportsClaudeLoginAdapter } from "./claude-login";

describe("supportsClaudeLoginAdapter", () => {
  it("allows claude_local and managed_service adapters", () => {
    expect(supportsClaudeLoginAdapter("claude_local")).toBe(true);
    expect(supportsClaudeLoginAdapter("managed_service")).toBe(true);
  });

  it("rejects non-Claude adapters", () => {
    expect(supportsClaudeLoginAdapter("codex_local")).toBe(false);
    expect(supportsClaudeLoginAdapter("openclaw_gateway")).toBe(false);
    expect(supportsClaudeLoginAdapter(null)).toBe(false);
  });
});
