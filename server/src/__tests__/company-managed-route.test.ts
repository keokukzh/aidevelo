import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { companyRoutes } from "../routes/companies.js";
import { errorHandler } from "../middleware/index.js";

const mockCompanyService = vi.hoisted(() => ({
  list: vi.fn(),
  stats: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  archive: vi.fn(),
  remove: vi.fn(),
}));

const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn(),
}));

const mockAccessService = vi.hoisted(() => ({
  ensureMembership: vi.fn(),
}));

const mockBudgetService = vi.hoisted(() => ({
  upsertPolicy: vi.fn(),
}));

const mockCompanyPortabilityService = vi.hoisted(() => ({
  exportBundle: vi.fn(),
  previewExport: vi.fn(),
  previewImport: vi.fn(),
  importBundle: vi.fn(),
}));

const mockLogActivity = vi.hoisted(() => vi.fn());

vi.mock("../services/index.js", () => ({
  accessService: () => mockAccessService,
  agentService: () => mockAgentService,
  budgetService: () => mockBudgetService,
  companyPortabilityService: () => mockCompanyPortabilityService,
  companyService: () => mockCompanyService,
  logActivity: mockLogActivity,
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board",
      userId: "user-1",
      source: "local_implicit",
      isInstanceAdmin: true,
    };
    next();
  });
  app.use("/api/companies", companyRoutes({} as any));
  app.use(errorHandler);
  return app;
}

describe("POST /api/companies managed runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes managed runtime fields through company creation", async () => {
    const now = new Date("2026-03-23T10:00:00.000Z");
    mockCompanyService.create.mockResolvedValue({
      id: "company-1",
      name: "Managed Co",
      description: null,
      status: "active",
      issuePrefix: "MAN",
      issueCounter: 0,
      budgetMonthlyCents: 0,
      spentMonthlyCents: 0,
      runtimeMode: "managed",
      managedRuntimeConfig: {
        primaryProvider: "main_api",
        fallbackProvider: "fallback_api",
      },
      requireBoardApprovalForNewAgents: true,
      brandColor: null,
      logoAssetId: null,
      logoUrl: null,
      createdAt: now,
      updatedAt: now,
    });

    const app = createApp();
    const res = await request(app).post("/api/companies").send({
      name: "Managed Co",
      runtimeMode: "managed",
      managedRuntimeConfig: {
        primaryProvider: "main_api",
        fallbackProvider: "fallback_api",
      },
    });

    expect(res.status).toBe(201);
    expect(mockCompanyService.create).toHaveBeenCalledWith({
      name: "Managed Co",
      budgetMonthlyCents: 0,
      runtimeMode: "managed",
      managedRuntimeConfig: {
        primaryProvider: "main_api",
        fallbackProvider: "fallback_api",
      },
    });
    expect(mockAccessService.ensureMembership).toHaveBeenCalledWith(
      "company-1",
      "user",
      "user-1",
      "owner",
      "active",
    );
  });
});