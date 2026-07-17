import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AdapterEnvironmentTestResult } from "@paperclipai/shared";
import { useLocation, useNavigate, useParams } from "@/lib/router";
import { useDialog } from "../context/DialogContext";
import { useCompany } from "../context/CompanyContext";
import { companiesApi } from "../api/companies";
import { agentsApi } from "../api/agents";
import { approvalsApi } from "../api/approvals";
import { issuesApi } from "../api/issues";
import { projectsApi } from "../api/projects";
import { queryKeys } from "../lib/queryKeys";
import { Dialog, DialogPortal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "../lib/utils";
import { getUIAdapter } from "../adapters";
import { defaultCreateValues } from "./agent-config-defaults";
import { composeCeoInstructions } from "../lib/ceo-instructions";
import {
  buildOnboardingProjectPayload,
  selectReusableOnboardingProject,
} from "../lib/onboarding-launch";
import { buildNewAgentRuntimeConfig } from "../lib/new-agent-runtime-config";
import { APP_DISPLAY_NAME } from "../lib/app-branding";
import { DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX } from "@paperclipai/adapter-codex-local";
import { resolveRouteOnboardingOptions } from "../lib/onboarding-route";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Fuel,
  Github,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";

// Board ruling (2026-07-17, VIT-128): three steps, nothing gates the company
// existing. Name is the only required input. Fuel = the customer's OWN
// Claude/Codex subscription, probed the same way the board's machine is —
// never an API key prompt. The repo IS the knowledge base, so pairing it is
// step 3 and everything else (mission, agent naming, adapter/model choice)
// moved out of setup: the CEO's interview fills those in later.
type Step = 1 | 2 | 3;

const ONBOARDING_STORAGE_KEY = "paperclip-onboarding-state";
const DEFAULT_TASK_TITLE = "Hire your first AI employee and create the operating plan";
const DEFAULT_TASK_DESCRIPTION = `You are the CEO. The human is the board. Set the operating constraint and train the first accountable AI employee.

- define the first constraint to improve
- assign board-visible work with a clear budget cap
- create the next operating tasks and start delegating work`;

type FuelProvider = "claude_local" | "codex_local";

const FUEL_PROVIDERS: Array<{
  type: FuelProvider;
  label: string;
  subscription: string;
  installHint: string;
}> = [
  {
    type: "claude_local",
    label: "Claude Code",
    subscription: "your Claude subscription",
    installHint: "npm i -g @anthropic-ai/claude-code, then `claude login`",
  },
  {
    type: "codex_local",
    label: "Codex",
    subscription: "your ChatGPT/Codex subscription",
    installHint: "npm i -g @openai/codex, then `codex login`",
  },
];

type FuelCheck = {
  status: "idle" | "checking" | "connected" | "not_connected";
  result: AdapterEnvironmentTestResult | null;
  error: string | null;
};

const IDLE_FUEL: FuelCheck = { status: "idle", result: null, error: null };

function buildFuelAdapterConfig(
  type: FuelProvider,
  opts?: { unsetAnthropicApiKey?: boolean },
): Record<string, unknown> {
  const adapter = getUIAdapter(type);
  const config = adapter.buildAdapterConfig({
    ...defaultCreateValues,
    adapterType: type,
    model: "",
    command: "",
    args: "",
    url: "",
    dangerouslySkipPermissions: type === "claude_local",
    dangerouslyBypassSandbox:
      type === "codex_local"
        ? DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX
        : defaultCreateValues.dangerouslyBypassSandbox,
  });
  if (type === "claude_local" && opts?.unsetAnthropicApiKey) {
    const env =
      typeof config.env === "object" && config.env !== null && !Array.isArray(config.env)
        ? { ...(config.env as Record<string, unknown>) }
        : {};
    env.ANTHROPIC_API_KEY = { type: "plain", value: "" };
    config.env = env;
  }
  return config;
}

export function parseRepoName(repoUrl: string): string {
  try {
    const url = new URL(repoUrl);
    const segments = url.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1] ?? "";
    const name = last.replace(/\.git$/i, "").trim();
    return name || "Primary repo";
  } catch {
    return "Primary repo";
  }
}

export function isValidRepoUrl(repoUrl: string): boolean {
  try {
    const url = new URL(repoUrl);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function loadSavedState(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function OnboardingWizard() {
  const {
    onboardingOpen,
    onboardingOptions,
    closeOnboarding,
    onboardingRouteDismissed: routeDismissed,
    setOnboardingRouteDismissed: setRouteDismissed,
  } = useDialog();
  const { companies, setSelectedCompanyId, loading: companiesLoading } = useCompany();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { companyPrefix } = useParams<{ companyPrefix?: string }>();

  // Support opening the wizard from a route (e.g. /onboarding or an existing
  // company's "hire your first employee" entry) in addition to the dialog context.
  const routeOnboardingOptions =
    companyPrefix && companiesLoading
      ? null
      : resolveRouteOnboardingOptions({
          pathname: location.pathname,
          companyPrefix,
          companies,
        });
  const effectiveOnboardingOpen =
    onboardingOpen || (routeOnboardingOptions !== null && !routeDismissed);
  const effectiveOnboardingOptions = onboardingOpen
    ? onboardingOptions
    : routeOnboardingOptions ?? {};

  // Legacy callers pass initialStep up to 4 (the old 6-step flow); everything
  // ≥2 means "the company already exists — start at fuel".
  const initialStep: Step = (effectiveOnboardingOptions.initialStep ?? 1) >= 2 ? 2 : 1;
  const existingCompanyId = effectiveOnboardingOptions.companyId;

  const saved = useMemo(loadSavedState, []);

  const [step, setStep] = useState<Step>(() => {
    const savedStep = saved?.step;
    if (savedStep === 2 || savedStep === 3) return savedStep;
    return initialStep;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState((saved?.companyName as string) ?? "");
  const [repoUrl, setRepoUrl] = useState((saved?.repoUrl as string) ?? "");

  const [claudeFuel, setClaudeFuel] = useState<FuelCheck>(IDLE_FUEL);
  const [codexFuel, setCodexFuel] = useState<FuelCheck>(IDLE_FUEL);
  const [unsetAnthropicKey, setUnsetAnthropicKey] = useState(false);
  const probesStartedRef = useRef(false);

  const [createdCompanyId, setCreatedCompanyId] = useState<string | null>(
    existingCompanyId ?? (saved?.createdCompanyId as string) ?? null,
  );
  const [createdCompanyPrefix, setCreatedCompanyPrefix] = useState<string | null>(
    (saved?.createdCompanyPrefix as string) ?? null,
  );
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(
    (saved?.createdAgentId as string) ?? null,
  );
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(
    (saved?.createdProjectId as string) ?? null,
  );
  const [createdIssueRef, setCreatedIssueRef] = useState<string | null>(
    (saved?.createdIssueRef as string) ?? null,
  );

  // Reset the route-dismissed flag when navigating to a different path.
  useEffect(() => {
    setRouteDismissed(false);
  }, [location.pathname]);

  // Sync company when onboarding opens with explicit options.
  useEffect(() => {
    if (!effectiveOnboardingOpen) return;
    if (effectiveOnboardingOptions.companyId) {
      setCreatedCompanyId(effectiveOnboardingOptions.companyId);
      setCreatedCompanyPrefix(null);
      if (step === 1) setStep(2);
    }
  }, [effectiveOnboardingOpen, effectiveOnboardingOptions.companyId]);

  // Backfill the issue prefix for an existing company once companies load.
  useEffect(() => {
    if (!effectiveOnboardingOpen || !createdCompanyId || createdCompanyPrefix) return;
    const company = companies.find((c) => c.id === createdCompanyId);
    if (company) setCreatedCompanyPrefix(company.issuePrefix);
  }, [effectiveOnboardingOpen, createdCompanyId, createdCompanyPrefix, companies]);

  // Persist wizard state so a mid-setup reload resumes where it left off.
  useEffect(() => {
    if (!effectiveOnboardingOpen) return;
    const state = {
      step,
      companyName,
      repoUrl,
      createdCompanyId,
      createdCompanyPrefix,
      createdAgentId,
      createdProjectId,
      createdIssueRef,
    };
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
  }, [
    effectiveOnboardingOpen,
    step,
    companyName,
    repoUrl,
    createdCompanyId,
    createdCompanyPrefix,
    createdAgentId,
    createdProjectId,
    createdIssueRef,
  ]);

  async function probeFuel(type: FuelProvider, opts?: { unsetAnthropicApiKey?: boolean }) {
    if (!createdCompanyId) return;
    const setFuel = type === "claude_local" ? setClaudeFuel : setCodexFuel;
    setFuel({ status: "checking", result: null, error: null });
    try {
      const result = await agentsApi.testEnvironment(createdCompanyId, type, {
        adapterConfig: buildFuelAdapterConfig(type, opts),
      });
      // "warn" still means the CLI answered — usable fuel with caveats.
      setFuel({
        status: result.status === "fail" ? "not_connected" : "connected",
        result,
        error: null,
      });
    } catch (err) {
      setFuel({
        status: "not_connected",
        result: null,
        error: err instanceof Error ? err.message : "Fuel check failed",
      });
    }
  }

  // Auto-probe both providers when the fuel step first becomes reachable.
  useEffect(() => {
    if (!effectiveOnboardingOpen || step !== 2 || !createdCompanyId) return;
    if (probesStartedRef.current) return;
    probesStartedRef.current = true;
    void probeFuel("claude_local");
    void probeFuel("codex_local");
  }, [effectiveOnboardingOpen, step, createdCompanyId]);

  const claudeConnected = claudeFuel.status === "connected";
  const codexConnected = codexFuel.status === "connected";
  const fuelAdapter: FuelProvider | null = claudeConnected
    ? "claude_local"
    : codexConnected
      ? "codex_local"
      : null;
  const claudeHasApiKeyOverride =
    claudeFuel.result?.checks.some(
      (check) => check.code === "claude_anthropic_api_key_overrides_subscription",
    ) ?? false;

  function reset() {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    setStep(1);
    setLoading(false);
    setError(null);
    setCompanyName("");
    setRepoUrl("");
    setClaudeFuel(IDLE_FUEL);
    setCodexFuel(IDLE_FUEL);
    setUnsetAnthropicKey(false);
    probesStartedRef.current = false;
    setCreatedCompanyId(null);
    setCreatedCompanyPrefix(null);
    setCreatedAgentId(null);
    setCreatedProjectId(null);
    setCreatedIssueRef(null);
  }

  function handleClose() {
    reset();
    closeOnboarding();
    // On the /onboarding route the wizard is also kept open by the route
    // itself, so closing the dialog must mark the route dismissed — otherwise
    // effectiveOnboardingOpen stays true and the wizard re-renders instead of
    // handing off to the launcher card (PAP-52).
    setRouteDismissed(true);
  }

  // Step 1 → 2: create the company. The server seeds the local environment,
  // bundled agents, and the core-8 formation proposals on creation, so a
  // company is complete the moment it has a name.
  async function handleCreateCompany() {
    if (createdCompanyId) {
      setStep(2);
      return;
    }
    if (!companyName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const company = await companiesApi.create({ name: companyName.trim() });
      setCreatedCompanyId(company.id);
      setCreatedCompanyPrefix(company.issuePrefix);
      setSelectedCompanyId(company.id);
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create company");
    } finally {
      setLoading(false);
    }
  }

  async function hireCeoIfFueled(): Promise<string | null> {
    if (createdAgentId) return createdAgentId;
    if (!createdCompanyId || !fuelAdapter) return null;
    const hire = await agentsApi.hire(createdCompanyId, {
      name: "Chief of staff",
      role: "ceo",
      adapterType: fuelAdapter,
      adapterConfig: buildFuelAdapterConfig(fuelAdapter, {
        unsetAnthropicApiKey: fuelAdapter === "claude_local" && unsetAnthropicKey,
      }),
      runtimeConfig: buildNewAgentRuntimeConfig(),
    });
    if (hire.approval) {
      await approvalsApi.approve(hire.approval.id, "Approved during onboarding first-agent setup.");
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(createdCompanyId) });
    }
    const agent = hire.agent;
    setCreatedAgentId(agent.id);
    queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(createdCompanyId) });

    // Seed the CEO's instructions file with company context. Non-fatal on
    // failure — the agent still functions with adapter defaults.
    try {
      const bundle = await agentsApi.instructionsBundle(agent.id, createdCompanyId);
      await agentsApi.saveInstructionsFile(
        agent.id,
        {
          path: bundle.entryFile,
          content: composeCeoInstructions({
            companyName,
            companyGoal: "",
            growPath: false,
            growWorkflows: "",
            growPainPoints: "",
            growAutomate: "",
            q1: "",
            q2: "",
            q3: "",
            q4: "",
          }),
        },
        createdCompanyId,
      );
    } catch (err) {
      console.warn("Failed to seed CEO instructions:", err);
    }
    return agent.id;
  }

  // Finish: hire the CEO when fuel is connected, pair the repo when one was
  // pasted, file the first board-visible task, and open the dashboard.
  // Skipping fuel or repo still yields a complete company — never a
  // half-created state.
  async function handleFinish(opts?: { skipRepo?: boolean }) {
    if (!createdCompanyId) return;
    const pairRepo = !opts?.skipRepo && repoUrl.trim().length > 0;
    if (pairRepo && !isValidRepoUrl(repoUrl.trim())) {
      setError("Repo URL must be a full https:// link, e.g. https://github.com/you/repo");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const agentId = await hireCeoIfFueled();

      let projectId = createdProjectId;
      if (!projectId && pairRepo) {
        const trimmedUrl = repoUrl.trim();
        const repoName = parseRepoName(trimmedUrl);
        const project = await projectsApi.create(createdCompanyId, {
          name: repoName,
          status: "in_progress",
          ...(agentId ? { leadAgentId: agentId } : {}),
          workspace: {
            name: repoName,
            sourceType: "git_repo",
            repoUrl: trimmedUrl,
            defaultRef: "main",
            isPrimary: true,
          },
        });
        projectId = project.id;
        setCreatedProjectId(projectId);
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.list(createdCompanyId) });
      } else if (!projectId && agentId) {
        const projects = await projectsApi.list(createdCompanyId);
        const existing = selectReusableOnboardingProject(projects);
        if (existing) {
          projectId = existing.id;
        } else {
          const project = await projectsApi.create(
            createdCompanyId,
            buildOnboardingProjectPayload(null),
          );
          projectId = project.id;
          queryClient.invalidateQueries({ queryKey: queryKeys.projects.list(createdCompanyId) });
        }
        setCreatedProjectId(projectId);
      }

      if (agentId && !createdIssueRef) {
        // The first task is the operating plan — it doesn't need the repo.
        // A repo paired by URL has no local clone yet, and the run policy
        // refuses to launch a project-linked task outside its project
        // workspace ("expected a project workspace" — verified live). So a
        // repo-paired company files the first task WITHOUT the project link;
        // repo-linked work starts once the workspace has a clone (SUM-129).
        const issue = await issuesApi.create(createdCompanyId, {
          title: DEFAULT_TASK_TITLE,
          description: DEFAULT_TASK_DESCRIPTION,
          assigneeAgentId: agentId,
          ...(pairRepo || !projectId ? {} : { projectId }),
          status: "todo" as const,
        });
        setCreatedIssueRef(issue.identifier ?? issue.id);
        queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(createdCompanyId) });
      }

      const prefix = createdCompanyPrefix;
      setSelectedCompanyId(createdCompanyId);
      reset();
      closeOnboarding();
      setRouteDismissed(true);
      navigate(prefix ? `/${prefix}/dashboard` : "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to finish setup");
    } finally {
      setLoading(false);
    }
  }

  // "Skip setup": the company already exists with its core-8 proposals —
  // just open the dashboard.
  function handleSkipSetup() {
    if (!createdCompanyId) return;
    const prefix = createdCompanyPrefix;
    setSelectedCompanyId(createdCompanyId);
    reset();
    closeOnboarding();
    setRouteDismissed(true);
    navigate(prefix ? `/${prefix}/dashboard` : "/dashboard");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (step === 1 && companyName.trim()) void handleCreateCompany();
      else if (step === 2) setStep(3);
      else if (step === 3) void handleFinish();
    }
  }

  if (!effectiveOnboardingOpen) return null;

  const renderedStep: Step = createdCompanyId ? step : 1;

  return (
    <Dialog
      open={effectiveOnboardingOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogPortal>
        {/* Plain div instead of DialogOverlay — Radix's overlay wraps in
            RemoveScroll which blocks wheel events on our custom (non-DialogContent)
            scroll container. A plain div preserves the background without scroll-locking. */}
        <div className="fixed inset-0 z-50 bg-background" />
        <div className="fixed inset-0 z-50 flex" onKeyDown={handleKeyDown}>
          <button
            onClick={handleClose}
            className="absolute top-4 left-4 z-10 rounded-sm p-1.5 text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </button>

          <div className="w-full flex flex-col overflow-y-auto">
            <div className="w-full max-w-md mx-auto my-auto px-8 py-12 shrink-0">
              {/* 3-segment progress bar — completed segments jump back. */}
              <div className="flex items-center gap-1.5 mb-8">
                {([1, 2, 3] as const).map((s) => {
                  const filled = renderedStep >= s;
                  const canJump = s < renderedStep && s > 1;
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-label={`Step ${s}`}
                      aria-current={s === renderedStep ? "step" : undefined}
                      disabled={!canJump}
                      onClick={() => canJump && setStep(s)}
                      className={cn(
                        "h-1 flex-1 rounded-full transition-colors",
                        filled ? "bg-foreground" : "bg-muted",
                        canJump ? "cursor-pointer" : "cursor-default",
                      )}
                    />
                  );
                })}
              </div>

              {/* Step 1: Name the company — the only required input. */}
              {renderedStep === 1 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="bg-muted/50 p-2">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-medium">Name the company</h3>
                      <p className="text-xs text-muted-foreground">
                        The only thing {APP_DISPLAY_NAME} needs to get started. It arrives
                        with the standard eight departments; your CEO fills in the rest.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 group">
                    <label
                      className={cn(
                        "text-xs mb-1 block transition-colors",
                        companyName.trim()
                          ? "text-foreground"
                          : "text-muted-foreground group-focus-within:text-foreground",
                      )}
                    >
                      Company name
                    </label>
                    <input
                      className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                      placeholder="Acme Corp"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && companyName.trim()) {
                          e.preventDefault();
                          void handleCreateCompany();
                        }
                      }}
                      autoFocus
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Connect your fuel — the customer's own subscriptions. */}
              {renderedStep === 2 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="bg-muted/50 p-2">
                      <Fuel className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-medium">Connect your fuel</h3>
                      <p className="text-xs text-muted-foreground">
                        AI employees run on your own Claude or Codex subscription — the
                        same one you already use. No API keys.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {FUEL_PROVIDERS.map(({ type, label, subscription, installHint }) => {
                      const fuel = type === "claude_local" ? claudeFuel : codexFuel;
                      return (
                        <div key={type} className="rounded-md border border-border px-3 py-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{label}</p>
                              <p className="text-(length:--text-micro) text-muted-foreground truncate">
                                {fuel.status === "connected"
                                  ? `Connected via ${subscription}`
                                  : fuel.status === "checking"
                                    ? "Checking…"
                                    : `Not connected — install: ${installHint}`}
                              </p>
                            </div>
                            {fuel.status === "checking" ? (
                              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                            ) : fuel.status === "connected" ? (
                              <span className="flex items-center gap-1 shrink-0 text-xs font-medium text-green-600 dark:text-green-400">
                                <Check className="h-3.5 w-3.5" />
                                Connected
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2.5 text-xs shrink-0"
                                onClick={() => void probeFuel(type)}
                              >
                                <RefreshCw className="h-3 w-3 mr-1" />
                                Retry
                              </Button>
                            )}
                          </div>
                          {fuel.status === "not_connected" && fuel.error && (
                            <p className="mt-1.5 text-(length:--text-micro) text-muted-foreground break-words">
                              {fuel.error}
                            </p>
                          )}
                          {type === "claude_local" &&
                            fuel.status === "not_connected" &&
                            claudeHasApiKeyOverride && (
                              <div className="mt-2 rounded-md border border-amber-300/60 bg-amber-50/40 px-2.5 py-2 space-y-1.5">
                                <p className="text-(length:--text-micro) text-amber-900/90 leading-relaxed">
                                  Claude failed while <span className="font-mono">ANTHROPIC_API_KEY</span>{" "}
                                  is set — the key overrides your subscription login.
                                </p>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2.5 text-xs"
                                  onClick={() => {
                                    setUnsetAnthropicKey(true);
                                    void probeFuel("claude_local", { unsetAnthropicApiKey: true });
                                  }}
                                >
                                  Retry without the API key
                                </Button>
                              </div>
                            )}
                        </div>
                      );
                    })}
                  </div>

                  {!claudeConnected &&
                    !codexConnected &&
                    claudeFuel.status !== "checking" &&
                    codexFuel.status !== "checking" &&
                    claudeFuel.status !== "idle" && (
                      <p className="text-(length:--text-micro) text-amber-700 dark:text-amber-400">
                        No fuel connected yet. The company still gets created — employees
                        just can't run until one of these turns green.
                      </p>
                    )}
                </div>
              )}

              {/* Step 3: Pair the work — the repo is the knowledge base. */}
              {renderedStep === 3 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="bg-muted/50 p-2">
                      <Github className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-medium">Pair the work</h3>
                      <p className="text-xs text-muted-foreground">
                        Paste a GitHub repo and it becomes the company's primary
                        workspace — where your AI employees read and write.
                      </p>
                    </div>
                  </div>
                  <div className="group">
                    <label
                      className={cn(
                        "text-xs mb-1 block transition-colors",
                        repoUrl.trim()
                          ? "text-foreground"
                          : "text-muted-foreground group-focus-within:text-foreground",
                      )}
                    >
                      Repo URL
                    </label>
                    <input
                      className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm font-mono outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                      placeholder="https://github.com/you/repo"
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void handleFinish();
                        }
                      }}
                      autoFocus
                    />
                    <p className="mt-1.5 text-(length:--text-micro) text-muted-foreground">
                      Whole-org pairing (pick several repos at once) needs GitHub sign-in
                      and ships later — pasting any repo URL works today.
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-3">
                  <p className="text-xs text-destructive">{error}</p>
                </div>
              )}

              {/* Footer navigation — one primary action per step. */}
              <div className="flex items-center justify-between mt-8">
                <div>
                  {renderedStep === 3 && (
                    <Button variant="ghost" size="sm" onClick={() => setStep(2)} disabled={loading}>
                      <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                      Back
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {renderedStep === 1 && (
                    <Button
                      size="sm"
                      disabled={!companyName.trim() || loading}
                      onClick={() => void handleCreateCompany()}
                    >
                      {loading ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      ) : (
                        <ArrowRight className="h-3.5 w-3.5 mr-1" />
                      )}
                      {loading ? "Creating…" : "Create company"}
                    </Button>
                  )}
                  {renderedStep === 2 && (
                    <>
                      <Button variant="ghost" size="sm" onClick={handleSkipSetup} disabled={loading}>
                        Skip setup
                      </Button>
                      <Button size="sm" onClick={() => setStep(3)} disabled={loading}>
                        Continue
                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </>
                  )}
                  {renderedStep === 3 && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleFinish({ skipRepo: true })}
                        disabled={loading}
                      >
                        Finish without a repo
                      </Button>
                      <Button size="sm" onClick={() => void handleFinish()} disabled={loading}>
                        {loading ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        ) : (
                          <ArrowRight className="h-3.5 w-3.5 mr-1" />
                        )}
                        {loading ? "Finishing…" : "Finish setup"}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogPortal>
    </Dialog>
  );
}
