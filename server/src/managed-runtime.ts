function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function isManagedCompanyRuntime(company: { runtimeMode?: unknown; managedRuntimeConfig?: unknown } | null | undefined) {
  if (company?.runtimeMode === "managed") return true;
  const managedRuntimeConfig = asRecord(company?.managedRuntimeConfig);
  return managedRuntimeConfig !== null && Object.keys(managedRuntimeConfig).length > 0;
}

export function buildManagedServiceAdapterConfig(
  companyManagedRuntimeConfig: unknown,
  adapterConfig: Record<string, unknown>,
): Record<string, unknown> {
  const companyDefaults = asRecord(companyManagedRuntimeConfig) ?? {};
  const next = {
    ...companyDefaults,
    ...adapterConfig,
  };
  if (!asNonEmptyString(next.routingMode)) {
    next.routingMode = "primary_with_fallback";
  }
  if (!asNonEmptyString(next.providerStrategy)) {
    next.providerStrategy = "company_managed";
  }
  if (!asNonEmptyString(next.primaryProvider)) {
    next.primaryProvider = "main_api";
  }
  if (!asNonEmptyString(next.fallbackProvider)) {
    next.fallbackProvider = "fallback_api";
  }
  if (!asNonEmptyString(next.modelSelection)) {
    next.modelSelection = "managed";
  }
  return next;
}

export function resolveRequestedAgentAdapter(
  company: { runtimeMode?: unknown; managedRuntimeConfig?: unknown } | null,
  adapterType: string | null | undefined,
  adapterConfig: Record<string, unknown>,
  applyLegacyDefaults: (adapterType: string | null | undefined, adapterConfig: Record<string, unknown>) => Record<string, unknown>,
) {
  if (isManagedCompanyRuntime(company)) {
    return {
      adapterType: "managed_service",
      adapterConfig: buildManagedServiceAdapterConfig(company?.managedRuntimeConfig, adapterConfig),
    };
  }

  return {
    adapterType,
    adapterConfig: applyLegacyDefaults(adapterType, adapterConfig),
  };
}