// The Company screen: the first of four game screens (Company, Party, Quests,
// Your turn). One glance answers: what level is the company, what is the boss,
// what changed today, and what needs the board. Every number is evidence from
// the control plane; see ui/src/lib/company-game.ts.

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@/lib/router";
import { attentionApi } from "../api/attention";
import { agentsApi } from "../api/agents";
import { goalsApi } from "../api/goals";
import { issuesApi } from "../api/issues";
import { projectsApi } from "../api/projects";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { attentionBadgeCount } from "../lib/attention";
import { computeCompanyGame, type CompanyGame } from "../lib/company-game";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { Card } from "@/components/ui/card";
import { LayoutDashboard } from "lucide-react";
import { useMarketCapSnapshot } from "./MarketCap";
import { buildRoadmapStages, selectRoadmapConstraint } from "./Roadmap";

function Bar({ value, label }: { value: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
    >
      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function CompanyScreen({ game, companyName, prefix }: { game: CompanyGame; companyName: string; prefix: string }) {
  const turnCount = game.yourTurn.decisions + game.yourTurn.blocked + game.yourTurn.unassigned;
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6" data-testid="company-screen">
      <Card className="space-y-3 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{companyName}</p>
            <h1 className="truncate text-xl font-semibold tracking-tight">
              Level {game.level} of {game.totalLevels}
            </h1>
          </div>
          <span className="text-sm tabular-nums text-muted-foreground">{game.progress}% of the roadmap</span>
        </div>
        <Bar value={game.progress} label="Roadmap progress" />
      </Card>

      <Card className="space-y-2 p-5">
        <p className="text-xs text-muted-foreground">Current boss</p>
        {game.boss ? (
          <>
            <h2 className="text-lg font-semibold tracking-tight">
              Stage {game.boss.stageSequence}: {game.boss.stageTitle}
            </h2>
            <p className="text-sm text-muted-foreground">
              {game.boss.ownerName} leads it. {game.boss.openQuests} open, {game.boss.blockedQuests} blocked.
            </p>
            <Bar value={game.boss.progress} label={`Stage ${game.boss.stageSequence} progress`} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No stage is unblocked yet.</p>
        )}
        <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
          <span className="text-muted-foreground">Gold, real Stripe revenue only</span>
          <span className={game.gold.verified ? "font-semibold tabular-nums" : "tabular-nums text-muted-foreground"}>
            {game.gold.label}
          </span>
        </div>
      </Card>

      <Card className="space-y-2 p-5">
        <div className="flex items-baseline justify-between">
          <p className="text-xs text-muted-foreground">Today</p>
          <p className="text-xs tabular-nums text-muted-foreground">
            {game.today.partyRunning} working, {game.today.partyErrored} in error
          </p>
        </div>
        <h2 className="text-lg font-semibold tracking-tight">
          {game.today.completedCount === 0
            ? "No quests completed yet today"
            : `${game.today.completedCount} quest${game.today.completedCount === 1 ? "" : "s"} completed`}
        </h2>
        {game.today.completed.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {game.today.completed.map((quest) => (
              <li key={quest.id} className="flex gap-2">
                <span className="shrink-0 font-mono text-xs text-muted-foreground">{quest.identifier}</span>
                <Link to={quest.href} className="min-w-0 truncate hover:underline">
                  {quest.title}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card className="space-y-2 p-5">
        <p className="text-xs text-muted-foreground">Your turn</p>
        <h2 className="text-lg font-semibold tracking-tight">
          {turnCount === 0 ? "Nothing needs you" : `${turnCount} thing${turnCount === 1 ? "" : "s"} need you`}
        </h2>
        <ul className="grid grid-cols-3 gap-2 text-sm">
          <li>
            <Link to={`/${prefix}/inbox`} className="block rounded-md border border-border p-3 hover:bg-muted">
              <span className="block text-lg font-semibold tabular-nums">{game.yourTurn.decisions}</span>
              <span className="text-muted-foreground">decisions</span>
            </Link>
          </li>
          <li>
            <Link to={`/${prefix}/issues?status=blocked`} className="block rounded-md border border-border p-3 hover:bg-muted">
              <span className="block text-lg font-semibold tabular-nums">{game.yourTurn.blocked}</span>
              <span className="text-muted-foreground">blocked</span>
            </Link>
          </li>
          <li>
            <Link to={`/${prefix}/issues?assignee=none`} className="block rounded-md border border-border p-3 hover:bg-muted">
              <span className="block text-lg font-semibold tabular-nums">{game.yourTurn.unassigned}</span>
              <span className="text-muted-foreground">unclaimed</span>
            </Link>
          </li>
        </ul>
      </Card>
    </div>
  );
}

export function Company() {
  const { selectedCompanyId, selectedCompany, companies } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Company" }]);
  }, [setBreadcrumbs]);

  const enabled = !!selectedCompanyId;
  const { data: agents = [], isLoading: agentsLoading } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled,
  });
  const { data: issues = [], isLoading: issuesLoading } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled,
  });
  const { data: projects = [] } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled,
  });
  const { data: goals = [] } = useQuery({
    queryKey: queryKeys.goals.list(selectedCompanyId!),
    queryFn: () => goalsApi.list(selectedCompanyId!),
    enabled,
  });
  const { data: attention } = useQuery({
    queryKey: queryKeys.attention(selectedCompanyId!),
    queryFn: () => attentionApi.list(selectedCompanyId!),
    enabled,
  });
  const { snapshot } = useMarketCapSnapshot(selectedCompanyId);

  const stages = useMemo(
    () => buildRoadmapStages({ agents, issues, projects, goals }),
    [agents, issues, projects, goals],
  );
  const constraint = useMemo(() => selectRoadmapConstraint(stages), [stages]);
  const prefix = selectedCompany?.issuePrefix ?? "";
  const game = useMemo(
    () =>
      computeCompanyGame({
        companyPrefix: prefix,
        agents,
        issues,
        stages,
        constraint,
        snapshot,
        decisions: attentionBadgeCount(attention),
      }),
    [prefix, agents, issues, stages, constraint, snapshot, attention],
  );

  if (!selectedCompanyId) {
    return (
      <EmptyState
        icon={LayoutDashboard}
        message={companies.length === 0 ? "Create your first company to start playing." : "Select a company."}
      />
    );
  }
  if (agentsLoading || issuesLoading) return <PageSkeleton variant="dashboard" />;

  return <CompanyScreen game={game} companyName={selectedCompany?.name ?? "Company"} prefix={prefix} />;
}
