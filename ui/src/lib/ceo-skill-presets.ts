import type { CompanySkillListItem } from "@aideveloai/shared";

export type CeoSkillPresetId = "ceo_core" | "ceo_builder" | "manual";

type PresetDefinition = {
  id: CeoSkillPresetId;
  label: string;
  description: string;
  bundledSlugs: string[];
};

const CEO_RECOMMENDED_SKILL_BADGES: Record<string, string[]> = {
  "aideveloai/aidevelo/aidevelo": ["CEO Core"],
  "aideveloai/aidevelo/para-memory-files": ["CEO Core"],
  "aideveloai/aidevelo/aidevelo-create-agent": ["CEO Builder"],
};

export const CEO_SKILL_PRESETS: PresetDefinition[] = [
  {
    id: "ceo_core",
    label: "CEO Core",
    description: "Memory and company coordination.",
    bundledSlugs: ["aidevelo", "para-memory-files"],
  },
  {
    id: "ceo_builder",
    label: "CEO Builder",
    description: "CEO Core plus agent creation for delegation and hiring.",
    bundledSlugs: ["aidevelo", "para-memory-files", "aidevelo-create-agent"],
  },
  {
    id: "manual",
    label: "Manual",
    description: "Pick skills one by one.",
    bundledSlugs: [],
  },
];

export function shouldAutoSyncCeoPresetSkills(presetId: CeoSkillPresetId) {
  return presetId !== "manual";
}

function canonicalBundledKey(slug: string) {
  return `aideveloai/aidevelo/${slug}`;
}

export function resolveInstalledCeoPresetSkillKeys(
  companySkills: CompanySkillListItem[],
  presetId: CeoSkillPresetId,
) {
  const preset = CEO_SKILL_PRESETS.find((entry) => entry.id === presetId);
  if (!preset || preset.id === "manual") return [];
  const availableKeys = new Set(companySkills.map((skill) => skill.key));
  return preset.bundledSlugs
    .map(canonicalBundledKey)
    .filter((key) => availableKeys.has(key));
}

export function getCeoSkillPreset(presetId: CeoSkillPresetId) {
  return CEO_SKILL_PRESETS.find((entry) => entry.id === presetId) ?? CEO_SKILL_PRESETS[0]!;
}

export function getCeoRecommendationBadges(skill: Pick<CompanySkillListItem, "key">) {
  return CEO_RECOMMENDED_SKILL_BADGES[skill.key] ?? [];
}
