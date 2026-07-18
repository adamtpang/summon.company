import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Hand, Moon, OctagonX, Play, Square } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { companiesApi } from "../api/companies";
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
export function FleetRunningNow() {
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const operatingMode = selectedCompany?.operatingMode;
  const [confirmingStopAll, setConfirmingStopAll] = useState(false);
  const [confirmingAlwaysOn, setConfirmingAlwaysOn] = useState(false);
  const [lastSweep, setLastSweep] = useState<string | null>(null);

  const setMode = useMutation({
    mutationFn: (mode: "manual" | "always_on") =>
      companiesApi.update(companyId!, { operatingMode: mode }),
    onSuccess: () => {
      setConfirmingAlwaysOn(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: FLEET_RUNNING_KEY,
    queryFn: () => fleetApi.running(),
    refetchInterval: 15_000,
  });

  const stopAll = useMutation({
    mutationFn: () => fleetApi.stop({ reason: "Board kill switch" }),
    onSuccess: (result) => {
      setConfirmingStopAll(false);
      setLastSweep(
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
    <Card data-testid="fleet-running-now" className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Play className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Running now</h2>
          <span className="text-xs text-muted-foreground">
            {isLoading
              ? "checking…"
              : quiet
                ? "fleet is quiet"
                : `${runs.length} live · ${queuedWakeups} queued`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* VIT-127: the operating-mode dial lives beside the kill switch —
              Manual (nothing executes unpointed) is the default; switching to
              24/7 is a spend decision, so it confirms. Back to Manual is the
              safe direction and never confirms. */}
          {companyId && operatingMode ? (
            confirmingAlwaysOn ? (
              <>
                <span className="text-xs text-muted-foreground">
                  Timers wake agents overnight; budget caps pause, never bill. Go 24/7?
                </span>
                <Button
                  size="sm"
                  className="h-7 px-2.5 text-xs"
                  disabled={setMode.isPending}
                  onClick={() => setMode.mutate("always_on")}
                >
                  {setMode.isPending ? "Switching…" : "Confirm 24/7"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  disabled={setMode.isPending}
                  onClick={() => setConfirmingAlwaysOn(false)}
                >
                  Stay manual
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-xs"
                disabled={setMode.isPending}
                onClick={() =>
                  operatingMode === "manual" ? setConfirmingAlwaysOn(true) : setMode.mutate("manual")
                }
              >
                {operatingMode === "manual" ? (
                  <>
                    <Hand className="h-3.5 w-3.5 mr-1" />
                    Manual mode
                  </>
                ) : (
                  <>
                    <Moon className="h-3.5 w-3.5 mr-1" />
                    24/7 mode
                  </>
                )}
              </Button>
            )
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

      {lastSweep && <p className="text-xs text-muted-foreground">{lastSweep}</p>}

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
