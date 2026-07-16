import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  Agent,
  Goal,
  GoalStatus,
  Issue,
  IssueStatus,
  Project,
  ProjectStatus,
} from "@paperclipai/shared";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Flag,
  GitBranch,
  Landmark,
  ListChecks,
  Map as MapIcon,
  Milestone,
  Palette,
  Route as RouteIcon,
  ShieldAlert,
  Target,
  UsersRound,
} from "lucide-react";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { agentsApi } from "../api/agents";
import { goalsApi } from "../api/goals";
import { issuesApi } from "../api/issues";
import { projectsApi } from "../api/projects";
import { EmptyState } from "../components/EmptyState";
import { IssueStatusBadge, StatusBadge } from "../components/StatusBadge";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { cn, agentUrl, formatNumber, issueUrl, projectUrl } from "../lib/utils";
import { queryKeys } from "../lib/queryKeys";
import {
  buildFormationAssignments,
  VITALS_DEPARTMENTS,
  type DepartmentDefinition,
  type DepartmentId,
} from "./Formation";

export type RoadmapStageId =
  | "initial_idea"
  | "found_it"
  | "identity"
  | "build"
  | "distribute"
  | "launch"
  | "operate_close"
  | "scale";

export type RoadmapDependencyState =
  | "complete"
  | "agent_can_do_this"
  | "needs_your_input"
  | "needs_earlier_steps_first";

export type RoadmapEvidenceKind = "task" | "project" | "goal";

export type RoadmapStageDefinition = {
  id: RoadmapStageId;
  sequence: number;
  title: string;
  flow: string;
  description: string;
  ownerDepartmentId: DepartmentId;
  icon: LucideIcon;
  keywords: readonly string[];
  highRiskKeywords: readonly string[];
};

export type RoadmapEvidence = {
  id: string;
  stageId: RoadmapStageId;
  kind: RoadmapEvidenceKind;
  title: string;
  status: string;
  progress: number;
  href: string;
  ownerAgentId: string | null;
  blocked: boolean;
  highRisk: boolean;
  updatedAt: Date | string;
};

export type RoadmapStageAssignment = {
  stage: RoadmapStageDefinition;
  ownerDepartment: DepartmentDefinition;
  ownerAgent: Agent | null;
  progress: number;
  dependencyState: RoadmapDependencyState;
  isUnblocked: boolean;
  evidence: RoadmapEvidence[];
  taskCount: number;
  projectCount: number;
  goalCount: number;
  blockedEvidenceCount: number;
  highRiskOpenCount: number;
};

export const VITALS_ROADMAP_STAGES: readonly RoadmapStageDefinition[] = [
  {
    id: "initial_idea",
    sequence: 1,
    title: "Initial idea",
    flow: "Idea",
    description: "Define the product, customer, problem, and outcome.",
    ownerDepartmentId: "operations",
    icon: Target,
    keywords: ["idea", "problem", "customer", "outcome", "validation", "mission", "product thesis", "positioning brief"],
    highRiskKeywords: [],
  },
  {
    id: "found_it",
    sequence: 2,
    title: "Found it",
    flow: "Found",
    description: "Name the company, prepare the repository, and form the entity.",
    ownerDepartmentId: "legal",
    icon: Landmark,
    keywords: ["found", "company name", "repo", "repository", "incorporate", "incorporation", "entity", "llc", "corporation", "setup"],
    highRiskKeywords: ["incorporate", "incorporation", "entity", "llc", "corporation"],
  },
  {
    id: "identity",
    sequence: 3,
    title: "Identity",
    flow: "Identity",
    description: "Create the brand, domain, positioning, socials, and banking base.",
    ownerDepartmentId: "design",
    icon: Palette,
    keywords: ["identity", "brand", "logo", "domain", "positioning", "social", "bank", "banking", "website"],
    highRiskKeywords: ["bank", "banking", "domain"],
  },
  {
    id: "build",
    sequence: 4,
    title: "Build",
    flow: "Build",
    description: "Build the product, auth, email, billing, site, and operating systems.",
    ownerDepartmentId: "engineering",
    icon: GitBranch,
    keywords: ["build", "app", "product", "auth", "email", "billing", "infrastructure", "integration", "dashboard", "monitoring", "bookkeeping", "outbound system", "prospect list"],
    highRiskKeywords: ["outbound"],
  },
  {
    id: "distribute",
    sequence: 5,
    title: "Distribute",
    flow: "Sell",
    description: "Publish content, grow social, send outreach, and run acquisition.",
    ownerDepartmentId: "marketing",
    icon: RouteIcon,
    keywords: ["distribute", "content", "social", "seo", "paid", "acquisition", "outreach", "referral", "growth", "campaign"],
    highRiskKeywords: ["outreach", "paid", "ad", "ads", "acquisition"],
  },
  {
    id: "launch",
    sequence: 6,
    title: "Launch",
    flow: "Launch",
    description: "Launch the app and site, expand content, and qualify opportunities.",
    ownerDepartmentId: "sales",
    icon: Flag,
    keywords: ["launch", "beta", "publish", "release", "site", "opportunity", "qualification", "pipeline", "demo"],
    highRiskKeywords: ["launch", "release"],
  },
  {
    id: "operate_close",
    sequence: 7,
    title: "Operate and close",
    flow: "Run",
    description: "Run monitoring, community, closing, onboarding, billing, and support.",
    ownerDepartmentId: "support",
    icon: ListChecks,
    keywords: ["operate", "close", "closing", "monitoring", "community", "onboarding", "billing", "customer", "support", "feedback"],
    highRiskKeywords: ["close", "closing", "billing"],
  },
  {
    id: "scale",
    sequence: 8,
    title: "Scale",
    flow: "Scale",
    description: "Add referrals, legal coverage, compliance, and the support chat surface.",
    ownerDepartmentId: "finance",
    icon: Milestone,
    keywords: ["scale", "referral", "referrals", "legal", "compliance", "contract", "privacy", "support chat", "chat surface", "runway"],
    highRiskKeywords: ["legal", "compliance", "contract", "privacy"],
  },
] as const;

const ISSUE_STATUS_PROGRESS: Record<IssueStatus, number> = {
  backlog: 10,
  todo: 20,
  in_progress: 55,
  in_review: 85,
  done: 100,
  blocked: 15,
  cancelled: 0,
};

const PROJECT_STATUS_PROGRESS: Record<ProjectStatus, number> = {
  backlog: 10,
  planned: 20,
  in_progress: 60,
  completed: 100,
  cancelled: 0,
};

const GOAL_STATUS_PROGRESS: Record<GoalStatus, number> = {
  planned: 15,
  active: 50,
  achieved: 100,
  cancelled: 0,
};

const EVIDENCE_KIND_WEIGHT: Record<RoadmapEvidenceKind, number> = {
  task: 1,
  project: 0.75,
  goal: 0.5,
};

const EVIDENCE_KIND_LABEL: Record<RoadmapEvidenceKind, string> = {
  task: "Task",
  project: "Project",
  goal: "Goal",
};

const DEPENDENCY_LABEL: Record<RoadmapDependencyState, string> = {
  complete: "Complete",
  agent_can_do_this: "Agent can do this",
  needs_your_input: "Needs your input",
  needs_earlier_steps_first: "Needs earlier steps first",
};

function normalize(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function compactText(...values: unknown[]): string {
  return values.map(normalize).filter(Boolean).join(" ");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function includesPhrase(text: string, phrase: string): boolean {
  const normalized = normalize(phrase);
  if (!normalized) return false;
  if (normalized.length <= 3 || normalized.includes(" ")) {
    return new RegExp(`\\b${escapeRegex(normalized)}\\b`).test(text);
  }
  return text.includes(normalized);
}

function scoreStageText(text: string, stage: RoadmapStageDefinition): number {
  if (!text) return 0;
  let score = 0;
  if (includesPhrase(text, stage.title)) score += 70;
  if (includesPhrase(text, stage.flow)) score += 30;
  for (const keyword of stage.keywords) {
    if (includesPhrase(text, keyword)) score += keyword.includes(" ") ? 16 : 9;
  }
  return score;
}

function bestStageForText(text: string): RoadmapStageDefinition | null {
  let best: { stage: RoadmapStageDefinition; score: number } | null = null;
  for (const stage of VITALS_ROADMAP_STAGES) {
    const score = scoreStageText(text, stage);
    if (score > 0 && (!best || score > best.score)) {
      best = { stage, score };
    }
  }
  return best?.stage ?? null;
}

function isHighRiskEvidence(text: string, stage: RoadmapStageDefinition): boolean {
  return stage.highRiskKeywords.some((keyword) => includesPhrase(text, keyword));
}

function roundProgress(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value / 5) * 5));
}

function evidenceSortValue(item: RoadmapEvidence): number {
  if (item.blocked) return -1000 + item.progress;
  if (item.progress < 100) return item.progress;
  return 1000 + item.progress;
}

function sortEvidence(left: RoadmapEvidence, right: RoadmapEvidence): number {
  const progressDiff = evidenceSortValue(left) - evidenceSortValue(right);
  if (progressDiff !== 0) return progressDiff;
  const leftTime = new Date(left.updatedAt).getTime();
  const rightTime = new Date(right.updatedAt).getTime();
  const timeDiff = (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
  if (timeDiff !== 0) return timeDiff;
  return left.title.localeCompare(right.title);
}

function progressFromEvidence(evidence: RoadmapEvidence[]): number {
  if (evidence.length === 0) return 0;
  const totalWeight = evidence.reduce((total, item) => total + EVIDENCE_KIND_WEIGHT[item.kind], 0);
  const weighted = evidence.reduce((total, item) => total + (item.progress * EVIDENCE_KIND_WEIGHT[item.kind]), 0);
  return roundProgress(weighted / totalWeight);
}

function departmentById(id: DepartmentId): DepartmentDefinition {
  return VITALS_DEPARTMENTS.find((department) => department.id === id) ?? VITALS_DEPARTMENTS[0]!;
}

function evidenceForIssue(issue: Issue, projectsById: Map<string, Project>, goalsById: Map<string, Goal>): RoadmapEvidence | null {
  if (issue.hiddenAt || issue.status === "cancelled") return null;
  const project = issue.projectId ? projectsById.get(issue.projectId) ?? null : null;
  const goal = issue.goalId ? goalsById.get(issue.goalId) ?? null : null;
  const text = compactText(issue.identifier, issue.title, issue.description, project?.name, project?.description, goal?.title, goal?.description);
  const stage = bestStageForText(text);
  if (!stage) return null;
  return {
    id: issue.id,
    stageId: stage.id,
    kind: "task",
    title: issue.identifier ? `${issue.identifier} ${issue.title}` : issue.title,
    status: issue.status,
    progress: ISSUE_STATUS_PROGRESS[issue.status],
    href: issueUrl(issue),
    ownerAgentId: issue.assigneeAgentId,
    blocked: issue.status === "blocked" || (issue.blockedBy?.length ?? 0) > 0,
    highRisk: isHighRiskEvidence(text, stage),
    updatedAt: issue.updatedAt,
  };
}

function evidenceForProject(project: Project, goalsById: Map<string, Goal>): RoadmapEvidence | null {
  if (project.archivedAt || project.status === "cancelled") return null;
  const linkedGoals = project.goalIds.map((goalId) => goalsById.get(goalId)).filter(Boolean);
  const text = compactText(
    project.name,
    project.description,
    ...linkedGoals.flatMap((goal) => [goal?.title, goal?.description]),
  );
  const stage = bestStageForText(text);
  if (!stage) return null;
  return {
    id: project.id,
    stageId: stage.id,
    kind: "project",
    title: project.name,
    status: project.status,
    progress: PROJECT_STATUS_PROGRESS[project.status],
    href: projectUrl(project),
    ownerAgentId: project.leadAgentId,
    blocked: false,
    highRisk: isHighRiskEvidence(text, stage),
    updatedAt: project.updatedAt,
  };
}

function evidenceForGoal(goal: Goal): RoadmapEvidence | null {
  if (goal.status === "cancelled") return null;
  const text = compactText(goal.title, goal.description);
  const stage = bestStageForText(text);
  if (!stage) return null;
  return {
    id: goal.id,
    stageId: stage.id,
    kind: "goal",
    title: goal.title,
    status: goal.status,
    progress: GOAL_STATUS_PROGRESS[goal.status],
    href: `/goals/${goal.id}`,
    ownerAgentId: goal.ownerAgentId,
    blocked: false,
    highRisk: isHighRiskEvidence(text, stage),
    updatedAt: goal.updatedAt,
  };
}

export function buildRoadmapEvidence(input: {
  goals: Goal[];
  projects: Project[];
  issues: Issue[];
}): RoadmapEvidence[] {
  const projectsById = new Map(input.projects.map((project) => [project.id, project]));
  const goalsById = new Map(input.goals.map((goal) => [goal.id, goal]));
  return [
    ...input.issues.map((issue) => evidenceForIssue(issue, projectsById, goalsById)),
    ...input.projects.map((project) => evidenceForProject(project, goalsById)),
    ...input.goals.map((goal) => evidenceForGoal(goal)),
  ].filter((item): item is RoadmapEvidence => item !== null);
}

export function buildRoadmapStages(input: {
  agents: Agent[];
  goals: Goal[];
  projects: Project[];
  issues: Issue[];
}): RoadmapStageAssignment[] {
  const evidence = buildRoadmapEvidence(input);
  const formationAssignments = buildFormationAssignments(input.agents);
  const ownerByDepartment = new Map(
    formationAssignments.map((assignment) => [assignment.department.id, assignment.agent] as const),
  );
  let priorStagesComplete = true;

  return VITALS_ROADMAP_STAGES.map((stage) => {
    const stageEvidence = evidence.filter((item) => item.stageId === stage.id).sort(sortEvidence);
    const progress = progressFromEvidence(stageEvidence);
    const blockedEvidenceCount = stageEvidence.filter((item) => item.blocked && item.progress < 100).length;
    const highRiskOpenCount = stageEvidence.filter((item) => item.highRisk && item.progress < 100).length;
    const dependencyState: RoadmapDependencyState = progress >= 100
      ? "complete"
      : !priorStagesComplete
        ? "needs_earlier_steps_first"
        : blockedEvidenceCount > 0 || highRiskOpenCount > 0
          ? "needs_your_input"
          : "agent_can_do_this";
    const assignment: RoadmapStageAssignment = {
      stage,
      ownerDepartment: departmentById(stage.ownerDepartmentId),
      ownerAgent: ownerByDepartment.get(stage.ownerDepartmentId) ?? null,
      progress,
      dependencyState,
      isUnblocked: progress < 100 && priorStagesComplete,
      evidence: stageEvidence,
      taskCount: stageEvidence.filter((item) => item.kind === "task").length,
      projectCount: stageEvidence.filter((item) => item.kind === "project").length,
      goalCount: stageEvidence.filter((item) => item.kind === "goal").length,
      blockedEvidenceCount,
      highRiskOpenCount,
    };
    if (progress < 100) priorStagesComplete = false;
    return assignment;
  });
}

export function selectRoadmapConstraint(stages: RoadmapStageAssignment[]): RoadmapStageAssignment | null {
  const candidates = stages.filter((stage) => stage.isUnblocked);
  const pool = candidates.length > 0 ? candidates : stages.filter((stage) => stage.progress < 100);
  if (pool.length === 0) return stages[stages.length - 1] ?? null;
  return pool.reduce((current, stage) => {
    if (stage.progress < current.progress) return stage;
    if (stage.progress === current.progress && stage.stage.sequence < current.stage.sequence) return stage;
    return current;
  });
}

function RoadmapSkeleton() {
  return (
    <div className="space-y-5 motion-safe:animate-pulse" aria-label="Loading roadmap">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="grid grid-cols-2 gap-3 border-y border-border py-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-12" />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-8">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-40" />)}
        </div>
        <Skeleton className="h-80 lg:col-span-4" />
      </div>
    </div>
  );
}

function DependencyBadge({ state }: { state: RoadmapDependencyState }) {
  const Icon = state === "complete"
    ? CheckCircle2
    : state === "needs_your_input"
      ? ShieldAlert
      : state === "needs_earlier_steps_first"
        ? CircleDashed
        : ArrowRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        state === "complete" && "border-primary/30 bg-primary/5 text-primary",
        state === "needs_your_input" && "border-destructive/30 bg-destructive/5 text-destructive",
        state === "needs_earlier_steps_first" && "border-border bg-muted text-muted-foreground",
        state === "agent_can_do_this" && "border-border bg-background text-foreground",
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {DEPENDENCY_LABEL[state]}
    </span>
  );
}

function ProgressBar({ progress, isConstraint }: { progress: number; isConstraint: boolean }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
      <div
        className={cn("h-full rounded-full", isConstraint ? "bg-primary" : "bg-foreground/70")}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

function EvidenceStatus({ item }: { item: RoadmapEvidence }) {
  if (item.kind === "task") return <IssueStatusBadge status={item.status} />;
  return <StatusBadge status={item.status} />;
}

function EvidenceRow({ item, agentsById }: { item: RoadmapEvidence; agentsById: Map<string, Agent> }) {
  const owner = item.ownerAgentId ? agentsById.get(item.ownerAgentId) ?? null : null;
  return (
    <Link
      to={item.href}
      className="group flex min-w-0 flex-col gap-2 py-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center sm:justify-between"
    >
      <span className="min-w-0">
        <span className="block text-xs text-muted-foreground">
          {EVIDENCE_KIND_LABEL[item.kind]}{owner ? ` by ${owner.name}` : ""}
        </span>
        <span className="block truncate text-sm font-medium group-hover:underline">{item.title}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {item.highRisk && item.progress < 100 ? <ShieldAlert className="size-4 text-destructive" aria-label="Board input likely needed" /> : null}
        <EvidenceStatus item={item} />
      </span>
    </Link>
  );
}

function StageCard({
  assignment,
  agentsById,
  isConstraint,
}: {
  assignment: RoadmapStageAssignment;
  agentsById: Map<string, Agent>;
  isConstraint: boolean;
}) {
  const Icon = assignment.stage.icon;
  const visibleEvidence = assignment.evidence.slice(0, 4);
  const hiddenEvidenceCount = Math.max(0, assignment.evidence.length - visibleEvidence.length);

  return (
    <article
      aria-label={`Roadmap stage ${assignment.stage.sequence}: ${assignment.stage.title}`}
      className={cn(
        "rounded-lg border bg-card p-4 transition-(--tp-color-background-color-border-color-box-shadow-opacity)",
        isConstraint && "border-primary bg-primary/5 shadow-sm",
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono tabular-nums">{String(assignment.stage.sequence).padStart(2, "0")}</span>
            <span>{assignment.stage.flow}</span>
            {isConstraint ? <span className="text-primary">Critical path</span> : null}
          </div>
          <div className="flex items-center gap-2">
            <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <h2 className="truncate text-base font-semibold">{assignment.stage.title}</h2>
          </div>
          <p className="max-w-prose text-sm text-muted-foreground">{assignment.stage.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
          <span className="font-mono text-2xl font-semibold tabular-nums">{assignment.progress}%</span>
          <DependencyBadge state={assignment.dependencyState} />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <ProgressBar progress={assignment.progress} isConstraint={isConstraint} />
        <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-3">
          <div>
            <span className="block">Owner</span>
            <span className="mt-1 block truncate font-medium text-foreground">
              {assignment.ownerDepartment.name}{assignment.ownerAgent ? ` / ${assignment.ownerAgent.name}` : ""}
            </span>
          </div>
          <div>
            <span className="block">Evidence</span>
            <span className="mt-1 block font-mono text-foreground tabular-nums">
              {assignment.taskCount} task{assignment.taskCount === 1 ? "" : "s"} / {assignment.projectCount} project{assignment.projectCount === 1 ? "" : "s"} / {assignment.goalCount} goal{assignment.goalCount === 1 ? "" : "s"}
            </span>
          </div>
          <div>
            <span className="block">Open gates</span>
            <span className="mt-1 block font-mono text-foreground tabular-nums">
              {assignment.blockedEvidenceCount + assignment.highRiskOpenCount}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-border pt-2">
        {visibleEvidence.length > 0 ? (
          <div className="divide-y divide-border">
            {visibleEvidence.map((item) => <EvidenceRow key={`${item.kind}-${item.id}`} item={item} agentsById={agentsById} />)}
          </div>
        ) : (
          <p className="py-3 text-sm text-muted-foreground">No matching live goals, projects, or tasks yet.</p>
        )}
        {hiddenEvidenceCount > 0 ? (
          <p className="pt-2 text-xs text-muted-foreground">+ {formatNumber(hiddenEvidenceCount)} more evidence item{hiddenEvidenceCount === 1 ? "" : "s"}</p>
        ) : null}
      </div>
      <div className="sr-only">Progress {assignment.progress}%</div>
    </article>
  );
}

function Scoreboard({
  stages,
  constraint,
}: {
  stages: RoadmapStageAssignment[];
  constraint: RoadmapStageAssignment | null;
}) {
  const completed = stages.filter((stage) => stage.progress >= 100).length;
  const evidenceCount = stages.reduce((total, stage) => total + stage.evidence.length, 0);
  const average = stages.length === 0
    ? 0
    : roundProgress(stages.reduce((total, stage) => total + stage.progress, 0) / stages.length);
  const metrics = [
    { label: "Critical path", value: constraint?.stage.title ?? "None" },
    { label: "Roadmap complete", value: `${average}%` },
    { label: "Stages complete", value: `${completed} / ${stages.length}` },
    { label: "Evidence items", value: formatNumber(evidenceCount) },
  ];

  return (
    <dl className="grid grid-cols-2 border-y border-border lg:grid-cols-4">
      {metrics.map((metric) => (
        <div key={metric.label} className="py-3 pr-4 lg:border-r lg:border-border lg:px-4 lg:first:pl-0 lg:last:border-r-0">
          <dt className="text-xs text-muted-foreground">{metric.label}</dt>
          <dd className="mt-1 truncate font-mono text-base font-semibold tabular-nums">{metric.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function CriticalPathPanel({
  constraint,
  agentsById,
}: {
  constraint: RoadmapStageAssignment | null;
  agentsById: Map<string, Agent>;
}) {
  if (!constraint) {
    return (
      <aside className="space-y-3 lg:col-span-4 lg:border-l lg:border-border lg:pl-6">
        <p className="text-xs font-medium text-primary">Critical path</p>
        <h2 className="text-xl font-semibold">Roadmap ready</h2>
        <p className="text-sm text-muted-foreground">No stage evidence is available yet.</p>
      </aside>
    );
  }

  const nextEvidence = constraint.evidence.find((item) => item.progress < 100) ?? null;

  return (
    <aside className="space-y-5 lg:col-span-4 lg:border-l lg:border-border lg:pl-6" aria-labelledby="critical-path-title">
      <div className="space-y-1">
        <p className="text-xs font-medium text-primary">Critical path</p>
        <h2 id="critical-path-title" className="text-xl font-semibold">{constraint.stage.title}</h2>
        <p className="text-sm text-muted-foreground">
          This is the least-complete stage whose earlier dependencies are clear.
        </p>
      </div>

      <div className="border-y border-border py-4">
        <dl className="space-y-3 text-sm">
          <div className="flex items-start justify-between gap-4">
            <dt className="text-muted-foreground">Owner</dt>
            <dd className="text-right font-medium">{constraint.ownerDepartment.name}</dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-muted-foreground">Agent</dt>
            <dd className="text-right font-medium">{constraint.ownerAgent?.name ?? "Open position"}</dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-muted-foreground">Progress</dt>
            <dd className="font-mono text-right font-medium tabular-nums">{constraint.progress}%</dd>
          </div>
        </dl>
      </div>

      <div className="space-y-3">
        <DependencyBadge state={constraint.dependencyState} />
        <ProgressBar progress={constraint.progress} isConstraint />
      </div>

      {nextEvidence ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Next evidence</p>
          <EvidenceRow item={nextEvidence} agentsById={agentsById} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Create the first task or project for this stage to make the next move inspectable.</p>
      )}

      <Button asChild className="w-full">
        <Link to={nextEvidence?.href ?? "/issues"}>
          <ArrowRight aria-hidden="true" />
          {nextEvidence ? "Open next task" : "Open tasks"}
        </Link>
      </Button>

      {constraint.ownerAgent ? (
        <Button asChild variant="outline" className="w-full">
          <Link to={agentUrl(constraint.ownerAgent)}>
            <UsersRound aria-hidden="true" />
            Dispatch owner
          </Link>
        </Button>
      ) : (
        <Button asChild variant="outline" className="w-full">
          <Link to={`/agents/new?department=${constraint.ownerDepartment.id}`}>
            <UsersRound aria-hidden="true" />
            Staff owner
          </Link>
        </Button>
      )}
    </aside>
  );
}

export function Roadmap() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  const agentsQuery = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const goalsQuery = useQuery({
    queryKey: queryKeys.goals.list(selectedCompanyId!),
    queryFn: () => goalsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const projectsQuery = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const issuesQuery = useQuery({
    queryKey: [...queryKeys.issues.list(selectedCompanyId!), "roadmap", "blocked-by"] as const,
    queryFn: () => issuesApi.list(selectedCompanyId!, { includeBlockedBy: true }),
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Roadmap" }]);
  }, [setBreadcrumbs]);

  const activeAgents = useMemo(
    () => (agentsQuery.data ?? []).filter((agent) => agent.status !== "terminated"),
    [agentsQuery.data],
  );
  const stages = useMemo(
    () => buildRoadmapStages({
      agents: activeAgents,
      goals: goalsQuery.data ?? [],
      projects: projectsQuery.data ?? [],
      issues: issuesQuery.data ?? [],
    }),
    [activeAgents, goalsQuery.data, issuesQuery.data, projectsQuery.data],
  );
  const constraint = useMemo(() => selectRoadmapConstraint(stages), [stages]);
  const agentsById = useMemo(() => new Map(activeAgents.map((agent) => [agent.id, agent])), [activeAgents]);

  if (!selectedCompanyId) {
    return <EmptyState icon={MapIcon} title="No company selected" message="Select a company to view its roadmap." />;
  }

  if (agentsQuery.isLoading || goalsQuery.isLoading || projectsQuery.isLoading || issuesQuery.isLoading) {
    return <RoadmapSkeleton />;
  }

  if (agentsQuery.isError || goalsQuery.isError || projectsQuery.isError || issuesQuery.isError) {
    return (
      <div className="flex min-h-72 flex-col items-start justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-6">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="size-5" aria-hidden="true" />
          <h1 className="text-base font-semibold">Could not load the roadmap</h1>
        </div>
        <p className="max-w-prose text-sm text-muted-foreground">The live goals, projects, or tasks did not load. Retry without leaving this page.</p>
        <Button
          variant="outline"
          onClick={() => {
            void agentsQuery.refetch();
            void goalsQuery.refetch();
            void projectsQuery.refetch();
            void issuesQuery.refetch();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Company roadmap</h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            {selectedCompany?.name ?? "This company"} moves through eight stages. Progress is rounded from live goals, projects, and tasks.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/formation">
            <UsersRound aria-hidden="true" />
            Formation
          </Link>
        </Button>
      </header>

      <Scoreboard stages={stages} constraint={constraint} />

      <div className="grid gap-6 lg:grid-cols-12">
        <section className="space-y-3 lg:col-span-8" aria-labelledby="roadmap-stage-title">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 id="roadmap-stage-title" className="text-base font-semibold">Milestones</h2>
              <p className="text-xs text-muted-foreground">Idea, identity, build, sell, launch, run, and scale.</p>
            </div>
            <span className="text-xs text-muted-foreground">One highlighted constraint</span>
          </div>
          {stages.map((assignment) => (
            <StageCard
              key={assignment.stage.id}
              assignment={assignment}
              agentsById={agentsById}
              isConstraint={assignment.stage.id === constraint?.stage.id}
            />
          ))}
        </section>

        <CriticalPathPanel constraint={constraint} agentsById={agentsById} />
      </div>
    </div>
  );
}
