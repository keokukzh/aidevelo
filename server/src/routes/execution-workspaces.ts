import { and, eq } from "drizzle-orm";
import { Router } from "express";
import type { Db } from "@aideveloai/db";
import { issues, projects, projectWorkspaces } from "@aideveloai/db";
import { updateExecutionWorkspaceSchema } from "@aideveloai/shared";
import { validate } from "../middleware/validate.js";
import { executionWorkspaceService, jobQueueService, logActivity, workspaceOperationService } from "../services/index.js";
import { parseProjectExecutionWorkspacePolicy } from "../services/execution-workspace-policy.js";
import { listRuntimeServicesForExecutionWorkspace, stopRuntimeServicesForExecutionWorkspace } from "../services/workspace-runtime.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

const TERMINAL_ISSUE_STATUSES = new Set(["done", "cancelled"]);

export function executionWorkspaceRoutes(db: Db) {
  const router = Router();
  const svc = executionWorkspaceService(db);
  const workspaceOperationsSvc = workspaceOperationService(db);

  router.get("/companies/:companyId/execution-workspaces", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const workspaces = await svc.list(companyId, {
      projectId: req.query.projectId as string | undefined,
      projectWorkspaceId: req.query.projectWorkspaceId as string | undefined,
      issueId: req.query.issueId as string | undefined,
      status: req.query.status as string | undefined,
      reuseEligible: req.query.reuseEligible === "true",
    });
    res.json(workspaces);
  });

  router.get("/execution-workspaces/:id", async (req, res) => {
    const id = req.params.id as string;
    const workspace = await svc.getById(id);
    if (!workspace) {
      res.status(404).json({ error: "Execution workspace not found" });
      return;
    }
    assertCompanyAccess(req, workspace.companyId);
    const runtimeServices = await listRuntimeServicesForExecutionWorkspace(db, id);
    res.json({ ...workspace, runtimeServices });
  });

  router.patch("/execution-workspaces/:id", validate(updateExecutionWorkspaceSchema), async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Execution workspace not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);
    const patch: Record<string, unknown> = {
      ...req.body,
      ...(req.body.cleanupEligibleAt ? { cleanupEligibleAt: new Date(req.body.cleanupEligibleAt) } : {}),
    };
    let workspace = existing;
    let cleanupWarnings: string[] = [];

    if (req.body.status === "archived" && existing.status !== "archived") {
      const linkedIssues = await db
        .select({
          id: issues.id,
          status: issues.status,
        })
        .from(issues)
        .where(and(eq(issues.companyId, existing.companyId), eq(issues.executionWorkspaceId, existing.id)));
      const activeLinkedIssues = linkedIssues.filter((issue) => !TERMINAL_ISSUE_STATUSES.has(issue.status));

      if (activeLinkedIssues.length > 0) {
        res.status(409).json({
          error: `Cannot archive execution workspace while ${activeLinkedIssues.length} linked issue(s) are still open`,
        });
        return;
      }

      const closedAt = new Date();
      const archivedWorkspace = await svc.update(id, {
        ...patch,
        status: "archived",
        closedAt,
        cleanupReason: null,
      });
      if (!archivedWorkspace) {
        res.status(404).json({ error: "Execution workspace not found" });
        return;
      }
      workspace = archivedWorkspace;

      try {
        await stopRuntimeServicesForExecutionWorkspace({
          db,
          executionWorkspaceId: existing.id,
          workspaceCwd: existing.cwd,
        });
      } catch (error) {
        const failureReason = error instanceof Error ? error.message : String(error);
        workspace =
          (await svc.update(id, {
            status: "cleanup_failed",
            closedAt,
            cleanupReason: failureReason,
          })) ?? workspace;
        res.status(500).json({
          error: `Failed to archive execution workspace: ${failureReason}`,
        });
        return;
      }

      // Enqueue workspace cleanup job instead of running synchronously
      await jobQueueService(db).enqueue("workspace_cleanup", existing.companyId, {
        workspaceId: existing.id,
        cleanupReason: "archive",
      });
    } else {
      const updatedWorkspace = await svc.update(id, patch);
      if (!updatedWorkspace) {
        res.status(404).json({ error: "Execution workspace not found" });
        return;
      }
      workspace = updatedWorkspace;
    }
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: existing.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "execution_workspace.updated",
      entityType: "execution_workspace",
      entityId: workspace.id,
      details: {
        changedKeys: Object.keys(req.body).sort(),
        ...(cleanupWarnings.length > 0 ? { cleanupWarnings } : {}),
      },
    });
    res.json(workspace);
  });

  return router;
}
