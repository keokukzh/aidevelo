---
title: Environment Variables
summary: Full environment variable reference
---

All environment variables that Aidevelo uses for server configuration.

## Server Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3100` | Server port |
| `HOST` | `127.0.0.1` | Server host binding |
| `DATABASE_URL` | (embedded) | PostgreSQL connection string |
| `AIDEVELO_HOME` | `~/.aidevelo` | Base directory for all Aidevelo data |
| `AIDEVELO_INSTANCE_ID` | `default` | Instance identifier (for multiple local instances) |
| `AIDEVELO_DEPLOYMENT_MODE` | `local_trusted` | Runtime mode override |

## Secrets

| Variable | Default | Description |
|----------|---------|-------------|
| `AIDEVELO_SECRETS_MASTER_KEY` | (from file) | 32-byte encryption key (base64/hex/raw) |
| `AIDEVELO_SECRETS_MASTER_KEY_FILE` | `~/.aidevelo/.../secrets/master.key` | Path to key file |
| `AIDEVELO_SECRETS_STRICT_MODE` | `false` | Require secret refs for sensitive env vars |

## Agent Runtime (Injected into agent processes)

These are set automatically by the server when invoking agents:

| Variable | Description |
|----------|-------------|
| `AIDEVELO_AGENT_ID` | Agent's unique ID |
| `AIDEVELO_COMPANY_ID` | Company ID |
| `AIDEVELO_API_URL` | Aidevelo API base URL |
| `AIDEVELO_API_KEY` | Short-lived JWT for API auth |
| `AIDEVELO_RUN_ID` | Current heartbeat run ID |
| `AIDEVELO_TASK_ID` | Issue that triggered this wake |
| `AIDEVELO_WAKE_REASON` | Wake trigger reason |
| `AIDEVELO_WAKE_COMMENT_ID` | Comment that triggered this wake |
| `AIDEVELO_APPROVAL_ID` | Resolved approval ID |
| `AIDEVELO_APPROVAL_STATUS` | Approval decision |
| `AIDEVELO_LINKED_ISSUE_IDS` | Comma-separated linked issue IDs |

## LLM Provider Keys (for adapters)

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key (for Claude Local adapter) |
| `OPENAI_API_KEY` | OpenAI API key (for Codex Local adapter) |
