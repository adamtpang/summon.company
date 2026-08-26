import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@/lib/router";
import { AGENT_ROLE_LABELS, type Agent, type AgentRole, type AgentRuntimeState } from "@paperclipai/shared";
import { agentsApi } from "../api/agents";
import { issuesApi } from "../api/issues";
import { projectsApi } from "../api/projects";
import { useCompany } from "../context/CompanyContext";
import { getAdapterLabel } from "../adapters/adapter-display-registry";
import { queryKeys } from "../lib/queryKeys";
import { AgentStatusBadge } from "./StatusBadge";
import { Identity } from "./Identity";
import { formatDate, agentUrl } from "../lib/utils";
import { Separator } from "@/components/ui/separator";
import { PersonaPicker, personaMonogram } from "./PersonaPicker";
import {
  type DepartmentKey,
  type Persona,
  defaultPersonaFor,
  personaBySlug,
} from "../lib/personas";
import { reachedRoadmapSequence } from "../lib/persona-unlock";
import { buildRoadmapStages } from "../pages/Roadmap";

interface AgentPropertiesProps {
  agent: Agent;
  runtimeState?: AgentRuntimeState;
}

const roleLabels = AGENT_ROLE_LABELS as Record<string, string>;

/**
 * Best-effort map from an agent's functional role to the persona department whose
 * roster opens first in the picker (SUM-196). The deck browses every department, so
 * this only chooses the opening tab.
 */
const ROLE_TO_DEPARTMENT: Partial<Record<AgentRole, DepartmentKey>> = {
  ceo: "operations",
  cto: "engineering",
  engineer: "engineering",
  devops: "engineering",
  qa: "engineering",
  designer: "design",
  cmo: "marketing",
  cfo: "finance",
  security: "legal",
};

/** Read the persona slug an agent currently embodies, if any. */
function personaSlugOf(agent: Agent): string | null {
  const raw = (agent.metadata as Record<string, unknown> | null)?.persona;
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className="text-xs text-muted-foreground shrink-0 w-20 mt-0.5">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">{children}</div>
    </div>
  );
}

export function AgentProperties({ agent, runtimeState }: AgentPropertiesProps) {
  const { selectedCompanyId } = useCompany();
  const lastErrorIsActive = agent.status === "error";

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId && !!agent.reportsTo,
  });

  const reportsToAgent = agent.reportsTo ? agents?.find((a) => a.id === agent.reportsTo) : null;

  // Roadmap evidence drives persona unlocks (board reshape: unlockable characters).
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
  const { data: rosterAgents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const reachedStageSequence = useMemo(() => {
    const stages = buildRoadmapStages({
      agents: rosterAgents ?? agents ?? [],
      issues: issues ?? [],
      projects: projects ?? [],
      goals: [],
    });
    return reachedRoadmapSequence(stages);
  }, [rosterAgents, agents, issues, projects]);

  const currentSlug = personaSlugOf(agent);
  const currentPersona = currentSlug ? personaBySlug(currentSlug) : undefined;
  const seatDepartment: DepartmentKey =
    currentPersona?.department ?? ROLE_TO_DEPARTMENT[agent.role] ?? "engineering";
  const displayPersona = currentPersona ?? defaultPersonaFor(seatDepartment);

  const queryClient = useQueryClient();
  const setPersona = useMutation({
    mutationFn: (persona: Persona) =>
      agentsApi.update(
        agent.id,
        { metadata: { ...(agent.metadata ?? {}), persona: persona.slug } },
        selectedCompanyId ?? undefined,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agent.id) });
      if (selectedCompanyId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(selectedCompanyId) });
      }
    },
  });

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <PropertyRow label="Status">
          <AgentStatusBadge status={agent.status} />
        </PropertyRow>
        {lastErrorIsActive && agent.errorReason && (
          <PropertyRow label="Error reason">
            <span className="text-xs text-red-600 dark:text-red-400 break-words min-w-0">
              {agent.errorReason}
            </span>
          </PropertyRow>
        )}
        <PropertyRow label="Role">
          <span className="text-sm">{roleLabels[agent.role] ?? agent.role}</span>
        </PropertyRow>
        {agent.title && (
          <PropertyRow label="Title">
            <span className="text-sm">{agent.title}</span>
          </PropertyRow>
        )}
        <PropertyRow label="Persona">
          <PersonaPicker
            value={currentSlug}
            department={seatDepartment}
            agentName={agent.name}
            reachedStageSequence={reachedStageSequence}
            onChange={(persona) => setPersona.mutate(persona)}
          >
            <button
              type="button"
              disabled={setPersona.isPending}
              aria-label={
                displayPersona
                  ? `Persona: ${displayPersona.archetype}. Choose or swap.`
                  : "Choose a persona"
              }
              className="group inline-flex items-center gap-1.5 rounded-md py-0.5 pr-1.5 pl-0.5 text-sm hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
            >
              {displayPersona ? (
                <>
                  <span
                    aria-hidden
                    className="flex h-5 w-5 items-center justify-center rounded-sm bg-primary/[0.07] text-[10px] font-semibold tracking-tight text-primary/80"
                  >
                    {personaMonogram(displayPersona.archetype)}
                  </span>
                  <span>{displayPersona.archetype}</span>
                  {!currentPersona ? (
                    <span className="text-xs text-muted-foreground">(default)</span>
                  ) : null}
                </>
              ) : (
                <span className="text-muted-foreground">Choose persona</span>
              )}
              <span className="text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                Swap
              </span>
            </button>
          </PersonaPicker>
        </PropertyRow>
        <PropertyRow label="Adapter">
          <span className="text-sm font-mono">{getAdapterLabel(agent.adapterType)}</span>
        </PropertyRow>
      </div>

      <Separator />

      <div className="space-y-1">
        {(runtimeState?.sessionDisplayId ?? runtimeState?.sessionId) && (
          <PropertyRow label="Session">
            <span className="text-xs font-mono">
              {String(runtimeState.sessionDisplayId ?? runtimeState.sessionId).slice(0, 12)}...
            </span>
          </PropertyRow>
        )}
        {runtimeState?.lastError && (
          <PropertyRow label={lastErrorIsActive ? "Last error" : "Last run error"}>
            <span
              className={
                lastErrorIsActive
                  ? "text-xs text-red-600 dark:text-red-400 break-words min-w-0"
                  : "text-xs text-muted-foreground break-words min-w-0"
              }
            >
              {runtimeState.lastError}
            </span>
          </PropertyRow>
        )}
        {agent.lastHeartbeatAt && (
          <PropertyRow label="Last Heartbeat">
            <span className="text-sm">{formatDate(agent.lastHeartbeatAt)}</span>
          </PropertyRow>
        )}
        {agent.reportsTo && (
          <PropertyRow label="Reports To">
            {reportsToAgent ? (
              <Link to={agentUrl(reportsToAgent)} className="hover:underline">
                <Identity name={reportsToAgent.name} size="sm" />
              </Link>
            ) : (
              <span className="text-sm font-mono">{agent.reportsTo.slice(0, 8)}</span>
            )}
          </PropertyRow>
        )}
        <PropertyRow label="Created">
          <span className="text-sm">{formatDate(agent.createdAt)}</span>
        </PropertyRow>
      </div>
    </div>
  );
}
