import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  listCodexSkills,
  syncCodexSkills,
} from "@aideveloai/adapter-codex-local/server";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

describe("codex local skill sync", () => {
  const aideveloKey = "aideveloai/aidevelo/aidevelo";
  const cleanupDirs = new Set<string>();

  afterEach(async () => {
    await Promise.all(Array.from(cleanupDirs).map((dir) => fs.rm(dir, { recursive: true, force: true })));
    cleanupDirs.clear();
  });

  it("reports configured Aidevelo skills for workspace injection on the next run", async () => {
    const codexHome = await makeTempDir("aidevelo-codex-skill-sync-");
    cleanupDirs.add(codexHome);

    const ctx = {
      agentId: "agent-1",
      companyId: "company-1",
      adapterType: "codex_local",
      config: {
        env: {
          CODEX_HOME: codexHome,
        },
        aideveloSkillSync: {
          desiredSkills: [aideveloKey],
        },
      },
    } as const;

    const before = await listCodexSkills(ctx);
    expect(before.mode).toBe("ephemeral");
    expect(before.desiredSkills).toContain(aideveloKey);
    expect(before.entries.find((entry) => entry.key === aideveloKey)?.required).toBe(true);
    expect(before.entries.find((entry) => entry.key === aideveloKey)?.state).toBe("configured");
    expect(before.entries.find((entry) => entry.key === aideveloKey)?.detail).toContain(".agents/skills");
  });

  it("does not persist Aidevelo skills into CODEX_HOME during sync", async () => {
    const codexHome = await makeTempDir("aidevelo-codex-skill-prune-");
    cleanupDirs.add(codexHome);

    const configuredCtx = {
      agentId: "agent-2",
      companyId: "company-1",
      adapterType: "codex_local",
      config: {
        env: {
          CODEX_HOME: codexHome,
        },
        aideveloSkillSync: {
          desiredSkills: [aideveloKey],
        },
      },
    } as const;

    const after = await syncCodexSkills(configuredCtx, [aideveloKey]);
    expect(after.mode).toBe("ephemeral");
    expect(after.entries.find((entry) => entry.key === aideveloKey)?.state).toBe("configured");
    await expect(fs.lstat(path.join(codexHome, "skills", "aidevelo"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("keeps required bundled Aidevelo skills configured even when the desired set is emptied", async () => {
    const codexHome = await makeTempDir("aidevelo-codex-skill-required-");
    cleanupDirs.add(codexHome);

    const configuredCtx = {
      agentId: "agent-2",
      companyId: "company-1",
      adapterType: "codex_local",
      config: {
        env: {
          CODEX_HOME: codexHome,
        },
        aideveloSkillSync: {
          desiredSkills: [],
        },
      },
    } as const;

    const after = await syncCodexSkills(configuredCtx, []);
    expect(after.desiredSkills).toContain(aideveloKey);
    expect(after.entries.find((entry) => entry.key === aideveloKey)?.state).toBe("configured");
  });

  it("normalizes legacy flat Aidevelo skill refs before reporting configured state", async () => {
    const codexHome = await makeTempDir("aidevelo-codex-legacy-skill-sync-");
    cleanupDirs.add(codexHome);

    const snapshot = await listCodexSkills({
      agentId: "agent-3",
      companyId: "company-1",
      adapterType: "codex_local",
      config: {
        env: {
          CODEX_HOME: codexHome,
        },
        aideveloSkillSync: {
          desiredSkills: ["aidevelo"],
        },
      },
    });

    expect(snapshot.warnings).toEqual([]);
    expect(snapshot.desiredSkills).toContain(aideveloKey);
    expect(snapshot.desiredSkills).not.toContain("aidevelo");
    expect(snapshot.entries.find((entry) => entry.key === aideveloKey)?.state).toBe("configured");
    expect(snapshot.entries.find((entry) => entry.key === "aidevelo")).toBeUndefined();
  });
});
