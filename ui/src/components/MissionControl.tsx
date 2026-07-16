import { useMemo } from "react";
import type { Agent, DashboardSummary, Goal, Issue, Project } from "@paperclipai/shared";
import type { MarketCapSnapshot } from "@paperclipai/shared/vitals-market-cap";
import {
  Activity,
  ArrowRight,
  CircleDollarSign,
  Gauge,
  ListChecks,
  Network,
  Route,
  UsersRound,
} from "lucide-react";
import { Link } from "@/lib/router";
import { Card } from "@/components/ui/card";
import { buildFormationAssignments } from "../pages/Formation";
import { buildRoadmapStages, selectRoadmapConstraint } from "../pages/Roadmap";
import { buildScoreboard } from "../lib/scoreboard";
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
    <div data-testid="mission-control" className="space-y-6">
      <section aria-labelledby="mission-control-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-(--tracking-eyebrow) text-muted-foreground">
              Company state
            </p>
            <h1 id="mission-control-heading" className="text-2xl font-semibold tracking-tight">
              Mission Control
            </h1>
          </div>
          <p className="text-xs text-muted-foreground">Control-plane evidence, not self-reporting</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <HeroLink
            to="/marketcap"
            icon={CircleDollarSign}
            label="Market cap"
            value={marketCapSnapshot?.capProxyLabel ?? "Calculating…"}
            detail={marketCapSnapshot ? `ARR ${marketCapSnapshot.arrLabel} · stage ${marketCapSnapshot.stage.id}` : "Loading evidence"}
          />
          <HeroLink
            to="/issues"
            icon={Activity}
            label="Execution"
            value={`${summary.agents.running} live`}
            detail={`${summary.tasks.inProgress} in progress · ${reliability}% run reliability`}
          />
          <HeroLink
            to="/usage"
            icon={Gauge}
            label="Month spend"
            value={formatCents(summary.costs.monthSpendCents)}
            detail={summary.costs.monthBudgetCents > 0 ? `${summary.costs.monthUtilizationPercent}% of budget` : "No company budget ceiling"}
          />
          <HeroLink
            to="/decisions"
            icon={ListChecks}
            label="Board decisions"
            value={String(decisionCount)}
            detail={decisionCount === 0 ? "Nothing waiting on the board" : "One-card deck ready"}
          />
        </div>

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

      <section aria-labelledby="formation-heading" className="space-y-3">
        <SectionHeading id="formation-heading" icon={UsersRound} title="Formation" detail="Eight departments, one accountable employee each" to="/formation" />
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {formation.map((assignment) => {
            const agent = assignment.agent;
            const current = agent ? currentIssueByAgent.get(agent.id) ?? null : null;
            return (
              <Link key={assignment.department.id} to={agent ? `/agents/${agent.id}` : "/formation"} className="group rounded-lg border border-border bg-card p-3 hover:bg-accent/40">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-(--tracking-eyebrow) text-muted-foreground">{assignment.department.name}</span>
                  <span className={cn("text-xs capitalize", agent?.status === "running" ? "text-primary" : "text-muted-foreground")}>
                    {agent?.status ?? "open"}
                  </span>
                </div>
                <p className="mt-2 truncate text-sm font-semibold">{agent?.name ?? "Open position"}</p>
                <p className="mt-1 line-clamp-2 min-h-10 text-xs text-muted-foreground">
                  {current ? `${current.identifier ?? current.id.slice(0, 8)} · ${current.title}` : agent ? "No open task assigned" : `Staff ${assignment.department.name}`}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="roadmap-heading" className="space-y-3">
        <SectionHeading id="roadmap-heading" icon={Route} title="Roadmap" detail="Eight stages, constraint outlined" to="/roadmap" />
        <div className="grid gap-2 lg:grid-cols-2">
          {roadmap.map((assignment) => {
            const isConstraint = assignment.stage.id === roadmapConstraint?.stage.id;
            return (
              <Link key={assignment.stage.id} to="/roadmap" className={cn("rounded-lg border bg-card p-3", isConstraint ? "border-primary" : "border-border")}>
                <div className="flex items-center gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border text-xs font-semibold tabular-nums">{assignment.stage.sequence}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{assignment.stage.title}</span>
                      <span className={cn("text-xs tabular-nums", isConstraint ? "font-semibold text-primary" : "text-muted-foreground")}>{assignment.progress}%{isConstraint ? " · constraint" : ""}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${assignment.stage.title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={assignment.progress}>
                      <div className={cn("h-full rounded-full", isConstraint ? "bg-primary" : "bg-foreground/60")} style={{ width: `${assignment.progress}%` }} />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="queue-heading" className="space-y-3">
        <SectionHeading id="queue-heading" icon={Network} title="Task queue" detail="Top seven by logged importance + urgency proxy" to="/issues" />
        <Card className="block overflow-hidden py-0">
          {topWork.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No company work is queued.</p>
          ) : (
            topWork.map((row, index) => (
              <Link key={row.id} to={`/issues/${row.pathId}`} className="flex items-center gap-3 border-b border-border px-3 py-3 last:border-b-0 hover:bg-accent/40">
                <span className="w-5 text-center text-xs font-medium tabular-nums text-muted-foreground">{index + 1}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{row.title}</span>
                  <span className="block text-xs text-muted-foreground">{row.identifier} · {row.progressLabel}</span>
                </span>
                <span className="text-right">
                  <span className="block text-sm font-semibold tabular-nums">{row.importanceStars + row.urgencyStars}/10</span>
                  <span className="block text-xs text-muted-foreground">proxy score</span>
                </span>
              </Link>
            ))
          )}
        </Card>
        <p className="text-xs text-muted-foreground">
          Honest fallback: this is the logged two-factor proxy until money, time, effort, and human-attention inputs are persisted for the full Summon Score.
        </p>
      </section>
    </div>
  );
}

function HeroLink({ to, icon: Icon, label, value, detail }: { to: string; icon: typeof Activity; label: string; value: string; detail: string }) {
  return (
    <Link to={to} className="rounded-lg border border-border bg-card p-4 hover:bg-accent/40">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-(--tracking-eyebrow) text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
        {label}
      </div>
      <p className="mt-3 truncate text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
    </Link>
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

function SectionHeading({ id, icon: Icon, title, detail, to }: { id: string; icon: typeof Activity; title: string; detail: string; to: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 id={id} className="flex items-center gap-2 text-base font-semibold"><Icon className="size-4 text-muted-foreground" aria-hidden="true" />{title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
      </div>
      <Link to={to} className="text-xs font-medium text-primary hover:underline">Open</Link>
    </div>
  );
}
