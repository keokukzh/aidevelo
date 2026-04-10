import type { CompanySkillListItem } from "@aideveloai/shared";
import { describe, expect, it } from "vitest";
import {
  getCeoRecommendationBadges,
  resolveInstalledCeoPresetSkillKeys,
  shouldAutoSyncCeoPresetSkills,
} from "./ceo-skill-presets";

const companySkills = [
  {
    id: "1",
    key: "aideveloai/aidevelo/aidevelo",
    bundled: true,
    tags: [],
  } as CompanySkillListItem,
  {
    id: "2",
    key: "aideveloai/aidevelo/para-memory-files",
    bundled: true,
    tags: [],
  } as CompanySkillListItem,
  {
    id: "3",
    key: "company/company-1/custom-skill",
    bundled: false,
    tags: [],
  } as CompanySkillListItem,
];

describe("resolveInstalledCeoPresetSkillKeys", () => {
  it("only resolves keys that are currently installed in the company", () => {
    expect(resolveInstalledCeoPresetSkillKeys([...companySkills], "ceo_builder")).toEqual([
      "aideveloai/aidevelo/aidevelo",
      "aideveloai/aidevelo/para-memory-files",
    ]);
  });

  it("returns no automatic keys for manual selection", () => {
    expect(resolveInstalledCeoPresetSkillKeys([...companySkills], "manual")).toEqual([]);
  });
});

describe("shouldAutoSyncCeoPresetSkills", () => {
  it("disables automatic preset syncing for manual selection", () => {
    expect(shouldAutoSyncCeoPresetSkills("manual")).toBe(false);
    expect(shouldAutoSyncCeoPresetSkills("ceo_builder")).toBe(true);
  });
});

describe("getCeoRecommendationBadges", () => {
  it("marks CEO-focused bundled skills with lightweight recommendation badges", () => {
    expect(getCeoRecommendationBadges(companySkills[0])).toEqual(["CEO Core"]);
    expect(getCeoRecommendationBadges({
      key: "aideveloai/aidevelo/aidevelo-create-agent",
    } as Pick<CompanySkillListItem, "key">)).toEqual(["CEO Builder"]);
  });
});
