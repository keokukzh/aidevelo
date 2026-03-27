import { describe, expect, it } from "vitest";
import { classifyTask } from "../services/task-classifier.js";
import { createModelRouter } from "../services/model-router.js";

// These test the integration of classifyTask + model-router without needing
// to mock the adapter modules. The full adapter integration is tested
// via the existing managed-service-minimax.test.ts pattern.

describe("classifyTask + model-router integration", () => {
  it("complex task (critical priority) selects M2.7 at low budget", async () => {
    const router = createModelRouter({} as any);
    router.setBudgetCount(0); // no budget pressure

    // Critical priority + long description = score 65 → complex
    const complexity = classifyTask({
      runId: "run-1",
      agent: { id: "a1", companyId: "c1", name: "Test", adapterType: "managed_service", adapterConfig: {} },
      runtime: { sessionId: null, sessionParams: null, sessionDisplayId: null, taskKey: null },
      config: { issue: { priority: "critical" }, prompt: "x".repeat(600) },
      context: {},
      onLog: async () => {},
    } as any);

    expect(complexity).toBe("complex");
    const selected = await router.selectModel(complexity, "c1");
    expect(selected?.id).toBe("MiniMax-M2.7-highspeed");
  });

  it("standard task (medium priority) selects M2.5 at low budget", async () => {
    const router = createModelRouter({} as any);
    router.setBudgetCount(0);

    const complexity = classifyTask({
      runId: "run-1",
      agent: { id: "a1", companyId: "c1", name: "Test", adapterType: "managed_service", adapterConfig: {} },
      runtime: { sessionId: null, sessionParams: null, sessionDisplayId: null, taskKey: null },
      config: { issue: { priority: "medium" } },
      context: {},
      onLog: async () => {},
    } as any);

    expect(complexity).toBe("standard");
    const selected = await router.selectModel(complexity, "c1");
    expect(selected?.id).toBe("MiniMax-M2.5-highspeed");
  });

  it("complex task downgrades to M2.5 at 80-93% budget (3700 requests)", async () => {
    const router = createModelRouter({} as any);
    router.setBudgetCount(3700);

    const complexity = classifyTask({
      runId: "run-1",
      agent: { id: "a1", companyId: "c1", name: "Test", adapterType: "managed_service", adapterConfig: {} },
      runtime: { sessionId: null, sessionParams: null, sessionDisplayId: null, taskKey: null },
      config: { issue: { priority: "critical" }, prompt: "x".repeat(600) },
      context: {},
      onLog: async () => {},
    } as any);

    expect(complexity).toBe("complex");
    const selected = await router.selectModel(complexity, "c1");
    expect(selected?.id).toBe("MiniMax-M2.5-highspeed"); // forced downgrade
  });

  it("all tasks go to M2.1 at 93-100% budget (4300 requests)", async () => {
    const router = createModelRouter({} as any);
    router.setBudgetCount(4300);

    const complexComplexity = classifyTask({
      runId: "run-1",
      agent: { id: "a1", companyId: "c1", name: "Test", adapterType: "managed_service", adapterConfig: {} },
      runtime: { sessionId: null, sessionParams: null, sessionDisplayId: null, taskKey: null },
      config: { issue: { priority: "critical" }, prompt: "x".repeat(600) },
      context: {},
      onLog: async () => {},
    } as any);

    const selected = await router.selectModel(complexComplexity, "c1");
    expect(selected?.id).toBe("MiniMax-M2.1-highspeed");
  });

  it("quota exhausted at 4500 requests returns null", async () => {
    const router = createModelRouter({} as any);
    router.setBudgetCount(4500);

    const selected = await router.selectModel("complex", "c1");
    expect(selected).toBeNull();
  });

  it("circuit breaker opens after 3 failures and getNextTier cascades", () => {
    const router = createModelRouter({} as any);
    router.setBudgetCount(0);

    router.recordFailure("MiniMax-M2.7-highspeed" as any, { statusCode: 500 });
    router.recordFailure("MiniMax-M2.7-highspeed" as any, { statusCode: 500 });
    router.recordFailure("MiniMax-M2.7-highspeed" as any, { statusCode: 500 });

    expect(router.getRouterState().circuits["MiniMax-M2.7-highspeed" as any].state).toBe("OPEN");
    expect(router.getNextTier("MiniMax-M2.7-highspeed" as any)).toBe("MiniMax-M2.5-highspeed");
  });
});
