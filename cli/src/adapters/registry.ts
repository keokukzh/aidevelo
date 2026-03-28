import type { CLIAdapterModule } from "@aideveloai/adapter-utils";
import { printClaudeStreamEvent } from "@aideveloai/adapter-claude-local/cli";
import { printCodexStreamEvent } from "@aideveloai/adapter-codex-local/cli";
import { printCursorStreamEvent } from "@aideveloai/adapter-cursor-local/cli";
import { printGeminiStreamEvent } from "@aideveloai/adapter-gemini-local/cli";
import { printOpenCodeStreamEvent } from "@aideveloai/adapter-opencode-local/cli";
import { printPiStreamEvent } from "@aideveloai/adapter-pi-local/cli";
import { printAideveloGatewayStreamEvent } from "@aideveloai/adapter-aidevelo-gateway/cli";
import { processCLIAdapter } from "./process/index.js";
import { httpCLIAdapter } from "./http/index.js";

const claudeLocalCLIAdapter: CLIAdapterModule = {
  type: "claude_local",
  formatStdoutEvent: printClaudeStreamEvent,
};

const codexLocalCLIAdapter: CLIAdapterModule = {
  type: "codex_local",
  formatStdoutEvent: printCodexStreamEvent,
};

const openCodeLocalCLIAdapter: CLIAdapterModule = {
  type: "opencode_local",
  formatStdoutEvent: printOpenCodeStreamEvent,
};

const piLocalCLIAdapter: CLIAdapterModule = {
  type: "pi_local",
  formatStdoutEvent: printPiStreamEvent,
};

const cursorLocalCLIAdapter: CLIAdapterModule = {
  type: "cursor",
  formatStdoutEvent: printCursorStreamEvent,
};

const geminiLocalCLIAdapter: CLIAdapterModule = {
  type: "gemini_local",
  formatStdoutEvent: printGeminiStreamEvent,
};

const aideveloGatewayCLIAdapter: CLIAdapterModule = {
  type: "aidevelo_gateway",
  formatStdoutEvent: printAideveloGatewayStreamEvent,
};

const adaptersByType = new Map<string, CLIAdapterModule>(
  [
    claudeLocalCLIAdapter,
    codexLocalCLIAdapter,
    openCodeLocalCLIAdapter,
    piLocalCLIAdapter,
    cursorLocalCLIAdapter,
    geminiLocalCLIAdapter,
    aideveloGatewayCLIAdapter,
    processCLIAdapter,
    httpCLIAdapter,
  ].map((a) => [a.type, a]),
);

export function getCLIAdapter(type: string): CLIAdapterModule {
  return adaptersByType.get(type) ?? processCLIAdapter;
}
