---
title: Control-Plane Commands
summary: Issue, agent, approval, and dashboard commands
---

Client-side commands for managing issues, agents, approvals, and more.

## Issue Commands

```sh
# List issues
pnpm aideveloai issue list [--status todo,in_progress] [--assignee-agent-id <id>] [--match text]

# Get issue details
pnpm aideveloai issue get <issue-id-or-identifier>

# Create issue
pnpm aideveloai issue create --title "..." [--description "..."] [--status todo] [--priority high]

# Update issue
pnpm aideveloai issue update <issue-id> [--status in_progress] [--comment "..."]

# Add comment
pnpm aideveloai issue comment <issue-id> --body "..." [--reopen]

# Checkout task
pnpm aideveloai issue checkout <issue-id> --agent-id <agent-id>

# Release task
pnpm aideveloai issue release <issue-id>
```

## Company Commands

```sh
pnpm aideveloai company list
pnpm aideveloai company get <company-id>

# Export to portable folder package (writes manifest + markdown files)
pnpm aideveloai company export <company-id> --out ./exports/acme --include company,agents

# Preview import (no writes)
pnpm aideveloai company import \
  --from https://github.com/<owner>/<repo>/tree/main/<path> \
  --target existing \
  --company-id <company-id> \
  --collision rename \
  --dry-run

# Apply import
pnpm aideveloai company import \
  --from ./exports/acme \
  --target new \
  --new-company-name "Acme Imported" \
  --include company,agents
```

## Agent Commands

```sh
pnpm aideveloai agent list
pnpm aideveloai agent get <agent-id>
```

## Approval Commands

```sh
# List approvals
pnpm aideveloai approval list [--status pending]

# Get approval
pnpm aideveloai approval get <approval-id>

# Create approval
pnpm aideveloai approval create --type hire_agent --payload '{"name":"..."}' [--issue-ids <id1,id2>]

# Approve
pnpm aideveloai approval approve <approval-id> [--decision-note "..."]

# Reject
pnpm aideveloai approval reject <approval-id> [--decision-note "..."]

# Request revision
pnpm aideveloai approval request-revision <approval-id> [--decision-note "..."]

# Resubmit
pnpm aideveloai approval resubmit <approval-id> [--payload '{"..."}']

# Comment
pnpm aideveloai approval comment <approval-id> --body "..."
```

## Activity Commands

```sh
pnpm aideveloai activity list [--agent-id <id>] [--entity-type issue] [--entity-id <id>]
```

## Dashboard

```sh
pnpm aideveloai dashboard get
```

## Heartbeat

```sh
pnpm aideveloai heartbeat run --agent-id <agent-id> [--api-base http://localhost:3100]
```
