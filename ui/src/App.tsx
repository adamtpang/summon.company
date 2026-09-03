import { Navigate, Outlet, Route, Routes, useLocation, useParams } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { Layout } from "./components/Layout";
import { ConferenceRoomChatGate } from "./components/ConferenceRoomChatGate";
import { PipelinesExperimentalGate } from "./components/PipelinesExperimentalGate";
import { CasesExperimentalGate } from "./components/CasesExperimentalGate";
import { Cases } from "./pages/Cases";
import { CaseDetail } from "./pages/CaseDetail";
import { OnboardingWizardVariant } from "./components/OnboardingWizardVariant";
import { CloudAccessGate } from "./components/CloudAccessGate";
import { Dashboard } from "./pages/Dashboard";
import { DashboardLive } from "./pages/DashboardLive";
import { Timeline } from "./pages/Timeline";
import { Companies } from "./pages/Companies";
import { AetherPortfolio } from "./pages/AetherPortfolio";
import { AetherPortfolioCockpit } from "./pages/AetherPortfolioCockpit";
import { CodebaseDiagnosis } from "./pages/CodebaseDiagnosis";
import { AGENT_FILTER_TABS, Agents } from "./pages/Agents";
import { AgentDetail } from "./pages/AgentDetail";
import { Projects } from "./pages/Projects";
import { ProjectDetail } from "./pages/ProjectDetail";
import { ProjectWorkspaceDetail } from "./pages/ProjectWorkspaceDetail";
import { Workspaces } from "./pages/Workspaces";
import { Issues } from "./pages/Issues";
import { Search } from "./pages/Search";
import { IssueDetail } from "./pages/IssueDetail";
import { IssueChatLongThreadPerf } from "./pages/IssueChatLongThreadPerf";
import { Routines } from "./pages/Routines";
import { Learnings, PipelineItemDetail, PipelineItemLegacyRedirect, Pipelines, ReviewQueue } from "./pages/Pipelines";
import { PipelineSettings } from "./pages/PipelineSettings";
import { RoutineDetail } from "./pages/RoutineDetail";
import { UserProfile } from "./pages/UserProfile";
import { ExecutionWorkspaceDetail } from "./pages/ExecutionWorkspaceDetail";
import { Goals } from "./pages/Goals";
import { Artifacts } from "./pages/Artifacts";
import { GoalDetail } from "./pages/GoalDetail";
import { Approvals } from "./pages/Approvals";
import { ApprovalDetail } from "./pages/ApprovalDetail";
import { Costs } from "./pages/Costs";
import { Usage } from "./pages/Usage";
import { Activity } from "./pages/Activity";
import { Inbox } from "./pages/Inbox";
import { CustomerInbox } from "./pages/CustomerInbox";
import { CompanyWebsite } from "./pages/CompanyWebsite";
import { CompanyPayments } from "./pages/CompanyPayments";
import { CompanySocial } from "./pages/CompanySocial";
import { CompanyOutreach } from "./pages/CompanyOutreach";
import { CompanyAds } from "./pages/CompanyAds";
import { CompanyMedia } from "./pages/CompanyMedia";
import { CompanyStack } from "./pages/CompanyStack";
import { CompanyPublic } from "./pages/CompanyPublic";
import { PublicCompany } from "./pages/PublicCompany";
import { PublicCompanies } from "./pages/PublicCompanies";
import { FactoryFloor } from "./pages/FactoryFloor";
import { AuditTable } from "./pages/AuditTable";
import { Watchtower } from "./pages/Watchtower";
import { HelpCenter } from "./pages/HelpCenter";
import { WhatNeedsMe } from "./pages/WhatNeedsMe";
import { BoardChat } from "./pages/BoardChat";
import { ChatMode } from "./pages/ChatMode";
import { CompanySettings } from "./pages/CompanySettings";
import { CompanyEnvironments } from "./pages/CompanyEnvironments";
import { CloudUpstream } from "./pages/CloudUpstream";
import { CloudUpstreamUxLab } from "./pages/CloudUpstreamUxLab";
import { BootstrapSetupUxLab } from "./pages/BootstrapSetupUxLab";
import { ResponsibleUserDenialUxLab } from "./pages/ResponsibleUserDenialUxLab";
import { CompanySettingsPluginPage } from "./pages/CompanySettingsPluginPage";
import { CompanyAccess, CompanyAccessLegacyRoute } from "./pages/CompanyAccess";
import { CompanyInvites } from "./pages/CompanyInvites";
import { CompanySkills } from "./pages/CompanySkills";
import { SkillStudio } from "./pages/SkillStudio";
import { Secrets } from "./pages/Secrets";
import { CompanyExport } from "./pages/CompanyExport";
import { CompanyImport } from "./pages/CompanyImport";
import { DesignGuide } from "./pages/DesignGuide";
import { InstanceGeneralSettings } from "./pages/InstanceGeneralSettings";
import { InstanceAccess } from "./pages/InstanceAccess";
import { InstanceSettings } from "./pages/InstanceSettings";
import { InstanceExperimentalSettings } from "./pages/InstanceExperimentalSettings";
import { ProfileSettings } from "./pages/ProfileSettings";
import { PluginManager } from "./pages/PluginManager";
import { PluginSettings } from "./pages/PluginSettings";
import { AdapterManager } from "./pages/AdapterManager";
import { PluginPage } from "./pages/PluginPage";
import { OrgChart } from "./pages/OrgChart";
import { Formation } from "./pages/Formation";
import { MarketCap } from "./pages/MarketCap";
import { Roadmap } from "./pages/Roadmap";
import { Messages } from "./pages/Messages";
import { AiSdrDogfood } from "./pages/AiSdrDogfood";
import { NewAgent } from "./pages/NewAgent";
import { AuthPage } from "./pages/Auth";
import { BoardClaimPage } from "./pages/BoardClaim";
import { CliAuthPage } from "./pages/CliAuth";
import { InviteLandingPage } from "./pages/InviteLanding";
import { JoinRequestQueue } from "./pages/JoinRequestQueue";
import { NotFoundPage } from "./pages/NotFound";
import { useCompany } from "./context/CompanyContext";
import { useDialogActions, useDialogState } from "./context/DialogContext";
import { loadLastInboxTab } from "./lib/inbox";
import {
  isOnboardingWizardActive,
  shouldRedirectCompanylessRouteToOnboarding,
} from "./lib/onboarding-route";
import { normalizeRememberedInstanceSettingsPath } from "./lib/instance-settings";
import { readHostedPublicCompanySlug } from "./lib/publicCompanyHost";

function boardRoutes() {
  return (
    <>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="dashboard/live" element={<DashboardLive />} />
      <Route path="timeline" element={<Timeline />} />
      <Route path="onboarding" element={<OnboardingRoutePage />} />
      <Route path="companies" element={<Companies />} />
      <Route path="portfolio" element={<AetherPortfolioCockpit />} />
      <Route path="portfolio/ledger" element={<AetherPortfolio />} />
      <Route path="diagnose" element={<CodebaseDiagnosis />} />
      <Route path="company/settings" element={<CompanySettings />} />
      <Route path="company/website" element={<CompanyWebsite />} />
      <Route path="company/payments" element={<CompanyPayments />} />
      <Route path="company/social" element={<CompanySocial />} />
      <Route path="company/outreach" element={<CompanyOutreach />} />
      <Route path="company/ads" element={<CompanyAds />} />
      <Route path="company/media" element={<CompanyMedia />} />
      <Route path="company/stack" element={<CompanyStack />} />
      <Route path="company/public" element={<CompanyPublic />} />
      <Route path="company/settings/environments" element={<Navigate to="/company/settings/instance/environments" replace />} />
      <Route path="company/settings/cloud-upstream" element={<CloudUpstream />} />
      <Route path="company/settings/members" element={<CompanyAccess />} />
      <Route path="company/settings/access" element={<CompanyAccessLegacyRoute />} />
      <Route path="company/settings/cloud-upstream" element={<CloudUpstream />} />
      <Route path="company/settings/invites" element={<CompanyInvites />} />
      <Route path="company/export/*" element={<CompanyExport />} />
      <Route path="company/import" element={<CompanyImport />} />
      <Route path="company/settings/secrets" element={<Secrets />} />
      <Route path="company/settings/instance" element={<Navigate to="general" replace />} />
      <Route path="company/settings/instance/profile" element={<ProfileSettings />} />
      <Route path="company/settings/instance/general" element={<InstanceGeneralSettings />} />
      <Route path="company/settings/instance/environments" element={<CompanyEnvironments />} />
      <Route path="company/settings/instance/environments/new" element={<CompanyEnvironments mode="create" />} />
      <Route path="company/settings/instance/environments/:environmentId/edit" element={<CompanyEnvironments mode="edit" />} />
      <Route path="company/settings/instance/access" element={<InstanceAccess />} />
      <Route path="company/settings/instance/heartbeats" element={<InstanceSettings />} />
      <Route path="company/settings/instance/experimental" element={<InstanceExperimentalSettings />} />
      <Route path="company/settings/instance/plugins" element={<PluginManager />} />
      <Route path="company/settings/instance/plugins/:pluginId" element={<PluginSettings />} />
      <Route path="company/settings/instance/adapters" element={<AdapterManager />} />
      <Route path="company/settings/:settingsRoutePath/*" element={<CompanySettingsPluginPage />} />
      <Route path="skills/studio" element={<SkillStudio />} />
      <Route path="skills/studio/new" element={<SkillStudio />} />
      <Route path="skills/studio/:skillId" element={<SkillStudio />} />
      <Route path="skills/:skillId/studio" element={<LegacySkillStudioRedirect />} />
      <Route path="skills/*" element={<CompanySkills />} />
      <Route path="settings" element={<LegacySettingsRedirect />} />
      <Route path="settings/*" element={<LegacySettingsRedirect />} />
      <Route path="plugins/:pluginId" element={<PluginPage />} />
      <Route path="org" element={<OrgChart />} />
      <Route path="formation" element={<Formation />} />
      <Route path="market-cap" element={<MarketCap />} />
      <Route path="marketcap" element={<MarketCap />} />
      <Route path="roadmap" element={<Roadmap />} />
      <Route path="messages" element={<Messages />} />
      <Route path="ai-sdr" element={<AiSdrDogfood />} />
      <Route path="agents" element={<Navigate to="/agents/all" replace />} />
      {AGENT_FILTER_TABS.map((tab) => (
        <Route key={tab} path={`agents/${tab}`} element={<Agents />} />
      ))}
      <Route path="agents/new" element={<NewAgent />} />
      <Route path="agents/:agentId" element={<AgentDetail />} />
      <Route path="agents/:agentId/:tab" element={<AgentDetail />} />
      <Route path="agents/:agentId/runs/:runId" element={<AgentDetail />} />
      <Route path="projects" element={<Projects />} />
      <Route path="projects/:projectId" element={<ProjectDetail />} />
      <Route path="projects/:projectId/overview" element={<ProjectDetail />} />
      <Route path="projects/:projectId/issues" element={<ProjectDetail />} />
      <Route path="projects/:projectId/issues/:filter" element={<ProjectDetail />} />
      <Route path="projects/:projectId/workspaces/:workspaceId" element={<ProjectWorkspaceDetail />} />
      <Route path="projects/:projectId/workspaces" element={<ProjectDetail />} />
      <Route path="projects/:projectId/configuration" element={<ProjectDetail />} />
      <Route path="projects/:projectId/budget" element={<ProjectDetail />} />
      <Route path="workspaces" element={<Workspaces />} />
      <Route path="issues" element={<Issues />} />
      <Route path="search" element={<Search />} />
      <Route path="issues/all" element={<Navigate to="/issues" replace />} />
      <Route path="issues/active" element={<Navigate to="/issues" replace />} />
      <Route path="issues/backlog" element={<Navigate to="/issues" replace />} />
      <Route path="issues/done" element={<Navigate to="/issues" replace />} />
      <Route path="issues/recent" element={<Navigate to="/issues" replace />} />
      <Route path="issues/:issueId" element={<IssueDetail />} />
      {import.meta.env.DEV ? (
        <Route path="tests/perf/long-thread" element={<IssueChatLongThreadPerf />} />
      ) : null}
      <Route path="routines" element={<Routines />} />
      <Route
        path="cases"
        element={<CasesExperimentalGate><Cases /></CasesExperimentalGate>}
      />
      <Route
        path="cases/:caseIdentifier"
        element={<CasesExperimentalGate><CaseDetail /></CasesExperimentalGate>}
      />
      <Route
        path="review-queue"
        element={<PipelinesExperimentalGate><ReviewQueue /></PipelinesExperimentalGate>}
      />
      <Route
        path="learnings"
        element={<PipelinesExperimentalGate><Learnings /></PipelinesExperimentalGate>}
      />
      <Route
        path="pipelines"
        element={<PipelinesExperimentalGate><Pipelines /></PipelinesExperimentalGate>}
      />
      <Route
        path="pipelines/:pipelineId"
        element={<PipelinesExperimentalGate><Pipelines /></PipelinesExperimentalGate>}
      />
      <Route
        path="pipelines/:pipelineId/add"
        element={<PipelinesExperimentalGate><Pipelines /></PipelinesExperimentalGate>}
      />
      <Route
        path="pipelines/:pipelineId/settings"
        element={<PipelinesExperimentalGate><PipelineSettings /></PipelinesExperimentalGate>}
      />
      <Route
        path="pipelines/:pipelineId/items/:caseId"
        element={<PipelinesExperimentalGate><PipelineItemDetail /></PipelinesExperimentalGate>}
      />
      <Route
        path="pipelines/:pipelineId/cases/:caseId"
        element={<PipelinesExperimentalGate><PipelineItemLegacyRedirect /></PipelinesExperimentalGate>}
      />
      <Route path="routines/:routineId" element={<RoutineDetail />} />
      <Route path="routines/:routineId/:section" element={<RoutineDetail />} />
      <Route path="execution-workspaces/:workspaceId" element={<ExecutionWorkspaceDetail />} />
      <Route path="execution-workspaces/:workspaceId/services" element={<ExecutionWorkspaceDetail />} />
      <Route path="execution-workspaces/:workspaceId/configuration" element={<ExecutionWorkspaceDetail />} />
      <Route path="execution-workspaces/:workspaceId/runtime-logs" element={<ExecutionWorkspaceDetail />} />
      <Route path="execution-workspaces/:workspaceId/issues" element={<ExecutionWorkspaceDetail />} />
      <Route path="execution-workspaces/:workspaceId/routines" element={<ExecutionWorkspaceDetail />} />
      <Route path="goals" element={<Goals />} />
      <Route path="goals/:goalId" element={<GoalDetail />} />
      <Route path="artifacts" element={<Artifacts />} />
      <Route path="approvals" element={<Navigate to="/approvals/pending" replace />} />
      <Route path="approvals/pending" element={<Approvals />} />
      <Route path="approvals/all" element={<Approvals />} />
      <Route path="approvals/:approvalId" element={<ApprovalDetail />} />
      <Route path="costs" element={<Costs />} />
      <Route path="usage" element={<Usage />} />
      <Route path="activity" element={<Activity />} />
      <Route path="factory-floor" element={<FactoryFloor />} />
      <Route path="audit" element={<AuditTable />} />
      <Route path="watchtower" element={<Watchtower />} />
      <Route path="help" element={<HelpCenter />} />
      {/* Conference Room Chat surfaces (PAP-136/PAP-137): routes stay
          registered but redirect to the company home while the experimental
          flag is off. The board-level `artifacts` mount below is the new
          conference-room one; the master-level mount above it still serves
          `/artifacts` in both modes. */}
      <Route element={<ConferenceRoomChatGate />}>
        <Route path="board-chat" element={<BoardChat />} />
        <Route path="artifacts" element={<Artifacts />} />
      </Route>
      {/* Chat mode (beta, board 2026-07-19): the company as a conversation. */}
      <Route path="chat" element={<ChatMode />} />
      <Route path="decisions" element={<WhatNeedsMe />} />
      <Route path="inbox" element={<InboxRootRedirect />} />
      <Route path="inbox/mine" element={<Inbox />} />
      <Route path="inbox/recent" element={<Inbox />} />
      <Route path="inbox/unread" element={<Inbox />} />
      <Route path="inbox/blocked" element={<Inbox />} />
      <Route path="inbox/customers" element={<CustomerInbox />} />
      <Route path="inbox/all" element={<Inbox />} />
      <Route path="inbox/requests" element={<JoinRequestQueue />} />
      <Route path="inbox/new" element={<Navigate to="/inbox/mine" replace />} />
      <Route path="u/:userSlug" element={<UserProfile />} />
      <Route path="design-guide" element={<DesignGuide />} />
      <Route path="instance/settings/adapters" element={<AdapterManager />} />
      <Route path=":pluginRoutePath/*" element={<PluginPage />} />
      <Route path="*" element={<NotFoundPage scope="board" />} />
    </>
  );
}

function InboxRootRedirect() {
  return <Navigate to={`/inbox/${loadLastInboxTab()}`} replace />;
}

function LegacySkillStudioRedirect() {
  const location = useLocation();
  const { companies, selectedCompany, loading } = useCompany();
  const { companyPrefix, skillId } = useParams<{ companyPrefix?: string; skillId?: string }>();

  if (loading) return null;

  const targetCompany =
    (companyPrefix
      ? companies.find((company) => company.issuePrefix.toUpperCase() === companyPrefix.toUpperCase())
      : null) ??
    selectedCompany ??
    companies[0] ??
    null;

  if (!targetCompany || !skillId) {
    return <Navigate to="/skills/studio" replace />;
  }

  return (
    <Navigate
      to={`/${targetCompany.issuePrefix}/skills/studio/${encodeURIComponent(skillId)}${location.search}${location.hash}`}
      replace
    />
  );
}

function LegacySettingsRedirect() {
  const location = useLocation();
  const { companies, selectedCompany, loading } = useCompany();
  const { companyPrefix } = useParams<{ companyPrefix?: string }>();

  if (loading) {
    return <div className="mx-auto max-w-xl py-10 text-sm text-muted-foreground">Loading...</div>;
  }

  const targetCompany =
    (companyPrefix
      ? companies.find((company) => company.issuePrefix.toUpperCase() === companyPrefix.toUpperCase())
      : null) ??
    selectedCompany ??
    companies[0] ??
    null;

  if (!targetCompany) {
    if (
      shouldRedirectCompanylessRouteToOnboarding({
        pathname: location.pathname,
        hasCompanies: false,
      })
    ) {
      return <Navigate to="/onboarding" replace />;
    }
    return <NoCompaniesStartPage />;
  }

  const normalizedPath = normalizeRememberedInstanceSettingsPath(
    `${location.pathname}${location.search}${location.hash}`,
  );

  return (
    <Navigate
      to={`/${targetCompany.issuePrefix}${normalizedPath}`}
      replace
    />
  );
}

function OnboardingRoutePage() {
  const { companies } = useCompany();
  const { openOnboarding } = useDialogActions();
  const { onboardingOpen, onboardingRouteDismissed } = useDialogState();
  const { companyPrefix } = useParams<{ companyPrefix?: string }>();

  // The OnboardingWizard auto-opens on this route (and can also be opened
  // explicitly). While it is showing it covers the whole screen, so the
  // launcher card below must not stay interactive behind it — otherwise users
  // can tab/click through to the form behind the modal (PAP-52). The launcher
  // only needs to render as a re-entry point once the wizard is dismissed.
  if (isOnboardingWizardActive({ onboardingOpen, routeDismissed: onboardingRouteDismissed })) {
    return null;
  }
  const matchedCompany = companyPrefix
    ? companies.find((company) => company.issuePrefix.toUpperCase() === companyPrefix.toUpperCase()) ?? null
    : null;

  const title = matchedCompany
    ? `Add another agent to ${matchedCompany.name}`
    : companies.length > 0
      ? "Create another company"
      : "Create your first company";
  const description = matchedCompany
    ? "Run onboarding again to add an agent and a starter task for this company."
    : companies.length > 0
      ? "Run onboarding again to create another company and seed its first agent."
      : "Get started by creating a company and your first agent.";

  return (
    <div className="mx-auto max-w-xl py-10">
      <div className="rounded-lg border border-border bg-card p-6">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <div className="mt-4">
          <Button
            onClick={() =>
              matchedCompany
                ? openOnboarding({ initialStep: 2, companyId: matchedCompany.id })
                : openOnboarding()
            }
          >
            {matchedCompany ? "Add Agent" : "Start Onboarding"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CompanyRootRedirect() {
  const { companies, selectedCompany, loading } = useCompany();
  const location = useLocation();

  if (loading) {
    return <div className="mx-auto max-w-xl py-10 text-sm text-muted-foreground">Loading...</div>;
  }

  const targetCompany = selectedCompany ?? companies[0] ?? null;
  if (!targetCompany) {
    if (
      shouldRedirectCompanylessRouteToOnboarding({
        pathname: location.pathname,
        hasCompanies: false,
      })
    ) {
      return <Navigate to="/onboarding" replace />;
    }
    return <NoCompaniesStartPage />;
  }

  return <Navigate to={`/${targetCompany.issuePrefix}/dashboard`} replace />;
}

function UnprefixedBoardRedirect() {
  const location = useLocation();
  const { companies, selectedCompany, loading } = useCompany();

  if (loading) {
    return <div className="mx-auto max-w-xl py-10 text-sm text-muted-foreground">Loading...</div>;
  }

  const targetCompany = selectedCompany ?? companies[0] ?? null;
  if (!targetCompany) {
    if (
      shouldRedirectCompanylessRouteToOnboarding({
        pathname: location.pathname,
        hasCompanies: false,
      })
    ) {
      return <Navigate to="/onboarding" replace />;
    }
    return <NoCompaniesStartPage />;
  }

  return (
    <Navigate
      to={`/${targetCompany.issuePrefix}${location.pathname}${location.search}${location.hash}`}
      replace
    />
  );
}

function NoCompaniesStartPage() {
  const { openOnboarding } = useDialogActions();
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-xl py-10">
      <div className="rounded-lg border border-border bg-card p-6">
        <h1 className="text-xl font-semibold">
          {t("app.noCompanies.title", { defaultValue: "Create your first company" })}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("app.noCompanies.description", { defaultValue: "Get started by creating a company." })}
        </p>
        <div className="mt-4">
          <Button onClick={() => openOnboarding()}>
            {t("app.noCompanies.newCompany", { defaultValue: "New Company" })}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function App() {
  const hostedPublicCompanySlug = readHostedPublicCompanySlug();
  if (hostedPublicCompanySlug) {
    return <PublicCompany slugOverride={hostedPublicCompanySlug} />;
  }
  return (
    <>
      <Routes>
        <Route path="auth" element={<AuthPage />} />
        <Route path="board-claim/:token" element={<BoardClaimPage />} />
        <Route path="cli-auth/:id" element={<CliAuthPage />} />
        <Route path="invite/:token" element={<InviteLandingPage />} />
        <Route path="discover" element={<PublicCompanies />} />
        <Route path="public/:slug" element={<PublicCompany />} />
        <Route path="tests/perf/long-thread" element={<IssueChatLongThreadPerf />} />
        <Route path="ux-lab/cloud-upstream" element={<CloudUpstreamUxLab />} />
        <Route path="ux-lab/bootstrap-setup" element={<BootstrapSetupUxLab />} />
        <Route path="ux-lab/responsible-user-denial" element={<ResponsibleUserDenialUxLab />} />

        <Route element={<CloudAccessGate />}>
          <Route index element={<CompanyRootRedirect />} />
          <Route path="onboarding" element={<OnboardingRoutePage />} />
          <Route path="instance" element={<LegacySettingsRedirect />} />
          <Route path="instance/settings" element={<LegacySettingsRedirect />} />
          <Route path="instance/settings/*" element={<LegacySettingsRedirect />} />
          <Route path="companies" element={<UnprefixedBoardRedirect />} />
          <Route path="diagnose" element={<UnprefixedBoardRedirect />} />
          <Route path="help" element={<UnprefixedBoardRedirect />} />
          <Route path="company/website" element={<UnprefixedBoardRedirect />} />
          <Route path="company/payments" element={<UnprefixedBoardRedirect />} />
          <Route path="company/social" element={<UnprefixedBoardRedirect />} />
          <Route path="company/outreach" element={<UnprefixedBoardRedirect />} />
          <Route path="company/ads" element={<UnprefixedBoardRedirect />} />
          <Route path="company/stack" element={<UnprefixedBoardRedirect />} />
          <Route path="company/public" element={<UnprefixedBoardRedirect />} />
          <Route path="issues" element={<UnprefixedBoardRedirect />} />
          <Route path="issues/:issueId" element={<UnprefixedBoardRedirect />} />
          <Route path="routines" element={<UnprefixedBoardRedirect />} />
          <Route path="routines/:routineId" element={<UnprefixedBoardRedirect />} />
          <Route path="review-queue" element={<UnprefixedBoardRedirect />} />
          <Route path="learnings" element={<UnprefixedBoardRedirect />} />
          <Route path="cases" element={<UnprefixedBoardRedirect />} />
          <Route path="cases/:caseIdentifier" element={<UnprefixedBoardRedirect />} />
          <Route path="pipelines" element={<UnprefixedBoardRedirect />} />
          <Route path="pipelines/:pipelineId" element={<UnprefixedBoardRedirect />} />
          <Route path="pipelines/:pipelineId/add" element={<UnprefixedBoardRedirect />} />
          <Route path="pipelines/:pipelineId/settings" element={<UnprefixedBoardRedirect />} />
          <Route path="pipelines/:pipelineId/items/:caseId" element={<UnprefixedBoardRedirect />} />
          <Route path="pipelines/:pipelineId/cases/:caseId" element={<UnprefixedBoardRedirect />} />
          <Route path="artifacts" element={<UnprefixedBoardRedirect />} />
          <Route path="decisions" element={<UnprefixedBoardRedirect />} />
          <Route path="chat" element={<UnprefixedBoardRedirect />} />
          <Route path="u/:userSlug" element={<UnprefixedBoardRedirect />} />
          <Route path="skills/studio" element={<UnprefixedBoardRedirect />} />
          <Route path="skills/studio/new" element={<UnprefixedBoardRedirect />} />
          <Route path="skills/studio/:skillId" element={<UnprefixedBoardRedirect />} />
          <Route path="skills/:skillId/studio" element={<LegacySkillStudioRedirect />} />
          <Route path="skills/*" element={<UnprefixedBoardRedirect />} />
          <Route path="settings" element={<LegacySettingsRedirect />} />
          <Route path="settings/*" element={<LegacySettingsRedirect />} />
          <Route path="agents" element={<UnprefixedBoardRedirect />} />
          <Route path="formation" element={<UnprefixedBoardRedirect />} />
          <Route path="roadmap" element={<UnprefixedBoardRedirect />} />
          <Route path="messages" element={<UnprefixedBoardRedirect />} />
          <Route path="ai-sdr" element={<UnprefixedBoardRedirect />} />
          {AGENT_FILTER_TABS.map((tab) => (
            <Route key={tab} path={`agents/${tab}`} element={<UnprefixedBoardRedirect />} />
          ))}
          <Route path="agents/new" element={<UnprefixedBoardRedirect />} />
          <Route path="agents/:agentId" element={<UnprefixedBoardRedirect />} />
          <Route path="agents/:agentId/:tab" element={<UnprefixedBoardRedirect />} />
          <Route path="agents/:agentId/runs/:runId" element={<UnprefixedBoardRedirect />} />
          <Route path="projects" element={<UnprefixedBoardRedirect />} />
          <Route path="projects/:projectId" element={<UnprefixedBoardRedirect />} />
          <Route path="projects/:projectId/overview" element={<UnprefixedBoardRedirect />} />
          <Route path="projects/:projectId/issues" element={<UnprefixedBoardRedirect />} />
          <Route path="projects/:projectId/issues/:filter" element={<UnprefixedBoardRedirect />} />
          <Route path="projects/:projectId/workspaces" element={<UnprefixedBoardRedirect />} />
          <Route path="projects/:projectId/workspaces/:workspaceId" element={<UnprefixedBoardRedirect />} />
          <Route path="projects/:projectId/configuration" element={<UnprefixedBoardRedirect />} />
          <Route path="workspaces" element={<UnprefixedBoardRedirect />} />
          <Route path="execution-workspaces/:workspaceId" element={<UnprefixedBoardRedirect />} />
          <Route path="execution-workspaces/:workspaceId/services" element={<UnprefixedBoardRedirect />} />
          <Route path="execution-workspaces/:workspaceId/configuration" element={<UnprefixedBoardRedirect />} />
          <Route path="execution-workspaces/:workspaceId/runtime-logs" element={<UnprefixedBoardRedirect />} />
          <Route path="execution-workspaces/:workspaceId/issues" element={<UnprefixedBoardRedirect />} />
          <Route path="execution-workspaces/:workspaceId/routines" element={<UnprefixedBoardRedirect />} />
          <Route path=":companyPrefix" element={<Layout />}>
            {boardRoutes()}
          </Route>
          <Route path="*" element={<NotFoundPage scope="global" />} />
        </Route>
      </Routes>
      <OnboardingWizardVariant />
    </>
  );
}
