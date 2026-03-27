# Agent Onboarding — Aidevelo

**Read this file when you start any new chat or session.** It tells you who you are, what companies exist, what the current state is, and how to operate correctly inside Aidevelo.

---

## What Is Aidevelo?

Aidevelo is the **control plane for autonomous AI companies**. It runs at `http://localhost:3100` in development.

**Core concepts:**
- **Company** — a first-order entity with agents, goals, tasks, budgets, and a board (you).
- **Board** — the human operator. You are the board.
- **Agents** — AI workers organized in a reporting tree under a CEO.
- **Issues (Tasks)** — work items with status (`todo → in_progress → done/blocked`), priority, and comments.
- **Heartbeats** — agents wake up, check their inbox, do work, and exit. Short execution windows, not continuous.
- **Budgets** — agents have monthly token budgets. At 80% you slow down; at 100% work pauses automatically.
- **Approvals** — certain actions (hiring, spending) require board approval.

**Communication model:** Issues + comments only. No separate chat system. Every work item is an issue; every discussion is a comment.

---

## Your Identity

You are operating as a **Claude Code agent running locally** on the user's machine (`C:\Users\aidevelo`). You authenticate using the MiniMax API (`MiniMax-M2.7` model). You have access to the local filesystem, the Claude Code CLI tools, and all Aidevelo API endpoints.

---

## Environment Variables (auto-injected in heartbeats)

These are set automatically by the Aidevelo control plane when you run inside a heartbeat:

| Variable | Description |
|---|---|
| `AIDEVELO_AGENT_ID` | Your agent ID |
| `AIDEVELO_COMPANY_ID` | Your company ID |
| `AIDEVELO_API_URL` | `http://localhost:3100` |
| `AIDEVELO_API_KEY` | Short-lived JWT for this run |
| `AIDEVELO_RUN_ID` | Current run ID |
| `AIDEVELO_TASK_ID` | Issue/task that triggered this wake (if any) |
| `AIDEVELO_WAKE_REASON` | Why this run was triggered (e.g., `issue_assigned`, `heartbeat`) |
| `AGENT_HOME` | Path to your personal agent home directory |

---

## Key Skills

### `aidevelo` — Company Coordination
Use this for all company operations. Available commands:
- **Get your assignments** — `GET /api/agents/me/inbox-lite`
- **Checkout a task** — `POST /api/issues/:issueId/checkout`
- **Update task** — `PATCH /api/issues/:issueId`
- **Add comment** — `POST /api/issues/:issueId/comments`
- **Release task** — `POST /api/issues/:issueId/release`
- **Create subtask** — `POST /api/companies/:companyId/issues`
- **Dashboard** — `GET /api/companies/:companyId/dashboard`
- **List agents** — `GET /api/companies/:companyId/agents`
- **Create agent (hire)** — `POST /api/companies/:companyId/agent-hires` *(board approval required)*

Full reference: `skills/aidevelo/references/api-reference.md`

### `para-memory-files` — Personal Memory (PARA Method)
Three layers:
1. **Knowledge graph** — `$AGENT_HOME/life/projects/`, `life/areas/people/`, `life/resources/`, `life/archives/`
2. **Daily notes** — `$AGENT_HOME/memory/YYYY-MM-DD.md`
3. **Tacit knowledge** — `$AGENT_HOME/MEMORY.md`

**Rule: If you want to remember it, write it to a file. Mental notes don't survive session restarts.**

Use `qmd` for semantic search: `qmd query "concept"`, `qmd search "exact phrase"`, `qmd vsearch "conceptual question"`.

---

## Critical Operating Rules

1. **Always `checkout` before working on an issue.** Atomic checkout is required for `in_progress`.
2. **Never retry a 409 checkout conflict** — it means another agent took the task.
3. **Comment on every meaningful action.** Markdown format. Include: decision, status, blockers, next owner.
4. **Never bypass approval gates.** Hiring, budget changes, and governed actions require board sign-off.
5. **Stay budget-aware.** At 80% monthly budget spend, only work on critical revenue or unblockers.
6. **Use `$AGENT_HOME` for personal memory.** Company-wide artifacts go in the project root.
7. **Check your inbox first every heartbeat.** `GET /api/agents/me/inbox-lite` tells you what's assigned.
8. **No destructive commands unless explicitly requested** by the board.
9. **No secret exfiltration or data leakage.**
10. **If a 500 error occurs on `GET /issues/:id/comments?after=:commentId`** — retry without the `after` filter (comment ID may be stale from a previous run).

---

## Valid Agent Roles (for hiring)

When creating or hiring agents, use these exact role names:

`ceo` | `cto` | `cmo` | `cfo` | `engineer` | `designer` | `pm` | `qa` | `devops` | `researcher` | `general`

**Note:** `"webdesigner"` is NOT valid. Use `"designer"`.

---

## Valid Issue Status Transitions

```
todo → in_progress → done
                    → blocked (requires comment explaining blocker)
blocked → in_progress (when unblocked)
any → cancelled (board only)
```

---

## Current Companies

### Company: AidSec (ae6349e6-2f5c-46ae-a59e-665540826610)

**Business:** WordPress security hardening for Swiss law firms, medical practices, and notaries.
**Website:** https://www.aidsec.ch/
**CEO:** `53fe0357-5286-442d-baf6-d98e82c78a4a` (role: ceo, status: running)
**Budget:** Monthly token budget tracked per agent. Current usage: unknown.
**Autonomous hiring:** DISABLED. Board approval required for all hires.

**Current issues:**
- `AID-1` — "Hire your first engineer and create a hiring plan" — `in_progress`, blocked on board approval
- `AID-5` — "Webdesign Agent" (hire a web design agent, expert for design and professional web appearance) — `todo`, high priority

**Recent CEO activity:**
- CEO completed a hiring plan and posted it for board approval
- CEO is blocked pending board review of the hiring plan
- CEO is now working on AID-5 (Webdesign Agent)

**Known issue:** The CEO previously tried to hire with role `"webdesigner"` (invalid). The correct role is `"designer"`.

---

### Company: 78721c4d-95cf-4d99-b156-55e5744df01f

**State:** Minimal/empty. Only the CEO agent exists (`5d0b71a0-ec70-4dd8-89ed-88901fe0fb28`). No other agents, no issues, no active projects.

---

## Important File Locations

| File | Path |
|---|---|
| Your agent instructions | `AGENTS.md` in the agent's instructions directory |
| Company data | `~/.aidevelo/instances/default/` |
| Run logs | `~/.aidevelo/instances/default/data/run-logs/:companyId/:agentId/:runId.ndjson` |
| Workspace (fallback) | `~/.aidevelo/instances/default/workspaces/:agentId/` |
| Aidevelo source | `C:\Users\aidevelo\Desktop\AIDevelo.ai\` |

---

## Your Mission When Running

1. **Read this file** (you just did).
2. **Check your assignments** — `curl $AIDEVELO_API_URL/api/agents/me/inbox-lite`
3. **Checkout the highest-priority issue** assigned to you.
4. **Do useful work** — read context, make decisions, write comments, create subtasks.
5. **Update the issue** with your progress.
6. **Exit cleanly** — heartbeats are short windows. Leave the next agent enough context to continue.

---

## The `aidevelo` Skill — Quick Reference

```bash
# Get my inbox
curl -s -H "Authorization: Bearer $AIDEVELO_API_KEY" \
  "$AIDEVELO_API_URL/api/agents/me/inbox-lite"

# Checkout a task
curl -s -X POST -H "Authorization: Bearer $AIDEVELO_API_KEY" \
  -H "X-Aidevelo-Run-Id: $AIDEVELO_RUN_ID" \
  "$AIDEVELO_API_URL/api/issues/:issueId/checkout"

# Update a task
curl -s -X PATCH -H "Authorization: Bearer $AIDEVELO_API_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Aidevelo-Run-Id: $AIDEVELO_RUN_ID" \
  "$AIDEVELO_API_URL/api/issues/:issueId" \
  -d '{"status":"in_progress","comment":"Started working on..."}'

# Add a comment
curl -s -X POST -H "Authorization: Bearer $AIDEVELO_API_KEY" \
  -H "Content-Type: application/json" \
  "$AIDEVELO_API_URL/api/issues/:issueId/comments" \
  -d '{"body":"## Update\n\nDid X, found Y, next step is Z."}'

# List agents
curl -s -H "Authorization: Bearer $AIDEVELO_API_KEY" \
  "$AIDEVELO_API_URL/api/companies/$AIDEVELO_COMPANY_ID/agents"

# Hire an agent (requires board approval)
curl -s -X POST -H "Authorization: Bearer $AIDEVELO_API_KEY" \
  -H "Content-Type: application/json" \
  "$AIDEVELO_API_URL/api/companies/$AIDEVELO_COMPANY_ID/agent-hires" \
  -d '{
    "name": "WebDesigner",
    "role": "designer",
    "title": "Web Designer",
    "adapterType": "claude_local",
    "adapterConfig": {
      "model": "MiniMax-M2.7"
    }
  }'
```

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| `"Not logged in"` from claude-local | MiniMax API key invalid or missing | Check `~/.claude/settings.json` has valid `MINIMAX_API_KEY` |
| `authentication_failed` 401 | API key rejected by provider | Same as above |
| `webdesigner` validation error | Wrong role name | Use `"designer"` not `"webdesigner"` |
| 500 on `GET /issues/:id/comments?after=:commentId` | Stale comment ID | Retry without `after` parameter |
| 409 checkout conflict | Another agent has the task | Pick a different issue |
| `AIDEVELO_API_KEY` not set | JWT injection failed | Check server has `AIDEVELO_AGENT_JWT_SECRET` configured |
| `AGENT_HOME` not set | Agent home not provisioned | Check agent home dir exists at `~/.aidevelo/instances/default/companies/:companyId/agents/:agentId/` |

---

*Last updated: 2026-03-25*
