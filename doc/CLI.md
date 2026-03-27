# CLI Reference

Aidevelo CLI now supports both:

- instance setup/diagnostics (`onboard`, `doctor`, `configure`, `env`, `allowed-hostname`)
- control-plane client operations (issues, approvals, agents, activity, dashboard)

## Base Usage

Use repo script in development:

```sh
pnpm aideveloai --help
```

First-time local bootstrap + run:

```sh
pnpm aideveloai run
```

Choose local instance:

```sh
pnpm aideveloai run --instance dev
```

## Deployment Modes

Mode taxonomy and design intent are documented in `doc/DEPLOYMENT-MODES.md`.

Current CLI behavior:

- `aideveloai onboard` and `aideveloai configure --section server` set deployment mode in config
- runtime can override mode with `AIDEVELO_DEPLOYMENT_MODE`
- `aideveloai run` and `aideveloai doctor` do not yet expose a direct `--mode` flag

Target behavior (planned) is documented in `doc/DEPLOYMENT-MODES.md` section 5.

Allow an authenticated/private hostname (for example custom Tailscale DNS):

```sh
pnpm aideveloai allowed-hostname dotta-macbook-pro
```

All client commands support:

- `--data-dir <path>`
- `--api-base <url>`
- `--api-key <token>`
- `--context <path>`
- `--profile <name>`
- `--json`

Company-scoped commands also support `--company-id <id>`.

Use `--data-dir` on any CLI command to isolate all default local state (config/context/db/logs/storage/secrets) away from `~/.aidevelo`:

```sh
pnpm aideveloai run --data-dir ./tmp/aidevelo-dev
pnpm aideveloai issue list --data-dir ./tmp/aidevelo-dev
```

## Context Profiles

Store local defaults in `~/.aidevelo/context.json`:

```sh
pnpm aideveloai context set --api-base http://localhost:3100 --company-id <company-id>
pnpm aideveloai context show
pnpm aideveloai context list
pnpm aideveloai context use default
```

To avoid storing secrets in context, set `apiKeyEnvVarName` and keep the key in env:

```sh
pnpm aideveloai context set --api-key-env-var-name AIDEVELO_API_KEY
export AIDEVELO_API_KEY=...
```

## Company Commands

```sh
pnpm aideveloai company list
pnpm aideveloai company get <company-id>
pnpm aideveloai company delete <company-id-or-prefix> --yes --confirm <same-id-or-prefix>
```

Examples:

```sh
pnpm aideveloai company delete PAP --yes --confirm PAP
pnpm aideveloai company delete 5cbe79ee-acb3-4597-896e-7662742593cd --yes --confirm 5cbe79ee-acb3-4597-896e-7662742593cd
```

Notes:

- Deletion is server-gated by `AIDEVELO_ENABLE_COMPANY_DELETION`.
- With agent authentication, company deletion is company-scoped. Use the current company ID/prefix (for example via `--company-id` or `AIDEVELO_COMPANY_ID`), not another company.

## Issue Commands

```sh
pnpm aideveloai issue list --company-id <company-id> [--status todo,in_progress] [--assignee-agent-id <agent-id>] [--match text]
pnpm aideveloai issue get <issue-id-or-identifier>
pnpm aideveloai issue create --company-id <company-id> --title "..." [--description "..."] [--status todo] [--priority high]
pnpm aideveloai issue update <issue-id> [--status in_progress] [--comment "..."]
pnpm aideveloai issue comment <issue-id> --body "..." [--reopen]
pnpm aideveloai issue checkout <issue-id> --agent-id <agent-id> [--expected-statuses todo,backlog,blocked]
pnpm aideveloai issue release <issue-id>
```

## Agent Commands

```sh
pnpm aideveloai agent list --company-id <company-id>
pnpm aideveloai agent get <agent-id>
pnpm aideveloai agent local-cli <agent-id-or-shortname> --company-id <company-id>
```

`agent local-cli` is the quickest way to run local Claude/Codex manually as a Aidevelo agent:

- creates a new long-lived agent API key
- installs missing Aidevelo skills into `~/.codex/skills` and `~/.claude/skills`
- prints `export ...` lines for `AIDEVELO_API_URL`, `AIDEVELO_COMPANY_ID`, `AIDEVELO_AGENT_ID`, and `AIDEVELO_API_KEY`

Example for shortname-based local setup:

```sh
pnpm aideveloai agent local-cli codexcoder --company-id <company-id>
pnpm aideveloai agent local-cli claudecoder --company-id <company-id>
```

## Approval Commands

```sh
pnpm aideveloai approval list --company-id <company-id> [--status pending]
pnpm aideveloai approval get <approval-id>
pnpm aideveloai approval create --company-id <company-id> --type hire_agent --payload '{"name":"..."}' [--issue-ids <id1,id2>]
pnpm aideveloai approval approve <approval-id> [--decision-note "..."]
pnpm aideveloai approval reject <approval-id> [--decision-note "..."]
pnpm aideveloai approval request-revision <approval-id> [--decision-note "..."]
pnpm aideveloai approval resubmit <approval-id> [--payload '{"...":"..."}']
pnpm aideveloai approval comment <approval-id> --body "..."
```

## Activity Commands

```sh
pnpm aideveloai activity list --company-id <company-id> [--agent-id <agent-id>] [--entity-type issue] [--entity-id <id>]
```

## Dashboard Commands

```sh
pnpm aideveloai dashboard get --company-id <company-id>
```

## Heartbeat Command

`heartbeat run` now also supports context/api-key options and uses the shared client stack:

```sh
pnpm aideveloai heartbeat run --agent-id <agent-id> [--api-base http://localhost:3100] [--api-key <token>]
```

## Local Storage Defaults

Default local instance root is `~/.aidevelo/instances/default`:

- config: `~/.aidevelo/instances/default/config.json`
- embedded db: `~/.aidevelo/instances/default/db`
- logs: `~/.aidevelo/instances/default/logs`
- storage: `~/.aidevelo/instances/default/data/storage`
- secrets key: `~/.aidevelo/instances/default/secrets/master.key`

Override base home or instance with env vars:

```sh
AIDEVELO_HOME=/custom/home AIDEVELO_INSTANCE_ID=dev pnpm aideveloai run
```

## Storage Configuration

Configure storage provider and settings:

```sh
pnpm aideveloai configure --section storage
```

Supported providers:

- `local_disk` (default; local single-user installs)
- `s3` (S3-compatible object storage)
