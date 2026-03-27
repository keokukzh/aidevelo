# Smart Model Routing for MiniMax Subscription

**Date**: 2026-03-27
**Status**: Draft
**Author**: AI + User collaborative design

## Problem

AIDEVELO's managed service adapter always routes agent requests to the default MiniMax M2.7 model with no failover, no budget awareness, and no task-based routing. The `primary_with_fallback` routing mode is configured in the adapter config but never acted on. If M2.7 goes down or the 4500 req/5hr budget is exhausted, agents stop working entirely.

## Solution

Implement a 3-tier smart model routing system with:

1. **Task complexity classifier** — scores each request and routes to the appropriate model tier
2. **Circuit-breaker failover** — cascades M2.7 → M2.5 → M2.1 on provider errors
3. **Budget gate** — monitors the rolling 5-hour request count and automatically downgrades model tiers as budget pressure increases

## MiniMax Subscription Context

- **Plan**: Plus High-Speed ($40/month)
- **Budget**: 4500 model requests per 5-hour rolling window
- **Models**: MiniMax-M2.7-highspeed (primary), M2.5-highspeed (standard), M2.1-highspeed (fallback)

## Model Tier Registry

| Tier | Model ID | Default Use | Cascade Order |
|------|----------|-------------|---------------|
| Primary | `MiniMax-M2.7-highspeed` | Complex tasks | Try first |
| Standard | `MiniMax-M2.5-highspeed` | Simple/standard tasks | Fallback 1 |
| Fallback | `MiniMax-M2.1-highspeed` | Emergency / budget-saving | Fallback 2 |

## Task Complexity Classifier

The classifier receives metadata from the `AdapterExecutionContext` config object. The managed adapter's `execute()` enriches ctx.config with issue, agent, and prompt metadata that the heartbeat service passes down. Signals that aren't present score 0 (safe default: routes to standard tier).

Additive scoring (0-100) using signals from the execution context:

| Signal | Source | Points |
|--------|--------|--------|
| Issue priority critical/high | `ctx.issue?.priority` | +40 |
| Issue priority medium | `ctx.issue?.priority` | +20 |
| Description > 500 chars | prompt or issue description | +25 |
| Description > 200 chars | prompt or issue description | +15 |
| Task type feature/debug | routine type or wakeup reason | +20 |
| CEO proactive initiatives enabled | agent CEO profile | +10 |
| Multi-file references in prompt | keyword scan | +15 |

- **Score >= 50** → `complex` → M2.7
- **Score >= 20** → `standard` → M2.5
- **Score < 20** → `simple` → M2.5 (or M2.1 under budget pressure)

## Circuit Breaker

Per-model in-memory state machine:

```
CLOSED (healthy) ──3 failures──→ OPEN (skip this tier)
OPEN ──60s cooldown──→ HALF_OPEN (probe with 1 request)
HALF_OPEN ──success──→ CLOSED
HALF_OPEN ──failure──→ OPEN (doubled cooldown, max 5min)
```

Triggers: HTTP 429, 5xx, process timeout, non-zero exit with provider error.

## Budget Gate

Queries `cost_events` for rolling 5-hour window count:

| Usage % | Request Count | Behavior |
|---------|---------------|----------|
| < 80% | 0-3599 | Route normally by complexity |
| 80-93% | 3600-4199 | Downgrade complex → M2.5 |
| 93-100% | 4200-4499 | All tasks → M2.1 |
| >= 100% | 4500+ | Reject with quota exhausted |

## Execution Flow

```
execute(ctx)
  ├─ classifyTask(ctx)              → complexity level
  ├─ checkBudgetGate(companyId)     → budget pressure
  ├─ selectModel(complexity, budget) → model tier
  ├─ checkCircuitBreaker(model)     → healthy or cascade
  │
  ├─ buildDelegateConfig() + inject model override
  ├─ claudeExecute()
  │
  ├─ success → recordSuccess(model), return
  └─ failure → recordFailure(model), retry next tier (max 2 retries)
```

## Files

| File | Action | Lines |
|------|--------|-------|
| `server/src/services/model-router.ts` | Create | ~150 |
| `server/src/services/task-classifier.ts` | Create | ~80 |
| `server/src/adapters/managed/index.ts` | Modify execute() | ~40 changed |
| `packages/adapters/claude-local/src/server/execute.ts` | Modify applyMinimaxClaudeTokenPlanEnv() | ~10 changed |
| `server/src/services/__tests__/model-router.test.ts` | Create | ~120 |
| `server/src/services/__tests__/task-classifier.test.ts` | Create | ~80 |
| `server/src/__tests__/managed-service-routing.test.ts` | Create | ~100 |

## Observability

- Structured pino logs for every routing decision (model selected, complexity, budget usage, circuit states)
- Warning logs on fallback triggers
- Cost events naturally record which model tier was used (existing `model` column)
- No dashboard changes — data queryable via SQL for future dashboard work

## Non-Goals

- No database schema changes
- No per-company budget configuration (hardcoded 4500)
- No ML-based complexity classification
- No provider health check background jobs
- No dashboard UI for routing metrics
