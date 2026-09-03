import {
  ListChecks,
  CircleDot,
  LayoutDashboard,
  DollarSign,
  Search,
  SquarePen,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  UsersRound,
  Building2,
  FileSearch,
  Network,
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink } from "@/lib/router";
import { SidebarSection } from "./SidebarSection";
import { SidebarNavItem } from "./SidebarNavItem";
import { useDialogActions } from "../context/DialogContext";
import { useCompany } from "../context/CompanyContext";
import { useSidebar } from "../context/SidebarContext";
import { attentionApi } from "../api/attention";
import { heartbeatsApi } from "../api/heartbeats";
import { queryKeys } from "../lib/queryKeys";
import { attentionBadgeCount } from "../lib/attention";
import { usePublishSharedQueryData, useSharedPollingQuery } from "../hooks/useSharedPolling";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, SIDEBAR_RAIL_HIDDEN_LABEL } from "../lib/utils";
import { PluginSlotOutlet } from "@/plugins/slots";
import { PluginLauncherOutlet } from "@/plugins/launchers";
import { SidebarCompanyMenu } from "./SidebarCompanyMenu";
import { SummonMark } from "./SummonMark";

export function Sidebar() {
  const { openNewIssue } = useDialogActions();
  const [companyOpen, setCompanyOpen] = useState(true);
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { isMobile, collapsed, collapseLocked, peeking, toggleCollapsed, setCollapsed } = useSidebar();
  const rail = collapsed && !peeking;
  const liveRunsQueryKey = queryKeys.liveRuns(selectedCompanyId!);
  const sharedLiveRuns = useSharedPollingQuery({
    companyId: selectedCompanyId,
    resourceKey: "live-runs",
    queryKey: liveRunsQueryKey,
    enabled: !!selectedCompanyId,
    refetchInterval: 10_000,
    leaderOnly: true,
  });
  const { data: liveRuns, dataUpdatedAt: liveRunsUpdatedAt } = useQuery({
    queryKey: liveRunsQueryKey,
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!),
    enabled: sharedLiveRuns.enabled,
    refetchInterval: sharedLiveRuns.refetchInterval,
  });
  usePublishSharedQueryData(sharedLiveRuns, liveRuns, liveRunsUpdatedAt);
  const liveRunCount = liveRuns?.length ?? 0;
  const { data: attentionFeed } = useQuery({
    queryKey: queryKeys.attention(selectedCompanyId!),
    queryFn: () => attentionApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 60_000,
  });
  const attentionCount = attentionBadgeCount(attentionFeed);

  const pluginContext = {
    companyId: selectedCompanyId,
    companyPrefix: selectedCompany?.issuePrefix ?? null,
  };

  return (
    <aside className="summon-primary-sidebar flex h-full min-h-0 w-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border px-3">
        <NavLink
          to="/dashboard"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-sidebar-foreground outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          aria-label={rail ? "Summon" : undefined}
        >
          <SummonMark className="size-5 text-sidebar-primary" />
          <span className={rail ? SIDEBAR_RAIL_HIDDEN_LABEL : "truncate text-xs font-bold uppercase tracking-(--tracking-eyebrow)"}>
            Summon
          </span>
        </NavLink>

        {/* Desktop-only collapse/expand affordance. While peeking (hover flyout
            over the collapsed rail) it becomes a Pin that promotes the peek to a
            pinned-expanded sidebar; otherwise it toggles the pinned rail. */}
        {!rail && !isMobile && !collapseLocked ? (
          peeking ? (
            <Button
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-muted-foreground"
              aria-label="Keep sidebar expanded"
              title="Keep sidebar expanded"
              onClick={() => setCollapsed(false)}
            >
              <Pin className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-muted-foreground"
              aria-expanded={!collapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => toggleCollapsed()}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
          )
        ) : null}
      </div>

      <div className="flex h-12 shrink-0 items-center gap-1 px-3">
        <SidebarCompanyMenu />
        {!rail ? (
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-muted-foreground"
            aria-label="Open search"
            title="Open search"
          >
            <NavLink to="/search">
              <Search className="h-4 w-4" />
            </NavLink>
          </Button>
        ) : null}
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto scrollbar-auto-hide flex flex-col gap-4 pointer-coarse:gap-3 px-3 py-2">
        <div className="flex flex-col gap-0.5">
          {/* New Task button aligned with nav items */}
          {(() => {
            const newTaskButton = (
              <button
                onClick={() => openNewIssue()}
                data-slot="icon-button"
                aria-label={rail ? "New Task" : undefined}
                className="mx-2 flex min-h-9 items-center gap-2.5 rounded-lg bg-sidebar-primary px-2 py-1.5 text-(length:--text-compact) font-semibold text-sidebar-primary-foreground transition-colors hover:bg-sidebar-primary/90"
              >
                <SquarePen className="h-4 w-4 shrink-0" />
                <span className={rail ? SIDEBAR_RAIL_HIDDEN_LABEL : "truncate"}>New Task</span>
              </button>
            );
            return rail ? (
              <Tooltip>
                <TooltipTrigger asChild>{newTaskButton}</TooltipTrigger>
                <TooltipContent side="right">New Task</TooltipContent>
              </Tooltip>
            ) : (
              newTaskButton
            );
          })()}
          <SidebarNavItem to="/portfolio" label="Fleet" icon={Network} />
          <SidebarNavItem
            to="/dashboard"
            label="Mission Control"
            icon={LayoutDashboard}
            liveCount={liveRunCount}
          />
          <SidebarNavItem to="/factory-floor" label="Company Office" icon={Building2} />
          <SidebarNavItem to="/diagnose" label="Diagnose Codebase" icon={FileSearch} />
          <SidebarNavItem to="/issues" label="Tasks" icon={CircleDot} />
          <SidebarNavItem
            to="/decisions"
            label="Decisions"
            icon={ListChecks}
            badge={attentionCount}
            badgeLabel="decisions"
          />
        </div>

        <SidebarSection label="Company" collapsible={{ open: companyOpen, onOpenChange: setCompanyOpen }}>
          <SidebarNavItem to="/org" label="Org" icon={UsersRound} />
          <SidebarNavItem to="/costs" label="Costs" icon={DollarSign} />
          <SidebarNavItem to="/company/settings" label="Settings" icon={Settings} />
        </SidebarSection>

        {/* Extensions stay discoverable without allowing Paperclip's feature
            inventory to become the founder's information architecture. */}
        <PluginSlotOutlet
          slotTypes={["sidebar"]}
          context={pluginContext}
          className="flex flex-col gap-0.5"
          itemClassName="text-(length:--text-compact) font-medium"
          missingBehavior="placeholder"
        />
        <PluginLauncherOutlet
          placementZones={["sidebar"]}
          context={pluginContext}
          className="flex flex-col gap-0.5"
          itemClassName="text-(length:--text-compact) font-medium"
        />

        <PluginSlotOutlet
          slotTypes={["sidebarPanel"]}
          context={pluginContext}
          className="flex flex-col gap-3"
          itemClassName="rounded-lg border border-border p-3"
          missingBehavior="placeholder"
        />
      </nav>
    </aside>
  );
}
