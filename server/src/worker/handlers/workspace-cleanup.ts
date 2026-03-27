// server/src/worker/handlers/workspace-cleanup.ts
import { createDb, executionWorkspaces, projectWorkspaces } from "@aideveloai/db";
import { eq } from "drizzle-orm";
import { cleanupExecutionWorkspaceArtifacts } from "../../services/workspace-runtime.js";
import type { WorkspaceCleanupPayload } from "../../services/job-queue.js";

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  return url;
}

export const workspaceCleanupHandler = {
  async execute(payload: unknown): Promise<{ success: boolean; skipped?: boolean }> {
    const { workspaceId, cleanupReason } = payload as WorkspaceCleanupPayload;
    const db = createDb(getDatabaseUrl());

    // Fetch workspace with related data
    const [workspace] = await db
      .select()
      .from(executionWorkspaces)
      .where(eq(executionWorkspaces.id, workspaceId));

    if (!workspace) {
      return { success: false, skipped: true };
    }

    // Fetch project workspace if linked
    let projectWorkspace = null;
    if (workspace.projectWorkspaceId) {
      const [pw] = await db
        .select()
        .from(projectWorkspaces)
        .where(eq(projectWorkspaces.id, workspace.projectWorkspaceId));
      projectWorkspace = pw ?? null;
    }

    // Execute cleanup
    await cleanupExecutionWorkspaceArtifacts({
      workspace: {
        id: workspace.id,
        cwd: workspace.cwd,
        providerType: workspace.providerType,
        providerRef: workspace.providerRef,
        branchName: workspace.branchName,
        repoUrl: workspace.repoUrl,
        baseRef: workspace.baseRef,
        projectId: workspace.projectId,
        projectWorkspaceId: workspace.projectWorkspaceId,
        sourceIssueId: workspace.sourceIssueId,
        metadata: workspace.metadata as Record<string, unknown> | null,
      },
      projectWorkspace: projectWorkspace
        ? {
            cwd: projectWorkspace.cwd,
            cleanupCommand: projectWorkspace.cleanupCommand,
          }
        : null,
    });

    return { success: true };
  },

  getTimeoutMs(): number {
    return 60000; // 1 minute
  },
};
