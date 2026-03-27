import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/index.js";
import { agentRoutes } from "../routes/agents.js";

const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn(),
}));

const mockSecretService = vi.hoisted(() => ({
  resolveAdapterConfigForRuntime: vi.fn(),
}));

const mockRunClaudeLogin = vi.hoisted(() => vi.fn());

vi.mock("../services/index.js", () => ({
  agentService: () => mockAgentService,
  agentInstructionsService: () => ({}),
  accessService: () => ({}),
  approvalService: () => ({}),
  budgetService: () => ({}),
  heartbeatService: () => ({}),
  issueApprovalService: () => ({}),
  issueService: () => ({}),
  companySkillService: () => ({}),
  logActivity: vi.fn(),
  secretService: () => mockSecretService,
  syncManagedCeoInstructions: vi.fn(),
  syncInstructionsBundleConfigFromFilePath: vi.fn((_agent, config) => config),
  workspaceOperationService: () => ({}),
}));

vi.mock("../services/instance-settings.js", () => ({
  instanceSettingsService: () => ({
    getGeneral: vi.fn().mockResolvedValue({ censorUsernameInLogs: false }),
  }),
}));

vi.mock("../adapters/index.js", () => ({
  findServerAdapter: vi.fn(),
  listAdapterModels: vi.fn().mockResolvedValue([]),
}));

vi.mock("../services/default-agent-instructions.js", () => ({
  loadDefaultAgentInstructionsBundle: vi.fn(),
  resolveDefaultAgentInstructionsBundleRole: vi.fn(),
}));

vi.mock("../services/agent-home-provisioning.js", () => ({
  provisionAgentHomeForRole: vi.fn(),
}));

vi.mock("@aideveloai/adapter-claude-local/server", () => ({
  runClaudeLogin: mockRunClaudeLogin,
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board",
      userId: "user-1",
      source: "local_implicit",
      isInstanceAdmin: false,
    };
    next();
  });
  app.use("/api", agentRoutes({} as any));
  app.use(errorHandler);
  return app;
}

describe("POST /api/agents/:id/claude-login", () => {
  const managedAgentId = "11111111-1111-4111-8111-111111111111";
  const codexAgentId = "22222222-2222-4222-8222-222222222222";

  beforeEach(() => {
    vi.clearAllMocks();
    mockSecretService.resolveAdapterConfigForRuntime.mockResolvedValue({
      config: { command: "claude", cwd: "/tmp/workspace" },
      secretKeys: new Set<string>(),
    });
    mockRunClaudeLogin.mockResolvedValue({
      exitCode: 0,
      signal: null,
      timedOut: false,
      loginUrl: "https://example.test/login",
      stdout: "",
      stderr: "",
    });
  });

  it("allows managed_service agents to run Claude login", async () => {
    mockAgentService.getById.mockResolvedValue({
      id: managedAgentId,
      companyId: "company-1",
      name: "CEO",
      adapterType: "managed_service",
      adapterConfig: {},
    });

    const res = await request(createApp()).post(`/api/agents/${managedAgentId}/claude-login`);

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(mockSecretService.resolveAdapterConfigForRuntime).toHaveBeenCalledWith("company-1", {});
    expect(mockRunClaudeLogin).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: expect.objectContaining({
          id: managedAgentId,
          companyId: "company-1",
          adapterType: "managed_service",
        }),
        config: { command: "claude", cwd: "/tmp/workspace" },
      }),
    );
  });

  it("still rejects non-Claude-backed adapters", async () => {
    mockAgentService.getById.mockResolvedValue({
      id: codexAgentId,
      companyId: "company-1",
      name: "Coder",
      adapterType: "codex_local",
      adapterConfig: {},
    });

    const res = await request(createApp()).post(`/api/agents/${codexAgentId}/claude-login`);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "Login is only supported for claude_local and managed_service agents",
    });
    expect(mockRunClaudeLogin).not.toHaveBeenCalled();
  });
});
