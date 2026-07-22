import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BoardChat } from "./BoardChat";
import { buildRoadmapStages, selectRoadmapConstraint } from "./Roadmap";
import { agentsApi } from "../api/agents";
import { issuesApi } from "../api/issues";
import { projectsApi } from "../api/projects";
import { useCompany } from "../context/CompanyContext";
import { useSidebar } from "../context/SidebarContext";
import { queryKeys } from "../lib/queryKeys";

/**
 * Chat mode (BETA — board ask 2026-07-19): the whole company as a
 * conversation. "I want to feel like I'm texting a real person." This wraps
 * the existing BoardChat machinery in texting chrome: a persona header (who
 * you're talking to, present), the beta badge, and an immersive collapsed
 * sidebar. Intelligence stays in the agent — "status", "decisions", "help"
 * are things Sol ANSWERS (its instructions carry the command doctrine), not
 * client-parsed tricks. Inline visual cards on demand are the next iteration.
 */
export function ChatMode() {
  const { selectedCompanyId } = useCompany();
  const { setCollapsed } = useSidebar();

  // Immersive: collapse the rail while chatting; restore on leave.
  useEffect(() => {
    setCollapsed(true);
    return () => setCollapsed(false);
  }, [setCollapsed]);

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const cofounder = agents?.find((a) => a.role === "ceo") ?? null;
  const monogram = (cofounder?.name ?? "S").slice(0, 1).toUpperCase();

  // The game HUD (board, 2026-07-19: "like a video game with progression") —
  // the company roadmap as the persistent progress strip above the thread.
  // Same evidence engine as Mission Control; never self-reported.
  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const roadmap = useMemo(
    () => buildRoadmapStages({ agents: agents ?? [], issues: issues ?? [], projects: projects ?? [], goals: [] }),
    [agents, issues, projects],
  );
  const constraint = useMemo(() => selectRoadmapConstraint(roadmap), [roadmap]);
  const overall = roadmap.length
    ? Math.round(roadmap.reduce((sum, stage) => sum + stage.progress, 0) / roadmap.length)
    : 0;

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-3xl flex-col" data-testid="chat-mode">
      <header className="flex items-center gap-3 border-b border-border pb-3">
        {/* Persona presence: monogram in the Summon-circle register — never a
            real person's photo; the persona-card portraits arrive with the
            roster picker (SUM-196). */}
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground"
        >
          {monogram}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{cofounder?.name ?? "Your cofounder"}</p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block size-1.5 rounded-full bg-(--status-task-done)" aria-hidden="true" />
            online · the whole company answers here
          </p>
        </div>
        <span className="rounded-full border border-border px-2 py-0.5 text-(length:--text-nano) font-semibold uppercase tracking-(--tracking-eyebrow) text-muted-foreground">
          beta
        </span>
      </header>
      {/* Progression HUD: stage + percent, always in view while you play. */}
      {constraint ? (
        <div className="flex items-center gap-3 border-b border-border py-2">
          <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
            Stage {constraint.stage.sequence}/8 · {constraint.stage.title}
          </span>
          <span
            className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Company roadmap progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={overall}
          >
            <span className="block h-full rounded-full bg-primary/80" style={{ width: `${Math.max(overall, 2)}%` }} />
          </span>
          <span className="shrink-0 text-xs font-semibold tabular-nums">{overall}%</span>
        </div>
      ) : null}
      <p className="border-b border-border py-2 text-center text-xs text-muted-foreground">
        Try: “status” · “what needs me” · “what's our bottleneck” · @sales, @engineering, @Ink… to reach anyone
      </p>
      <div className="min-h-0 flex-1">
        <BoardChat />
      </div>
    </div>
  );
}
