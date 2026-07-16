import { useMemo, useState } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Bot, RefreshCw } from "lucide-react";
import { agentsApi } from "../api/agents";
import { issuesApi } from "../api/issues";
import { useCompany } from "../context/CompanyContext";
import { useDialogActions } from "../context/DialogContext";
import { useOptionalToastActions } from "../context/ToastContext";
import { useNavigate } from "../lib/router";
import {
  buildRoster,
  dispatchIssueTitle,
  type RoutingDecision,
} from "../lib/globalComposer";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { GlobalComposer } from "./GlobalComposer";

interface GlobalComposerDockProps {
  mobile?: boolean;
  className?: string;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Summon could not file this request. Try again.";
}

function dispatchFeedback(status: string): { tone: "success" | "warn"; body: string } {
  if (status === "paused") {
    return {
      tone: "warn",
      body: "The task is filed, but this employee is paused. Open the thread to resume or reassign it.",
    };
  }
  if (status === "error") {
    return {
      tone: "warn",
      body: "The task is filed. This employee needs recovery before the run can start.",
    };
  }
  return {
    tone: "success",
    body: "Opening the task thread. The assigned employee's live run will stream there.",
  };
}

export function GlobalComposerDock({ mobile = false, className }: GlobalComposerDockProps) {
  const {
    companies,
    loading: companiesLoading,
    selectedCompanyId,
    setSelectedCompanyId,
  } = useCompany();
  const { openNewAgent } = useDialogActions();
  const toastActions = useOptionalToastActions();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<{ companyId: string; agentId: string | null } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  const activeCompanies = useMemo(
    () => companies.filter((company) => company.status !== "archived"),
    [companies],
  );
  const agentQueries = useQueries({
    queries: activeCompanies.map((company) => ({
      queryKey: queryKeys.agents.list(company.id),
      queryFn: () => agentsApi.list(company.id),
      staleTime: 30_000,
    })),
  });
  const agentsByCompanyId = useMemo(
    () => Object.fromEntries(
      activeCompanies.map((company, index) => [company.id, agentQueries[index]?.data]),
    ),
    [activeCompanies, agentQueries],
  );
  const roster = useMemo(
    () => buildRoster(activeCompanies, agentsByCompanyId),
    [activeCompanies, agentsByCompanyId],
  );
  const loading = companiesLoading || agentQueries.some((query) => query.isLoading);
  const rosterError = agentQueries.find((query) => query.error)?.error ?? null;
  const employeeCount = roster.reduce((total, company) => total + company.agents.length, 0);

  async function handleDispatch(decision: RoutingDecision): Promise<boolean> {
    setDispatchError(null);
    const company = activeCompanies.find((candidate) => candidate.id === decision.companyId) ?? null;
    const employee = decision.agent ?? decision.ceo;
    if (!company || !employee) {
      setDispatchError("This company has no assignable CEO. Hire or approve one, then try again.");
      return false;
    }

    setSubmitting(true);
    try {
      const issue = await issuesApi.create(company.id, {
        title: dispatchIssueTitle(decision.message),
        description: decision.message.trim(),
        assigneeAgentId: employee.id,
      });
      const issueRef = issue.identifier ?? issue.id;
      const href = `/${company.issuePrefix}/issues/${issueRef}`;
      const feedback = dispatchFeedback(employee.status);

      await queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(company.id) });
      setScope({ companyId: company.id, agentId: employee.id });
      setSelectedCompanyId(company.id, { source: "manual" });
      toastActions?.pushToast({
        title: `${issueRef} assigned to ${employee.name}`,
        body: feedback.body,
        tone: feedback.tone,
        action: { label: "Open thread", href },
      });
      navigate(href);
      return true;
    } catch (error) {
      setDispatchError(errorMessage(error));
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  const shellClassName = cn(
    "border-t border-border bg-background/95 px-4 py-3 backdrop-blur",
    mobile && "fixed inset-x-0 bottom-(--sz-calc-14) z-30",
    className,
  );

  if (loading) {
    return (
      <div aria-label="Loading company roster" className={shellClassName}>
        <div className="mx-auto max-w-3xl space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (rosterError) {
    return (
      <div className={shellClassName}>
        <div className="mx-auto flex max-w-3xl items-center gap-3" role="alert">
          <AlertCircle className="size-4 shrink-0 text-destructive" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm">
            Could not load the employee roster. {errorMessage(rosterError)}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void Promise.all(agentQueries.map((query) => query.refetch()))}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (employeeCount === 0) {
    return (
      <div className={shellClassName}>
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Bot className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm">Hire an employee before dispatching work.</p>
          <Button type="button" size="sm" variant="outline" onClick={openNewAgent}>
            Hire employee
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={shellClassName}>
      <GlobalComposer
        roster={roster}
        scopedCompanyId={scope?.companyId ?? selectedCompanyId}
        scopedAgentId={scope?.agentId ?? null}
        onScopeChange={(companyId, agentId) => setScope({ companyId, agentId })}
        onDispatch={handleDispatch}
        submitting={submitting}
        error={dispatchError}
        className="mx-auto max-w-3xl"
      />
    </div>
  );
}
