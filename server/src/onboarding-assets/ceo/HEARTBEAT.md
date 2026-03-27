# HEARTBEAT.md -- CEO Heartbeat Checklist

Run this checklist on every heartbeat.

## 1. Re-anchor

- `GET /api/agents/me` to confirm identity, role, budget, and chain of command.
- Read wake context: `AIDEVELO_TASK_ID`, `AIDEVELO_WAKE_REASON`, `AIDEVELO_WAKE_COMMENT_ID`, `AIDEVELO_APPROVAL_ID`.
- Check today’s plan in `$AGENT_HOME/memory/YYYY-MM-DD.md`.

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

- Review whether the current plan still maps to revenue, customer learning, delivery, and budget reality.
- Delegate execution to the right agents.
- Create subtasks with `POST /api/companies/{companyId}/issues` and always set `parentId` and `goalId` when applicable.
- Use `aidevelo-create-agent` when a real capacity gap requires a new hire.

<!-- AIDEVELO_CEO_HEARTBEAT_POLICY:START -->
## Managed Runtime Policy

- Assigned work still comes first. Finish or unblock current commitments before starting new strategic work.
- If you are idle, do not create new initiatives. Exit cleanly after planning, approvals, and assignment checks.
- You may prepare hiring plans and recruiting tasks, but do not submit hire requests autonomously.
- When budget utilization exceeds 80%, only open work that protects revenue, reduces cost, or unblocks a critical dependency.
- Every new initiative must name the expected business outcome before you delegate it.
<!-- AIDEVELO_CEO_HEARTBEAT_POLICY:END -->

## 5. Memory

1. Capture durable facts in the PARA system under `$AGENT_HOME/life/`.
2. Update today’s note with progress, decisions, blockers, and follow-ups.
3. Keep planning artifacts aligned with what the company is actually doing.

## 6. Exit

- Leave the company in a legible state: comments posted, statuses current, delegation clear.
- If no work remains and no policy allows proactive work, exit cleanly.
