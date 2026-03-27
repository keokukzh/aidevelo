import type { AdapterExecutionContext } from "@aideveloai/adapter-utils";

export type TaskComplexity = "simple" | "standard" | "complex";

const SCORE_COMPLEX = 50;
const SCORE_STANDARD = 20;

function getString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function scoreIssuePriority(issue: Record<string, unknown> | null | undefined): number {
  if (!issue) return 0;
  const priority = getString(issue.priority).toLowerCase();
  if (priority === "critical" || priority === "high") return 40;
  if (priority === "medium") return 20;
  return 0;
}

function scoreDescriptionLength(prompt: string | null | undefined, description: string | null | undefined): number {
  // Use prompt if present, otherwise fall back to description
  const promptText = getString(prompt ?? "");
  const descText = getString(description ?? "");
  const text = promptText.length > 0 ? promptText : descText;
  if (text.length > 500) return 25;
  if (text.length > 200) return 15;
  return 0;
}

function scoreTaskType(taskType: unknown): number {
  const type = getString(taskType).toLowerCase();
  if (type === "feature" || type === "debug") return 20;
  return 0;
}

function scoreCeoProactive(ceoProfile: unknown): number {
  if (typeof ceoProfile === "object" && ceoProfile !== null) return 10;
  return 0;
}

function scoreMultiFileRefs(prompt: string | null | undefined): number {
  const text = getString(prompt ?? "");
  if (text.includes("file://") || /\bopen\b/i.test(text) || /\bedit\b/i.test(text)) return 15;
  return 0;
}

function resolveIssue(config: Record<string, unknown>): Record<string, unknown> | null {
  const issue = config.issue;
  if (issue && typeof issue === "object") return issue as Record<string, unknown>;
  return null;
}

function resolvePrompt(config: Record<string, unknown>): string | null {
  return typeof config.prompt === "string" ? config.prompt : null;
}

function resolveTaskType(config: Record<string, unknown>): string | null {
  return typeof config.taskType === "string" ? config.taskType : null;
}

function resolveAgent(config: Record<string, unknown>): Record<string, unknown> | null {
  const agent = config.agent;
  if (agent && typeof agent === "object") return agent as Record<string, unknown>;
  return null;
}

function resolveCeoProfile(agent: Record<string, unknown> | null): unknown {
  if (!agent) return null;
  return agent.ceoProfile ?? null;
}

export function classifyTask(ctx: AdapterExecutionContext): TaskComplexity {
  const config = ctx.config ?? {};

  const issue = resolveIssue(config);
  const prompt = resolvePrompt(config);
  const description = issue ? getString(issue.description) : null;
  const taskType = resolveTaskType(config);
  const agent = resolveAgent(config);
  const ceoProfile = resolveCeoProfile(agent);

  const score =
    scoreIssuePriority(issue) +
    scoreDescriptionLength(prompt, description) +
    scoreTaskType(taskType) +
    scoreCeoProactive(ceoProfile) +
    scoreMultiFileRefs(prompt);

  // No meaningful signals detected — route to standard tier as safe default
  if (score === 0) return "standard";
  if (score >= SCORE_COMPLEX) return "complex";
  if (score >= SCORE_STANDARD) return "standard";
  return "simple";
}
