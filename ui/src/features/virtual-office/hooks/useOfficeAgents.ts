import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Agent } from "@aideveloai/shared";
import type { LiveRunForIssue } from "@/api/heartbeats";
import { agentsApi } from "@/api/agents";
import { heartbeatsApi } from "@/api/heartbeats";
import { queryKeys } from "@/lib/queryKeys";
import { mapAgentToOffice, assignDeskIndices } from "../core/mapAgentState";

interface UseOfficeAgentsOptions {
  companyId: string | null;
}

export function useOfficeAgents({ companyId }: UseOfficeAgentsOptions) {
  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: queryKeys.agents.list(companyId ?? ""),
    queryFn: () => agentsApi.list(companyId!),
    enabled: !!companyId,
  });

  const { data: liveRuns = [] } = useQuery<LiveRunForIssue[]>({
    queryKey: queryKeys.liveRuns(companyId ?? ""),
    queryFn: () => heartbeatsApi.liveRunsForCompany(companyId!),
    enabled: !!companyId,
  });

  const officeAgents = useMemo(() => {
    const liveRunMap = new Map<string, LiveRunForIssue>(
      liveRuns.map((run: LiveRunForIssue) => [run.agentId, run])
    );

    const mapped = (agents as Agent[])
      .filter((a) => a.status !== "terminated")
      .map((agent) => mapAgentToOffice(agent, liveRunMap.get(agent.id), 0));

    return assignDeskIndices(mapped);
  }, [agents, liveRuns]);

  return { officeAgents };
}
