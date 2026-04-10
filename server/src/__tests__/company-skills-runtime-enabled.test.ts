import { describe, expect, it } from "vitest";
import type { CompanySkill } from "@aideveloai/shared";
import {
  companySkillIncludedInRuntimeInjection,
  resolveRequestedSkillKeysOrThrow,
} from "../services/company-skills.js";

function skill(overrides: Partial<CompanySkill>): CompanySkill {
  const now = new Date();
  return {
    id: "00000000-0000-0000-0000-000000000001",
    companyId: "00000000-0000-0000-0000-000000000002",
    key: "company/c/skill",
    slug: "skill",
    name: "Skill",
    description: null,
    markdown: "---\nname: Skill\n---\n\n# Skill\n",
    sourceType: "local_path",
    sourceLocator: "/tmp/skill",
    sourceRef: null,
    trustLevel: "markdown_only",
    compatibility: "compatible",
    enabled: true,
    fileInventory: [],
    metadata: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("company skill runtime / resolution", () => {
  it("excludes disabled non-bundled skills from runtime injection", () => {
    expect(companySkillIncludedInRuntimeInjection(skill({ enabled: false, metadata: {} }))).toBe(false);
    expect(
      companySkillIncludedInRuntimeInjection(
        skill({ enabled: false, metadata: { sourceKind: "aidevelo_bundled" } }),
      ),
    ).toBe(true);
  });

  it("rejects disabled skills in resolveRequestedSkillKeysOrThrow", () => {
    const skills = [
      skill({
        key: "k-off",
        slug: "off",
        enabled: false,
        metadata: { sourceKind: "local_path" },
      }),
    ];
    expect(() => resolveRequestedSkillKeysOrThrow(skills, ["k-off"])).toThrow(/disabled skills/);
  });

  it("allows bundled skills in resolveRequestedSkillKeysOrThrow even if disabled in DB", () => {
    const skills = [
      skill({
        key: "k-bundle",
        slug: "bundle",
        enabled: false,
        metadata: { sourceKind: "aidevelo_bundled" },
      }),
    ];
    expect(resolveRequestedSkillKeysOrThrow(skills, ["k-bundle"])).toEqual(["k-bundle"]);
  });
});
