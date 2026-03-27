import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  listGeminiSkills,
  syncGeminiSkills,
} from "@aideveloai/adapter-gemini-local/server";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

describe("gemini local skill sync", () => {
  const aideveloKey = "aideveloai/aidevelo/aidevelo";
  const cleanupDirs = new Set<string>();

  afterEach(async () => {
    await Promise.all(Array.from(cleanupDirs).map((dir) => fs.rm(dir, { recursive: true, force: true })));
    cleanupDirs.clear();
  });

  it("reports configured Aidevelo skills and installs them into the Gemini skills home", async () => {
    const home = await makeTempDir("aidevelo-gemini-skill-sync-");
    cleanupDirs.add(home);

    const ctx = {
      agentId: "agent-1",
      companyId: "company-1",
      adapterType: "gemini_local",
      config: {
        env: {
          HOME: home,
        },
        aideveloSkillSync: {
          desiredSkills: [aideveloKey],
        },
      },
    } as const;

    const before = await listGeminiSkills(ctx);
    expect(before.mode).toBe("persistent");
    expect(before.desiredSkills).toContain(aideveloKey);
    expect(before.entries.find((entry) => entry.key === aideveloKey)?.required).toBe(true);
    expect(before.entries.find((entry) => entry.key === aideveloKey)?.state).toBe("missing");

    const after = await syncGeminiSkills(ctx, [aideveloKey]);
    expect(after.entries.find((entry) => entry.key === aideveloKey)?.state).toBe("installed");
    expect((await fs.lstat(path.join(home, ".gemini", "skills", "aidevelo"))).isSymbolicLink()).toBe(true);
  });

  it("keeps required bundled Aidevelo skills installed even when the desired set is emptied", async () => {
    const home = await makeTempDir("aidevelo-gemini-skill-prune-");
    cleanupDirs.add(home);

    const configuredCtx = {
      agentId: "agent-2",
      companyId: "company-1",
      adapterType: "gemini_local",
      config: {
        env: {
          HOME: home,
        },
        aideveloSkillSync: {
          desiredSkills: [aideveloKey],
        },
      },
    } as const;

    await syncGeminiSkills(configuredCtx, [aideveloKey]);

    const clearedCtx = {
      ...configuredCtx,
      config: {
        env: {
          HOME: home,
        },
        aideveloSkillSync: {
          desiredSkills: [],
        },
      },
    } as const;

    const after = await syncGeminiSkills(clearedCtx, []);
    expect(after.desiredSkills).toContain(aideveloKey);
    expect(after.entries.find((entry) => entry.key === aideveloKey)?.state).toBe("installed");
    expect((await fs.lstat(path.join(home, ".gemini", "skills", "aidevelo"))).isSymbolicLink()).toBe(true);
  });
});
