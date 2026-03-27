export const type = "claude_local";
export const label = "Claude Code (local)";

export const models = [
  { id: "claude-opus-4-6", label: "Claude Opus 4.6" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { id: "claude-haiku-4-6", label: "Claude Haiku 4.6" },
  { id: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
];

export const agentConfigurationDoc = `# claude_local agent configuration

Adapter: claude_local

Core fields:
- cwd (string, optional): default absolute working directory fallback for the agent process (created if missing when possible)
- instructionsFilePath (string, optional): absolute path to a markdown instructions file injected at runtime
- model (string, optional): Claude model id
- effort (string, optional): reasoning effort passed via --effort (low|medium|high)
- chrome (boolean, optional): pass --chrome when running Claude
- promptTemplate (string, optional): run prompt template
- maxTurnsPerRun (number, optional): max turns for one run
- dangerouslySkipPermissions (boolean, optional): pass --dangerously-skip-permissions to claude
- command (string, optional): defaults to "claude"
- extraArgs (string[], optional): additional CLI args
- env (object, optional): KEY=VALUE environment variables
- workspaceStrategy (object, optional): execution workspace strategy; currently supports { type: "git_worktree", baseRef?, branchTemplate?, worktreeParentDir? }
- workspaceRuntime (object, optional): workspace runtime service intents; local host-managed services are realized before Claude starts and exposed back via context/env

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds

Notes:
- When Aidevelo realizes a workspace/runtime for a run, it injects AIDEVELO_WORKSPACE_* and AIDEVELO_RUNTIME_* env vars for agent-side tooling.
- MiniMax token plan (Claude Code): set MINIMAX_API_KEY in the server env or adapter env; Aidevelo maps it to ANTHROPIC_BASE_URL + bearer tokens per https://platform.minimax.io/docs/token-plan/claude-code (also sets ANTHROPIC_API_KEY for Claude Code 2.x). Use MINIMAX_ANTHROPIC_BASE_URL (or AIDEVELO_MINIMAX_ANTHROPIC_BASE_URL) for China (\`https://api.minimaxi.com/anthropic\`). Anthropic subscription-style \`model\` ids (e.g. claude-sonnet-4-6) are replaced with MiniMax-M2.7 (or ANTHROPIC_MODEL) for the CLI when this path is active. Set AIDEVELO_SKIP_MINIMAX_CLAUDE=true to skip this mapping.
`;
