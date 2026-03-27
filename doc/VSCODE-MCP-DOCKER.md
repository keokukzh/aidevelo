# VS Code + Docker MCP

This repository does not yet ship a dedicated Aidevelo MCP server. What is available now:

1. A running Aidevelo HTTP server in Docker on `http://localhost:3100`
2. Docker MCP Toolkit connected to VS Code globally
3. A documented path for adding an Aidevelo-specific MCP server later

## Current machine status

The Docker MCP Toolkit client is connected globally to VS Code with:

```sh
docker mcp client connect --global vscode
```

Verify:

```sh
docker mcp client ls --global
```

If VS Code does not show the updated MCP setup immediately, restart VS Code.

## What this connection does

This enables Docker-managed MCP servers and the Docker MCP catalog in VS Code.

It does **not** create an Aidevelo-specific MCP server automatically. The repo still only contains the MCP function contract in [doc/TASKS-mcp.md](doc/TASKS-mcp.md).

## Local Docker app stack

Recommended local stack with explicit bind-mounted data:

```sh
docker compose -f docker-compose.local.yml up --build -d
```

Required env var:

```sh
BETTER_AUTH_SECRET=<random-32-plus-char-secret>
```

This publishes:

- app: `http://localhost:3100`
- postgres: `localhost:5432`

Data is stored under:

- `./data/docker-aidevelo-local/app`
- `./data/docker-aidevelo-local/postgres`

## Recommended MCP next step

When adding the repo's own MCP server, keep it separate from the Express HTTP app transport.

Recommended shape:

1. new stdio MCP entrypoint in the repo
2. thin issue-focused tool surface first:
   - `list_issues`
   - `get_issue`
   - `create_issue`
   - `update_issue`
3. MCP process authenticates against the running Aidevelo app on `http://localhost:3100`

## Useful Docker MCP commands

```sh
docker mcp version
docker mcp client ls --global
docker mcp tools ls
```
