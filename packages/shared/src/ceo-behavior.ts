export const CEO_BEHAVIOR_PROFILE = "balanced_startup_ceo" as const;

export type CeoBehaviorProfile = typeof CEO_BEHAVIOR_PROFILE;
export type CeoBehaviorDefaultMode = "new" | "existing";

export interface CeoBehaviorConfig {
  profile?: CeoBehaviorProfile;
  proactiveInitiativesEnabled?: boolean;
  autonomousHiringEnabled?: boolean;
}

export interface ResolvedCeoBehavior {
  profile: CeoBehaviorProfile;
  proactiveInitiativesEnabled: boolean;
  autonomousHiringEnabled: boolean;
  explicit: boolean;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export function getStoredCeoBehavior(adapterConfig: unknown): CeoBehaviorConfig | null {
  const config = asRecord(adapterConfig);
  const behavior = asRecord(config?.ceoBehavior);
  if (!behavior) return null;
  return {
    profile: behavior.profile === CEO_BEHAVIOR_PROFILE ? CEO_BEHAVIOR_PROFILE : undefined,
    proactiveInitiativesEnabled: asBoolean(behavior.proactiveInitiativesEnabled),
    autonomousHiringEnabled: asBoolean(behavior.autonomousHiringEnabled),
  };
}

export function hasStoredCeoBehavior(adapterConfig: unknown): boolean {
  return Boolean(getStoredCeoBehavior(adapterConfig));
}

export function resolveCeoBehavior(
  adapterConfig: unknown,
  defaultMode: CeoBehaviorDefaultMode = "existing",
): ResolvedCeoBehavior {
  const stored = getStoredCeoBehavior(adapterConfig);
  const defaults =
    defaultMode === "new"
      ? {
          proactiveInitiativesEnabled: true,
          autonomousHiringEnabled: false,
        }
      : {
          proactiveInitiativesEnabled: false,
          autonomousHiringEnabled: false,
        };

  return {
    profile: stored?.profile ?? CEO_BEHAVIOR_PROFILE,
    proactiveInitiativesEnabled:
      stored?.proactiveInitiativesEnabled ?? defaults.proactiveInitiativesEnabled,
    autonomousHiringEnabled:
      stored?.autonomousHiringEnabled ?? defaults.autonomousHiringEnabled,
    explicit: Boolean(stored),
  };
}

export function setCeoBehavior(
  adapterConfig: Record<string, unknown>,
  behavior: CeoBehaviorConfig,
  defaultMode: CeoBehaviorDefaultMode = "existing",
): Record<string, unknown> {
  const resolved = resolveCeoBehavior({ ...adapterConfig, ceoBehavior: behavior }, defaultMode);
  return {
    ...adapterConfig,
    ceoBehavior: {
      profile: resolved.profile,
      proactiveInitiativesEnabled: resolved.proactiveInitiativesEnabled,
      autonomousHiringEnabled: resolved.autonomousHiringEnabled,
    },
  };
}
