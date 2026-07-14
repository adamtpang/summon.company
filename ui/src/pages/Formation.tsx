import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Agent } from "@paperclipai/shared";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BriefcaseBusiness,
  CircleDashed,
  Code2,
  Gauge,
  Hammer,
  Handshake,
  Headphones,
  Landmark,
  Megaphone,
  Palette,
  Scale,
  TrendingUp,
  UserPlus,
  UsersRound,
  Workflow,
} from "lucide-react";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { agentsApi } from "../api/agents";
import { AgentStatusCapsule } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { cn, agentUrl, formatCents } from "../lib/utils";
import { queryKeys } from "../lib/queryKeys";

type DepartmentId =
  | "engineering"
  | "design"
  | "marketing"
  | "sales"
  | "finance"
  | "operations"
  | "support"
  | "legal";

type DepartmentDefinition = {
  id: DepartmentId;
  name: string;
  hero: string;
  mode: string;
  owns: string;
  icon: LucideIcon;
  modeIcon: LucideIcon;
  aliases: readonly string[];
  roles: readonly string[];
  position: string;
};

export type FormationAssignment = {
  department: DepartmentDefinition;
  agent: Agent | null;
  utilization: number;
  constraintScore: number;
  constraintReason: string;
};

export const VITALS_DEPARTMENTS: readonly DepartmentDefinition[] = [
  {
    id: "engineering",
    name: "Engineering",
    hero: "Elon Musk",
    mode: "Builds",
    owns: "App, auth, billing infrastructure, monitoring, and integrations",
    icon: Code2,
    modeIcon: Hammer,
    aliases: ["engineering", "engineer", "software", "developer", "technical"],
    roles: ["engineer", "cto", "devops"],
    position: "md:col-start-3 md:row-start-2",
  },
  {
    id: "design",
    name: "Design",
    hero: "Jony Ive",
    mode: "Builds",
    owns: "Brand identity, product experience, and the marketing website",
    icon: Palette,
    modeIcon: Hammer,
    aliases: ["design", "designer", "brand", "ux", "ui"],
    roles: ["designer"],
    position: "md:col-start-1 md:row-start-2",
  },
  {
    id: "marketing",
    name: "Marketing",
    hero: "Alex Hormozi",
    mode: "Sells",
    owns: "Positioning, content, social, SEO, paid acquisition, and referrals",
    icon: Megaphone,
    modeIcon: TrendingUp,
    aliases: ["marketing", "marketer", "growth", "content", "acquisition"],
    roles: ["cmo"],
    position: "md:col-start-1 md:row-start-1",
  },
  {
    id: "sales",
    name: "Sales",
    hero: "Ryan Serhant",
    mode: "Sells",
    owns: "Prospecting, outbound, qualification, pipeline, and closing",
    icon: Handshake,
    modeIcon: TrendingUp,
    aliases: ["sales", "seller", "revenue", "outbound", "business development"],
    roles: [],
    position: "md:col-start-3 md:row-start-1",
  },
  {
    id: "finance",
    name: "Finance",
    hero: "John D. Rockefeller",
    mode: "Runs",
    owns: "Cash, banking, bookkeeping, budgets, billing, and runway",
    icon: Landmark,
    modeIcon: Gauge,
    aliases: ["finance", "financial", "accounting", "bookkeeping", "cash"],
    roles: ["cfo"],
    position: "md:col-start-3 md:row-start-3",
  },
  {
    id: "operations",
    name: "Operations",
    hero: "Jeff Bezos",
    mode: "Runs",
    owns: "Company setup, process, domains, repositories, and operating cadence",
    icon: Workflow,
    modeIcon: Gauge,
    aliases: ["operations", "operator", "ops", "process", "program manager"],
    roles: ["pm"],
    position: "md:col-start-2 md:row-start-3",
  },
  {
    id: "support",
    name: "Support",
    hero: "Tony Hsieh",
    mode: "Runs and sells",
    owns: "Onboarding, community, customer support, and customer feedback",
    icon: Headphones,
    modeIcon: Activity,
    aliases: ["support", "customer success", "community", "onboarding", "service"],
    roles: [],
    position: "md:col-start-1 md:row-start-3",
  },
  {
    id: "legal",
    name: "Legal",
    hero: "Open summon",
    mode: "Runs",
    owns: "Incorporation, contracts, compliance, privacy, and risk",
    icon: Scale,
    modeIcon: Gauge,
    aliases: ["legal", "lawyer", "counsel", "compliance", "contracts"],
    roles: [],
    position: "md:col-start-2 md:row-start-4",
  },
] as const;

function normalize(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function metadataDepartment(agent: Agent): string {
  return normalize(agent.metadata?.department ?? agent.metadata?.team ?? agent.metadata?.function);
}

function aliasScore(value: string, aliases: readonly string[], score: number): number {
  if (!value) return 0;
  const words = value.split(/[^a-z0-9]+/).filter(Boolean);
  return aliases.reduce((best, alias) => {
    if (value === alias) return Math.max(best, score + 10);
    if (alias.length <= 3 ? words.includes(alias) : value.includes(alias)) return Math.max(best, score);
    return best;
  }, 0);
}

function departmentMatchScore(agent: Agent, department: DepartmentDefinition): number {
  if (agent.status === "terminated") return 0;

  const metadata = metadataDepartment(agent);
  if (metadata === department.id || department.aliases.includes(metadata)) return 120;

  return Math.max(
    aliasScore(normalize(agent.title), department.aliases, 90),
    aliasScore(normalize(agent.name), department.aliases, 80),
    aliasScore(normalize(agent.capabilities), department.aliases, 50),
    department.roles.includes(agent.role) ? 70 : 0,
  );
}

function budgetUtilization(agent: Agent): number {
  if (agent.budgetMonthlyCents <= 0) return 0;
  return Math.round((agent.spentMonthlyCents / agent.budgetMonthlyCents) * 100);
}

function constraintFor(agent: Agent | null, utilization: number): Pick<FormationAssignment, "constraintScore" | "constraintReason"> {
  if (!agent) {
    return { constraintScore: 100, constraintReason: "No agent owns this department yet." };
  }
  if (agent.status === "error") {
    return { constraintScore: 98, constraintReason: "The department agent is blocked by a runtime error." };
  }
  if (utilization >= 100) {
    return { constraintScore: 94, constraintReason: "Monthly agent spend has reached its budget cap." };
  }
  if (agent.status === "paused") {
    return { constraintScore: 88, constraintReason: "The department agent is paused and cannot accept work." };
  }
  if (utilization >= 85) {
    return { constraintScore: 76, constraintReason: "Monthly agent spend is approaching its budget cap." };
  }
  if (agent.status === "idle" || agent.status === "active") {
    return { constraintScore: 45 + Math.min(utilization, 40), constraintReason: "This department has the most available execution capacity." };
  }
  return { constraintScore: 20 + Math.min(utilization, 60), constraintReason: "This department carries the highest current operating load." };
}

export function buildFormationAssignments(agents: Agent[]): FormationAssignment[] {
  const available = agents.filter((agent) => agent.role !== "ceo" && agent.status !== "terminated");
  const assigned = new Set<string>();

  return VITALS_DEPARTMENTS.map((department) => {
    const match = available
      .filter((agent) => !assigned.has(agent.id))
      .map((agent) => ({ agent, score: departmentMatchScore(agent, department) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.agent.name.localeCompare(b.agent.name))[0]?.agent ?? null;

    if (match) assigned.add(match.id);
    const utilization = match ? budgetUtilization(match) : 0;
    return {
      department,
      agent: match,
      utilization,
      ...constraintFor(match, utilization),
    };
  });
}

export function selectFormationConstraint(assignments: FormationAssignment[]): FormationAssignment | null {
  return assignments.reduce<FormationAssignment | null>((current, assignment) => {
    if (!current || assignment.constraintScore > current.constraintScore) return assignment;
    return current;
  }, null);
}

function FormationSkeleton() {
  return (
    <div className="space-y-5 motion-safe:animate-pulse" aria-label="Loading formation">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="grid grid-cols-2 gap-3 border-y border-border py-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-12" />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="grid gap-3 md:grid-cols-3 lg:col-span-8">
          {Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-32" />)}
        </div>
        <Skeleton className="h-80 lg:col-span-4" />
      </div>
    </div>
  );
}

function DepartmentPosition({ assignment, isConstraint }: { assignment: FormationAssignment; isConstraint: boolean }) {
  const { department, agent, utilization } = assignment;
  const DepartmentIcon = department.icon;
  const ModeIcon = department.modeIcon;
  const destination = agent ? agentUrl(agent) : `/agents/new?department=${department.id}`;
  const status = !agent ? "open" : utilization >= 100 ? "over budget" : agent.status;

  return (
    <Link
      to={destination}
      aria-label={`${department.name}: ${agent ? agent.name : "unstaffed"}`}
      className={cn(
        "group flex min-h-32 flex-col justify-between rounded-lg border bg-card p-4 text-left transition-(--tp-color-background-color-border-color-box-shadow-opacity)",
        "hover:border-foreground/30 hover:bg-accent/40 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        department.position,
        isConstraint && "border-primary bg-primary/5",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <DepartmentIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate text-sm font-semibold">{department.name}</span>
        </div>
        {agent ? (
          <AgentStatusCapsule status={utilization >= 100 ? "error" : agent.status} />
        ) : (
          <CircleDashed className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 space-y-1">
        <p className="truncate text-sm text-foreground">{agent?.name ?? "Unstaffed"}</p>
        <p className="truncate text-xs text-muted-foreground">Guide: {department.hero}</p>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <ModeIcon className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{department.mode}</span>
        </span>
        <span className="shrink-0 font-mono">{status}</span>
      </div>
    </Link>
  );
}

function Scoreboard({ agents, assignments }: { agents: Agent[]; assignments: FormationAssignment[] }) {
  const activeAgents = agents.filter((agent) => !["paused", "error", "terminated"].includes(agent.status)).length;
  const spend = agents.reduce((total, agent) => total + agent.spentMonthlyCents, 0);
  const budget = agents.reduce((total, agent) => total + agent.budgetMonthlyCents, 0);
  const staffed = assignments.filter((assignment) => assignment.agent).length;
  const metrics = [
    { label: "Active agents", value: String(activeAgents) },
    { label: "Monthly spend", value: formatCents(spend) },
    { label: "Budget remaining", value: formatCents(Math.max(0, budget - spend)) },
    { label: "Departments staffed", value: `${staffed} / ${VITALS_DEPARTMENTS.length}` },
  ];

  return (
    <dl className="grid grid-cols-2 border-y border-border lg:grid-cols-4">
      {metrics.map((metric) => (
        <div key={metric.label} className="py-3 pr-4 lg:border-r lg:border-border lg:px-4 lg:first:pl-0 lg:last:border-r-0">
          <dt className="text-xs text-muted-foreground">{metric.label}</dt>
          <dd className="mt-1 font-mono text-base font-semibold tabular-nums">{metric.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Formation() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const agentsQuery = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Formation" }]);
  }, [setBreadcrumbs]);

  const activeAgents = useMemo(
    () => (agentsQuery.data ?? []).filter((agent) => agent.status !== "terminated"),
    [agentsQuery.data],
  );
  const assignments = useMemo(() => buildFormationAssignments(activeAgents), [activeAgents]);
  const constraint = useMemo(() => selectFormationConstraint(assignments), [assignments]);
  const chief = activeAgents.find((agent) => agent.role === "ceo") ?? null;

  if (!selectedCompanyId) {
    return <EmptyState icon={UsersRound} title="No company selected" message="Select a company to view its operating formation." />;
  }

  if (agentsQuery.isLoading) return <FormationSkeleton />;

  if (agentsQuery.isError) {
    return (
      <div className="flex min-h-72 flex-col items-start justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-6">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="size-5" aria-hidden="true" />
          <h1 className="text-base font-semibold">Could not load the formation</h1>
        </div>
        <p className="max-w-prose text-sm text-muted-foreground">The agent roster did not load. Retry without leaving this page.</p>
        <Button variant="outline" onClick={() => agentsQuery.refetch()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Company formation</h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            {selectedCompany?.name ?? "This company"} runs through eight departments. Staff the open positions, then dispatch the constraint.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/org">
            <UsersRound aria-hidden="true" />
            Org chart
          </Link>
        </Button>
      </header>

      <Scoreboard agents={activeAgents} assignments={assignments} />

      <div className="grid gap-6 lg:grid-cols-12">
        <section className="space-y-4 lg:col-span-8" aria-labelledby="formation-field-title">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 id="formation-field-title" className="text-base font-semibold">Operating field</h2>
              <p className="text-xs text-muted-foreground">Build, sell, and run as one system.</p>
            </div>
            <span className="text-xs text-muted-foreground">One constraint at a time</span>
          </div>

          <div className="rounded-lg bg-muted/30 p-3 sm:p-4">
            <div className="mx-auto mb-4 max-w-sm rounded-lg border border-border bg-background p-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
                  <BriefcaseBusiness className="size-5 text-muted-foreground" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Board and CEO agent</p>
                  {chief ? (
                    <Link className="block truncate text-sm font-semibold hover:underline focus-visible:ring-2 focus-visible:ring-ring" to={agentUrl(chief)}>
                      {chief.name}
                    </Link>
                  ) : (
                    <Link className="text-sm font-semibold hover:underline focus-visible:ring-2 focus-visible:ring-ring" to="/agents/new?role=ceo">
                      Staff the orchestrator
                    </Link>
                  )}
                </div>
                {chief ? <AgentStatusCapsule status={chief.status} /> : <CircleDashed className="size-4 text-muted-foreground" aria-hidden="true" />}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3 md:grid-rows-4" aria-label="Eight department formation">
              {assignments.map((assignment) => (
                <DepartmentPosition
                  key={assignment.department.id}
                  assignment={assignment}
                  isConstraint={assignment.department.id === constraint?.department.id}
                />
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-5 lg:col-span-4 lg:border-l lg:border-border lg:pl-6" aria-labelledby="constraint-title">
          <div className="space-y-1">
            <p className="text-xs font-medium text-primary">One constraint</p>
            <h2 id="constraint-title" className="text-xl font-semibold">{constraint?.department.name ?? "Formation ready"}</h2>
            <p className="text-sm text-muted-foreground">{constraint?.constraintReason ?? "No constraint detected."}</p>
          </div>

          {constraint ? (
            <div className="space-y-4">
              <div className="border-y border-border py-4">
                <dl className="space-y-3 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-muted-foreground">Guide</dt>
                    <dd className="text-right font-medium">{constraint.department.hero}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-muted-foreground">Owner</dt>
                    <dd className="text-right font-medium">{constraint.agent?.name ?? "Open position"}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-muted-foreground">Budget load</dt>
                    <dd className="font-mono text-right font-medium tabular-nums">{constraint.agent ? `${constraint.utilization}%` : "-"}</dd>
                  </div>
                </dl>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">{constraint.department.owns}.</p>
              <Button asChild className="w-full">
                <Link to={constraint.agent ? agentUrl(constraint.agent) : `/agents/new?department=${constraint.department.id}`}>
                  {constraint.agent ? <ArrowRight aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
                  {constraint.agent ? "Dispatch to agent" : `Staff ${constraint.department.name}`}
                </Link>
              </Button>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
