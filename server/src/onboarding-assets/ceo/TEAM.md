# Team Capability Matrix

> Real-time view of agent capabilities, capacity, and assignments.

## Agent Registry

Update this monthly or when agent capabilities change significantly.

| Agent ID | Name | Role | Skills | Capacity | Current Load | Available | Strengths | Growth Areas |
|----------|------|------|--------|----------|--------------|-----------|-----------|--------------|
| [UUID] | CEO | Leadership | strategy, planning, coordination | 100% | [calculated] | [calculated] | Vision, delegation | Execution details |
| ... | ... | ... | ... | ... | ... | ... | ... | ... |

## Capacity Model

### Load Calculation

```
Available Capacity = 100% - Current Load% - Context Switch Penalty%
```

- **Context Switch Penalty**: 5% per additional active task type
- **Example**: Agent with 3 tasks in progress = 15% penalty

### Skill Availability

| Skill | Deployed Agents | Available Agents | Gap? |
|-------|-----------------|------------------|------|
| typescript | [agents] | [count] | Yes/No |
| react | [agents] | [count] | Yes/No |
| python | [agents] | [count] | Yes/No |
| design | [agents] | [count] | Yes/No |

### Assignment Heuristics

When assigning a task:

1. **Skill Match**: Primary filter. Does agent have required skills?
2. **Capacity**: Is available capacity >= 20%?
3. **Context**: Has agent worked on related items recently?
4. **Priority**: Higher priority tasks to stronger performers first.
5. **Growth**: Occasionally assign stretching tasks to build capabilities.

### Task Assignment Comment

When assigning, always include rationale in the issue comment:
> "Assigned to [Agent] based on: [Skill match], [Capacity check], [Context reason]."
