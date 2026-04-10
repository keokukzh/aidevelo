import type { DashboardSummary } from "@aideveloai/shared";
import { api } from "./client";

export type InboxSummary = {
  actionableApprovals: number;
  pendingJoinRequests: number;
  failedRuns: number;
  unreadTouchedIssues: number;
  agentErrorCount: number;
  monthBudgetCents: number;
  monthUtilizationPercent: number;
};

export const dashboardApi = {
  summary: (companyId: string) => api.get<DashboardSummary>(`/companies/${companyId}/dashboard`),
  inboxSummary: (companyId: string) => api.get<InboxSummary>(`/companies/${companyId}/inbox-summary`),
};
