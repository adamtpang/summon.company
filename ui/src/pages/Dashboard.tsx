import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bot, LayoutDashboard } from "lucide-react";
import { dashboardApi } from "../api/dashboard";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { projectsApi } from "../api/projects";
import { goalsApi } from "../api/goals";
import { attentionApi } from "../api/attention";
import { heartbeatsApi } from "../api/heartbeats";
import { APP_NAME } from "../lib/app-branding";
import { attentionBadgeCount } from "../lib/attention";
import { useCompany } from "../context/CompanyContext";
import { useDialogActions } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { collectLiveIssueIds } from "../lib/liveIssueIds";
import { useVisibilityRefetchInterval } from "../lib/polling";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { Button } from "@/components/ui/button";
import { MissionControl } from "../components/MissionControl";
import { PluginSlotOutlet } from "@/plugins/slots";

export function Dashboard() {
  const { selectedCompanyId, companies } = useCompany();
  const { openNewIssue, openOnboarding } = useDialogActions();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Mission Control" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.dashboard(selectedCompanyId!),
    queryFn: () => dashboardApi.summary(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const { data: agents = [] } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const { data: issues = [] } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const { data: projects = [] } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const { data: goals = [] } = useQuery({
    queryKey: queryKeys.goals.list(selectedCompanyId!),
    queryFn: () => goalsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const { data: attention } = useQuery({
    queryKey: queryKeys.attention(selectedCompanyId!),
    queryFn: () => attentionApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const liveRunsRefetchInterval = useVisibilityRefetchInterval({ visibleMs: 5_000 });
  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(selectedCompanyId!),
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: liveRunsRefetchInterval,
  });
  const liveIssueIds = useMemo(() => collectLiveIssueIds(liveRuns), [liveRuns]);

  if (!selectedCompanyId) {
    if (companies.length === 0) {
      return (
        <EmptyState
          icon={LayoutDashboard}
          message={`Welcome to ${APP_NAME}. Set up your first company and AI employee to get started.`}
          action="Hire First Employee"
          onAction={openOnboarding}
        />
      );
    }
    return <EmptyState icon={LayoutDashboard} message="Create or select a company to view Mission Control." />;
  }

  if (isLoading || !data) return <PageSkeleton variant="dashboard" />;

  const hasNoAgents = agents.length === 0;
  const notice = error || hasNoAgents ? (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <Bot className="size-4 shrink-0" aria-hidden="true" />
        <p className="text-sm">
          {error?.message ?? "Your eight-department formation has no AI employees yet."}
        </p>
      </div>
      {hasNoAgents ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => openOnboarding({ initialStep: 2, companyId: selectedCompanyId })}
          className="rounded-(--rad-2) border-foreground font-console text-xs uppercase tracking-(--tracking-eyebrow) shadow-none"
        >
          Hire first employee
        </Button>
      ) : null}
    </div>
  ) : undefined;

  return (
    <div className="h-full min-h-0">
      <MissionControl
        companyId={selectedCompanyId}
        companyName={companies.find((company) => company.id === selectedCompanyId)?.name}
        summary={data}
        agents={agents}
        issues={issues}
        projects={projects}
        goals={goals}
        decisionCount={attentionBadgeCount(attention)}
        liveIssueIds={liveIssueIds}
        onCreateTask={() => openNewIssue()}
        notice={notice}
        extensions={(
          <PluginSlotOutlet
            slotTypes={["dashboardWidget"]}
            context={{ companyId: selectedCompanyId }}
            className="grid gap-2 md:grid-cols-2"
            itemClassName="border-b border-foreground py-3"
          />
        )}
      />
    </div>
  );
}
