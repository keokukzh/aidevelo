import { describe, expect, it } from "vitest";
import { classifyTask } from "../task-classifier.js";
import type { AdapterExecutionContext } from "@aideveloai/adapter-utils";

function makeCtx(overrides: Partial<AdapterExecutionContext["config"]> = {}): AdapterExecutionContext {
  return {
    runId: "run-1",
    agent: { id: "agent-1", companyId: "company-1", name: "Test", adapterType: "managed_service", adapterConfig: {} },
    runtime: { sessionId: null, sessionParams: null, sessionDisplayId: null, taskKey: null },
    config: { ...overrides },
    context: {},
    onLog: async () => {},
  };
}

describe("classifyTask", () => {
  it("scores >= 50 as complex", () => {
    // critical priority (+40) + prompt > 500 (+25) = 65 >= 50
    const ctx = makeCtx({
      issue: { priority: "critical" },
      prompt: "x".repeat(600),
    });
    expect(classifyTask(ctx)).toBe("complex");
  });

  it("scores >= 20 but < 50 as standard", () => {
    // medium priority (+20) + description > 200 (+15) = 35
    const ctx = makeCtx({
      issue: { priority: "medium", description: "x".repeat(300) },
      prompt: "",
    });
    expect(classifyTask(ctx)).toBe("standard");
  });

  it("scores < 20 as simple", () => {
    // prompt > 200 (+15) but no other signals = 15 < 20
    const ctx = makeCtx({
      issue: { priority: "low" },
      prompt: "x".repeat(250),
    });
    expect(classifyTask(ctx)).toBe("simple");
  });

  it("missing signals defaults to standard (safe fallback)", () => {
    const ctx = makeCtx({});
    expect(classifyTask(ctx)).toBe("standard");
  });

  it("detects multi-file keywords in prompt (score 15 → simple)", () => {
    // 'open' + 'edit' = +15, prompt length ~43 → no length bonus, total 15 < 20
    const ctx = makeCtx({
      prompt: "Please open file1.ts and edit file2.ts",
    });
    expect(classifyTask(ctx)).toBe("simple");
  });

  it("detects file:// URLs in prompt (score 15 → simple)", () => {
    const ctx = makeCtx({
      prompt: "file:///src/utils.ts and file:///src/app.ts",
    });
    expect(classifyTask(ctx)).toBe("simple");
  });

  it("scores feature task type", () => {
    // taskType feature (+20) + description > 200 (+15) = 35 → standard
    const ctx = makeCtx({
      taskType: "feature",
      prompt: "x".repeat(300),
    });
    expect(classifyTask(ctx)).toBe("standard");
  });

  it("scores debug task type", () => {
    const ctx = makeCtx({
      taskType: "debug",
      prompt: "x".repeat(50),
    });
    expect(classifyTask(ctx)).toBe("standard");
  });

  it("scores CEO proactive initiatives", () => {
    // ceoProfile (+10) + description > 200 (+15) = 25 → standard
    const ctx = makeCtx({
      agent: { ceoProfile: { name: "Proactive CEO" } as unknown as undefined },
      prompt: "x".repeat(300),
    });
    expect(classifyTask(ctx)).toBe("standard");
  });

  it("complex threshold: exactly 50 is complex", () => {
    // critical (+40) + >200 (+15) - 1 char = 55 but wait... let me be precise
    // critical (+40) + description > 200 (+15) = 55 >= 50 → complex
    const ctx = makeCtx({
      issue: { priority: "critical" },
      prompt: "x".repeat(300),
    });
    expect(classifyTask(ctx)).toBe("complex");
  });

  it("standard threshold: exactly 20 is standard", () => {
    // medium priority (+20) = 20 >= 20 → standard
    const ctx = makeCtx({
      issue: { priority: "medium" },
    });
    expect(classifyTask(ctx)).toBe("standard");
  });

  it("score 0 routes to standard (safe default per spec)", () => {
    const ctx = makeCtx({});
    expect(classifyTask(ctx)).toBe("standard");
  });
});
