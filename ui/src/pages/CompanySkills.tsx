import { useEffect, useMemo, useState, type SVGProps } from "react";
import { Link, useNavigate, useParams } from "@/lib/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CompanySkillCreateRequest,
  CompanySkillDetail,
  CompanySkillFileDetail,
  CompanySkillFileInventoryEntry,
  CompanySkillListItem,
  CompanySkillPatchRequest,
  CompanySkillProjectScanResult,
  CompanySkillSourceBadge,
  CompanySkillUpdateStatus,
} from "@aideveloai/shared";
import { companySkillsApi } from "../api/companySkills";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { getCeoRecommendationBadges } from "../lib/ceo-skill-presets";
import { EmptyState } from "../components/EmptyState";
import { MarkdownBody } from "../components/MarkdownBody";
import { MarkdownEditor } from "../components/MarkdownEditor";
import { PageSkeleton } from "../components/PageSkeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "../lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Boxes,
  ChevronDown,
  ChevronRight,
  Code2,
  Eye,
  FileCode2,
  FileText,
  Folder,
  FolderOpen,
  Github,
  Link2,
  ExternalLink,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
} from "lucide-react";

/** API and cached query data may omit `tags`; keep UI resilient. */
function listItemTags(skill: Pick<CompanySkillListItem, "tags">): string[] {
  const raw = skill.tags;
  if (!Array.isArray(raw)) return [];
  return raw.filter((t): t is string => typeof t === "string" && t.length > 0);
}

function detailTags(detail: Pick<CompanySkillDetail, "tags"> | null | undefined): string[] {
  if (!detail) return [];
  return listItemTags(detail);
}

function skillBundled(skill: Pick<CompanySkillListItem, "bundled">): boolean {
  return skill.bundled === true;
}

/** Treat missing `enabled` as on (older API / cache). */
function skillActiveForRuntime(skill: Pick<CompanySkillListItem, "enabled" | "bundled">): boolean {
  return skillBundled(skill) || skill.enabled !== false;
}

function skillExplicitlyDisabled(skill: Pick<CompanySkillListItem, "enabled" | "bundled">): boolean {
  return skill.enabled === false && !skillBundled(skill);
}

const RECOMMENDED_SKILL_IMPORTS: { label: string; description: string; source: string }[] = [
  {
    label: "Find skills",
    description: "Discover skills from the registry (planning / setup).",
    source: "npx skills add https://github.com/vercel-labs/skills --skill find-skills",
  },
  {
    label: "Anthropic examples",
    description: "Official example skills (brainstorming, docs patterns).",
    source: "https://github.com/anthropics/skills",
  },
  {
    label: "Remotion skills",
    description: "Video and Remotion-oriented workflows.",
    source: "https://github.com/remotion-dev/skills",
  },
];

type SkillTreeNode = {
  name: string;
  path: string | null;
  kind: "dir" | "file";
  fileKind?: CompanySkillFileInventoryEntry["kind"];
  children: SkillTreeNode[];
};

const SKILL_TREE_BASE_INDENT = 16;
const SKILL_TREE_STEP_INDENT = 24;
const SKILL_TREE_ROW_HEIGHT_CLASS = "min-h-9";

function VercelMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 4 21 19H3z" />
    </svg>
  );
}

function stripFrontmatter(markdown: string) {
  const normalized = markdown.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) return normalized.trim();
  const closing = normalized.indexOf("\n---\n", 4);
  if (closing < 0) return normalized.trim();
  return normalized.slice(closing + 5).trim();
}

function splitFrontmatter(markdown: string): { frontmatter: string | null; body: string } {
  const normalized = markdown.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    return { frontmatter: null, body: normalized };
  }
  const closing = normalized.indexOf("\n---\n", 4);
  if (closing < 0) {
    return { frontmatter: null, body: normalized };
  }
  return {
    frontmatter: normalized.slice(4, closing).trim(),
    body: normalized.slice(closing + 5).trimStart(),
  };
}

function mergeFrontmatter(markdown: string, body: string) {
  const parsed = splitFrontmatter(markdown);
  if (!parsed.frontmatter) return body;
  return ["---", parsed.frontmatter, "---", "", body].join("\n");
}

function buildTree(entries: CompanySkillFileInventoryEntry[]) {
  const root: SkillTreeNode = { name: "", path: null, kind: "dir", children: [] };

  for (const entry of entries) {
    const segments = entry.path.split("/").filter(Boolean);
    let current = root;
    let currentPath = "";
    for (const [index, segment] of segments.entries()) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      const isLeaf = index === segments.length - 1;
      let next = current.children.find((child) => child.name === segment);
      if (!next) {
        next = {
          name: segment,
          path: isLeaf ? entry.path : currentPath,
          kind: isLeaf ? "file" : "dir",
          fileKind: isLeaf ? entry.kind : undefined,
          children: [],
        };
        current.children.push(next);
      }
      current = next;
    }
  }

  function sortNode(node: SkillTreeNode) {
    node.children.sort((left, right) => {
      if (left.kind !== right.kind) return left.kind === "dir" ? -1 : 1;
      if (left.name === "SKILL.md") return -1;
      if (right.name === "SKILL.md") return 1;
      return left.name.localeCompare(right.name);
    });
    node.children.forEach(sortNode);
  }

  sortNode(root);
  return root.children;
}

function sourceMeta(sourceBadge: CompanySkillSourceBadge, sourceLabel: string | null) {
  const normalizedLabel = sourceLabel?.toLowerCase() ?? "";
  const isSkillsShManaged =
    normalizedLabel.includes("skills.sh") || normalizedLabel.includes("vercel-labs/skills");

  switch (sourceBadge) {
    case "skills_sh":
      return { icon: VercelMark, label: sourceLabel ?? "skills.sh", managedLabel: "skills.sh managed" };
    case "github":
      return isSkillsShManaged
        ? { icon: VercelMark, label: sourceLabel ?? "skills.sh", managedLabel: "skills.sh managed" }
        : { icon: Github, label: sourceLabel ?? "GitHub", managedLabel: "GitHub managed" };
    case "url":
      return { icon: Link2, label: sourceLabel ?? "URL", managedLabel: "URL managed" };
    case "local":
      return { icon: Folder, label: sourceLabel ?? "Folder", managedLabel: "Folder managed" };
    case "aidevelo":
      return { icon: Paperclip, label: sourceLabel ?? "Aidevelo", managedLabel: "Aidevelo managed" };
    default:
      return { icon: Boxes, label: sourceLabel ?? "Catalog", managedLabel: "Catalog managed" };
  }
}

function shortRef(ref: string | null | undefined) {
  if (!ref) return null;
  return ref.slice(0, 7);
}

function formatProjectScanSummary(result: CompanySkillProjectScanResult) {
  const parts = [
    `${result.discovered} found`,
    `${result.imported.length} imported`,
    `${result.updated.length} updated`,
  ];
  if (result.conflicts.length > 0) parts.push(`${result.conflicts.length} conflicts`);
  if (result.skipped.length > 0) parts.push(`${result.skipped.length} skipped`);
  return `${parts.join(", ")} across ${result.scannedWorkspaces} workspace${result.scannedWorkspaces === 1 ? "" : "s"}.`;
}

function fileIcon(kind: CompanySkillFileInventoryEntry["kind"]) {
  if (kind === "script" || kind === "reference") return FileCode2;
  return FileText;
}

function encodeSkillFilePath(filePath: string) {
  return filePath.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

function decodeSkillFilePath(filePath: string | undefined) {
  if (!filePath) return "SKILL.md";
  return filePath
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .join("/");
}

function parseSkillRoute(routePath: string | undefined) {
  const segments = (routePath ?? "").split("/").filter(Boolean);
  if (segments.length === 0) {
    return { skillId: null, filePath: "SKILL.md" };
  }

  const [rawSkillId, rawMode, ...rest] = segments;
  const skillId = rawSkillId ? decodeURIComponent(rawSkillId) : null;
  if (!skillId) {
    return { skillId: null, filePath: "SKILL.md" };
  }

  if (rawMode === "files") {
    return {
      skillId,
      filePath: decodeSkillFilePath(rest.join("/")),
    };
  }

  return { skillId, filePath: "SKILL.md" };
}

function skillRoute(skillId: string, filePath?: string | null) {
  return filePath ? `/skills/${skillId}/files/${encodeSkillFilePath(filePath)}` : `/skills/${skillId}`;
}

function parentDirectoryPaths(filePath: string) {
  const segments = filePath.split("/").filter(Boolean);
  const parents: string[] = [];
  for (let index = 0; index < segments.length - 1; index += 1) {
    parents.push(segments.slice(0, index + 1).join("/"));
  }
  return parents;
}

function NewSkillForm({
  onCreate,
  isPending,
  onCancel,
}: {
  onCreate: (payload: CompanySkillCreateRequest) => void;
  isPending: boolean;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");

  return (
    <div className="border-b border-border px-4 py-4">
      <div className="space-y-3">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Skill name"
          className="h-9 rounded-none border-0 border-b border-border px-0 shadow-none focus-visible:ring-0"
        />
        <Input
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          placeholder="optional-shortname"
          className="h-9 rounded-none border-0 border-b border-border px-0 shadow-none focus-visible:ring-0"
        />
        <Textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Short description"
          className="min-h-20 rounded-none border-0 border-b border-border px-0 shadow-none focus-visible:ring-0"
        />
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => onCreate({ name, slug: slug || null, description: description || null })}
            disabled={isPending || name.trim().length === 0}
          >
            {isPending ? "Creating..." : "Create skill"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SkillTree({
  nodes,
  skillId,
  selectedPath,
  expandedDirs,
  onToggleDir,
  onSelectPath,
  depth = 0,
}: {
  nodes: SkillTreeNode[];
  skillId: string;
  selectedPath: string;
  expandedDirs: Set<string>;
  onToggleDir: (path: string) => void;
  onSelectPath: (path: string) => void;
  depth?: number;
}) {
  return (
    <div>
      {nodes.map((node) => {
        const expanded = node.kind === "dir" && node.path ? expandedDirs.has(node.path) : false;
        if (node.kind === "dir") {
          return (
            <div key={node.path ?? node.name}>
              <div
                className={cn(
                  "group grid w-full grid-cols-[minmax(0,1fr)_2.25rem] items-center gap-x-1 pr-3 text-left text-sm text-muted-foreground hover:bg-accent/30 hover:text-foreground",
                  SKILL_TREE_ROW_HEIGHT_CLASS,
                )}
              >
                <button
                  type="button"
                  className="flex min-w-0 items-center gap-2 py-1 text-left"
                  style={{ paddingLeft: `${SKILL_TREE_BASE_INDENT + depth * SKILL_TREE_STEP_INDENT}px` }}
                  onClick={() => node.path && onToggleDir(node.path)}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                    {expanded ? <FolderOpen className="h-3.5 w-3.5" /> : <Folder className="h-3.5 w-3.5" />}
                  </span>
                  <span className="truncate">{node.name}</span>
                </button>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center self-center rounded-sm text-muted-foreground opacity-70 transition-[background-color,color,opacity] hover:bg-accent hover:text-foreground group-hover:opacity-100"
                  onClick={() => node.path && onToggleDir(node.path)}
                >
                  {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
              </div>
              {expanded && (
                <SkillTree
                  nodes={node.children}
                  skillId={skillId}
                  selectedPath={selectedPath}
                  expandedDirs={expandedDirs}
                  onToggleDir={onToggleDir}
                  onSelectPath={onSelectPath}
                  depth={depth + 1}
                />
              )}
            </div>
          );
        }

        const FileIcon = fileIcon(node.fileKind ?? "other");
        return (
          <Link
            key={node.path ?? node.name}
            className={cn(
              "flex w-full items-center gap-2 pr-3 text-left text-sm text-muted-foreground hover:bg-accent/30 hover:text-foreground",
              SKILL_TREE_ROW_HEIGHT_CLASS,
              node.path === selectedPath && "text-foreground",
            )}
            style={{ paddingInlineStart: `${SKILL_TREE_BASE_INDENT + depth * SKILL_TREE_STEP_INDENT}px` }}
            to={skillRoute(skillId, node.path)}
            onClick={() => node.path && onSelectPath(node.path)}
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center">
              <FileIcon className="h-3.5 w-3.5" />
            </span>
            <span className="truncate">{node.name}</span>
          </Link>
        );
      })}
    </div>
  );
}

function SkillList({
  skills,
  selectedSkillId,
  expandedSkillId,
  expandedDirs,
  selectedPaths,
  onToggleSkill,
  onToggleDir,
  onSelectSkill,
  onSelectPath,
  onToggleEnabled,
  patchingSkillId,
  onRequestDelete,
  emptyMessage,
}: {
  skills: CompanySkillListItem[];
  emptyMessage: string;
  selectedSkillId: string | null;
  expandedSkillId: string | null;
  expandedDirs: Record<string, Set<string>>;
  selectedPaths: Record<string, string>;
  onToggleSkill: (skillId: string) => void;
  onToggleDir: (skillId: string, path: string) => void;
  onSelectSkill: (skillId: string) => void;
  onSelectPath: (skillId: string, path: string) => void;
  onToggleEnabled: (skillId: string, enabled: boolean) => void;
  patchingSkillId: string | null;
  onRequestDelete: (skill: CompanySkillListItem) => void;
}) {
  if (skills.length === 0) {
    return (
      <div className="px-4 py-6 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div>
      {skills.map((skill) => {
        const expanded = expandedSkillId === skill.id;
        const tree = buildTree(skill.fileInventory);
        const source = sourceMeta(skill.sourceBadge, skill.sourceLabel);
        const SourceIcon = source.icon;
        const recommendationBadges = getCeoRecommendationBadges(skill);

        return (
          <div
            key={skill.id}
            className={cn(
              "border-b border-border",
              skillExplicitlyDisabled(skill) && "bg-muted/20",
            )}
          >
            <div
              className={cn(
                "group flex items-start gap-2 px-3 py-1.5 hover:bg-accent/30",
                skill.id === selectedSkillId && "text-foreground",
              )}
            >
              <Link
                to={skillRoute(skill.id)}
                className="flex min-w-0 flex-1 items-start gap-2 self-stretch pr-1 text-left no-underline"
                onClick={() => onSelectSkill(skill.id)}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground opacity-75 transition-opacity group-hover:opacity-100">
                      <SourceIcon className="h-3.5 w-3.5" />
                      <span className="sr-only">{source.managedLabel}</span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">{source.managedLabel}</TooltipContent>
                </Tooltip>
                <span className="min-w-0 flex-1">
                  <span className="block overflow-hidden text-[13px] font-medium leading-5 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]">
                    {skill.name}
                  </span>
                  {skillExplicitlyDisabled(skill) ? (
                    <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
                      Disabled
                    </span>
                  ) : null}
                  {listItemTags(skill).length > 0 ? (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {listItemTags(skill).map((tag) => (
                        <Badge key={tag} variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
                          {tag}
                        </Badge>
                      ))}
                    </span>
                  ) : null}
                  {recommendationBadges.length > 0 ? (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {recommendationBadges.map((badge) => (
                        <span
                          key={badge}
                          className="inline-flex rounded-full border border-emerald-300/70 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-300"
                        >
                          {badge}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </span>
              </Link>
              <div className="flex shrink-0 items-center gap-0.5 pt-0.5">
                <div className="flex flex-col items-center gap-0.5">
                  <Checkbox
                    id={`skill-active-${skill.id}`}
                    checked={skillActiveForRuntime(skill)}
                    disabled={skillBundled(skill) || patchingSkillId === skill.id}
                    title={skillBundled(skill) ? "Bundled skills stay enabled for adapters." : "Include in adapter runtime"}
                    onCheckedChange={(value) => {
                      if (value === "indeterminate") return;
                      onToggleEnabled(skill.id, value);
                    }}
                  />
                  <Label
                    htmlFor={`skill-active-${skill.id}`}
                    className="text-[9px] leading-none text-muted-foreground"
                  >
                    On
                  </Label>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive"
                  disabled={skillBundled(skill)}
                  title={skillBundled(skill) ? "Bundled skills cannot be removed." : "Remove skill"}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onRequestDelete(skill);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <button
                  type="button"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-muted-foreground opacity-80 transition-[background-color,color,opacity] hover:bg-accent hover:text-foreground group-hover:opacity-100"
                  onClick={() => onToggleSkill(skill.id)}
                  aria-label={expanded ? `Collapse ${skill.name}` : `Expand ${skill.name}`}
                >
                  {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <div
              aria-hidden={!expanded}
              className={cn(
                "grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
                expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="min-h-0 overflow-hidden">
                <SkillTree
                  nodes={tree}
                  skillId={skill.id}
                  selectedPath={selectedPaths[skill.id] ?? "SKILL.md"}
                  expandedDirs={expandedDirs[skill.id] ?? new Set<string>()}
                  onToggleDir={(path) => onToggleDir(skill.id, path)}
                  onSelectPath={(path) => onSelectPath(skill.id, path)}
                  depth={1}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const SKILL_TAG_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

function SkillPane({
  loading,
  detail,
  file,
  fileLoading,
  updateStatus,
  updateStatusLoading,
  viewMode,
  editMode,
  draft,
  setViewMode,
  setEditMode,
  setDraft,
  onCheckUpdates,
  checkUpdatesPending,
  onInstallUpdate,
  installUpdatePending,
  onSave,
  savePending,
  onSaveTags,
  tagsSaving,
}: {
  loading: boolean;
  detail: CompanySkillDetail | null | undefined;
  file: CompanySkillFileDetail | null | undefined;
  fileLoading: boolean;
  updateStatus: CompanySkillUpdateStatus | null | undefined;
  updateStatusLoading: boolean;
  viewMode: "preview" | "code";
  editMode: boolean;
  draft: string;
  setViewMode: (mode: "preview" | "code") => void;
  setEditMode: (value: boolean) => void;
  setDraft: (value: string) => void;
  onCheckUpdates: () => void;
  checkUpdatesPending: boolean;
  onInstallUpdate: () => void;
  installUpdatePending: boolean;
  onSave: () => void;
  savePending: boolean;
  onSaveTags: (tags: string[]) => void;
  tagsSaving: boolean;
}) {
  const { pushToast } = useToast();
  const [tagDraft, setTagDraft] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    if (!detail) {
      setTagDraft([]);
      setTagInput("");
      return;
    }
    setTagDraft(detailTags(detail));
    setTagInput("");
  }, [detail?.id, detailTags(detail).join("\0")]);

  function addTagFromInput() {
    const raw = tagInput.trim();
    if (!raw) return;
    if (raw.length > 48 || !SKILL_TAG_PATTERN.test(raw)) {
      pushToast({
        tone: "error",
        title: "Invalid tag",
        body: "Use 1–48 characters: letters, numbers, dot, underscore, hyphen; must start with alphanumeric.",
      });
      return;
    }
    if (tagDraft.includes(raw)) {
      setTagInput("");
      return;
    }
    if (tagDraft.length >= 20) {
      pushToast({ tone: "warn", title: "Tag limit", body: "You can add at most 20 tags." });
      return;
    }
    setTagDraft((current) => [...current, raw]);
    setTagInput("");
  }

  const sortedDraft = [...tagDraft].sort().join("\0");
  const sortedDetail = detail ? [...detailTags(detail)].sort().join("\0") : "";
  const tagsDirty = Boolean(detail && sortedDraft !== sortedDetail);

  if (!detail) {
    if (loading) {
      return <PageSkeleton variant="detail" />;
    }
    return (
      <EmptyState
        icon={Boxes}
        message="Select a skill to inspect its files."
      />
    );
  }

  const source = sourceMeta(detail.sourceBadge, detail.sourceLabel);
  const SourceIcon = source.icon;
  const usedBy = detail.usedByAgents;
  const body = file?.markdown ? stripFrontmatter(file.content) : file?.content ?? "";
  const currentPin = shortRef(detail.sourceRef);
  const latestPin = shortRef(updateStatus?.latestRef);

  return (
    <div className="min-w-0">
      <div className="border-b border-border px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 truncate text-2xl font-semibold">
              <SourceIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
              {detail.name}
            </h1>
            {detail.description && (
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{detail.description}</p>
            )}
          </div>
          {detail.editable ? (
            <button
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setEditMode(!editMode)}
            >
              <Pencil className="h-3.5 w-3.5" />
              {editMode ? "Stop editing" : "Edit"}
            </button>
          ) : (
            <div className="text-sm text-muted-foreground">{detail.editableReason}</div>
          )}
        </div>

        <div className="mt-4 space-y-3 border-t border-border pt-4 text-sm">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Source</span>
              <span className="flex items-center gap-2">
                <SourceIcon className="h-3.5 w-3.5 text-muted-foreground" />
                {detail.sourcePath ? (
                  <button
                    className="truncate hover:text-foreground text-muted-foreground transition-colors cursor-pointer"
                    onClick={() => {
                      navigator.clipboard.writeText(detail.sourcePath!);
                      pushToast({ title: "Copied path to workspace" });
                    }}
                  >
                    {source.label}
                  </button>
                ) : (
                  <span className="truncate">{source.label}</span>
                )}
              </span>
            </div>
            {detail.sourceType === "github" && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Pin</span>
                <span className="font-mono text-xs">{currentPin ?? "untracked"}</span>
                {updateStatus?.trackingRef && (
                  <span className="text-xs text-muted-foreground">tracking {updateStatus.trackingRef}</span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCheckUpdates}
                  disabled={checkUpdatesPending || updateStatusLoading}
                >
                  <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", (checkUpdatesPending || updateStatusLoading) && "animate-spin")} />
                  Check for updates
                </Button>
                {updateStatus?.supported && updateStatus.hasUpdate && (
                  <Button
                    size="sm"
                    onClick={onInstallUpdate}
                    disabled={installUpdatePending}
                  >
                    <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", installUpdatePending && "animate-spin")} />
                    Install update{latestPin ? ` ${latestPin}` : ""}
                  </Button>
                )}
                {updateStatus?.supported && !updateStatus.hasUpdate && !updateStatusLoading && (
                  <span className="text-xs text-muted-foreground">Up to date</span>
                )}
                {!updateStatus?.supported && updateStatus?.reason && (
                  <span className="text-xs text-muted-foreground">{updateStatus.reason}</span>
                )}
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Key</span>
              <span className="font-mono text-xs">{detail.key}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Mode</span>
              <span>{detail.editable ? "Editable" : "Read only"}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Used by</span>
            {usedBy.length === 0 ? (
              <span className="text-muted-foreground">No agents attached</span>
            ) : (
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {usedBy.map((agent) => (
                  <Link
                    key={agent.id}
                    to={`/agents/${agent.urlKey}/skills`}
                    className="text-foreground no-underline hover:underline"
                  >
                    {agent.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-start">
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground sm:pt-2">Tags</span>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap gap-1">
                {tagDraft.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-xs"
                  >
                    {tag}
                    <button
                      type="button"
                      className="rounded-sm text-muted-foreground hover:text-foreground"
                      aria-label={`Remove tag ${tag}`}
                      onClick={() => setTagDraft((current) => current.filter((t) => t !== tag))}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={tagInput}
                  onChange={(event) => setTagInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addTagFromInput();
                    }
                  }}
                  placeholder="e.g. Planung"
                  className="h-8 max-w-[12rem] text-sm"
                  disabled={tagsSaving}
                />
                <Button type="button" size="sm" variant="secondary" onClick={addTagFromInput} disabled={tagsSaving}>
                  Add
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onSaveTags(tagDraft)}
                  disabled={tagsSaving || !tagsDirty}
                >
                  {tagsSaving ? "Saving…" : "Save tags"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-border px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-mono text-sm">{file?.path ?? "SKILL.md"}</div>
          </div>
          <div className="flex items-center gap-2">
            {file?.markdown && !editMode && (
              <div className="flex items-center border border-border">
                <button
                  className={cn("px-3 py-1.5 text-sm", viewMode === "preview" && "text-foreground", viewMode !== "preview" && "text-muted-foreground")}
                  onClick={() => setViewMode("preview")}
                >
                  <span className="flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5" />
                    View
                  </span>
                </button>
                <button
                  className={cn("border-l border-border px-3 py-1.5 text-sm", viewMode === "code" && "text-foreground", viewMode !== "code" && "text-muted-foreground")}
                  onClick={() => setViewMode("code")}
                >
                  <span className="flex items-center gap-1.5">
                    <Code2 className="h-3.5 w-3.5" />
                    Code
                  </span>
                </button>
              </div>
            )}
            {editMode && file?.editable && (
              <>
                <Button variant="ghost" size="sm" onClick={() => setEditMode(false)} disabled={savePending}>
                  Cancel
                </Button>
                <Button size="sm" onClick={onSave} disabled={savePending}>
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                  {savePending ? "Saving..." : "Save"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="min-h-[560px] px-5 py-5">
        {fileLoading ? (
          <PageSkeleton variant="detail" />
        ) : !file ? (
          <div className="text-sm text-muted-foreground">Select a file to inspect.</div>
        ) : editMode && file.editable ? (
          file.markdown ? (
            <MarkdownEditor
              value={draft}
              onChange={setDraft}
              bordered={false}
              className="min-h-[520px]"
            />
          ) : (
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="min-h-[520px] rounded-none border-0 bg-transparent px-0 py-0 font-mono text-sm shadow-none focus-visible:ring-0"
            />
          )
        ) : file.markdown && viewMode === "preview" ? (
          <MarkdownBody>{body}</MarkdownBody>
        ) : (
          <pre className="overflow-x-auto whitespace-pre-wrap break-words border-0 bg-transparent p-0 font-mono text-sm text-foreground">
            <code>{file.content}</code>
          </pre>
        )}
      </div>
    </div>
  );
}

export function CompanySkills() {
  const { "*": routePath } = useParams<{ "*": string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const [skillFilter, setSkillFilter] = useState("");
  const [source, setSource] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [emptySourceHelpOpen, setEmptySourceHelpOpen] = useState(false);
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Record<string, Set<string>>>({});
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState("");
  const [displayedDetail, setDisplayedDetail] = useState<CompanySkillDetail | null>(null);
  const [displayedFile, setDisplayedFile] = useState<CompanySkillFileDetail | null>(null);
  const [scanStatusMessage, setScanStatusMessage] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<Set<string>>(() => new Set());
  const [showDisabledSkills, setShowDisabledSkills] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CompanySkillListItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const parsedRoute = useMemo(() => parseSkillRoute(routePath), [routePath]);
  const routeSkillId = parsedRoute.skillId;
  const selectedPath = parsedRoute.filePath;

  useEffect(() => {
    setBreadcrumbs([
      { label: "Skills", href: "/skills" },
      ...(routeSkillId ? [{ label: "Detail" }] : []),
    ]);
  }, [routeSkillId, setBreadcrumbs]);

  const skillsQuery = useQuery({
    queryKey: queryKeys.companySkills.list(selectedCompanyId ?? ""),
    queryFn: () => companySkillsApi.list(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId),
  });

  const allCompanySkills = skillsQuery.data ?? [];

  const unionTags = useMemo(() => {
    const tags = new Set<string>();
    for (const skill of allCompanySkills) {
      for (const tag of listItemTags(skill)) {
        tags.add(tag);
      }
    }
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [allCompanySkills]);

  const displaySkills = useMemo(() => {
    let next = allCompanySkills;
    if (!showDisabledSkills) {
      next = next.filter((skill) => skillActiveForRuntime(skill));
    }
    const q = skillFilter.trim().toLowerCase();
    if (q) {
      next = next.filter((skill) => {
        const haystack = `${skill.name} ${skill.key} ${skill.slug} ${skill.sourceLabel ?? ""} ${listItemTags(skill).join(" ")}`.toLowerCase();
        return haystack.includes(q);
      });
    }
    if (tagFilter.size > 0) {
      next = next.filter((skill) => listItemTags(skill).some((tag) => tagFilter.has(tag)));
    }
    return next;
  }, [allCompanySkills, showDisabledSkills, skillFilter, tagFilter]);

  const selectedSkillId = useMemo(() => {
    if (!routeSkillId) return skillsQuery.data?.[0]?.id ?? null;
    return routeSkillId;
  }, [routeSkillId, skillsQuery.data]);

  useEffect(() => {
    if (routeSkillId || !selectedSkillId) return;
    navigate(skillRoute(selectedSkillId), { replace: true });
  }, [navigate, routeSkillId, selectedSkillId]);

  const detailQuery = useQuery({
    queryKey: queryKeys.companySkills.detail(selectedCompanyId ?? "", selectedSkillId ?? ""),
    queryFn: () => companySkillsApi.detail(selectedCompanyId!, selectedSkillId!),
    enabled: Boolean(selectedCompanyId && selectedSkillId),
  });

  const fileQuery = useQuery({
    queryKey: queryKeys.companySkills.file(selectedCompanyId ?? "", selectedSkillId ?? "", selectedPath),
    queryFn: () => companySkillsApi.file(selectedCompanyId!, selectedSkillId!, selectedPath),
    enabled: Boolean(selectedCompanyId && selectedSkillId && selectedPath),
  });

  const updateStatusQuery = useQuery({
    queryKey: queryKeys.companySkills.updateStatus(selectedCompanyId ?? "", selectedSkillId ?? ""),
    queryFn: () => companySkillsApi.updateStatus(selectedCompanyId!, selectedSkillId!),
    enabled: Boolean(
      selectedCompanyId
      && selectedSkillId
      && (detailQuery.data?.sourceType === "github" || displayedDetail?.sourceType === "github"),
    ),
    staleTime: 60_000,
  });

  useEffect(() => {
    setExpandedSkillId(selectedSkillId);
  }, [selectedSkillId]);

  useEffect(() => {
    if (!selectedSkillId || selectedPath === "SKILL.md") return;
    const parents = parentDirectoryPaths(selectedPath);
    if (parents.length === 0) return;
    setExpandedDirs((current) => {
      const next = new Set(current[selectedSkillId] ?? []);
      let changed = false;
      for (const parent of parents) {
        if (!next.has(parent)) {
          next.add(parent);
          changed = true;
        }
      }
      return changed ? { ...current, [selectedSkillId]: next } : current;
    });
  }, [selectedPath, selectedSkillId]);

  useEffect(() => {
    setEditMode(false);
  }, [selectedSkillId, selectedPath]);

  useEffect(() => {
    if (detailQuery.data) {
      setDisplayedDetail(detailQuery.data);
    }
  }, [detailQuery.data]);

  useEffect(() => {
    if (fileQuery.data) {
      setDisplayedFile(fileQuery.data);
      setDraft(fileQuery.data.markdown ? splitFrontmatter(fileQuery.data.content).body : fileQuery.data.content);
    }
  }, [fileQuery.data]);

  useEffect(() => {
    if (selectedSkillId) return;
    setDisplayedDetail(null);
    setDisplayedFile(null);
  }, [selectedSkillId]);

  const activeDetail = detailQuery.data ?? displayedDetail;
  const activeFile = fileQuery.data ?? displayedFile;

  const importSkill = useMutation({
    mutationFn: (importSource: string) => companySkillsApi.importFromSource(selectedCompanyId!, importSource),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.companySkills.list(selectedCompanyId!) });
      if (result.imported[0]) navigate(skillRoute(result.imported[0].id));
      pushToast({
        tone: "success",
        title: "Skills imported",
        body: `${result.imported.length} skill${result.imported.length === 1 ? "" : "s"} added.`,
      });
      if (result.warnings[0]) {
        pushToast({ tone: "warn", title: "Import warnings", body: result.warnings[0] });
      }
      setSource("");
    },
    onError: (error) => {
      pushToast({
        tone: "error",
        title: "Skill import failed",
        body: error instanceof Error ? error.message : "Failed to import skill source.",
      });
    },
  });

  const createSkill = useMutation({
    mutationFn: (payload: CompanySkillCreateRequest) => companySkillsApi.create(selectedCompanyId!, payload),
    onSuccess: async (skill) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.companySkills.list(selectedCompanyId!) });
      navigate(skillRoute(skill.id));
      setCreateOpen(false);
      pushToast({
        tone: "success",
        title: "Skill created",
        body: `${skill.name} is now editable in the Aidevelo workspace.`,
      });
    },
    onError: (error) => {
      pushToast({
        tone: "error",
        title: "Skill creation failed",
        body: error instanceof Error ? error.message : "Failed to create skill.",
      });
    },
  });

  const scanProjects = useMutation({
    mutationFn: () => companySkillsApi.scanProjects(selectedCompanyId!),
    onMutate: () => {
      setScanStatusMessage("Scanning project workspaces for skills...");
    },
    onSuccess: async (result) => {
      setScanStatusMessage("Refreshing skills list...");
      await queryClient.invalidateQueries({ queryKey: queryKeys.companySkills.list(selectedCompanyId!) });
      const summary = formatProjectScanSummary(result);
      setScanStatusMessage(summary);
      pushToast({
        tone: "success",
        title: "Project skill scan complete",
        body: summary,
      });
      if (result.conflicts[0]) {
        pushToast({
          tone: "warn",
          title: "Skill conflicts found",
          body: result.conflicts[0].reason,
        });
      } else if (result.warnings[0]) {
        pushToast({
          tone: "warn",
          title: "Scan warnings",
          body: result.warnings[0],
        });
      }
    },
    onError: (error) => {
      setScanStatusMessage(null);
      pushToast({
        tone: "error",
        title: "Project skill scan failed",
        body: error instanceof Error ? error.message : "Failed to scan project workspaces.",
      });
    },
  });

  const saveFile = useMutation({
    mutationFn: () => companySkillsApi.updateFile(
      selectedCompanyId!,
      selectedSkillId!,
      selectedPath,
      activeFile?.markdown ? mergeFrontmatter(activeFile.content, draft) : draft,
    ),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.companySkills.list(selectedCompanyId!) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.companySkills.detail(selectedCompanyId!, selectedSkillId!) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.companySkills.file(selectedCompanyId!, selectedSkillId!, selectedPath) }),
      ]);
      setDraft(result.markdown ? splitFrontmatter(result.content).body : result.content);
      setEditMode(false);
      pushToast({
        tone: "success",
        title: "Skill saved",
        body: result.path,
      });
    },
    onError: (error) => {
      pushToast({
        tone: "error",
        title: "Save failed",
        body: error instanceof Error ? error.message : "Failed to save skill file.",
      });
    },
  });

  const installUpdate = useMutation({
    mutationFn: () => companySkillsApi.installUpdate(selectedCompanyId!, selectedSkillId!),
    onSuccess: async (skill) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.companySkills.list(selectedCompanyId!) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.companySkills.detail(selectedCompanyId!, selectedSkillId!) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.companySkills.updateStatus(selectedCompanyId!, selectedSkillId!) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.companySkills.file(selectedCompanyId!, selectedSkillId!, selectedPath) }),
      ]);
      navigate(skillRoute(skill.id, selectedPath));
      pushToast({
        tone: "success",
        title: "Skill updated",
        body: skill.sourceRef ? `Pinned to ${shortRef(skill.sourceRef)}` : skill.name,
      });
    },
    onError: (error) => {
      pushToast({
        tone: "error",
        title: "Update failed",
        body: error instanceof Error ? error.message : "Failed to install skill update.",
      });
    },
  });

  const patchSkillMutation = useMutation({
    mutationFn: ({
      skillId,
      body,
    }: {
      skillId: string;
      body: CompanySkillPatchRequest;
    }) => companySkillsApi.patch(selectedCompanyId!, skillId, body),
    onSuccess: async (updated, { skillId }) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.companySkills.list(selectedCompanyId!) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.companySkills.detail(selectedCompanyId!, skillId) });
      if (skillId === selectedSkillId) {
        setDisplayedDetail(updated);
      }
      pushToast({ tone: "success", title: "Skill updated" });
    },
    onError: (error) => {
      pushToast({
        tone: "error",
        title: "Skill update failed",
        body: error instanceof Error ? error.message : "Could not update skill.",
      });
    },
  });

  const deleteSkillMutation = useMutation({
    mutationFn: (skillId: string) => companySkillsApi.remove(selectedCompanyId!, skillId),
    onSuccess: async (_, skillId) => {
      setDeleteTarget(null);
      setDeleteConfirm("");
      await queryClient.invalidateQueries({ queryKey: queryKeys.companySkills.list(selectedCompanyId!) });
      if (selectedSkillId === skillId) {
        navigate("/skills", { replace: true });
      }
      pushToast({ tone: "success", title: "Skill removed" });
    },
    onError: (error) => {
      pushToast({
        tone: "error",
        title: "Remove failed",
        body: error instanceof Error ? error.message : "Could not remove skill.",
      });
    },
  });

  const patchingSkillId = patchSkillMutation.isPending && patchSkillMutation.variables
    ? patchSkillMutation.variables.skillId
    : null;

  const tagsSaving = Boolean(
    patchSkillMutation.isPending
    && patchSkillMutation.variables
    && patchSkillMutation.variables.skillId === selectedSkillId
    && patchSkillMutation.variables.body.tags !== undefined,
  );

  if (!selectedCompanyId) {
    return <EmptyState icon={Boxes} message="Select a company to manage skills." />;
  }

  function handleAddSkillSource() {
    const trimmedSource = source.trim();
    if (trimmedSource.length === 0) {
      setEmptySourceHelpOpen(true);
      return;
    }
    importSkill.mutate(trimmedSource);
  }

  return (
    <>
      <Dialog open={emptySourceHelpOpen} onOpenChange={setEmptySourceHelpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a skill source</DialogTitle>
            <DialogDescription>
              Paste a local path, GitHub URL, or `skills.sh` command into the field first.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <a
              href="https://skills.sh"
              target="_blank"
              rel="noreferrer"
              className="flex items-start justify-between rounded-md border border-border px-3 py-3 text-foreground no-underline transition-colors hover:bg-accent/40"
            >
              <span>
                <span className="block font-medium">Browse skills.sh</span>
                <span className="mt-1 block text-muted-foreground">
                  Find install commands and paste one here.
                </span>
              </span>
              <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            </a>
            <a
              href="https://github.com/search?q=SKILL.md&type=code"
              target="_blank"
              rel="noreferrer"
              className="flex items-start justify-between rounded-md border border-border px-3 py-3 text-foreground no-underline transition-colors hover:bg-accent/40"
            >
              <span>
                <span className="block font-medium">Search GitHub</span>
                <span className="mt-1 block text-muted-foreground">
                  Look for repositories with `SKILL.md`, then paste the repo URL here.
                </span>
              </span>
              <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            </a>
          </div>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteConfirm("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove skill</DialogTitle>
            <DialogDescription>
              This removes the skill from your company library. Agents will stop receiving it unless it is bundled with Aidevelo.
              Type the skill name <span className="font-medium text-foreground">{deleteTarget?.name}</span> to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirm}
            onChange={(event) => setDeleteConfirm(event.target.value)}
            placeholder="Skill name"
            autoComplete="off"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDeleteTarget(null);
                setDeleteConfirm("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                !deleteTarget
                || deleteConfirm.trim() !== deleteTarget.name.trim()
                || deleteSkillMutation.isPending
              }
              onClick={() => {
                if (!deleteTarget) return;
                deleteSkillMutation.mutate(deleteTarget.id);
              }}
            >
              {deleteSkillMutation.isPending ? "Removing…" : "Remove skill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid min-h-[calc(100vh-12rem)] gap-0 xl:grid-cols-[19rem_minmax(0,1fr)]">
        <aside className="border-r border-border">
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h1 className="text-base font-semibold">Skills</h1>
                <p className="text-xs text-muted-foreground">
                  {skillsQuery.data?.length ?? 0} available
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => scanProjects.mutate()}
                  disabled={scanProjects.isPending}
                  title="Scan project workspaces for skills"
                >
                  <RefreshCw className={cn("h-4 w-4", scanProjects.isPending && "animate-spin")} />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => setCreateOpen((value) => !value)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 border-b border-border pb-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={skillFilter}
                onChange={(event) => setSkillFilter(event.target.value)}
                placeholder="Filter skills"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>

            {unionTags.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {unionTags.map((tag) => {
                  const active = tagFilter.has(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                        active
                          ? "border-primary bg-primary/15 text-foreground"
                          : "border-border text-muted-foreground hover:bg-accent/50",
                      )}
                      onClick={() => {
                        setTagFilter((prev) => {
                          const next = new Set(prev);
                          if (next.has(tag)) next.delete(tag);
                          else next.add(tag);
                          return next;
                        });
                      }}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            ) : null}

            <div className="mt-2 flex items-center gap-2">
              <Checkbox
                id="show-disabled-company-skills"
                checked={showDisabledSkills}
                onCheckedChange={(value) => setShowDisabledSkills(value === true)}
              />
              <Label htmlFor="show-disabled-company-skills" className="text-xs text-muted-foreground">
                Show disabled skills
              </Label>
            </div>

            <div className="mt-3 rounded-md border border-border/80 bg-muted/20 px-2 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Recommended imports</p>
              <div className="mt-2 space-y-1.5">
                {RECOMMENDED_SKILL_IMPORTS.map((preset) => (
                  <button
                    key={preset.source}
                    type="button"
                    className="w-full rounded border border-border bg-background px-2 py-2 text-left text-xs transition-colors hover:bg-accent/40"
                    onClick={() => importSkill.mutate(preset.source)}
                    disabled={importSkill.isPending}
                  >
                    <span className="font-medium text-foreground">{preset.label}</span>
                    <span className="mt-0.5 block text-muted-foreground">{preset.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 border-b border-border pb-2">
              <input
                value={source}
                onChange={(event) => setSource(event.target.value)}
                placeholder="Paste path, GitHub URL, or skills.sh command"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={handleAddSkillSource}
                disabled={importSkill.isPending}
              >
                {importSkill.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Add"}
              </Button>
            </div>
            {scanStatusMessage && (
              <p className="mt-3 text-xs text-muted-foreground">
                {scanStatusMessage}
              </p>
            )}
          </div>

          {createOpen && (
            <NewSkillForm
              onCreate={(payload) => createSkill.mutate(payload)}
              isPending={createSkill.isPending}
              onCancel={() => setCreateOpen(false)}
            />
          )}

          {skillsQuery.isLoading ? (
            <PageSkeleton variant="list" />
          ) : skillsQuery.error ? (
            <div className="px-4 py-6 text-sm text-destructive">{skillsQuery.error.message}</div>
          ) : (
            <SkillList
              skills={displaySkills}
              emptyMessage={
                allCompanySkills.length === 0
                  ? "No skills yet. Import a source, scan projects, or create a skill."
                  : "No skills match this filter."
              }
              selectedSkillId={selectedSkillId}
              expandedSkillId={expandedSkillId}
              expandedDirs={expandedDirs}
              selectedPaths={selectedSkillId ? { [selectedSkillId]: selectedPath } : {}}
              onToggleSkill={(currentSkillId) =>
                setExpandedSkillId((current) => current === currentSkillId ? null : currentSkillId)
              }
              onToggleDir={(currentSkillId, path) => {
                setExpandedDirs((current) => {
                  const next = new Set(current[currentSkillId] ?? []);
                  if (next.has(path)) next.delete(path);
                  else next.add(path);
                  return { ...current, [currentSkillId]: next };
                });
              }}
              onSelectSkill={(currentSkillId) => setExpandedSkillId(currentSkillId)}
              onSelectPath={() => {}}
              onToggleEnabled={(skillId, enabled) => {
                patchSkillMutation.mutate({ skillId, body: { enabled } });
              }}
              patchingSkillId={patchingSkillId}
              onRequestDelete={(skill) => {
                setDeleteTarget(skill);
                setDeleteConfirm("");
              }}
            />
          )}
        </aside>

        <div className="min-w-0 pl-6">
          <SkillPane
            loading={skillsQuery.isLoading || detailQuery.isLoading}
            detail={activeDetail}
            file={activeFile}
            fileLoading={fileQuery.isLoading && !activeFile}
            updateStatus={updateStatusQuery.data}
            updateStatusLoading={updateStatusQuery.isLoading}
            viewMode={viewMode}
            editMode={editMode}
            draft={draft}
            setViewMode={setViewMode}
            setEditMode={setEditMode}
            setDraft={setDraft}
            onCheckUpdates={() => {
              void updateStatusQuery.refetch();
            }}
            checkUpdatesPending={updateStatusQuery.isFetching}
            onInstallUpdate={() => installUpdate.mutate()}
            installUpdatePending={installUpdate.isPending}
            onSave={() => saveFile.mutate()}
            savePending={saveFile.isPending}
            onSaveTags={(tags) => {
              if (!selectedSkillId) return;
              patchSkillMutation.mutate({ skillId: selectedSkillId, body: { tags } });
            }}
            tagsSaving={tagsSaving}
          />
        </div>
      </div>
    </>
  );
}
