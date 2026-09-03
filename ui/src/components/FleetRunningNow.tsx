import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAgentStatusInvokable, type Agent } from "@paperclipai/shared";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { OctagonX, Play, Square, Sunrise } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { agentsApi } from "../api/agents";
import { fleetApi } from "../api/fleet";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";

const FLEET_RUNNING_KEY = ["fleet", "running"] as const;

function elapsedLabel(iso: string | null): string {
  if (!iso) return "queued";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/**
 * RUNNING NOW — the board kill switch surface (SUM-125 lineage).
 * Answers the thesis question directly ("which of my agents is doing something
 * right now") and makes stopping the whole fleet a two-interaction act:
 * Stop everything → confirm. Confirm is required because the sweep pauses
 * every agent and cancels the queued backlog — powerful, not irreversible
 * (agents unpause individually), but never one accidental click.
 */
export function FleetRunningNow({ agents, className }: { agents: Agent[]; className?: string }) {
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const cofounder = agents.find((agent) => agent.role === "ceo" && agent.status !== "terminated") ?? null;
  const canRunCompany = Boolean(companyId && cofounder && isAgentStatusInvokable(cofounder.status));
  const [confirmingStopAll, setConfirmingStopAll] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: FLEET_RUNNING_KEY,
    queryFn: () => fleetApi.running(),
    refetchInterval: 15_000,
  });

  const runCompany = useMutation({
    mutationFn: () =>
      agentsApi.invoke(cofounder!.id, companyId!, {
        source: "on_demand",
        triggerDetail: "manual",
        reason: "Board requested an immediate company review from Mission Control",
        payload: { intent: "run_company_now" },
      }),
    onSuccess: () => {
      setLastAction(`${cofounder?.name ?? "Your cofounder"} is reviewing the company now.`);
      queryClient.invalidateQueries({ queryKey: FLEET_RUNNING_KEY });
      if (companyId && cofounder) {
        queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(companyId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.liveRuns(companyId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.heartbeats(companyId, cofounder.id) });
      }
    },
    onError: () => setLastAction("Run did not start. Check the cofounder status and try again."),
  });

  const stopAll = useMutation({
    mutationFn: () => fleetApi.stop({ reason: "Board kill switch" }),
    onSuccess: (result) => {
      setConfirmingStopAll(false);
      setLastAction(
        `Stopped: ${result.runsCancelled} run${result.runsCancelled === 1 ? "" : "s"}, ` +
          `${result.wakeupsCancelled} queued wake${result.wakeupsCancelled === 1 ? "" : "s"}, ` +
          `${result.agentsPaused} agent${result.agentsPaused === 1 ? "" : "s"} paused.`,
      );
      queryClient.invalidateQueries({ queryKey: FLEET_RUNNING_KEY });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });

  const stopRun = useMutation({
    mutationFn: (runId: string) => fleetApi.cancelRun(runId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FLEET_RUNNING_KEY }),
  });

  const runs = data?.runs ?? [];
  const queuedWakeups = data?.queuedWakeups ?? 0;
  const quiet = runs.length === 0 && queuedWakeups === 0;

  return (
    <Card data-testid="fleet-running-now" className={cn("space-y-3 p-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Play className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Running now</h2>
            <span className="text-xs text-muted-foreground">
              {isLoading
                ? "checking…"
                : quiet
                  ? "company is quiet"
                  : `${runs.length} live · ${queuedWakeups} queued`}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Live agents and queued wakes across the company.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            size="sm"
            className="h-7 px-2.5 text-xs"
            disabled={!canRunCompany || runCompany.isPending}
            title={
              !cofounder
                ? "Add a CEO before running the company"
                : !isAgentStatusInvokable(cofounder.status)
                  ? `Resume ${cofounder.name} before running the company`
                  : undefined
            }
            onClick={() => runCompany.mutate()}
          >
            <Sunrise className="h-3.5 w-3.5 mr-1" />
            {runCompany.isPending ? "Starting…" : "Run company now"}
          </Button>
          {!cofounder ? (
            <Link className="text-xs text-muted-foreground underline-offset-2 hover:underline" to="/agents/new?role=ceo">
              Add CEO
            </Link>
          ) : !isAgentStatusInvokable(cofounder.status) ? (
            <Link className="text-xs text-muted-foreground underline-offset-2 hover:underline" to={`/agents/${cofounder.id}`}>
              Resume cofounder
            </Link>
          ) : null}
          {confirmingStopAll ? (
            <>
              <span className="text-xs text-muted-foreground">
                Pause every agent, cancel {runs.length} run{runs.length === 1 ? "" : "s"} + {queuedWakeups} queued?
              </span>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 px-2.5 text-xs"
                disabled={stopAll.isPending}
                onClick={() => stopAll.mutate()}
              >
                {stopAll.isPending ? "Stopping…" : "Confirm stop"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                disabled={stopAll.isPending}
                onClick={() => setConfirmingStopAll(false)}
              >
                Keep running
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-xs"
              onClick={() => setConfirmingStopAll(true)}
            >
              <OctagonX className="h-3.5 w-3.5 mr-1" />
              Stop everything
            </Button>
          )}
        </div>
      </div>

      {lastAction && <p role="status" className="text-xs text-muted-foreground">{lastAction}</p>}

      {runs.length > 0 && (
        <ul className="space-y-1.5">
          {runs.map((run) => (
            <li key={run.runId} className="flex items-center justify-between gap-3 text-sm">
              <div className="flex min-w-0 items-baseline gap-2">
                <span
                  className={cn(
                    "inline-flex h-2 w-2 shrink-0 rounded-full",
                    run.status === "running" ? "bg-(--status-agent-running)" : "bg-(--status-task-todo)",
                  )}
                  aria-hidden
                />
                <span className="font-medium truncate">{run.agentName}</span>
                <span className="text-xs text-muted-foreground truncate">
                  {run.companyName}
                  {run.issueIdentifier ? (
                    <>
                      {" · "}
                      {/* Cross-company link: runs may belong to a company other
                          than the selected one, so carry the run's own prefix. */}
                      <Link
                        className="underline-offset-2 hover:underline"
                        to={`/${run.issuePrefix}/issues/${run.issueIdentifier}`}
                      >
                        {run.issueIdentifier}
                      </Link>
                    </>
                  ) : null}
                  {" · "}
                  {run.status === "running" ? `running ${elapsedLabel(run.startedAt)}` : run.status.replace(/_/g, " ")}
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs shrink-0"
                disabled={stopRun.isPending}
                onClick={() => stopRun.mutate(run.runId)}
              >
                <Square className="h-3 w-3 mr-1" />
                Stop
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
