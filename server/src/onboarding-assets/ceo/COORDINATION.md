# Multi-Agent Coordination Protocols

> How the CEO orchestrates work across agent teams.

## Task Handoff Protocol

When delegating to an agent:

### Required Context

```
1. WHY — Why this matters to the company
2. WHAT — Specific deliverable (not vague goal)
3. SUCCESS CRITERIA — How we know it's done
4. DEADLINE — Hard milestone or soft target
5. CHECK-INS — When to report progress
6. ESCALATION — When to surface blockers
```

### Handoff Template (in issue comment)

```markdown
## Delegation Handoff

**Why this matters**: [Business context]

**Deliverable**: [Specific output]

**Done when**: [Clear criteria]

**Timeline**: [Deadline]

**Check-in**: [Milestone or date]

**Blocker threshold**: [When to escalate]
```

## Parallel Execution Protocol

When multiple agents work on related items simultaneously:

### Pre-Execution Checklist
- [ ] Define clear interfaces/contracts between work products
- [ ] Set explicit blocking dependencies (who waits for whom)
- [ ] Schedule sync point for cross-agent review
- [ ] CEO identifies cross-cutting concerns upfront

### Sync Protocol
- CEO reviews cross-agent progress daily during parallel work
- blockers surfaced immediately in shared issue thread
- Milestone changes require CEO approval

## Escalation Protocol

### Level 1: Resource Constraint
**Symptoms**: Agent lacks time, tools, or access
**CEO Action**:
1. Re-prioritize agent's task queue
2. Re-assign lower-priority tasks
3. Procure necessary access/tools

### Level 2: Technical Blocker
**Symptoms**: Agent hit a technical limit, unknown approach
**CEO Action**:
1. Research solution approach
2. Consult documentation or external resources
3. Bring in specialist knowledge
4. Break task into smaller known steps

### Level 3: Strategic Blocker
**Symptoms**: Task validity questioned, initiative may be wrong
**CEO Action**:
1. Re-evaluate initiative against current strategy
2. Consult board or key stakeholders
3. Consider pivoting or terminating initiative
4. Document lessons in LEARNING.md

## Weekly Agent Standup

Run every Monday (or configured interval):

### Protocol
1. CEO requests status from each active agent
2. Collect: completed, in-progress, blockers, upcoming
3. CEO identifies cross-agent dependencies at risk
4. Re-balance load if needed
5. Update initiative timelines
6. Surface strategic concerns to board

### Status Collection Template

```markdown
## Standup [YYYY-MM-DD]

### [Agent Name]
- **Completed**: [Task 1], [Task 2]
- **In Progress**: [Task 3] (% complete)
- **Blockers**: [Blocker 1], [Blocker 2]
- **Next**: [Task 4]

### Cross-Agent Concerns
- [Dependency 1] — At risk? [Yes/No/Partial]
```
