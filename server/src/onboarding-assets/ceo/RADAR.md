# Opportunity Radar

> Proactive scanning for initiatives, improvements, and strategic moves.

## Scanning Triggers

Run opportunity scan in these situations:

1. **End of heartbeat** — If idle capacity exists and proactive mode enabled
2. **Weekly review** — Dedicated scanning during planning boundary
3. **New information** — Customer feedback, metric change, market shift
4. **Milestone completion** — Capacity opens up, good time to reassess

## Opportunity Categories

### Revenue Opportunities

**Signs to watch:**
- Customer complaints about missing features
- Competitor gaps we can exploit quickly
- Pricing optimization moments (churn signals, expansion signals)
- Expansion revenue from existing customers (cross-sell/upsell)

**Scoring:**

| Factor | 1 | 3 | 5 |
|--------|---|---|---|
| Market Size | Niche | SMB | Enterprise |
| Our Fit | Weak | Partial | Strong |
| Time to Revenue | >6mo | 3-6mo | <3mo |

### Efficiency Opportunities

**Signs to watch:**
- Repeated manual tasks (automation candidates)
- Agent coordination bottlenecks (handoff delays)
- Knowledge silos (key-person dependencies)
- Tooling gaps (slowing teams down)

**Scoring:**

| Factor | 1 | 3 | 5 |
|--------|---|---|---|
| Time Saved | <1hr/week | 1-5hr/week | 5hr+/week |
| Frequency | Rare | Weekly | Daily |
| Implementation Cost | High | Medium | Low |

### Growth Opportunities

**Signs to watch:**
- New customer segments underserved
- Partnership possibilities
- Content/distribution leverage points
- Hiring gaps limiting velocity

**Scoring:**

| Factor | 1 | 3 | 5 |
|--------|---|---|---|
| Strategic Value | Tactical | Product | Platform |
| Reversibility | Lock-in | Partial | Fully reversible |
| Execution Risk | High | Medium | Low |

## Opportunity Pipeline

| Opportunity | Category | Score | Status | Next Action |
|-------------|----------|-------|--------|-------------|
| [Name] | Revenue | 18/25 | Scouting | [Action] |
| [Name] | Efficiency | 22/25 | Validated | [Action] |

**Status Flow:**
- **Scouting**: Gathering data, initial assessment
- **Validated**: Confirmed opportunity, scoring complete
- **Initiative**: Created as active initiative
- **Archived**: Not worth pursuing

## Initiative Threshold

Convert opportunity to initiative only if:

1. **Score >= 15/25**
2. **At least one agent has capacity** (>20% available)
3. **Budget tier allows** (see AGENTS.md budget rules)
4. **Strategic alignment confirmed** (fits current themes)

## Proactive Mode

When `proactiveInitiativesEnabled = true`:

- CEO may create initiatives directly when score >= 20
- CEO must still decompose and delegate, not execute personally
- CEO must still set milestone and deadline
- Board is informed at next heartbeat of new initiative

When `proactiveInitiativesEnabled = false`:

- CEO drafts opportunities but flags for human review
- CEO only creates initiative after explicit approval
- CEO focuses on execution of assigned work
