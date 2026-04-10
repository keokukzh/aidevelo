import { describe, expect, it } from "vitest";
import {
  isDuplicateHeartbeatTickPayload,
  isDuplicateRoutineDispatchPayload,
} from "../services/job-queue.js";

describe("job queue dedupe helpers", () => {
  it("detects heartbeat ticks inside the dedupe window", () => {
    const existing = { tickTimestamp: "2026-01-01T00:00:10.000Z" };
    expect(
      isDuplicateHeartbeatTickPayload(existing, "2026-01-01T00:00:11.000Z", 2000),
    ).toBe(true);
  });

  it("ignores heartbeat ticks outside the dedupe window", () => {
    const existing = { tickTimestamp: "2026-01-01T00:00:10.000Z" };
    expect(
      isDuplicateHeartbeatTickPayload(existing, "2026-01-01T00:00:20.000Z", 2000),
    ).toBe(false);
  });

  it("detects routine dispatch duplicates by trigger and scheduled tick", () => {
    expect(
      isDuplicateRoutineDispatchPayload(
        {
          triggerId: "trig-1",
          scheduledTick: "2026-01-01T00:05:00.000Z",
        },
        {
          triggerId: "trig-1",
          routineId: "routine-1",
          companyId: "company-1",
          scheduledTick: "2026-01-01T00:05:00.000Z",
        },
      ),
    ).toBe(true);
  });

  it("does not match routine dispatch with different tick", () => {
    expect(
      isDuplicateRoutineDispatchPayload(
        {
          triggerId: "trig-1",
          scheduledTick: "2026-01-01T00:05:00.000Z",
        },
        {
          triggerId: "trig-1",
          routineId: "routine-1",
          companyId: "company-1",
          scheduledTick: "2026-01-01T00:06:00.000Z",
        },
      ),
    ).toBe(false);
  });
});
