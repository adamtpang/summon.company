// Your turn: the fourth game screen, modelled on nebula's session grid. One
// card per department, one status dot, bands in the order the board acts on
// them: needs you, error, working, idle. See ui/src/lib/your-turn.ts.

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@/lib/router";
import { attentionApi } from "../api/attention";
import { agentsApi } from "../api/agents";
import { issuesApi } from "../api/issues";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { computeYourTurn, type TurnCard, type TurnState, type YourTurn as YourTurnModel } from "../lib/your-turn";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { Card } from "@/components/ui/card";
import { Hand } from "lucide-react";

const BANDS: { state: TurnState; label: string }[] = [
  { state: "needs_you", label: "Needs you" },
  { state: "error", label: "Stopped" },
  { state: "working", label: "Working" },
  { state: "idle", label: "Idle" },
];

// Semantic status tokens only; the dot is never the sole signal (the band label says it too).
const DOT: Record<TurnState, string> = {
  needs_you: "bg-primary",
  error: "bg-destructive",
  working: "bg-foreground",
  idle: "bg-muted-foreground/40",
};

function DepartmentCard({ card }: { card: TurnCard }) {
  const shown = card.items.slice(0, 3);
  return (
    <Card className="flex min-w-0 flex-col gap-2 p-4" data-testid="turn-card" data-state={card.state}>
      <div className="flex items-center gap-2">
        <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[card.state]}`} />
        <h3 className="min-w-0 truncate font-semibold tracking-tight">{card.name}</h3>
        {card.items.length > 0 ? (
          <span className="ml-auto text-sm tabular-nums text-muted-foreground">{card.items.length}</span>
        ) : null}
      </div>
      {card.focus ? (
        <Link to={card.focus.href} className="min-w-0 truncate text-sm text-muted-foreground hover:underline">
          <span className="font-mono text-xs">{card.focus.identifier}</span> {card.focus.title}
        </Link>
      ) : card.agentId ? (
        <p className="text-sm text-muted-foreground">No open quest</p>
      ) : null}
      {card.errorReason ? <p className="text-sm text-destructive">{card.errorReason}</p> : null}
      {shown.length > 0 ? (
        <ul className="space-y-1 border-t border-border pt-2 text-sm">
          {shown.map((item) => (
            <li key={item.key} className="min-w-0">
              {item.href ? (
                <Link to={item.href} className="block truncate hover:underline">
                  {item.kind === "blocked" ? "Unblock: " : "Decide: "}
                  {item.title}
                </Link>
              ) : (
                <span className="block truncate">{item.title}</span>
              )}
            </li>
          ))}
          {card.items.length > shown.length ? (
            <li className="text-muted-foreground">and {card.items.length - shown.length} more</li>
          ) : null}
        </ul>
      ) : null}
    </Card>
  );
}

export function YourTurnScreen({ turn }: { turn: YourTurnModel }) {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6" data-testid="your-turn-screen">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {turn.needsYouTotal === 0
            ? "Nothing needs you"
            : `${turn.needsYouTotal} thing${turn.needsYouTotal === 1 ? "" : "s"} need you`}
        </h1>
        <p className="text-sm text-muted-foreground">
          {turn.counts.working} working, {turn.counts.idle} idle, {turn.counts.error} stopped
        </p>
      </div>
      {BANDS.map(({ state, label }) => {
        const cards = turn.cards.filter((card) => card.state === state);
        if (cards.length === 0) return null;
        return (
          <section key={state} aria-label={label} className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">{label}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((card) => (
                <DepartmentCard key={card.agentId ?? "board"} card={card} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function YourTurn() {
  const { selectedCompanyId, selectedCompany, companies } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Your turn" }]);
  }, [setBreadcrumbs]);

  const enabled = !!selectedCompanyId;
  const { data: agents = [], isLoading: agentsLoading } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled,
    refetchInterval: 15_000,
  });
  const { data: issues = [], isLoading: issuesLoading } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled,
    refetchInterval: 15_000,
  });
  const { data: attention } = useQuery({
    queryKey: queryKeys.attention(selectedCompanyId!),
    queryFn: () => attentionApi.list(selectedCompanyId!),
    enabled,
    refetchInterval: 15_000,
  });

  const prefix = selectedCompany?.issuePrefix ?? "";
  const turn = useMemo(
    () => computeYourTurn({ companyPrefix: prefix, agents, issues, attention }),
    [prefix, agents, issues, attention],
  );

  if (!selectedCompanyId) {
    return <EmptyState icon={Hand} message={companies.length === 0 ? "Create your first company." : "Select a company."} />;
  }
  if (agentsLoading || issuesLoading) return <PageSkeleton variant="dashboard" />;
  return <YourTurnScreen turn={turn} />;
}
