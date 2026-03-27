---
title: Docker
summary: Docker Compose quickstart
---

Run Aidevelo in Docker without installing Node or pnpm locally.

Docker-published Aidevelo runs in `authenticated/private` mode by default. `local_trusted` is not a portable Docker mode because the app must listen on `0.0.0.0` inside the container to be reachable from the host, while `local_trusted` requires loopback-only binding.

## Compose Quickstart (Recommended)

```sh
BETTER_AUTH_SECRET=replace-with-a-long-random-secret docker compose -f docker-compose.quickstart.yml up --build
```

Open [http://localhost:3100](http://localhost:3100).

Defaults:

- Host port: `3100`
- Data directory: `./data/docker-aidevelo`
- Deployment mode: `authenticated/private`
- Host exposure: `127.0.0.1` only

Override with environment variables:

```sh
BETTER_AUTH_SECRET=replace-with-a-long-random-secret \
AIDEVELO_PORT=3200 AIDEVELO_DATA_DIR=./data/pc \
  docker compose -f docker-compose.quickstart.yml up --build
```

Use `docker-compose.yml` when you want a dedicated Postgres container instead of embedded PostgreSQL:

```sh
BETTER_AUTH_SECRET=replace-with-a-long-random-secret \
docker compose -f docker-compose.yml up --build
```

Use `docker-compose.local.yml` when you want bind-mounted local data directories and a host-published PostgreSQL port for direct inspection:

```sh
BETTER_AUTH_SECRET=replace-with-a-long-random-secret \
docker compose -f docker-compose.local.yml up --build -d
```

This stores data in `./data/docker-aidevelo-local/`.

## VS Code + Docker MCP

Connect Docker MCP Toolkit to VS Code globally with:

```sh
docker mcp client connect --global vscode
```

This prepares Docker-managed MCP servers inside VS Code. Aidevelo's own MCP interface is still a repo contract rather than a shipped MCP server implementation.

See [doc/VSCODE-MCP-DOCKER.md](../../doc/VSCODE-MCP-DOCKER.md) for the current setup details.

## Kubernetes Sketch

The repository now includes a first Kubernetes sketch under `docker/k8s/` for cluster-oriented deployment experiments.

## Manual Docker Build

```sh
docker build -t aidevelo-local .
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

## Data Persistence

All data is persisted under the bind mount (`./data/docker-aidevelo`):

- Embedded PostgreSQL data
- Uploaded assets
- Local secrets key
- Agent workspace data

## Claude and Codex Adapters in Docker

The Docker image pre-installs:

- `claude` (Anthropic Claude Code CLI)
- `codex` (OpenAI Codex CLI)

Pass API keys to enable local adapter runs inside the container:

```sh
docker run --name aidevelo \
  -p 127.0.0.1:3100:3100 \
  -e HOST=0.0.0.0 \
  -e AIDEVELO_HOME=/aidevelo \
  -e AIDEVELO_DEPLOYMENT_MODE=authenticated \
  -e AIDEVELO_DEPLOYMENT_EXPOSURE=private \
  -e BETTER_AUTH_SECRET=replace-with-a-long-random-secret \
  -e OPENAI_API_KEY=sk-... \
  -e ANTHROPIC_API_KEY=sk-... \
  -v "$(pwd)/data/docker-aidevelo:/aidevelo" \
  aidevelo-local
```

Without API keys, the app runs normally — adapter environment checks will surface missing prerequisites.
