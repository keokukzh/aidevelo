import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  describeLocalInstancePaths,
  expandHomePrefix,
  resolveAideveloHomeDir,
  resolveAideveloInstanceId,
} from "../config/home.js";

const ORIGINAL_ENV = { ...process.env };

describe("home path resolution", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("defaults to ~/.aidevelo and default instance", () => {
    delete process.env.AIDEVELO_HOME;
    delete process.env.AIDEVELO_INSTANCE_ID;

    const paths = describeLocalInstancePaths();
    expect(paths.homeDir).toBe(path.resolve(os.homedir(), ".aidevelo"));
    expect(paths.instanceId).toBe("default");
    expect(paths.configPath).toBe(path.resolve(os.homedir(), ".aidevelo", "instances", "default", "config.json"));
  });

  it("supports AIDEVELO_HOME and explicit instance ids", () => {
    process.env.AIDEVELO_HOME = "~/aidevelo-home";

    const home = resolveAideveloHomeDir();
    expect(home).toBe(path.resolve(os.homedir(), "aidevelo-home"));
    expect(resolveAideveloInstanceId("dev_1")).toBe("dev_1");
  });

  it("rejects invalid instance ids", () => {
    expect(() => resolveAideveloInstanceId("bad/id")).toThrow(/Invalid instance id/);
  });

  it("expands ~ prefixes", () => {
    expect(expandHomePrefix("~")).toBe(os.homedir());
    expect(expandHomePrefix("~/x/y")).toBe(path.resolve(os.homedir(), "x/y"));
  });
});
