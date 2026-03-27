import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureAgentJwtSecret } from "../ensure-agent-jwt-secret.ts";
import { provisionAgentHomeForRole } from "../services/agent-home-provisioning.ts";

function utcTodayYmd(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

describe("local_trusted bootstrap + CEO workspace provisioning", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.AIDEVELO_AGENT_JWT_SECRET;
    delete process.env.AIDEVELO_HOME;
    delete process.env.AIDEVELO_INSTANCE_ID;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("auto-creates AIDEVELO_AGENT_JWT_SECRET in local_trusted env file", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "aidevelo-jwt-secret-"));
    const tempConfigPath = path.join(tempDir, "config.json");

    const envFilePath = path.join(tempDir, ".env");
    await fs.rm(envFilePath, { force: true });

    const result1 = await ensureAgentJwtSecret(tempConfigPath);
    expect(result1.created).toBe(true);
    expect(process.env.AIDEVELO_AGENT_JWT_SECRET?.trim().length).toBeGreaterThan(10);

    const envContents = await fs.readFile(envFilePath, "utf-8");
    expect(envContents).toContain("AIDEVELO_AGENT_JWT_SECRET=");

    const secretAfterFirst = process.env.AIDEVELO_AGENT_JWT_SECRET;
    const result2 = await ensureAgentJwtSecret(tempConfigPath);
    expect(result2.created).toBe(false);
    expect(process.env.AIDEVELO_AGENT_JWT_SECRET).toBe(secretAfterFirst);
  });

  it("provisions CEO agent home with PARA folders + reference files", async () => {
    const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "aidevelo-home-"));
    process.env.AIDEVELO_HOME = tempHome;
    process.env.AIDEVELO_INSTANCE_ID = "test";

    const agentId = "agent-1";

    const agentHome = path.join(tempHome, "instances", "test", "workspaces", agentId);
    const memoryDir = path.join(agentHome, "memory");
    const lifeDir = path.join(agentHome, "life");

    const todayYmd = utcTodayYmd();
    const todayFile = path.join(memoryDir, `${todayYmd}.md`);

    await provisionAgentHomeForRole(agentId, "ceo");

    // Core PARA folders
    await expect(fs.stat(path.join(lifeDir, "projects"))).resolves.toBeDefined();
    await expect(fs.stat(path.join(lifeDir, "areas", "people"))).resolves.toBeDefined();
    await expect(fs.stat(path.join(lifeDir, "areas", "companies"))).resolves.toBeDefined();
    await expect(fs.stat(path.join(lifeDir, "resources"))).resolves.toBeDefined();
    await expect(fs.stat(path.join(lifeDir, "archives"))).resolves.toBeDefined();

    // CEO reference files + memory skeleton
    await expect(fs.stat(path.join(agentHome, "HEARTBEAT.md"))).resolves.toBeDefined();
    await expect(fs.stat(path.join(agentHome, "SOUL.md"))).resolves.toBeDefined();
    await expect(fs.stat(path.join(agentHome, "TOOLS.md"))).resolves.toBeDefined();
    await expect(fs.stat(path.join(agentHome, "MEMORY.md"))).resolves.toBeDefined();

    await expect(fs.stat(memoryDir)).resolves.toBeDefined();

    // Today file (allow slight date drift to avoid midnight edge cases).
    const yesterdayYmd = utcTodayYmd(new Date(Date.now() - 24 * 60 * 60 * 1000));
    const tomorrowYmd = utcTodayYmd(new Date(Date.now() + 24 * 60 * 60 * 1000));
    let foundAnyTodayFile = false;
    for (const ymd of [todayYmd, yesterdayYmd, tomorrowYmd]) {
      const candidate = path.join(memoryDir, `${ymd}.md`);
      try {
        await fs.stat(candidate);
        foundAnyTodayFile = true;
        break;
      } catch {
        // keep trying
      }
    }
    expect(foundAnyTodayFile).toBe(true);

    // Ensure provisioning is idempotent and repairs missing reference files.
    const soulPath = path.join(agentHome, "SOUL.md");
    await fs.rm(soulPath, { force: true });
    await provisionAgentHomeForRole(agentId, "ceo");

    const soulContents = await fs.readFile(soulPath, "utf-8");
    expect(soulContents).toContain("You are the CEO.");
  });
});

