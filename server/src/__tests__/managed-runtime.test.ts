import { describe, expect, it } from "vitest";
import {
  buildManagedServiceAdapterConfig,
  isManagedCompanyRuntime,
  resolveRequestedAgentAdapter,
} from "../managed-runtime.js";

describe("managed runtime helpers", () => {
  it("treats explicit managed companies as managed", () => {
    expect(isManagedCompanyRuntime({ runtimeMode: "managed", managedRuntimeConfig: {} })).toBe(true);
  });

  it("treats companies with populated managed runtime config as managed", () => {
    expect(
      isManagedCompanyRuntime({
        runtimeMode: "legacy_configurable",
        managedRuntimeConfig: { primaryProvider: "main_api" },
      }),
    ).toBe(true);
  });

  it("builds managed adapter defaults from company config", () => {
    expect(
      buildManagedServiceAdapterConfig(
        { primaryProvider: "main_api", fallbackProvider: "fallback_api" },
        {},
      ),
    ).toEqual({
      primaryProvider: "main_api",
      fallbackProvider: "fallback_api",
      routingMode: "primary_with_fallback",
      providerStrategy: "company_managed",
      modelSelection: "managed",
    });
  });

  it("forces managed_service adapter resolution for managed companies", () => {
    const resolved = resolveRequestedAgentAdapter(
      {
        runtimeMode: "managed",
        managedRuntimeConfig: { primaryProvider: "main_api", fallbackProvider: "fallback_api" },
      },
      "process",
      {},
      (adapterType, adapterConfig) => ({ ...adapterConfig, adapterType }),
    );

    expect(resolved).toEqual({
      adapterType: "managed_service",
      adapterConfig: {
        primaryProvider: "main_api",
        fallbackProvider: "fallback_api",
        routingMode: "primary_with_fallback",
        providerStrategy: "company_managed",
        modelSelection: "managed",
      },
    });
  });
});