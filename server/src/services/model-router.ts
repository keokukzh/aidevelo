import { and, eq, gte, sql } from "drizzle-orm";
import type { Db } from "@aideveloai/db";
import { costEvents } from "@aideveloai/db";
import type { AdapterExecutionResult } from "@aideveloai/adapter-utils";
import type { TaskComplexity } from "./task-classifier.js";

export type ModelId = "MiniMax-M2.7-highspeed" | "MiniMax-M2.5-highspeed" | "MiniMax-M2.1-highspeed";

const MODEL_TIERS: Array<{ id: ModelId; tier: string; complexity: TaskComplexity[] }> = [
  { id: "MiniMax-M2.7-highspeed", tier: "primary", complexity: ["complex"] },
  { id: "MiniMax-M2.5-highspeed", tier: "standard", complexity: ["standard", "simple"] },
  { id: "MiniMax-M2.1-highspeed", tier: "fallback", complexity: ["simple"] },
];

const BUDGET_LIMIT = 4500;
const BUDGET_DOWNGRADE_STD = 3600;
const BUDGET_DOWNGRADE_MIN = 4200;

const FAILURE_THRESHOLD = 3;
const BASE_COOLDOWN_MS = 60_000;
const MAX_COOLDOWN_MS = 300_000;

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface CircuitBreaker {
  state: CircuitState;
  consecutiveFailures: number;
  lastFailureAt: number | null;
  cooldownMs: number;
}

type CircuitBreakers = Map<ModelId, CircuitBreaker>;

function createCircuitBreaker(): CircuitBreaker {
  return { state: "CLOSED", consecutiveFailures: 0, lastFailureAt: null, cooldownMs: BASE_COOLDOWN_MS };
}

function isOpen(cb: CircuitBreaker): boolean {
  if (cb.state !== "OPEN") return false;
  if (cb.lastFailureAt === null) return true;
  if (Date.now() >= cb.lastFailureAt + cb.cooldownMs) {
    cb.state = "HALF_OPEN";
    return false;
  }
  return true;
}

export interface RouterState {
  circuits: Record<ModelId, { state: CircuitState; consecutiveFailures: number; cooldownMs: number }>;
}

export interface SelectedModel {
  id: ModelId;
  complexity: TaskComplexity;
}

export function createModelRouter(_db: Db) {
  const circuits: CircuitBreakers = new Map();
  let budgetCountOverride: number | null = null;

  function getCircuit(modelId: ModelId): CircuitBreaker {
    let cb = circuits.get(modelId);
    if (!cb) {
      cb = createCircuitBreaker();
      circuits.set(modelId, cb);
    }
    return cb;
  }

  function tierIndex(modelId: ModelId): number {
    return MODEL_TIERS.findIndex((t) => t.id === modelId);
  }

  function getNextTier(current: ModelId): ModelId | null {
    const idx = tierIndex(current);
    if (idx < 0 || idx >= MODEL_TIERS.length - 1) return null;
    return MODEL_TIERS[idx + 1]!.id;
  }

  async function getBudgetCount(): Promise<number> {
    if (budgetCountOverride != null) return budgetCountOverride;
    // Budget is global (per subscription), not per company.
    // Query all cost_events in the 5-hour window regardless of company.
    const since = new Date(Date.now() - 5 * 60 * 60 * 1000);
    const [row] = await _db
      .select({ count: sql<number>`count(*)::int` })
      .from(costEvents)
      .where(and(gte(costEvents.occurredAt, since)));
    return Number(row?.count ?? 0);
  }

  function setBudgetCount(n: number) {
    budgetCountOverride = n;
  }

  function checkCircuitForModel(modelId: ModelId): ModelId | null {
    const cb = getCircuit(modelId);
    if (cb.state === "CLOSED") return modelId;
    if (isOpen(cb)) return null;
    return modelId; // HALF_OPEN — allow probe through
  }

  async function selectModel(complexity: TaskComplexity, _companyId: string): Promise<SelectedModel | null> {
    const budgetCount = await getBudgetCount();

    // 93-100%: all tasks forced to M2.1
    if (budgetCount >= BUDGET_DOWNGRADE_MIN && budgetCount < BUDGET_LIMIT) {
      return { id: "MiniMax-M2.1-highspeed", complexity: "simple" };
    }

    if (budgetCount >= BUDGET_LIMIT) {
      return null; // quota exhausted
    }

    let allowedComplexity = complexity;
    let forcedDowngrade = false;
    if (budgetCount >= BUDGET_DOWNGRADE_STD && budgetCount < BUDGET_DOWNGRADE_MIN) {
      // 80-93%: downgrade complex tasks to standard tier
      if (complexity === "complex") {
        allowedComplexity = "standard";
        forcedDowngrade = true;
      }
    }

    for (const tier of MODEL_TIERS) {
      if (!tier.complexity.includes(allowedComplexity)) continue;
      // When budget-forced downgrade is active, skip tiers that previously accepted the higher complexity
      if (forcedDowngrade && tier.complexity.includes(complexity)) continue;
      const available = checkCircuitForModel(tier.id);
      if (available) return { id: tier.id, complexity: allowedComplexity };
    }

    // Fallback: if no circuit-healthy tier for allowed complexity, try next lower tier regardless of circuit
    for (const tier of MODEL_TIERS) {
      if (!tier.complexity.includes(allowedComplexity)) continue;
      const cb = getCircuit(tier.id);
      if (cb.state === "OPEN" && !isOpen(cb)) continue;
      return { id: tier.id, complexity: allowedComplexity };
    }

    return null;
  }

  function recordSuccess(modelId: ModelId): void {
    const cb = getCircuit(modelId);
    cb.consecutiveFailures = 0;
    if (cb.state === "HALF_OPEN") {
      cb.state = "CLOSED";
      cb.cooldownMs = BASE_COOLDOWN_MS;
    }
  }

  function recordFailure(modelId: ModelId, error: unknown): void {
    const cb = getCircuit(modelId);
    cb.consecutiveFailures += 1;
    cb.lastFailureAt = Date.now();

    if (isHttp429(error)) {
      // Immediate open
      cb.state = "OPEN";
      cb.cooldownMs = Math.min(cb.cooldownMs * 2, MAX_COOLDOWN_MS);
      return;
    }

    if (cb.state === "CLOSED" && cb.consecutiveFailures >= FAILURE_THRESHOLD) {
      cb.state = "OPEN";
      cb.cooldownMs = Math.min(cb.cooldownMs * 2, MAX_COOLDOWN_MS);
    } else if (cb.state === "HALF_OPEN") {
      cb.state = "OPEN";
      cb.cooldownMs = Math.min(cb.cooldownMs * 2, MAX_COOLDOWN_MS);
    }
  }

  function getRouterState(): RouterState {
    const result: RouterState = { circuits: {} as RouterState["circuits"] };
    for (const modelId of MODEL_TIERS.map((t) => t.id)) {
      const cb = getCircuit(modelId);
      // Ensure OPEN circuits whose cooldown has expired are transitioned to HALF_OPEN
      if (cb.state === "OPEN") {
        isOpen(cb);
      }
      result.circuits[modelId] = {
        state: cb.state,
        consecutiveFailures: cb.consecutiveFailures,
        cooldownMs: cb.cooldownMs,
      };
    }
    return result;
  }

  return { selectModel, recordSuccess, recordFailure, getNextTier, getRouterState, setBudgetCount, getBudgetCount };
}

function isHttp429(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const err = error as Record<string, unknown>;
  if (typeof err.statusCode === "number") return err.statusCode === 429;
  if (typeof err.status === "number") return err.status === 429;
  return false;
}

export function isProviderError(result: AdapterExecutionResult): boolean {
  // Success is determined by exitCode === 0 and no errorMessage
  const isSuccess = (result.exitCode ?? 0) === 0 && !result.errorMessage;
  if (isSuccess) return false;

  // Non-zero exit code with known error patterns
  const exitCode = result.exitCode ?? 0;
  if (exitCode !== 0) {
    const msg = result.errorMessage ?? "";
    if (
      /rate.?limit|429|too.?many.?requests/i.test(msg) ||
      /500|502|503|server.?error|service.?unavailable/i.test(msg) ||
      /timeout|timed.?out/i.test(msg)
    ) {
      return true;
    }
  }

  // HTTP status via errorMeta
  if (result.errorMeta) {
    if (isHttp429(result.errorMeta)) return true;
    const e = result.errorMeta as Record<string, unknown>;
    const statusCode = typeof e.statusCode === "number" ? e.statusCode : typeof e.status === "number" ? e.status : 0;
    if (statusCode === 429 || (statusCode >= 500 && statusCode < 600)) return true;
  }

  // errorMessage with provider error patterns
  const msg = result.errorMessage ?? "";
  if (/rate.?limit|429|server.?error|service.?unavailable/i.test(msg)) return true;

  return false;
}
