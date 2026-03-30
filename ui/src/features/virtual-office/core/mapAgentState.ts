import type { Agent } from "@aideveloai/shared";
import type { LiveRunForIssue } from "@/api/heartbeats";
import { OfficeAgent, OfficeAgentState } from "./types";
import { ROLE_DESK_ZONE, AGENT_COLORS } from "./constants";

function getAgentState(agent: Agent, liveRun: LiveRunForIssue | undefined): OfficeAgentState {
  if (agent.status === "error") return "error";
  if (agent.status === "paused") return "away";
  if (liveRun) return "working";
  if (agent.status === "running") return "standing";
  if (agent.status === "idle") return "walking";
  if (agent.status === "pending_approval") return "standing";
  return "standing";
}

function roleToColor(role: string | null): string {
  return AGENT_COLORS[role?.toLowerCase() ?? "default"] ?? AGENT_COLORS.default;
}

export function mapAgentToOffice(
  agent: Agent,
  liveRun: LiveRunForIssue | undefined,
  deskIndex: number
): OfficeAgent {
  return {
    id: agent.id,
    name: agent.name,
    state: getAgentState(agent, liveRun),
    color: roleToColor(agent.role),
    deskIndex,
    hasActiveRun: !!liveRun,
    role: agent.role ?? "default",
  };
}

export function assignDeskIndices(agents: OfficeAgent[]): OfficeAgent[] {
  const sorted = [...agents].sort(
    (a, b) => (ROLE_DESK_ZONE[a.role] ?? 99) - (ROLE_DESK_ZONE[b.role] ?? 99)
  );
  return sorted.map((agent, i) => ({ ...agent, deskIndex: i }));
}
