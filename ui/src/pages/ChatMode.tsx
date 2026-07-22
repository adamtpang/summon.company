import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { BoardChat } from "./BoardChat";
import { agentsApi } from "../api/agents";
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
      <p className="border-b border-border py-2 text-center text-xs text-muted-foreground">
        Try: “status” · “what needs me” · “what's our bottleneck” · @Ink, @Magnet… to reach anyone
      </p>
      <div className="min-h-0 flex-1">
        <BoardChat />
      </div>
    </div>
  );
}
