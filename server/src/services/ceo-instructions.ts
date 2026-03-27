import {
  resolveCeoBehavior,
  type ResolvedCeoBehavior,
} from "@aideveloai/shared";
import { agentInstructionsService } from "./agent-instructions.js";
import { loadDefaultAgentInstructionsBundle } from "./default-agent-instructions.js";

type AgentLike = {
  id: string;
  companyId: string;
  name: string;
  role: string;
  adapterConfig: unknown;
};

type SyncResult<TAgent extends AgentLike> = {
  agent: TAgent & { adapterConfig: Record<string, unknown> };
  adapterConfig: Record<string, unknown>;
  bundleMode: "managed" | "external" | null;
  updated: boolean;
};

const AGENTS_POLICY_MARKER = "AIDEVELO_CEO_POLICY";
const HEARTBEAT_POLICY_MARKER = "AIDEVELO_CEO_HEARTBEAT_POLICY";

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function buildManagedSection(markerId: string, body: string) {
  const normalizedBody = body.trim();
  return `<!-- ${markerId}:START -->\n${normalizedBody}\n<!-- ${markerId}:END -->`;
}

function upsertManagedSection(content: string, markerId: string, body: string) {
  const section = buildManagedSection(markerId, body);
  const pattern = new RegExp(
    `<!-- ${markerId}:START -->[\\s\\S]*?<!-- ${markerId}:END -->`,
    "g",
  );
  if (pattern.test(content)) {
    return content.replace(pattern, section);
  }

  const trimmed = content.trimEnd();
  if (!trimmed) return `${section}\n`;
  return `${trimmed}\n\n${section}\n`;
}

function buildAgentsPolicySection(behavior: ResolvedCeoBehavior) {
  const initiativePolicy = behavior.proactiveInitiativesEnabled
    ? "- When you are idle after checking approvals and assigned work, you may create at most one new top-level initiative for the current heartbeat.\n- Every new initiative must tie directly to company goals, revenue growth, distribution, customer learning, margin improvement, or a critical blocker.\n- Prefer delegating the work quickly once you have shaped the goal, scope, and owner."
    : "- Do not generate new top-level initiatives when idle.\n- After checking approvals, planning state, and assigned work, wait for explicit tasks or wakeups.";
  const hiringPolicy = behavior.autonomousHiringEnabled
    ? "- You may submit hire requests when a persistent capability gap is blocking growth, delivery, or revenue.\n- Autonomous hiring still goes through the normal approval path. You do not bypass governance."
    : "- You may identify hiring gaps, draft hiring plans, and create recruiting work.\n- Do not autonomously submit hire requests unless the board or config explicitly enables it.";

  return [
    "## Managed CEO Policy",
    "",
    `- Profile: ${behavior.profile}`,
    "- Think like a founder-operator. Push for customer insight, sharper positioning, faster execution, better distribution, and durable revenue.",
    "- Stay budget-aware. If spend is above 80% of budget, focus only on critical revenue, cost reduction, or blocker-removal work.",
    "- Keep the board informed when you materially change priorities, initiate hiring, or open a new company-level push.",
    "",
    "### Initiative Policy",
    initiativePolicy,
    "",
    "### Hiring Policy",
    hiringPolicy,
    "",
    "### Guardrails",
    "- No spam task creation.",
    "- No more than one new top-level initiative per idle heartbeat.",
    "- Prefer reversible experiments over large speculative programs.",
    "- Never bypass approval gates for governed actions.",
  ].join("\n");
}

function buildHeartbeatPolicySection(behavior: ResolvedCeoBehavior) {
  return [
    "## Managed Runtime Policy",
    "",
    "- Assigned work still comes first. Finish or unblock current commitments before starting new strategic work.",
    behavior.proactiveInitiativesEnabled
      ? "- If you are idle, you may create one goal-linked initiative focused on business opportunity validation, revenue generation, growth, hiring, or a material blocker."
      : "- If you are idle, do not create new initiatives. Exit cleanly after planning, approvals, and assignment checks.",
    behavior.autonomousHiringEnabled
      ? "- You may submit a hire request when a capability gap is clearly limiting execution or revenue."
      : "- You may prepare hiring plans and recruiting tasks, but do not submit hire requests autonomously.",
    "- When budget utilization exceeds 80%, only open work that protects revenue, reduces cost, or unblocks a critical dependency.",
    "- Every new initiative must name the expected business outcome before you delegate it.",
  ].join("\n");
}

export async function syncManagedCeoInstructions<TAgent extends AgentLike>(
  agent: TAgent,
): Promise<SyncResult<TAgent>> {
  const initialConfig = asRecord(agent.adapterConfig);
  if (agent.role !== "ceo") {
    return {
      agent: { ...agent, adapterConfig: initialConfig },
      adapterConfig: initialConfig,
      bundleMode: null,
      updated: false,
    };
  }

  const instructions = agentInstructionsService();
  let updated = false;
  let currentAgent = { ...agent, adapterConfig: initialConfig };
  let bundle = await instructions.getBundle(currentAgent);

  if (bundle.mode === "external") {
    return {
      agent: currentAgent,
      adapterConfig: currentAgent.adapterConfig,
      bundleMode: "external",
      updated: false,
    };
  }

  if (bundle.mode !== "managed") {
    const switched = await instructions.updateBundle(currentAgent, {
      mode: "managed",
      clearLegacyPromptTemplate: true,
    });
    currentAgent = { ...currentAgent, adapterConfig: switched.adapterConfig };
    bundle = switched.bundle;
    updated = true;
  }

  const defaultFiles = await loadDefaultAgentInstructionsBundle("ceo");
  const existingPaths = new Set(bundle.files.map((file) => file.path));
  for (const [fileName, content] of Object.entries(defaultFiles)) {
    if (existingPaths.has(fileName)) continue;
    const writeResult = await instructions.writeFile(currentAgent, fileName, content, {
      clearLegacyPromptTemplate: true,
    });
    currentAgent = { ...currentAgent, adapterConfig: writeResult.adapterConfig };
    bundle = writeResult.bundle;
    existingPaths.add(fileName);
    updated = true;
  }

  const behavior = resolveCeoBehavior(currentAgent.adapterConfig, "existing");
  const managedUpdates = [
    {
      path: "AGENTS.md",
      markerId: AGENTS_POLICY_MARKER,
      build: buildAgentsPolicySection,
    },
    {
      path: "HEARTBEAT.md",
      markerId: HEARTBEAT_POLICY_MARKER,
      build: buildHeartbeatPolicySection,
    },
  ] as const;

  for (const target of managedUpdates) {
    const currentFile = await instructions.readFile(currentAgent, target.path);
    const nextContent = upsertManagedSection(
      currentFile.content,
      target.markerId,
      target.build(behavior),
    );
    if (nextContent === currentFile.content) continue;
    const writeResult = await instructions.writeFile(currentAgent, target.path, nextContent, {
      clearLegacyPromptTemplate: true,
    });
    currentAgent = { ...currentAgent, adapterConfig: writeResult.adapterConfig };
    bundle = writeResult.bundle;
    updated = true;
  }

  return {
    agent: currentAgent,
    adapterConfig: currentAgent.adapterConfig,
    bundleMode: bundle.mode,
    updated,
  };
}
