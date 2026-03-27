# Docker Quickstart

Run Aidevelo in Docker without installing Node or pnpm locally.

Docker-exposed Aidevelo uses `authenticated/private` by default. `local_trusted` is not a portable Docker mode because the app must bind to `0.0.0.0` inside the container to be reachable from the host, while `local_trusted` enforces loopback-only binding at the server level.

## One-liner (build + run)

```sh
docker build -t aidevelo-local . && \
docker run --name aidevelo \
  -p 127.0.0.1:3100:3100 \
  -e HOST=0.0.0.0 \
  -e AIDEVELO_HOME=/aidevelo \
  -e AIDEVELO_DEPLOYMENT_MODE=authenticated \
  -e AIDEVELO_DEPLOYMENT_EXPOSURE=private \
  -e BETTER_AUTH_SECRET=replace-with-a-long-random-secret \
  -v "$(pwd)/data/docker-aidevelo:/aidevelo" \
  aidevelo-local
```

Open: `http://localhost:3100`

Data persistence:

- Embedded PostgreSQL data
- uploaded assets
- local secrets key
- local agent workspace data

All persisted under your bind mount (`./data/docker-aidevelo` in the example above).

## Compose Quickstart

```sh
docker compose -f docker-compose.quickstart.yml up --build
```

Defaults:

- host port: `3100`
- persistent data dir: `./data/docker-aidevelo`
- deployment mode: `authenticated/private`
- host exposure: `127.0.0.1` only

Required environment:

```sh
BETTER_AUTH_SECRET=replace-with-a-long-random-secret
```

Optional overrides:

```sh
BETTER_AUTH_SECRET=replace-with-a-long-random-secret \
AIDEVELO_PORT=3200 AIDEVELO_DATA_DIR=./data/pc docker compose -f docker-compose.quickstart.yml up --build
```

If you change host port or use a non-local domain, set `AIDEVELO_PUBLIC_URL` to the external URL you will use in browser/auth flows.

## Compose With External PostgreSQL

Use this when you want the app on `http://localhost:3100` with a dedicated Postgres container:

```sh
BETTER_AUTH_SECRET=replace-with-a-long-random-secret \
docker compose -f docker-compose.yml up --build
```

Defaults:

- app URL: `http://localhost:3100`
- database: internal `db` service on the Compose network
- app data volume: `aidevelo-data`
- database volume: `pgdata`

The Postgres service is not published to the host by default. The Aidevelo server connects to it internally via `DATABASE_URL=postgres://aidevelo:aidevelo@db:5432/aidevelo`.

## Local Compose With Bind Mounts

Use this when you want explicit host-visible data directories for both app state and PostgreSQL:

```sh
BETTER_AUTH_SECRET=replace-with-a-long-random-secret \
docker compose -f docker-compose.local.yml up --build -d
```

This stores data under:

- `./data/docker-aidevelo-local/app`
- `./data/docker-aidevelo-local/postgres`

It also publishes PostgreSQL to `127.0.0.1:5432` for local inspection tools.

## VS Code + Docker MCP

Docker MCP Toolkit can be connected to VS Code globally with:

```sh
docker mcp client connect --global vscode
```

See `doc/VSCODE-MCP-DOCKER.md` for the exact workflow and the current limitation that Aidevelo does not yet ship its own MCP server implementation.

## Kubernetes Sketch

A first Kubernetes deployment sketch now lives under:

```text
docker/k8s/
```

These manifests are a starting point for cluster deployment, not a production-hardened package.

## Authenticated Compose (Single Public URL)

For authenticated deployments, set one canonical public URL and let Aidevelo derive auth/callback defaults:

```yaml
services:
  aidevelo:
    environment:
      AIDEVELO_DEPLOYMENT_MODE: authenticated
      AIDEVELO_DEPLOYMENT_EXPOSURE: private
      AIDEVELO_PUBLIC_URL: https://desk.koker.net
```

`AIDEVELO_PUBLIC_URL` is used as the primary source for:

- auth public base URL
- Better Auth base URL defaults
- bootstrap invite URL defaults
- hostname allowlist defaults (hostname extracted from URL)

Granular overrides remain available if needed (`AIDEVELO_AUTH_PUBLIC_BASE_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_TRUSTED_ORIGINS`, `AIDEVELO_ALLOWED_HOSTNAMES`).

Set `AIDEVELO_ALLOWED_HOSTNAMES` explicitly only when you need additional hostnames beyond the public URL host (for example Tailscale/LAN aliases or multiple private hostnames).

## Claude + Codex Local Adapters in Docker

The image pre-installs:

- `claude` (Anthropic Claude Code CLI)
- `codex` (OpenAI Codex CLI)

If you want local adapter runs inside the container, pass API keys when starting the container:

```sh
docker run --name aidevelo \
  -p 127.0.0.1:3100:3100 \
  -e HOST=0.0.0.0 \
  -e AIDEVELO_HOME=/aidevelo \
  -e AIDEVELO_DEPLOYMENT_MODE=authenticated \
  -e AIDEVELO_DEPLOYMENT_EXPOSURE=private \
  -e BETTER_AUTH_SECRET=replace-with-a-long-random-secret \
  -e OPENAI_API_KEY=... \
  -e ANTHROPIC_API_KEY=... \
  -e MINIMAX_API_KEY=... \
  -v "$(pwd)/data/docker-aidevelo:/aidevelo" \
  aidevelo-local
```

### MiniMax in Docker

Set `MINIMAX_API_KEY` in the container environment (or in a Compose `.env` file).

- **Default (Claude Code token plan):** `claude_local` maps the key to `ANTHROPIC_BASE_URL` + `ANTHROPIC_AUTH_TOKEN` as in [MiniMax Claude Code](https://platform.minimax.io/docs/token-plan/claude-code). `managed_service` delegates to Claude by default when this variable is set.
- **Codex CLI path:** set `AIDEVELO_MINIMAX_DELEGATE=codex` to use the OpenAI Codex CLI against MiniMax instead.
- **China region:** set `MINIMAX_ANTHROPIC_BASE_URL=https://api.minimaxi.com/anthropic` (or `AIDEVELO_MINIMAX_ANTHROPIC_BASE_URL`) for the Anthropic-compatible base URL.

Compose files `docker-compose.yml`, `docker-compose.local.yml`, and `docker-compose.quickstart.yml` forward `MINIMAX_API_KEY` from the host when present.

Notes:

- Without API keys, the app still runs normally.
- Adapter environment checks in Aidevelo will surface missing auth/CLI prerequisites.

## Untrusted PR Review Container

If you want a separate Docker environment for reviewing untrusted pull requests with `codex` or `claude`, use the dedicated review workflow in `doc/UNTRUSTED-PR-REVIEW.md`.

That setup keeps CLI auth state in Docker volumes instead of your host home directory and uses a separate scratch workspace for PR checkouts and preview runs.

## Onboard Smoke Test (Ubuntu + npm only)

Use this when you want to mimic a fresh machine that only has Ubuntu + npm and verify:

- `npx aideveloai onboard --yes` completes
- the server binds to `0.0.0.0:3100` so host access works
- onboard/run banners and startup logs are visible in your terminal

Build + run:

```sh
./scripts/docker-onboard-smoke.sh
```

Open: `http://localhost:3131` (default smoke host port)

Useful overrides:

```sh
HOST_PORT=3200 AIDEVELOAI_VERSION=latest ./scripts/docker-onboard-smoke.sh
AIDEVELO_DEPLOYMENT_MODE=authenticated AIDEVELO_DEPLOYMENT_EXPOSURE=private ./scripts/docker-onboard-smoke.sh
SMOKE_DETACH=true SMOKE_METADATA_FILE=/tmp/aidevelo-smoke.env AIDEVELOAI_VERSION=latest ./scripts/docker-onboard-smoke.sh
```

Notes:

- Persistent data is mounted at `./data/docker-onboard-smoke` by default.
- Container runtime user id defaults to your local `id -u` so the mounted data dir stays writable while avoiding root runtime.
- Smoke script defaults to `authenticated/private` mode so `HOST=0.0.0.0` can be exposed to the host.
- Smoke script defaults host port to `3131` to avoid conflicts with local Aidevelo on `3100`.
- Smoke script also defaults `AIDEVELO_PUBLIC_URL` to `http://localhost:<HOST_PORT>` so bootstrap invite URLs and auth callbacks use the reachable host port instead of the container's internal `3100`.
- In authenticated mode, the smoke script defaults `SMOKE_AUTO_BOOTSTRAP=true` and drives the real bootstrap path automatically: it signs up a real user, runs `aideveloai auth bootstrap-ceo` inside the container to mint a real bootstrap invite, accepts that invite over HTTP, and verifies board session access.
- Run the script in the foreground to watch the onboarding flow; stop with `Ctrl+C` after validation.
- Set `SMOKE_DETACH=true` to leave the container running for automation and optionally write shell-ready metadata to `SMOKE_METADATA_FILE`.
- The image definition is in `Dockerfile.onboard-smoke`.
