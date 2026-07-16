import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bot, LayoutDashboard } from "lucide-react";
import { dashboardApi } from "../api/dashboard";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { projectsApi } from "../api/projects";
import { goalsApi } from "../api/goals";
import { attentionApi } from "../api/attention";
import { APP_NAME } from "../lib/app-branding";
import { attentionBadgeCount } from "../lib/attention";
import { useCompany } from "../context/CompanyContext";
import { useDialogActions } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MissionControl } from "../components/MissionControl";
import { PluginSlotOutlet } from "@/plugins/slots";
import { useMarketCapSnapshot } from "./MarketCap";

export function Dashboard() {
  const { selectedCompanyId, companies } = useCompany();
  const { openOnboarding } = useDialogActions();
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
  const { snapshot: marketCapSnapshot } = useMarketCapSnapshot(selectedCompanyId);

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

  return (
    <div className="space-y-6 p-4 md:p-6">
      {error ? <p className="text-sm text-destructive">{error.message}</p> : null}

      {hasNoAgents ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2.5">
            <Bot className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm">Your eight-department formation has no AI employees yet.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => openOnboarding({ initialStep: 2, companyId: selectedCompanyId })}>
            Hire first employee
          </Button>
        </Card>
      ) : null}

      <MissionControl
        companyId={selectedCompanyId}
        summary={data}
        agents={agents}
        issues={issues}
        projects={projects}
        goals={goals}
        decisionCount={attentionBadgeCount(attention)}
        marketCapSnapshot={marketCapSnapshot}
      />

      <PluginSlotOutlet
        slotTypes={["dashboardWidget"]}
        context={{ companyId: selectedCompanyId }}
        className="grid gap-4 md:grid-cols-2"
        itemClassName="rounded-lg border bg-card p-4 shadow-sm"
      />
    </div>
  );
}
