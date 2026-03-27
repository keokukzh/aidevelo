import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyDataDirOverride } from "../config/data-dir.js";

const ORIGINAL_ENV = { ...process.env };

describe("applyDataDirOverride", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.AIDEVELO_HOME;
    delete process.env.AIDEVELO_CONFIG;
    delete process.env.AIDEVELO_CONTEXT;
    delete process.env.AIDEVELO_INSTANCE_ID;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("sets AIDEVELO_HOME and isolated default config/context paths", () => {
    const home = applyDataDirOverride({
      dataDir: "~/aidevelo-data",
      config: undefined,
      context: undefined,
    }, { hasConfigOption: true, hasContextOption: true });

    const expectedHome = path.resolve(os.homedir(), "aidevelo-data");
    expect(home).toBe(expectedHome);
    expect(process.env.AIDEVELO_HOME).toBe(expectedHome);
    expect(process.env.AIDEVELO_CONFIG).toBe(
      path.resolve(expectedHome, "instances", "default", "config.json"),
    );
    expect(process.env.AIDEVELO_CONTEXT).toBe(path.resolve(expectedHome, "context.json"));
    expect(process.env.AIDEVELO_INSTANCE_ID).toBe("default");
  });

  it("uses the provided instance id when deriving default config path", () => {
    const home = applyDataDirOverride({
      dataDir: "/tmp/aidevelo-alt",
      instance: "dev_1",
      config: undefined,
      context: undefined,
    }, { hasConfigOption: true, hasContextOption: true });

    expect(home).toBe(path.resolve("/tmp/aidevelo-alt"));
    expect(process.env.AIDEVELO_INSTANCE_ID).toBe("dev_1");
    expect(process.env.AIDEVELO_CONFIG).toBe(
      path.resolve("/tmp/aidevelo-alt", "instances", "dev_1", "config.json"),
    );
  });

  it("does not override explicit config/context settings", () => {
    process.env.AIDEVELO_CONFIG = "/env/config.json";
    process.env.AIDEVELO_CONTEXT = "/env/context.json";

    applyDataDirOverride({
      dataDir: "/tmp/aidevelo-alt",
      config: "/flag/config.json",
      context: "/flag/context.json",
    }, { hasConfigOption: true, hasContextOption: true });

    expect(process.env.AIDEVELO_CONFIG).toBe("/env/config.json");
    expect(process.env.AIDEVELO_CONTEXT).toBe("/env/context.json");
  });

  it("only applies defaults for options supported by the command", () => {
    applyDataDirOverride(
      {
        dataDir: "/tmp/aidevelo-alt",
      },
      { hasConfigOption: false, hasContextOption: false },
    );

    expect(process.env.AIDEVELO_HOME).toBe(path.resolve("/tmp/aidevelo-alt"));
    expect(process.env.AIDEVELO_CONFIG).toBeUndefined();
    expect(process.env.AIDEVELO_CONTEXT).toBeUndefined();
  });
});
