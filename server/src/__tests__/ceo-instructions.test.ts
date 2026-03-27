import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { agentInstructionsService } from "../services/agent-instructions.js";
import { syncManagedCeoInstructions } from "../services/ceo-instructions.js";

type TestAgent = {
  id: string;
  companyId: string;
  name: string;
  role: string;
  adapterConfig: Record<string, unknown>;
};

async function makeTempDir(prefix: string) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

function makeAgent(adapterConfig: Record<string, unknown>): TestAgent {
  return {
    id: "agent-1",
    companyId: "company-1",
    name: "CEO",
    role: "ceo",
    adapterConfig,
  };
}

describe("syncManagedCeoInstructions", () => {
  const originalAideveloHome = process.env.AIDEVELO_HOME;
  const originalAideveloInstanceId = process.env.AIDEVELO_INSTANCE_ID;
  const cleanupDirs = new Set<string>();

  afterEach(async () => {
    if (originalAideveloHome === undefined) delete process.env.AIDEVELO_HOME;
    else process.env.AIDEVELO_HOME = originalAideveloHome;
    if (originalAideveloInstanceId === undefined) delete process.env.AIDEVELO_INSTANCE_ID;
    else process.env.AIDEVELO_INSTANCE_ID = originalAideveloInstanceId;

    await Promise.all([...cleanupDirs].map(async (dir) => {
      await fs.rm(dir, { recursive: true, force: true });
      cleanupDirs.delete(dir);
    }));
  });

  it("replaces only the managed policy sections and preserves surrounding user edits", async () => {
    const aideveloHome = await makeTempDir("aidevelo-ceo-instructions-home-");
    cleanupDirs.add(aideveloHome);
    process.env.AIDEVELO_HOME = aideveloHome;
    process.env.AIDEVELO_INSTANCE_ID = "test-instance";

    const instructions = agentInstructionsService();
    const agent = makeAgent({
      instructionsBundleMode: "managed",
    });
    const materialized = await instructions.materializeManagedBundle(agent, {
      "AGENTS.md": [
        "Intro line",
        "",
        "## Custom Note",
        "Keep this paragraph exactly here.",
        "",
        "<!-- AIDEVELO_CEO_POLICY:START -->",
        "outdated policy",
        "<!-- AIDEVELO_CEO_POLICY:END -->",
      ].join("\n"),
      "HEARTBEAT.md": [
        "# HEARTBEAT.md",
        "",
        "<!-- AIDEVELO_CEO_HEARTBEAT_POLICY:START -->",
        "old heartbeat policy",
        "<!-- AIDEVELO_CEO_HEARTBEAT_POLICY:END -->",
      ].join("\n"),
      "SOUL.md": "# SOUL.md\n",
      "TOOLS.md": "# TOOLS.md\n",
    });

    const result = await syncManagedCeoInstructions({
      ...agent,
      adapterConfig: materialized.adapterConfig,
    });
    const agentsFile = await instructions.readFile(result.agent, "AGENTS.md");
    const heartbeatFile = await instructions.readFile(result.agent, "HEARTBEAT.md");

    expect(agentsFile.content).toContain("## Custom Note");
    expect(agentsFile.content).toContain("Keep this paragraph exactly here.");
    expect(agentsFile.content).toContain("## Managed CEO Policy");
    expect(agentsFile.content).not.toContain("outdated policy");
    expect(heartbeatFile.content).toContain("## Managed Runtime Policy");
    expect(heartbeatFile.content).not.toContain("old heartbeat policy");
  });

  it("keeps legacy CEOs conservative until behavior flags are explicitly stored", async () => {
    const aideveloHome = await makeTempDir("aidevelo-ceo-instructions-defaults-");
    cleanupDirs.add(aideveloHome);
    process.env.AIDEVELO_HOME = aideveloHome;
    process.env.AIDEVELO_INSTANCE_ID = "test-instance";

    const instructions = agentInstructionsService();
    const agent = makeAgent({
      instructionsBundleMode: "managed",
    });
    const materialized = await instructions.materializeManagedBundle(agent, {
      "AGENTS.md": "# CEO\n",
      "HEARTBEAT.md": "# HEARTBEAT\n",
      "SOUL.md": "# SOUL.md\n",
      "TOOLS.md": "# TOOLS.md\n",
    });

    const result = await syncManagedCeoInstructions({
      ...agent,
      adapterConfig: materialized.adapterConfig,
    });
    const agentsFile = await instructions.readFile(result.agent, "AGENTS.md");
    const heartbeatFile = await instructions.readFile(result.agent, "HEARTBEAT.md");

    expect(agentsFile.content).toContain("Do not generate new top-level initiatives when idle.");
    expect(agentsFile.content).toContain("Do not autonomously submit hire requests");
    expect(heartbeatFile.content).toContain("If you are idle, do not create new initiatives.");
  });
});
