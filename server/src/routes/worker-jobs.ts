import { Router } from "express";
import type { Db } from "@aideveloai/db";
import { jobQueueService } from "../services/job-queue.js";
import { assertCompanyAccess } from "./authz.js";

export function workerJobRoutes(db: Db) {
  const router = Router();
  const jobQueue = jobQueueService(db);

  // GET /api/companies/:companyId/jobs - List jobs for company
  router.get("/companies/:companyId/jobs/health", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const health = await jobQueue.getQueueHealth(companyId);
    res.json(health);
  });

  // GET /api/companies/:companyId/jobs - List jobs for company
  router.get("/companies/:companyId/jobs", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const { status, jobType, limit, cursor } = req.query as Record<string, string>;

    const jobs = await jobQueue.listJobs(companyId, {
      status,
      jobType: jobType as "workspace_cleanup" | "routine_dispatch" | "heartbeat_tick",
      limit: limit ? parseInt(limit, 10) : 50,
      cursor,
    });

    const nextCursor = jobs.length > 0
      ? jobs[jobs.length - 1].createdAt.toISOString()
      : null;

    res.json({
      jobs: jobs.map((job) => ({
        id: job.id,
        jobType: job.jobType,
        status: job.status,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        lastError: job.lastError,
        attempts: job.attempts,
      })),
      pagination: {
        cursor: nextCursor,
        hasMore: jobs.length > (parseInt(limit ?? "50", 10)),
      },
    });
  });

  // GET /api/companies/:companyId/jobs/:jobId - Get job details
  router.get("/companies/:companyId/jobs/:jobId", async (req, res) => {
    const { companyId, jobId } = req.params;
    assertCompanyAccess(req, companyId as string);

    const job = await jobQueue.getJob(jobId as string);

    if (!job || job.companyId !== companyId) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    res.json({
      id: job.id,
      jobType: job.jobType,
      jobPayload: job.jobPayload,
      status: job.status,
      priority: job.priority,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      lastError: job.lastError,
      scheduledAt: job.scheduledAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      nextRetryAt: job.nextRetryAt,
      createdAt: job.createdAt,
    });
  });

  // POST /api/companies/:companyId/jobs/:jobId/cancel - Cancel pending job
  router.post("/companies/:companyId/jobs/:jobId/cancel", async (req, res) => {
    const { companyId, jobId } = req.params;
    assertCompanyAccess(req, companyId as string);

    const job = await jobQueue.getJob(jobId as string);

    if (!job || job.companyId !== companyId) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    if (job.status !== "pending") {
      res.status(409).json({ error: "Can only cancel pending jobs" });
      return;
    }

    await jobQueue.cancel(jobId as string);
    res.json({ success: true });
  });

  return router;
}
