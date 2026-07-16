// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Agent, Goal, Issue, Project } from "@paperclipai/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildRoadmapEvidence, buildRoadmapStages, Roadmap, selectRoadmapConstraint } from "./Roadmap";

const agentsListMock = vi.fn();
const goalsListMock = vi.fn();
const projectsListMock = vi.fn();
const issuesListMock = vi.fn();

vi.mock("@/lib/router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => <a href={to} {...props}>{children}</a>,
}));

vi.mock("../context/CompanyContext", () => ({
  useCompany: () => ({ selectedCompanyId: "company-1", selectedCompany: { name: "Company Zero" } }),
}));

vi.mock("../context/BreadcrumbContext", () => ({
  useBreadcrumbs: () => ({ setBreadcrumbs: vi.fn() }),
}));

vi.mock("../api/agents", () => ({
  agentsApi: { list: () => agentsListMock() },
}));

vi.mock("../api/goals", () => ({
  goalsApi: { list: () => goalsListMock() },
}));

vi.mock("../api/projects", () => ({
  projectsApi: { list: () => projectsListMock() },
}));

vi.mock("../api/issues", () => ({
  issuesApi: { list: () => issuesListMock() },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = new Date("2026-07-14T00:00:00.000Z");

async function flushReact() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

function agent(overrides: Partial<Agent>): Agent {
  return {
    id: "agent-1",
    companyId: "company-1",
    name: "Engineer",
    urlKey: "engineer",
    role: "engineer",
    title: "Engineering lead",
    icon: null,
    status: "running",
    reportsTo: null,
    capabilities: "Builds the application",
    adapterType: "codex_local",
    adapterConfig: {},
    runtimeConfig: {},
    budgetMonthlyCents: 10_000,
    spentMonthlyCents: 2_500,
    pauseReason: null,
    pausedAt: null,
    permissions: { canCreateAgents: false },
    lastHeartbeatAt: null,
    metadata: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function goal(overrides: Partial<Goal>): Goal {
  return {
    id: "goal-1",
    companyId: "company-1",
    title: "Define the product outcome",
    description: null,
    level: "company",
    status: "active",
    parentId: null,
    ownerAgentId: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function project(overrides: Partial<Project>): Project {
  return {
    id: "project-1",
    companyId: "company-1",
    urlKey: "project-1",
    goalId: null,
    goalIds: [],
    goals: [],
    name: "Build app",
    description: null,
    status: "in_progress",
    leadAgentId: null,
    targetDate: null,
    color: null,
    icon: null,
    env: null,
    pauseReason: null,
    pausedAt: null,
    executionWorkspacePolicy: null,
    codebase: {
      workspaceId: null,
      repoUrl: null,
      repoRef: null,
      defaultRef: null,
      repoName: null,
      localFolder: null,
      managedFolder: "",
      effectiveLocalFolder: "",
      origin: "managed_checkout",
    },
    workspaces: [],
    primaryWorkspace: null,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function issue(overrides: Partial<Issue>): Issue {
  return {
    id: "issue-1",
    companyId: "company-1",
    projectId: null,
    projectWorkspaceId: null,
    goalId: null,
    parentId: null,
    title: "Build product auth",
    description: null,
    status: "todo",
    workMode: "standard",
    priority: "high",
    assigneeAgentId: null,
    assigneeUserId: null,
    checkoutRunId: null,
    executionRunId: null,
    executionAgentNameKey: null,
    executionLockedAt: null,
    createdByAgentId: null,
    createdByUserId: null,
    responsibleUserId: null,
    issueNumber: 1,
    identifier: "VIT-1",
    requestDepth: 0,
    billingCode: null,
    assigneeAdapterOverrides: null,
    executionWorkspaceId: null,
    executionWorkspacePreference: null,
    executionWorkspaceSettings: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    hiddenAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("roadmap evidence", () => {
  it("maps live goals, projects, and tasks to canonical stages", () => {
    const evidence = buildRoadmapEvidence({
      goals: [goal({ id: "idea-goal", title: "Define the product outcome" })],
      projects: [project({ id: "build-project", name: "Build app and auth" })],
      issues: [issue({ id: "launch-task", title: "Launch the public app", status: "in_progress" })],
    });

    expect(evidence.map((item) => item.stageId)).toEqual(
      expect.arrayContaining(["initial_idea", "build", "launch"]),
    );
    expect(evidence.find((item) => item.id === "launch-task")?.kind).toBe("task");
  });

  it("selects one least-complete stage whose earlier dependencies are clear", () => {
    const stages = buildRoadmapStages({
      agents: [
        agent({ id: "legal", title: "Legal", role: "general" }),
        agent({ id: "design", title: "Design", role: "designer" }),
        agent({ id: "engineering", title: "Engineering", role: "engineer" }),
      ],
      goals: [],
      projects: [project({ id: "found", name: "Incorporation setup", status: "completed" })],
      issues: [
        issue({ id: "idea", title: "Define product outcome", status: "done" }),
        issue({ id: "identity", title: "Create brand identity and open bank account", status: "blocked" }),
        issue({ id: "build", title: "Build product auth", status: "todo" }),
      ],
    });

    const identity = stages.find((stage) => stage.stage.id === "identity");
    const build = stages.find((stage) => stage.stage.id === "build");
    const constraint = selectRoadmapConstraint(stages);

    expect(identity?.dependencyState).toBe("needs_your_input");
    expect(build?.dependencyState).toBe("needs_earlier_steps_first");
    expect(constraint?.stage.id).toBe("identity");
    expect(stages.filter((stage) => stage.stage.id === constraint?.stage.id)).toHaveLength(1);
  });
});

describe("Roadmap page", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    agentsListMock.mockResolvedValue([
      agent({ id: "design", name: "Design", title: "Design", role: "designer", urlKey: "design" }),
      agent({ id: "legal", name: "Legal", title: "Legal", role: "general", urlKey: "legal" }),
    ]);
    goalsListMock.mockResolvedValue([]);
    projectsListMock.mockResolvedValue([project({ id: "found", name: "Incorporation setup", status: "completed" })]);
    issuesListMock.mockResolvedValue([
      issue({ id: "idea", title: "Define product outcome", status: "done" }),
      issue({ id: "identity", title: "Create brand identity and open bank account", status: "blocked", assigneeAgentId: "design" }),
    ]);
  });

  afterEach(async () => {
    if (root) await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it("renders all eight stages and the current critical path", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    root = createRoot(container);
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Roadmap />
        </QueryClientProvider>,
      );
    });
    await flushReact();
    await flushReact();

    expect(container.textContent).toContain("Company roadmap");
    expect(container.textContent).toContain("Company Zero");
    expect(container.textContent).toContain("Critical path");
    expect(container.textContent).toContain("Identity");
    expect(container.textContent).toContain("Needs your input");
    expect(container.querySelectorAll('[aria-label^="Roadmap stage"]')).toHaveLength(8);
  });
});
