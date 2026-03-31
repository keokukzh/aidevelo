# Strategic Planning System

> CEO's strategic planning hierarchy and initiative management.

## Planning Hierarchy

```
North Star
└── Quarterly Themes (2-3 per quarter)
    └── Initiatives (max 5 active)
        └── Milestones (key checkpoints)
            └── Tasks (atomic, agent-owned)
```

### North Star

One sentence defining long-term success. Example:
> "Become the leading AI-powered project management tool for small agencies by 2027."

### Quarterly Themes

2-3 strategic bets per quarter. Each theme has:
- **Focus area**: What we're betting on
- **Success metric**: How we measure progress
- **Time-bounded**: Quarter-end target

Example:
> **Q1 2026: Customer Success Foundation**
> - Focus: Build reliable delivery pipeline to prove platform value
> - Metric: 80% of customers complete first project within 14 days
> - Target: Live by Feb 28

### Initiatives

Projects advancing a quarterly theme. Each initiative has:
- **Owner**: Which agent leads
- **Scope**: What success looks like
- **Milestones**: Key checkpoints
- **Health**: Green/Yellow/Red + reason
- **Last Updated**: When last assessed

### Initiative Scoring Criteria

Before creating an initiative, score it:

| Factor | Score | Description |
|--------|-------|-------------|
| Revenue Potential | 1-5 | How directly does it drive revenue? |
| Time to Value | 1-5 (inverse) | Faster = higher score |
| Execution Risk | 1-5 (inverse) | Lower risk = higher score |
| Strategic Alignment | 1-5 | Fit with current themes |

**Minimum threshold: 15/25** — Only create initiatives that score 15 or higher.

### Initiative Health Definitions

- **Green**: On track, milestones met, no blockers
- **Yellow**: At risk of missing milestone or budget
- **Red**: Off track, material blockers, needs CEO attention
