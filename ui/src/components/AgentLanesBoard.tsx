import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "@/lib/router";
import type { Issue } from "@paperclipai/shared";

interface Agent {
  id: string;
  name: string;
}
import { StatusIcon } from "./StatusIcon";
import { PriorityIcon } from "./PriorityIcon";
import { Identity } from "./Identity";
import { IssueAgeChip } from "./IssueAgeChip";
import { deriveIssueAge } from "../lib/issue-age";
import { createIssueDetailPath, rememberIssueDetailLocationState, withIssueDetailHeaderSeed } from "../lib/issueDetailBreadcrumb";
import { cn } from "../lib/utils";

/**
 * Parallel lanes — the board's default work view (ELON-OPERATING-MODEL §3.2).
 * One lane per agent, everything gestating simultaneously; true dependencies
 * are drawn as explicit edges so serialization is visible (and killable).
 * Terminal work (done / cancelled) is excluded: this is the work in flight.
 */

interface AgentLanesBoardProps {
  issues: Issue[];
  agents?: Agent[];
  liveIssueIds?: Set<string>;
  issueLinkState?: unknown;
}

interface Lane {
  key: string;
  name: string;
  kind: "agent" | "user" | "unassigned";
  issues: Issue[];
}

const TERMINAL_STATUSES = new Set(["done", "cancelled"]);
const STATUS_LANE_ORDER: Record<string, number> = {
  in_progress: 0,
  in_review: 1,
  blocked: 2,
  todo: 3,
  backlog: 4,
};

export function buildAgentLanes(issues: Issue[], agents: Agent[] | undefined): Lane[] {
  const open = issues.filter((issue) => !TERMINAL_STATUSES.has(issue.status));
  const byAgent = new Map<string, Issue[]>();
  const byUser = new Map<string, Issue[]>();
  const unassigned: Issue[] = [];

  for (const issue of open) {
    if (issue.assigneeAgentId) {
      const list = byAgent.get(issue.assigneeAgentId) ?? [];
      list.push(issue);
      byAgent.set(issue.assigneeAgentId, list);
    } else if (issue.assigneeUserId) {
      const list = byUser.get(issue.assigneeUserId) ?? [];
      list.push(issue);
      byUser.set(issue.assigneeUserId, list);
    } else {
      unassigned.push(issue);
    }
  }

  const sortLane = (items: Issue[]) =>
    [...items].sort((a, b) => {
      const orderDelta = (STATUS_LANE_ORDER[a.status] ?? 9) - (STATUS_LANE_ORDER[b.status] ?? 9);
      if (orderDelta !== 0) return orderDelta;
      const ageA = deriveIssueAge(a)?.ageMs ?? 0;
      const ageB = deriveIssueAge(b)?.ageMs ?? 0;
      return ageB - ageA;
    });

  const lanes: Lane[] = [];

  // Every agent gets a lane, including idle agents — an empty lane is
  // information (nothing gestating there).
  for (const agent of agents ?? []) {
    lanes.push({
      key: `agent:${agent.id}`,
      name: agent.name,
      kind: "agent",
      issues: sortLane(byAgent.get(agent.id) ?? []),
    });
    byAgent.delete(agent.id);
  }
  // Assignees not present in the agents list (e.g. filtered list) still lane.
  for (const [agentId, laneIssues] of byAgent) {
    lanes.push({ key: `agent:${agentId}`, name: agentId.slice(0, 8), kind: "agent", issues: sortLane(laneIssues) });
  }
  for (const [userId, laneIssues] of byUser) {
    lanes.push({ key: `user:${userId}`, name: "You (board)", kind: "user", issues: sortLane(laneIssues) });
  }

  lanes.sort((a, b) => b.issues.length - a.issues.length);

  if (unassigned.length > 0) {
    lanes.push({ key: "unassigned", name: "Unassigned", kind: "unassigned", issues: sortLane(unassigned) });
  }

  return lanes;
}

interface DependencyEdge {
  fromId: string;
  toId: string;
  /** Blocker still open — active serialization. */
  active: boolean;
  label: string;
}

export function collectDependencyEdges(lanes: Lane[]): DependencyEdge[] {
  const visible = new Map<string, Issue>();
  for (const lane of lanes) {
    for (const issue of lane.issues) visible.set(issue.id, issue);
  }
  const edges: DependencyEdge[] = [];
  for (const issue of visible.values()) {
    for (const blocker of issue.blockedBy ?? []) {
      if (!visible.has(blocker.id)) continue;
      edges.push({
        fromId: blocker.id,
        toId: issue.id,
        active: !TERMINAL_STATUSES.has(blocker.status),
        label: `${blocker.identifier ?? blocker.id.slice(0, 8)} blocks ${issue.identifier ?? issue.id.slice(0, 8)} - serialization; kill it if the dependency isn't real`,
      });
    }
  }
  return edges;
}

interface EdgePath {
  d: string;
  active: boolean;
  label: string;
  key: string;
}

export function AgentLanesBoard({ issues, agents, liveIssueIds, issueLinkState }: AgentLanesBoardProps) {
  const lanes = useMemo(() => buildAgentLanes(issues, agents), [issues, agents]);
  const edges = useMemo(() => collectDependencyEdges(lanes), [lanes]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chipRefs = useRef(new Map<string, HTMLElement>());
  const [edgePaths, setEdgePaths] = useState<EdgePath[]>([]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const compute = () => {
      const containerRect = container.getBoundingClientRect();
      const next: EdgePath[] = [];
      for (const edge of edges) {
        const fromEl = chipRefs.current.get(edge.fromId);
        const toEl = chipRefs.current.get(edge.toId);
        if (!fromEl || !toEl) continue;
        const from = fromEl.getBoundingClientRect();
        const to = toEl.getBoundingClientRect();
        const x1 = from.left + from.width / 2 - containerRect.left;
        const y1 = from.bottom - containerRect.top;
        const x2 = to.left + to.width / 2 - containerRect.left;
        const y2 = to.top - containerRect.top;
        const bend = Math.max(16, Math.abs(y2 - y1) / 2);
        next.push({
          key: `${edge.fromId}->${edge.toId}`,
          d: `M ${x1} ${y1} C ${x1} ${y1 + bend}, ${x2} ${y2 - bend}, ${x2} ${y2}`,
          active: edge.active,
          label: edge.label,
        });
      }
      setEdgePaths(next);
    };

    compute();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(compute) : null;
    observer?.observe(container);
    window.addEventListener("resize", compute);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [edges, lanes]);

  const activeEdgeCount = edges.filter((edge) => edge.active).length;

  return (
    <div className="space-y-2" data-testid="agent-lanes-board">
      {edges.length > 0 ? (
        <p className="text-xs text-muted-foreground" data-testid="agent-lanes-serialization-note">
          {activeEdgeCount} active {activeEdgeCount === 1 ? "dependency" : "dependencies"} drawn below, serialization must justify itself.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground" data-testid="agent-lanes-serialization-note">
          No dependencies between open tasks, everything gestates in parallel.
        </p>
      )}
      <div ref={containerRef} className="relative rounded-lg border border-border">
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden={edgePaths.length === 0}
          data-testid="agent-lanes-edges"
        >
          {edgePaths.map((path) => (
            <path
              key={path.key}
              d={path.d}
              fill="none"
              strokeWidth={1.5}
              strokeDasharray={path.active ? undefined : "4 3"}
              className={path.active ? "stroke-red-500/70" : "stroke-muted-foreground/40"}
              style={{ pointerEvents: "stroke" }}
            >
              <title>{path.label}</title>
            </path>
          ))}
        </svg>
        <ol className="divide-y divide-border">
          {lanes.map((lane) => (
            <li key={lane.key} className="flex items-start gap-3 px-3 py-2" data-testid={`agent-lane-${lane.key}`}>
              <div className="flex w-36 shrink-0 flex-col gap-0.5 pt-1 sm:w-44">
                {lane.kind === "unassigned" ? (
                  <span className="text-sm font-medium text-amber-700 dark:text-amber-300">Unassigned</span>
                ) : (
                  <Identity name={lane.name} size="xs" />
                )}
                <span className="font-mono text-(length:--text-nano) tabular-nums text-muted-foreground">
                  {lane.issues.length === 0 ? "idle" : `${lane.issues.length} gestating`}
                </span>
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                {lane.issues.length === 0 ? (
                  <span className="py-1 text-xs text-muted-foreground/60">No open work, this lane is free.</span>
                ) : (
                  lane.issues.map((issue) => (
                    <LaneChip
                      key={issue.id}
                      issue={issue}
                      live={liveIssueIds?.has(issue.id) ?? false}
                      issueLinkState={issueLinkState}
                      registerRef={(el) => {
                        if (el) chipRefs.current.set(issue.id, el);
                        else chipRefs.current.delete(issue.id);
                      }}
                    />
                  ))
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function LaneChip({
  issue,
  live,
  issueLinkState,
  registerRef,
}: {
  issue: Issue;
  live: boolean;
  issueLinkState?: unknown;
  registerRef: (el: HTMLElement | null) => void;
}) {
  const issuePathId = issue.identifier ?? issue.id;
  const detailState = withIssueDetailHeaderSeed(issueLinkState, issue);
  return (
    <Link
      to={createIssueDetailPath(issuePathId)}
      state={detailState}
      disableIssueQuicklook
      issuePrefetch={issue}
      onClickCapture={() => rememberIssueDetailLocationState(issuePathId, detailState)}
      ref={registerRef as never}
      data-testid={`lane-chip-${issue.id}`}
      className={cn(
        "inline-flex max-w-64 items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs no-underline text-inherit",
        "hover:border-foreground/20 hover:shadow-sm",
      )}
    >
      <StatusIcon status={issue.status} blockerAttention={issue.blockerAttention} size="sm" />
      {live ? (
        <span className="relative flex h-2 w-2 shrink-0" title="Running now" aria-label="Running now">
          <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
        </span>
      ) : null}
      <span className="shrink-0 font-mono text-(length:--text-nano) text-muted-foreground">
        {issue.identifier ?? issue.id.slice(0, 8)}
      </span>
      <span className="truncate">{issue.title}</span>
      <PriorityIcon priority={issue.priority} />
      <IssueAgeChip issue={issue} />
    </Link>
  );
}
