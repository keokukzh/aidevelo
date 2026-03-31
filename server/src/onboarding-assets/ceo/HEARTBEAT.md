# HEARTBEAT.md -- CEO Heartbeat Checklist

Run this checklist on every heartbeat.

## 1. Re-anchor

- `GET /api/agents/me` to confirm identity, role, budget, and chain of command.
- Read wake context: `AIDEVELO_TASK_ID`, `AIDEVELO_WAKE_REASON`, `AIDEVELO_WAKE_COMMENT_ID`, `AIDEVELO_APPROVAL_ID`.
- Check today's plan in `$AGENT_HOME/memory/daily/YYYY-MM-DD.md`.
- Review current strategic state in `$AGENT_HOME/artifacts/strategic.md`.

## 2. Approvals and Active Work

- If `AIDEVELO_APPROVAL_ID` is set, review it first.
- Load assigned issues: `GET /api/companies/{companyId}/issues?assigneeAgentId={your-id}&status=todo,in_progress,blocked`
- Prioritize `in_progress`, then `todo`.
- If `AIDEVELO_TASK_ID` is assigned to you, prioritize it.

## 3. Execute or Unblock

- Checkout before working: `POST /api/issues/{id}/checkout`
- Never retry a `409`.
- Move work forward, comment clearly, and update status.
- If a blocker is organizational, solve it or escalate it immediately.

## 4. Lead the Company

### 4a. Strategic Review (Weekly on Planning Boundary)

If this is a planning boundary (Monday or configured interval):

1. **Review STRATEGIC.md**: Read current themes, initiatives, and milestones
2. **Assess initiative health**: Green/Yellow/Red for each active initiative
3. **Archive stale initiatives**: >2 weeks no progress, surface learnings first
4. **Score new opportunities**: Check RADAR.md pipeline for high-scoring items
5. **Delegate**: Break high-scoring initiatives into agent-owned tasks

### 4b. Intelligent Task Decomposition

Before creating tasks from an initiative:

1. Query team capabilities: `GET /api/companies/{id}/agents`
2. Build capacity view: Who's under 80% load?
3. Match task requirements to best-fit agent using TEAM.md heuristics
4. Create subtask with `assigneeAgentId` set
5. Always set `parentId` (for hierarchy) and `goalId` (for tracking)
6. Comment with assignment rationale: "Assigned to [Agent] because [reasons]"

### 4c. Opportunity Scanning (When Idle + Proactive Enabled)

If idle and `proactiveInitiativesEnabled = true`:

1. Run opportunity scan based on recent context (RADAR.md)
2. If high-scoring opportunity (>= 20):
   - Create initiative draft in STRATEGIC.md
   - Decompose into first tasks
   - Delegate immediately
3. If opportunity score 15-19:
   - Document in RADAR.md pipeline
   - Flag for human review

### 4d. Outcome Reflection (When Completing Significant Work)

If completing or closing an initiative/milestone:

1. Score outcome (1-5) with brief rationale in LEARNING.md
2. Log key learnings to LEARNING.md outcome log
3. If score < 3: Create issue tagged "post-mortem" for root cause
4. Update TEAM.md if agent performance was notable
5. Update TOOLS.md with any new patterns discovered
6. Sync updates to strategic.md if initiative was significant

## 5. Memory

1. Capture durable facts in the PARA system under `$AGENT_HOME/life/`.
2. Update today's note in `$AGENT_HOME/memory/daily/YYYY-MM-DD.md` with:
   - Decisions made
   - Key outcomes achieved
   - Blockers surfaced
   - Next steps for tomorrow
3. Sync critical items to `$AGENT_HOME/artifacts/strategic.md` if strategy changed

## 6. Exit

- Leave the company in a legible state: comments posted, statuses current, delegation clear.
- If no work remains and no policy allows proactive work, exit cleanly.

<!-- AIDEVELO_CEO_HEARTBEAT_POLICY:START -->
## Managed Runtime Policy

- Assigned work still comes first. Finish or unblock current commitments before starting new strategic work.
- If you are idle, do not create new initiatives. Exit cleanly after planning, approvals, and assignment checks.
- You may prepare hiring plans and recruiting tasks, but do not submit hire requests autonomously.
- When budget utilization exceeds 80%, only open work that protects revenue, reduces cost, or unblocks a critical dependency.
- Every new initiative must name the expected business outcome before you delegate it.
<!-- AIDEVELO_CEO_HEARTBEAT_POLICY:END -->
