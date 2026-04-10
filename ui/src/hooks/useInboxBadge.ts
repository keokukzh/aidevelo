import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "../api/dashboard";
import { queryKeys } from "../lib/queryKeys";
import {
  loadDismissedInboxItems,
  saveDismissedInboxItems,
} from "../lib/inbox";

export function useDismissedInboxItems() {
  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissedInboxItems);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== "aidevelo:inbox:dismissed") return;
      setDismissed(loadDismissedInboxItems());
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const dismiss = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDismissedInboxItems(next);
      return next;
    });
  };

  return { dismissed, dismiss };
}

export function useInboxBadge(companyId: string | null | undefined) {
  const { dismissed } = useDismissedInboxItems();
  const { data: summary } = useQuery({
    queryKey: queryKeys.inboxSummary(companyId!),
    queryFn: () => dashboardApi.inboxSummary(companyId!),
    enabled: !!companyId,
  });

  const failedRuns = summary?.failedRuns ?? 0;
  const showAggregateAgentError =
    (summary?.agentErrorCount ?? 0) > 0 &&
    failedRuns === 0 &&
    !dismissed.has("alert:agent-errors");
  const showBudgetAlert =
    (summary?.monthBudgetCents ?? 0) > 0 &&
    (summary?.monthUtilizationPercent ?? 0) >= 80 &&
    !dismissed.has("alert:budget");
  const alerts = Number(showAggregateAgentError) + Number(showBudgetAlert);
  const approvals = summary?.actionableApprovals ?? 0;
  const joinRequests = summary?.pendingJoinRequests ?? 0;
  const unreadTouchedIssues = summary?.unreadTouchedIssues ?? 0;
  const inbox = approvals + joinRequests + failedRuns + unreadTouchedIssues + alerts;

  return { inbox, approvals, failedRuns, joinRequests, unreadTouchedIssues, alerts };
}
