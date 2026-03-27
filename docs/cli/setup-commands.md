---
title: Setup Commands
summary: Onboard, run, doctor, and configure
---

Instance setup and diagnostics commands.

## `aideveloai run`

One-command bootstrap and start:

```sh
pnpm aideveloai run
```

Does:

1. Auto-onboards if config is missing
2. Runs `aideveloai doctor` with repair enabled
3. Starts the server when checks pass

Choose a specific instance:

```sh
pnpm aideveloai run --instance dev
```

## `aideveloai onboard`

Interactive first-time setup:

```sh
pnpm aideveloai onboard
```

First prompt:

1. `Quickstart` (recommended): local defaults (embedded database, no LLM provider, local disk storage, default secrets)
2. `Advanced setup`: full interactive configuration

Start immediately after onboarding:

```sh
pnpm aideveloai onboard --run
```

Non-interactive defaults + immediate start (opens browser on server listen):

```sh
pnpm aideveloai onboard --yes
```

## `aideveloai doctor`

Health checks with optional auto-repair:

```sh
pnpm aideveloai doctor
pnpm aideveloai doctor --repair
```

Validates:

- Server configuration
- Database connectivity
- Secrets adapter configuration
- Storage configuration
- Missing key files

## `aideveloai configure`

Update configuration sections:

```sh
pnpm aideveloai configure --section server
pnpm aideveloai configure --section secrets
pnpm aideveloai configure --section storage
```

## `aideveloai env`

Show resolved environment configuration:

```sh
pnpm aideveloai env
```

## `aideveloai allowed-hostname`

Allow a private hostname for authenticated/private mode:

```sh
pnpm aideveloai allowed-hostname my-tailscale-host
```

## Local Storage Paths

| Data | Default Path |
|------|-------------|
| Config | `~/.aidevelo/instances/default/config.json` |
| Database | `~/.aidevelo/instances/default/db` |
| Logs | `~/.aidevelo/instances/default/logs` |
| Storage | `~/.aidevelo/instances/default/data/storage` |
| Secrets key | `~/.aidevelo/instances/default/secrets/master.key` |

Override with:

```sh
AIDEVELO_HOME=/custom/home AIDEVELO_INSTANCE_ID=dev pnpm aideveloai run
```

Or pass `--data-dir` directly on any command:

```sh
pnpm aideveloai run --data-dir ./tmp/aidevelo-dev
pnpm aideveloai doctor --data-dir ./tmp/aidevelo-dev
```
