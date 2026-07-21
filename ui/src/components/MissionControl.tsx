import { useMemo } from "react";
import type { Agent, DashboardSummary, Goal, Issue, Project } from "@paperclipai/shared";
import type { MarketCapSnapshot } from "@paperclipai/shared/vitals-market-cap";
import { ArrowRight } from "lucide-react";
import { Link } from "@/lib/router";
import { Card } from "@/components/ui/card";
import { FleetRunningNow } from "./FleetRunningNow";
import { buildFormationAssignments } from "../pages/Formation";
import { buildRoadmapStages, selectRoadmapConstraint } from "../pages/Roadmap";
import { buildScoreboard, deriveProgress } from "../lib/scoreboard";
import { cn, formatCents } from "../lib/utils";

interface MissionControlProps {
  companyId: string;
  summary: DashboardSummary;
  agents: Agent[];
  issues: Issue[];
  projects: Project[];
  goals: Goal[];
  decisionCount: number;
  marketCapSnapshot: MarketCapSnapshot | null;
}

function workRank(issue: Issue): number {
  if (issue.executionRunId || issue.checkoutRunId || issue.executionLockedAt) return 0;
  if (issue.status === "in_review") return 1;
  if (issue.status === "blocked") return 2;
  if (issue.status === "in_progress") return 3;
  if (issue.status === "todo") return 4;
  return 5;
}

function pct(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

// Via-negativa pass (board, 2026-07-18; law 1 removals logged in the commit):
// the Roadmap 8-card grid, the "Honest fallback" caption, the header tagline,
// the eyebrow over the h1, per-section caption prose, heading + hero icons,
// the queue rank column, the "proxy score" sublabel, and the ×8 "No open task
// assigned" placeholders all failed the deletion test — none carried data or
// an affordance the remaining elements lack. The binding-constraint card IS
// the roadmap's dashboard presence; the full grid lives at /roadmap.
export function MissionControl({
  summary,
  agents,
  issues,
  projects,
  goals,
  decisionCount,
  marketCapSnapshot,
}: MissionControlProps) {
  const formation = useMemo(() => buildFormationAssignments(agents), [agents]);
  const roadmap = useMemo(
    () => buildRoadmapStages({ agents, issues, projects, goals }),
    [agents, goals, issues, projects],
  );
  const roadmapConstraint = useMemo(() => selectRoadmapConstraint(roadmap), [roadmap]);
  // Company lifespan at a glance (board, 2026-07-19): stage X of 8 + percent
  // through the whole roadmap — the mean of the eight stages' evidence-derived
  // progress. Same honest source as the constraint, never self-reported.
  const overallRoadmapProgress = useMemo(
    () => (roadmap.length ? Math.round(roadmap.reduce((sum, stage) => sum + stage.progress, 0) / roadmap.length) : 0),
    [roadmap],
  );
  const scoreboard = useMemo(() => buildScoreboard(issues), [issues]);
  const topWork = scoreboard.rows.slice(0, 7);

  const currentIssueByAgent = useMemo(() => {
    const map = new Map<string, Issue>();
    const eligible = issues
      .filter((issue) => issue.assigneeAgentId && issue.status !== "done" && issue.status !== "cancelled")
      .sort((a, b) => workRank(a) - workRank(b) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    for (const issue of eligible) {
      if (issue.assigneeAgentId && !map.has(issue.assigneeAgentId)) map.set(issue.assigneeAgentId, issue);
    }
    return map;
  }, [issues]);

  const runTotals = summary.runActivity.reduce(
    (total, day) => ({
      all: total.all + day.total,
      succeeded: total.succeeded + day.succeeded + day.recovered,
    }),
    { all: 0, succeeded: 0 },
  );
  const reliability = runTotals.all > 0 ? pct((runTotals.succeeded / runTotals.all) * 100) : 0;
  const enabledAgents = summary.agents.active + summary.agents.running + summary.agents.paused + summary.agents.error;
  const capacity = enabledAgents > 0 ? pct((summary.agents.running / enabledAgents) * 100) : 0;
  const demand = pct(summary.tasks.open * 10);
  const cash = summary.costs.monthBudgetCents > 0 ? pct(summary.costs.monthUtilizationPercent) : 0;

  return (
    <div data-testid="mission-control" className="space-y-8">
      <section aria-labelledby="mission-control-heading" className="space-y-4">
        <h1 id="mission-control-heading" className="text-2xl font-semibold tracking-tight">
          Mission Control
        </h1>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <HeroLink
            to="/marketcap"
            label="Market cap"
            value={marketCapSnapshot?.capProxyLabel ?? "Calculating…"}
            detail={marketCapSnapshot ? `ARR ${marketCapSnapshot.arrLabel} · stage ${marketCapSnapshot.stage.id}` : "Loading evidence"}
          />
          <HeroLink
            to="/issues"
            label="Execution"
            value={`${summary.agents.running} live`}
            detail={`${summary.tasks.inProgress} in progress · ${reliability}% run reliability`}
          />
          <HeroLink
            to="/usage"
            label="Month spend"
            value={formatCents(summary.costs.monthSpendCents)}
            detail={summary.costs.monthBudgetCents > 0 ? `${summary.costs.monthUtilizationPercent}% of budget` : "No budget ceiling"}
          />
          <HeroLink
            to="/decisions"
            label="Board decisions"
            value={String(decisionCount)}
            detail={decisionCount === 0 ? "Nothing waiting on the board" : "One-card deck ready"}
          />
        </div>

        {/* The kill switch lives on the glance surface: "which of my agents is
            doing something right now" is the thesis question, and stopping all
            of it must never be more than two interactions away. */}
        <FleetRunningNow />

        <div className="grid gap-3 lg:grid-cols-3">
          <Card className="block p-4 lg:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-(--tracking-eyebrow) text-muted-foreground">
                  One binding constraint
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {roadmapConstraint?.stage.title ?? "No open roadmap constraint"}
                </p>
                {roadmapConstraint ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Stage {roadmapConstraint.stage.sequence} of 8 · company {overallRoadmapProgress}% through the roadmap
                  </p>
                ) : null}
                <p className="mt-1 text-sm text-muted-foreground">
                  {roadmapConstraint
                    ? `${roadmapConstraint.ownerDepartment.name} owns the next stage at ${roadmapConstraint.progress}%.`
                    : "All roadmap stages are complete."}
                </p>
              </div>
              <Link to="/roadmap" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                Open critical path <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
            {roadmapConstraint ? (
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Binding constraint progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={roadmapConstraint.progress}>
                <div className="h-full rounded-full bg-primary" style={{ width: `${roadmapConstraint.progress}%` }} />
              </div>
            ) : null}
          </Card>

          <Card className="block p-4">
            <p className="text-xs font-medium uppercase tracking-(--tracking-eyebrow) text-muted-foreground">Pressure</p>
            <div className="mt-3 space-y-3">
              <Pressure label="Demand" value={demand} detail={`${summary.tasks.open} open tasks`} />
              <Pressure label="Capacity" value={capacity} detail={`${summary.agents.running}/${enabledAgents || 0} live`} />
              <Pressure label="Cash" value={cash} detail={summary.costs.monthBudgetCents > 0 ? `${summary.costs.monthUtilizationPercent}% used` : "uncapped"} />
            </div>
          </Card>
        </div>
      </section>

      {/* Board naming (2026-07-18): the user-facing word is "Org" everywhere;
          "Formation" stays as the internal doctrine/route name. */}
      <section aria-labelledby="formation-heading" className="space-y-3">
        <SectionHeading id="formation-heading" title="Org" to="/org" />
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {formation.map((assignment) => {
            const agent = assignment.agent;
            const current = agent ? currentIssueByAgent.get(agent.id) ?? null : null;
            // Status text renders only when it deviates from calm (running /
            // error / paused); a column of eight "idle"s is chrome, not signal.
            const loudStatus = agent && agent.status !== "idle" && agent.status !== "active" ? agent.status : null;
            // Open positions still route to /formation — the only surface with
            // a staffing flow; /org is a read-only chart.
            return (
              <Link key={assignment.department.id} to={agent ? `/agents/${agent.id}` : "/formation"} className="group rounded-lg border border-border bg-card p-3 hover:bg-accent/40">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-(--tracking-eyebrow) text-muted-foreground">{assignment.department.name}</span>
                  {loudStatus ? (
                    <span className={cn("text-xs capitalize", loudStatus === "running" ? "text-primary" : "text-muted-foreground")}>
                      {loudStatus}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 truncate text-sm font-semibold">{agent?.name ?? "Open position"}</p>
                {current ? (
                  <>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {current.identifier ?? current.id.slice(0, 8)} · {current.title}
                    </p>
                    <TaskProgress issue={current} className="mt-2" />
                  </>
                ) : !agent ? (
                  <p className="mt-1 truncate text-xs text-muted-foreground">Staff {assignment.department.name}</p>
                ) : null}
              </Link>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="queue-heading" className="space-y-3">
        <SectionHeading id="queue-heading" title="Task queue" to="/issues" />
        <Card className="block overflow-hidden py-0">
          {topWork.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No company work is queued.</p>
          ) : (
            topWork.map((row) => (
              <Link key={row.id} to={`/issues/${row.pathId}`} className="block border-b border-border px-3 py-3 last:border-b-0 hover:bg-accent/40">
                <span className="flex items-center gap-3">
                  {/* Tier letter (VIT-113): S is the Thiel band — bold + primary;
                      lower tiers stay quiet so S carries all the weight (law 4). */}
                  <span
                    className={cn(
                      "w-5 shrink-0 text-center text-sm font-semibold",
                      row.tier === "S" ? "text-primary" : "text-muted-foreground",
                    )}
                    aria-label={`Tier ${row.tier}`}
                  >
                    {row.tier}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{row.title}</span>
                    <span className="block text-xs text-muted-foreground">{row.identifier} · {row.progressLabel}</span>
                  </span>
                  <span
                    className="text-sm font-semibold tabular-nums"
                    style={{ color: `var(--score-${row.tier.toLowerCase()})` }}
                  >
                    {row.importanceStars + row.urgencyStars}/10
                  </span>
                </span>
                {/* Lifecycle progress (board ask 2026-07-18): the bar mirrors the
                    derived ladder (todo 0 → woken 10 → run 25 → review 90 → done
                    100) — control-plane evidence, never self-reported. A live run
                    pulses so "running right now" reads at a glance. */}
                <span
                  className="mt-2 block h-1 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-label={`${row.identifier} progress`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={row.progress}
                >
                  <span
                    className={cn(
                      "block h-full rounded-full bg-primary/80",
                      row.progressLabel === "Run started" && "animate-pulse",
                    )}
                    style={{ width: `${Math.max(row.progress, 2)}%` }}
                  />
                </span>
              </Link>
            ))
          )}
        </Card>
      </section>
    </div>
  );
}

function HeroLink({ to, label, value, detail }: { to: string; label: string; value: string; detail: string }) {
  return (
    <Link to={to} className="rounded-lg border border-border bg-card p-4 hover:bg-accent/40">
      <p className="text-xs font-medium uppercase tracking-(--tracking-eyebrow) text-muted-foreground">{label}</p>
      <p className="mt-3 truncate text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
    </Link>
  );
}

/** Lifecycle bar for a department card's current task — same derived ladder as
    the queue rows; pulses while a run is live. */
function TaskProgress({ issue, className }: { issue: Issue; className?: string }) {
  const { progress, label } = deriveProgress(issue);
  return (
    <span
      className={cn("block h-1 overflow-hidden rounded-full bg-muted", className)}
      role="progressbar"
      aria-label={`${issue.identifier ?? issue.id.slice(0, 8)} progress`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
    >
      <span
        className={cn("block h-full rounded-full bg-primary/80", label === "Run started" && "animate-pulse")}
        style={{ width: `${Math.max(progress, 2)}%` }}
      />
    </span>
  );
}

function Pressure({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{detail}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${label} pressure`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
        <div className="h-full rounded-full bg-foreground/70" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function SectionHeading({ id, title, to }: { id: string; title: string; to: string }) {
  return (
    <div className="flex items-end justify-between gap-2">
      <h2 id={id} className="text-base font-semibold">{title}</h2>
      <Link to={to} className="text-xs font-medium text-primary hover:underline">Open</Link>
    </div>
  );
}
