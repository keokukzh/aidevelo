import fs from "node:fs/promises";
import path from "node:path";
import { loadDefaultAgentInstructionsBundle } from "./default-agent-instructions.js";
import { resolveDefaultAgentWorkspaceDir } from "../home-paths.js";

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

function utcTodayYmd(now = new Date()): string {
  // Keep deterministic for both local runs and tests.
  return now.toISOString().slice(0, 10);
}

function buildTodayMemoryFileTemplate(todayYmd: string): string {
  return `# ${todayYmd}

## Today's Plan
- [ ] 

## Blockers

## Progress
`;
}

function buildMemoryFileTemplate(): string {
  return `# MEMORY.md

Tacit knowledge about the user and how they operate.

This file is owned by the agent and should be updated during heartbeats.
`;
}

export async function provisionAgentHomeForRole(agentId: string, role: string): Promise<void> {
  if (role !== "ceo") return;

  const agentHome = resolveDefaultAgentWorkspaceDir(agentId);
  const markerPath = path.join(agentHome, ".aidevelo-agent-home-provisioned");

  // Ensure root exists so any subsequent mkdir/write calls have a base.
  await fs.mkdir(agentHome, { recursive: true });

  const markerExists = await pathExists(markerPath);

  await fs.mkdir(path.join(agentHome, "life", "projects"), { recursive: true });
  await fs.mkdir(path.join(agentHome, "life", "areas", "people"), { recursive: true });
  await fs.mkdir(path.join(agentHome, "life", "areas", "companies"), { recursive: true });
  await fs.mkdir(path.join(agentHome, "life", "resources"), { recursive: true });
  await fs.mkdir(path.join(agentHome, "life", "archives"), { recursive: true });

  const memoryDir = path.join(agentHome, "memory");
  await fs.mkdir(memoryDir, { recursive: true });

  const memoryFilePath = path.join(agentHome, "MEMORY.md");
  if (!(await pathExists(memoryFilePath))) {
    await fs.writeFile(memoryFilePath, buildMemoryFileTemplate(), "utf-8");
  }

  const todayYmd = utcTodayYmd();
  const todayFilePath = path.join(memoryDir, `${todayYmd}.md`);
  if (!(await pathExists(todayFilePath))) {
    await fs.writeFile(todayFilePath, buildTodayMemoryFileTemplate(todayYmd), "utf-8");
  }

  const heartbeatPath = path.join(agentHome, "HEARTBEAT.md");
  const soulPath = path.join(agentHome, "SOUL.md");
  const toolsPath = path.join(agentHome, "TOOLS.md");
  const missingReferenceFiles = [
    !(await pathExists(heartbeatPath)),
    !(await pathExists(soulPath)),
    !(await pathExists(toolsPath)),
  ].some(Boolean);

  const bundle = missingReferenceFiles ? await loadDefaultAgentInstructionsBundle("ceo") : null;

  if (bundle) {
    if (!(await pathExists(heartbeatPath)) && bundle["HEARTBEAT.md"]?.trim()) {
      await fs.writeFile(heartbeatPath, bundle["HEARTBEAT.md"], "utf-8");
    }
    if (!(await pathExists(soulPath)) && bundle["SOUL.md"]?.trim()) {
      await fs.writeFile(soulPath, bundle["SOUL.md"], "utf-8");
    }
    if (!(await pathExists(toolsPath)) && bundle["TOOLS.md"]?.trim()) {
      await fs.writeFile(toolsPath, bundle["TOOLS.md"], "utf-8");
    }
  }

  if (!markerExists) {
    await fs.writeFile(markerPath, `provisioned_at=${new Date().toISOString()}\n`, "utf-8");
  }
}

