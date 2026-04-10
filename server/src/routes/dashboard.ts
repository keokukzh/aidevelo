import { Router } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@aideveloai/db";
import { approvals, heartbeatRuns, joinRequests } from "@aideveloai/db";
import { dashboardService } from "../services/dashboard.js";
import { issueService } from "../services/issues.js";
import { assertCompanyAccess } from "./authz.js";

export function dashboardRoutes(db: Db) {
  const router = Router();
  const svc = dashboardService(db);
  const issuesSvc = issueService(db);

  router.get("/companies/:companyId/dashboard", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const summary = await svc.summary(companyId);
    res.json(summary);
  });

  router.get("/companies/:companyId/inbox-summary", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const summary = await svc.summary(companyId);

    const [actionableApprovalsRow, pendingJoinRequestsRow, failedRunRows, unreadTouchedIssues] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(approvals)
        .where(
          and(
            eq(approvals.companyId, companyId),
            inArray(approvals.status, ["pending", "revision_requested"]),
          ),
        )
        .then((rows) => Number(rows[0]?.count ?? 0)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(joinRequests)
        .where(and(eq(joinRequests.companyId, companyId), eq(joinRequests.status, "pending_approval")))
        .then((rows) => Number(rows[0]?.count ?? 0)),
      db
        .selectDistinctOn([heartbeatRuns.agentId], { id: heartbeatRuns.id })
        .from(heartbeatRuns)
        .where(and(eq(heartbeatRuns.companyId, companyId), inArray(heartbeatRuns.status, ["failed", "timed_out"])))
        .orderBy(heartbeatRuns.agentId, desc(heartbeatRuns.createdAt)),
      req.actor.type === "board"
        ? issuesSvc
          .list(companyId, {
            unreadForUserId: "me",
            status: "backlog,todo,in_progress,in_review,blocked,done",
          })
          .then((rows) => rows.length)
        : Promise.resolve(0),
    ]);

    res.json({
      actionableApprovals: actionableApprovalsRow,
      pendingJoinRequests: pendingJoinRequestsRow,
      failedRuns: failedRunRows.length,
      unreadTouchedIssues,
      agentErrorCount: summary.agents.error,
      monthBudgetCents: summary.costs.monthBudgetCents,
      monthUtilizationPercent: summary.costs.monthUtilizationPercent,
    });
  });

  return router;
}
