import { useMemo } from "react";
import type { Agent, Issue } from "@paperclipai/shared";
import { Star } from "lucide-react";
import { Link } from "@/lib/router";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AgentIcon } from "./AgentIconPicker";
import { createIssueDetailPath } from "../lib/issueDetailBreadcrumb";
import { buildScoreboard, type ScoreboardRow } from "../lib/scoreboard";
import { cn } from "../lib/utils";

/**
 * VIT-70 — Board scoreboard docked beside the Conference Room chat.
 *
 * Renders the board-approved wireframe: a progress header (N tasks / agents
 * live / done + overall bar) above a sortable priorities table (Task,
 * Importance stars, Urgency stars, Agent, Progress with a state label).
 * Review-needed rows are highlighted and float to the top. Clicking a row opens
 * that task's thread — the table is the map, the thread is the territory.
 *
 * Every value shown is derived in {@link buildScoreboard} from real issue
 * fields; nothing here is self-reported.
 */

function agentInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "A";
}

/** Five stars, filled up to `value` (0-5). Monochrome to match the shell. */
function StarRating({ value, label }: { value: number; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={`${label}: ${value} of 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            "h-3 w-3",
            n <= value
              ? "fill-current text-foreground"
              : "text-muted-foreground/30",
          )}
          aria-hidden
        />
      ))}
    </span>
  );
}

function ProgressCell({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs leading-none text-muted-foreground">{label}</span>
    </div>
  );
}

function AgentCell({ agent }: { agent: Agent | null }) {
  if (!agent) {
    return <span className="text-xs text-muted-foreground">·</span>;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Avatar size="sm" className="shrink-0">
          <AvatarFallback>
            {agent.icon ? (
              <AgentIcon icon={agent.icon} className="h-3.5 w-3.5" />
            ) : (
              agentInitials(agent.name)
            )}
          </AvatarFallback>
        </Avatar>
      </TooltipTrigger>
      <TooltipContent side="left">{agent.name}</TooltipContent>
    </Tooltip>
  );
}

function ScoreboardTableRow({
  row,
  agent,
}: {
  row: ScoreboardRow;
  agent: Agent | null;
}) {
  return (
    <Link
      to={createIssueDetailPath(row.pathId)}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5",
        "border-b border-border transition-colors hover:bg-accent/60",
        row.reviewNeeded && "bg-accent/40",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {row.reviewNeeded && (
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
            aria-label="needs review"
          />
        )}
        <div className="min-w-0">
          <div className="truncate text-sm text-foreground">{row.title}</div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {row.identifier}
          </div>
        </div>
      </div>
      <div className="flex w-20 shrink-0 justify-center">
        <StarRating value={row.importanceStars} label="Importance" />
      </div>
      <div className="flex w-20 shrink-0 justify-center">
        <StarRating value={row.urgencyStars} label="Urgency" />
      </div>
      <div className="flex w-10 shrink-0 justify-center">
        <AgentCell agent={agent} />
      </div>
      <div className="w-36 shrink-0">
        <ProgressCell value={row.progress} label={row.progressLabel} />
      </div>
    </Link>
  );
}

export function PrioritiesPanel({
  issues,
  agents,
}: {
  issues: Issue[] | undefined;
  agents: Agent[] | undefined;
}) {
  const board = useMemo(() => buildScoreboard(issues ?? []), [issues]);
  const agentMap = useMemo(
    () => new Map((agents ?? []).map((a) => [a.id, a] as const)),
    [agents],
  );

  const { summary, rows } = board;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Progress header — N tasks / agents live / done + overall bar */}
      <div className="relative shrink-0 px-4 py-3">
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-border"
          aria-hidden
        />
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">Priorities</h3>
          <span className="text-xs text-muted-foreground">
            {summary.taskCount} {summary.taskCount === 1 ? "task" : "tasks"}
            {" · "}
            {summary.agentsLive} live
            {" · "}
            {summary.doneCount} done
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Overall completion"
            aria-valuenow={summary.overallProgress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${summary.overallProgress}%` }}
            />
          </div>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {summary.overallProgress}%
          </span>
        </div>
      </div>

      {/* Column header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span className="flex-1">Task</span>
        <span className="w-20 shrink-0 text-center">Importance</span>
        <span className="w-20 shrink-0 text-center">Urgency</span>
        <span className="w-10 shrink-0 text-center">Agent</span>
        <span className="w-36 shrink-0">Progress</span>
      </div>

      {/* Rows */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            No tasks yet. Ask your team in the chat to get the board moving.
          </div>
        ) : (
          rows.map((row) => (
            <ScoreboardTableRow
              key={row.id}
              row={row}
              agent={row.assigneeAgentId ? agentMap.get(row.assigneeAgentId) ?? null : null}
            />
          ))
        )}
      </div>
    </div>
  );
}
