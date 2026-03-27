import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { managedServiceAdapter } from "../adapters/managed/index.js";

const itWindows = process.platform === "win32" ? it : it.skip;

describe("managed_service MiniMax delegation", () => {
  itWindows("routes environment testing through Codex when MINIMAX_API_KEY is configured", async () => {
    const root = path.join(
      os.tmpdir(),
      `aidevelo-managed-minimax-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    const binDir = path.join(root, "bin");
    const cwd = path.join(root, "workspace");
    const fakeCodex = path.join(binDir, "codex.cmd");
    const script = [
      "@echo off",
      "echo {\"type\":\"thread.started\",\"thread_id\":\"test-thread\"}",
      "echo {\"type\":\"item.completed\",\"item\":{\"type\":\"agent_message\",\"text\":\"hello\"}}",
      "echo {\"type\":\"turn.completed\",\"usage\":{\"input_tokens\":1,\"cached_input_tokens\":0,\"output_tokens\":1}}",
      "exit /b 0",
      "",
    ].join("\r\n");

    try {
      await fs.mkdir(binDir, { recursive: true });
      await fs.writeFile(fakeCodex, script, "utf8");

      const result = await managedServiceAdapter.testEnvironment({
        companyId: "company-1",
        adapterType: "managed_service",
        config: {
          command: "codex",
          cwd,
          env: {
            MINIMAX_API_KEY: "sk-mm-test",
            PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}`,
          },
          primaryProvider: "minimax",
        },
      });

      expect(result.status).toBe("pass");
      expect(result.checks.some((check) => check.code === "managed_service_local_delegate")).toBe(true);
      expect(
        result.checks.some((check) => check.code === "codex_openai_compatible_provider_minimax"),
      ).toBe(true);
      expect(result.checks.some((check) => check.code === "codex_hello_probe_passed")).toBe(true);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
