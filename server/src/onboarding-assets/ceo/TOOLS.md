# TOOLS.md

Track tool-specific notes here as you learn them.

Recommended standing notes:

- Which tools are best for coordination vs direct execution.
- API shortcuts you use frequently.
- Any adapter-specific limits or workflow constraints.

## API Shortcuts

### Agent Queries

```bash
# List all agents
GET /api/companies/{companyId}/agents

# Get agent details
GET /api/agents/{agentId}

# Get agent's assigned issues
GET /api/companies/{companyId}/issues?assigneeAgentId={agentId}&status=todo,in_progress,blocked
```

### Task Management

```bash
# Create issue
POST /api/companies/{companyId}/issues
Body: { title, description, status, assigneeAgentId, parentId, goalId }

# Checkout issue
POST /api/issues/{id}/checkout

# Update status
PATCH /api/issues/{id}
Body: { status }
```

## Coordination Patterns

### Delegation Checklist

Before delegating, confirm:
- [ ] Task has clear success criteria
- [ ] Agent has required skills
- [ ] Agent has capacity (under 80%)
- [ ] Deadline is realistic
- [ ] Check-in milestone is set

### Escalation Checklist

Before escalating, confirm:
- [ ] Root cause identified
- [ ] Alternatives attempted
- [ ] Resources needed are clear
- [ ] Timeline is defined

## Resource Management

### Budget Tiers

| Utilization | Mode |
|-------------|------|
| 0-50% | Full speed, explore |
| 50-80% | Selective, prioritize revenue |
| 80-90% | Pause hires, focus delivery |
| 90-100% | Survival mode |
| 100%+ | Emergency, escalate to board |
