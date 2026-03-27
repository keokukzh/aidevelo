import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execute } from "@aideveloai/adapter-codex-local/server";

async function writeFakeCodexCommand(commandPath: string): Promise<void> {
  const script = `#!/usr/bin/env node
const fs = require("node:fs");

const capturePath = process.env.AIDEVELO_TEST_CAPTURE_PATH;
const payload = {
  argv: process.argv.slice(2),
  prompt: fs.readFileSync(0, "utf8"),
  codexHome: process.env.CODEX_HOME || null,
  aideveloEnvKeys: Object.keys(process.env)
    .filter((key) => key.startsWith("AIDEVELO_"))
    .sort(),
};
if (capturePath) {
  fs.writeFileSync(capturePath, JSON.stringify(payload), "utf8");
}
console.log(JSON.stringify({ type: "thread.started", thread_id: "codex-session-1" }));
console.log(JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "hello" } }));
console.log(JSON.stringify({ type: "turn.completed", usage: { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1 } }));
`;
  if (process.platform === "win32") {
    const wrapperPath = commandPath.toLowerCase().endsWith(".cmd") ? commandPath : `${commandPath}.cmd`;
    const nodeScriptPath = wrapperPath.replace(/\.cmd$/i, ".js");
    const wrapper = [
      "@echo off",
      `node "${nodeScriptPath}" %*`,
      "",
    ].join("\r\n");
    await fs.writeFile(nodeScriptPath, script, "utf8");
    await fs.writeFile(wrapperPath, wrapper, "utf8");
    return;
  }
  await fs.writeFile(commandPath, script, "utf8");
  await fs.chmod(commandPath, 0o755);
}

type CapturePayload = {
  argv: string[];
  prompt: string;
  codexHome: string | null;
  aideveloEnvKeys: string[];
};

type LogEntry = {
  stream: "stdout" | "stderr";
  chunk: string;
};

describe("codex execute", () => {
  it("uses a Aidevelo-managed CODEX_HOME outside worktree mode while preserving shared auth and config", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "aidevelo-codex-execute-default-"));
    const workspace = path.join(root, "workspace");
    const commandPath = process.platform === "win32" ? path.join(root, "codex.cmd") : path.join(root, "codex");
    const capturePath = path.join(root, "capture.json");
    const sharedCodexHome = path.join(root, "shared-codex-home");
    const aideveloHome = path.join(root, "aidevelo-home");
    const managedCodexHome = path.join(
      aideveloHome,
      "instances",
      "default",
      "companies",
      "company-1",
      "codex-home",
    );
    await fs.mkdir(workspace, { recursive: true });
    await fs.mkdir(sharedCodexHome, { recursive: true });
    await fs.writeFile(path.join(sharedCodexHome, "auth.json"), '{"token":"shared"}\n', "utf8");
    await fs.writeFile(path.join(sharedCodexHome, "config.toml"), 'model = "codex-mini-latest"\n', "utf8");
    await writeFakeCodexCommand(commandPath);

    const previousHome = process.env.HOME;
    const previousAideveloHome = process.env.AIDEVELO_HOME;
    const previousAideveloInstanceId = process.env.AIDEVELO_INSTANCE_ID;
    const previousAideveloInWorktree = process.env.AIDEVELO_IN_WORKTREE;
    const previousCodexHome = process.env.CODEX_HOME;
    process.env.HOME = root;
    process.env.AIDEVELO_HOME = aideveloHome;
    delete process.env.AIDEVELO_INSTANCE_ID;
    delete process.env.AIDEVELO_IN_WORKTREE;
    process.env.CODEX_HOME = sharedCodexHome;

    try {
      const logs: LogEntry[] = [];
      const result = await execute({
        runId: "run-default",
        agent: {
          id: "agent-1",
          companyId: "company-1",
          name: "Codex Coder",
          adapterType: "codex_local",
          adapterConfig: {},
        },
        runtime: {
          sessionId: null,
          sessionParams: null,
          sessionDisplayId: null,
          taskKey: null,
        },
        config: {
          command: commandPath,
          cwd: workspace,
          env: {
            AIDEVELO_TEST_CAPTURE_PATH: capturePath,
          },
          promptTemplate: "Follow the aidevelo heartbeat.",
        },
        context: {},
        authToken: "run-jwt-token",
        onLog: async (stream, chunk) => {
          logs.push({ stream, chunk });
        },
      });

      expect(result.exitCode).toBe(0);
      expect(result.errorMessage).toBeNull();

      const capture = JSON.parse(await fs.readFile(capturePath, "utf8")) as CapturePayload;
      expect(capture.codexHome).toBe(managedCodexHome);

      const managedAuth = path.join(managedCodexHome, "auth.json");
      const managedConfig = path.join(managedCodexHome, "config.toml");
      expect((await fs.lstat(managedAuth)).isSymbolicLink()).toBe(true);
      expect(await fs.realpath(managedAuth)).toBe(await fs.realpath(path.join(sharedCodexHome, "auth.json")));
      expect((await fs.lstat(managedConfig)).isFile()).toBe(true);
      expect(await fs.readFile(managedConfig, "utf8")).toBe('model = "codex-mini-latest"\n');
      await expect(fs.lstat(path.join(sharedCodexHome, "companies", "company-1"))).rejects.toThrow();
      expect(logs).toContainEqual(
        expect.objectContaining({
          stream: "stdout",
          chunk: expect.stringContaining("Using Aidevelo-managed Codex home"),
        }),
      );
    } finally {
      if (previousHome === undefined) delete process.env.HOME;
      else process.env.HOME = previousHome;
      if (previousAideveloHome === undefined) delete process.env.AIDEVELO_HOME;
      else process.env.AIDEVELO_HOME = previousAideveloHome;
      if (previousAideveloInstanceId === undefined) delete process.env.AIDEVELO_INSTANCE_ID;
      else process.env.AIDEVELO_INSTANCE_ID = previousAideveloInstanceId;
      if (previousAideveloInWorktree === undefined) delete process.env.AIDEVELO_IN_WORKTREE;
      else process.env.AIDEVELO_IN_WORKTREE = previousAideveloInWorktree;
      if (previousCodexHome === undefined) delete process.env.CODEX_HOME;
      else process.env.CODEX_HOME = previousCodexHome;
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("uses a worktree-isolated CODEX_HOME while preserving shared auth and config", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "aidevelo-codex-execute-"));
    const workspace = path.join(root, "workspace");
    const commandPath = process.platform === "win32" ? path.join(root, "codex.cmd") : path.join(root, "codex");
    const capturePath = path.join(root, "capture.json");
    const sharedCodexHome = path.join(root, "shared-codex-home");
    const aideveloHome = path.join(root, "aidevelo-home");
    const isolatedCodexHome = path.join(
      aideveloHome,
      "instances",
      "worktree-1",
      "companies",
      "company-1",
      "codex-home",
    );
    const workspaceSkill = path.join(workspace, ".agents", "skills", "aidevelo");
    await fs.mkdir(workspace, { recursive: true });
    await fs.mkdir(sharedCodexHome, { recursive: true });
    await fs.writeFile(path.join(sharedCodexHome, "auth.json"), '{"token":"shared"}\n', "utf8");
    await fs.writeFile(path.join(sharedCodexHome, "config.toml"), 'model = "codex-mini-latest"\n', "utf8");
    await writeFakeCodexCommand(commandPath);

    const previousHome = process.env.HOME;
    const previousAideveloHome = process.env.AIDEVELO_HOME;
    const previousAideveloInstanceId = process.env.AIDEVELO_INSTANCE_ID;
    const previousAideveloInWorktree = process.env.AIDEVELO_IN_WORKTREE;
    const previousCodexHome = process.env.CODEX_HOME;
    process.env.HOME = root;
    process.env.AIDEVELO_HOME = aideveloHome;
    process.env.AIDEVELO_INSTANCE_ID = "worktree-1";
    process.env.AIDEVELO_IN_WORKTREE = "true";
    process.env.CODEX_HOME = sharedCodexHome;

    try {
      const logs: LogEntry[] = [];
      const result = await execute({
        runId: "run-1",
        agent: {
          id: "agent-1",
          companyId: "company-1",
          name: "Codex Coder",
          adapterType: "codex_local",
          adapterConfig: {},
        },
        runtime: {
          sessionId: null,
          sessionParams: null,
          sessionDisplayId: null,
          taskKey: null,
        },
        config: {
          command: commandPath,
          cwd: workspace,
          env: {
            AIDEVELO_TEST_CAPTURE_PATH: capturePath,
          },
          promptTemplate: "Follow the aidevelo heartbeat.",
        },
        context: {},
        authToken: "run-jwt-token",
        onLog: async (stream, chunk) => {
          logs.push({ stream, chunk });
        },
      });

      expect(result.exitCode).toBe(0);
      expect(result.errorMessage).toBeNull();

      const capture = JSON.parse(await fs.readFile(capturePath, "utf8")) as CapturePayload;
      expect(capture.codexHome).toBe(isolatedCodexHome);
      expect(capture.argv).toEqual(expect.arrayContaining(["exec", "--json", "-"]));
      expect(capture.prompt).toContain("Follow the aidevelo heartbeat.");
      expect(capture.aideveloEnvKeys).toEqual(
        expect.arrayContaining([
          "AIDEVELO_AGENT_ID",
          "AIDEVELO_API_KEY",
          "AIDEVELO_API_URL",
          "AIDEVELO_COMPANY_ID",
          "AIDEVELO_RUN_ID",
        ]),
      );

      const isolatedAuth = path.join(isolatedCodexHome, "auth.json");
      const isolatedConfig = path.join(isolatedCodexHome, "config.toml");

      expect((await fs.lstat(isolatedAuth)).isSymbolicLink()).toBe(true);
      expect(await fs.realpath(isolatedAuth)).toBe(await fs.realpath(path.join(sharedCodexHome, "auth.json")));
      expect((await fs.lstat(isolatedConfig)).isFile()).toBe(true);
      expect(await fs.readFile(isolatedConfig, "utf8")).toBe('model = "codex-mini-latest"\n');
      expect((await fs.lstat(workspaceSkill)).isSymbolicLink()).toBe(true);
      expect(logs).toContainEqual(
        expect.objectContaining({
          stream: "stdout",
          chunk: expect.stringContaining("Using worktree-isolated Codex home"),
        }),
      );
      expect(logs).toContainEqual(
        expect.objectContaining({
          stream: "stdout",
          chunk: expect.stringContaining('Injected Codex skill "aidevelo"'),
        }),
      );
    } finally {
      if (previousHome === undefined) delete process.env.HOME;
      else process.env.HOME = previousHome;
      if (previousAideveloHome === undefined) delete process.env.AIDEVELO_HOME;
      else process.env.AIDEVELO_HOME = previousAideveloHome;
      if (previousAideveloInstanceId === undefined) delete process.env.AIDEVELO_INSTANCE_ID;
      else process.env.AIDEVELO_INSTANCE_ID = previousAideveloInstanceId;
      if (previousAideveloInWorktree === undefined) delete process.env.AIDEVELO_IN_WORKTREE;
      else process.env.AIDEVELO_IN_WORKTREE = previousAideveloInWorktree;
      if (previousCodexHome === undefined) delete process.env.CODEX_HOME;
      else process.env.CODEX_HOME = previousCodexHome;
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("respects an explicit CODEX_HOME config override even in worktree mode", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "aidevelo-codex-execute-explicit-"));
    const workspace = path.join(root, "workspace");
    const commandPath = process.platform === "win32" ? path.join(root, "codex.cmd") : path.join(root, "codex");
    const capturePath = path.join(root, "capture.json");
    const sharedCodexHome = path.join(root, "shared-codex-home");
    const explicitCodexHome = path.join(root, "explicit-codex-home");
    const aideveloHome = path.join(root, "aidevelo-home");
    await fs.mkdir(workspace, { recursive: true });
    await fs.mkdir(sharedCodexHome, { recursive: true });
    await fs.writeFile(path.join(sharedCodexHome, "auth.json"), '{"token":"shared"}\n', "utf8");
    await writeFakeCodexCommand(commandPath);

    const previousHome = process.env.HOME;
    const previousAideveloHome = process.env.AIDEVELO_HOME;
    const previousAideveloInstanceId = process.env.AIDEVELO_INSTANCE_ID;
    const previousAideveloInWorktree = process.env.AIDEVELO_IN_WORKTREE;
    const previousCodexHome = process.env.CODEX_HOME;
    process.env.HOME = root;
    process.env.AIDEVELO_HOME = aideveloHome;
    process.env.AIDEVELO_INSTANCE_ID = "worktree-1";
    process.env.AIDEVELO_IN_WORKTREE = "true";
    process.env.CODEX_HOME = sharedCodexHome;

    try {
      const result = await execute({
        runId: "run-2",
        agent: {
          id: "agent-1",
          companyId: "company-1",
          name: "Codex Coder",
          adapterType: "codex_local",
          adapterConfig: {},
        },
        runtime: {
          sessionId: null,
          sessionParams: null,
          sessionDisplayId: null,
          taskKey: null,
        },
        config: {
          command: commandPath,
          cwd: workspace,
          env: {
            AIDEVELO_TEST_CAPTURE_PATH: capturePath,
            CODEX_HOME: explicitCodexHome,
          },
          promptTemplate: "Follow the aidevelo heartbeat.",
        },
        context: {},
        authToken: "run-jwt-token",
        onLog: async () => {},
      });

      expect(result.exitCode).toBe(0);
      expect(result.errorMessage).toBeNull();

      const capture = JSON.parse(await fs.readFile(capturePath, "utf8")) as CapturePayload;
      expect(capture.codexHome).toBe(explicitCodexHome);
      expect((await fs.lstat(path.join(workspace, ".agents", "skills", "aidevelo"))).isSymbolicLink()).toBe(true);
      await expect(fs.lstat(path.join(aideveloHome, "instances", "worktree-1", "codex-home"))).rejects.toThrow();
    } finally {
      if (previousHome === undefined) delete process.env.HOME;
      else process.env.HOME = previousHome;
      if (previousAideveloHome === undefined) delete process.env.AIDEVELO_HOME;
      else process.env.AIDEVELO_HOME = previousAideveloHome;
      if (previousAideveloInstanceId === undefined) delete process.env.AIDEVELO_INSTANCE_ID;
      else process.env.AIDEVELO_INSTANCE_ID = previousAideveloInstanceId;
      if (previousAideveloInWorktree === undefined) delete process.env.AIDEVELO_IN_WORKTREE;
      else process.env.AIDEVELO_IN_WORKTREE = previousAideveloInWorktree;
      if (previousCodexHome === undefined) delete process.env.CODEX_HOME;
      else process.env.CODEX_HOME = previousCodexHome;
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("writes a managed MiniMax Codex profile when MINIMAX_API_KEY is configured", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "aidevelo-codex-execute-minimax-"));
    const workspace = path.join(root, "workspace");
    const commandPath = process.platform === "win32" ? path.join(root, "codex.cmd") : path.join(root, "codex");
    const capturePath = path.join(root, "capture.json");
    const sharedCodexHome = path.join(root, "shared-codex-home");
    const aideveloHome = path.join(root, "aidevelo-home");
    const managedCodexHome = path.join(
      aideveloHome,
      "instances",
      "default",
      "companies",
      "company-1",
      "codex-home",
    );
    await fs.mkdir(workspace, { recursive: true });
    await fs.mkdir(sharedCodexHome, { recursive: true });
    await fs.writeFile(path.join(sharedCodexHome, "auth.json"), '{"token":"shared"}\n', "utf8");
    await fs.writeFile(path.join(sharedCodexHome, "config.toml"), 'model = "codex-mini-latest"\n', "utf8");
    await writeFakeCodexCommand(commandPath);

    const previousHome = process.env.HOME;
    const previousAideveloHome = process.env.AIDEVELO_HOME;
    const previousAideveloInstanceId = process.env.AIDEVELO_INSTANCE_ID;
    const previousAideveloInWorktree = process.env.AIDEVELO_IN_WORKTREE;
    const previousCodexHome = process.env.CODEX_HOME;
    const previousOpenAiApiKey = process.env.OPENAI_API_KEY;
    process.env.HOME = root;
    process.env.AIDEVELO_HOME = aideveloHome;
    delete process.env.AIDEVELO_INSTANCE_ID;
    delete process.env.AIDEVELO_IN_WORKTREE;
    process.env.CODEX_HOME = sharedCodexHome;
    process.env.OPENAI_API_KEY = "should-not-leak";

    try {
      const result = await execute({
        runId: "run-minimax",
        agent: {
          id: "agent-1",
          companyId: "company-1",
          name: "Codex Coder",
          adapterType: "codex_local",
          adapterConfig: {},
        },
        runtime: {
          sessionId: null,
          sessionParams: null,
          sessionDisplayId: null,
          taskKey: null,
        },
        config: {
          command: commandPath,
          cwd: workspace,
          env: {
            AIDEVELO_TEST_CAPTURE_PATH: capturePath,
            MINIMAX_API_KEY: "sk-mm-test",
          },
          promptTemplate: "Use MiniMax for this run.",
        },
        context: {},
        authToken: "run-jwt-token",
        onLog: async () => {},
      });

      expect(result.exitCode).toBe(0);
      expect(result.errorMessage).toBeNull();
      expect(result.provider).toBe("minimax");
      expect(result.biller).toBe("minimax");
      expect(result.billingType).toBe("api");

      const capture = JSON.parse(await fs.readFile(capturePath, "utf8")) as CapturePayload;
      expect(capture.argv.slice(0, 4)).toEqual(["--profile", "aidevelo_managed", "exec", "--json"]);
      const managedConfig = await fs.readFile(path.join(managedCodexHome, "config.toml"), "utf8");
      expect(managedConfig).toContain("[model_providers.minimax]");
      expect(managedConfig).toContain('base_url = "https://api.minimax.io/v1"');
      expect(managedConfig).toContain('env_key = "MINIMAX_API_KEY"');
      expect(managedConfig).toContain("[profiles.aidevelo_managed]");
    } finally {
      if (previousHome === undefined) delete process.env.HOME;
      else process.env.HOME = previousHome;
      if (previousAideveloHome === undefined) delete process.env.AIDEVELO_HOME;
      else process.env.AIDEVELO_HOME = previousAideveloHome;
      if (previousAideveloInstanceId === undefined) delete process.env.AIDEVELO_INSTANCE_ID;
      else process.env.AIDEVELO_INSTANCE_ID = previousAideveloInstanceId;
      if (previousAideveloInWorktree === undefined) delete process.env.AIDEVELO_IN_WORKTREE;
      else process.env.AIDEVELO_IN_WORKTREE = previousAideveloInWorktree;
      if (previousCodexHome === undefined) delete process.env.CODEX_HOME;
      else process.env.CODEX_HOME = previousCodexHome;
      if (previousOpenAiApiKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previousOpenAiApiKey;
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
