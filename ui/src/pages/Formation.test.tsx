// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Agent } from "@paperclipai/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildFormationAssignments, Formation, selectFormationConstraint } from "./Formation";

const listMock = vi.fn();

vi.mock("@/lib/router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => <a href={to} {...props}>{children}</a>,
}));

vi.mock("../context/CompanyContext", () => ({
  useCompany: () => ({ selectedCompanyId: "company-1", selectedCompany: { name: "Vitals" } }),
}));

vi.mock("../context/BreadcrumbContext", () => ({
  useBreadcrumbs: () => ({ setBreadcrumbs: vi.fn() }),
}));

vi.mock("../api/agents", () => ({
  agentsApi: { list: () => listMock() },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

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
    createdAt: new Date("2026-07-14T00:00:00.000Z"),
    updatedAt: new Date("2026-07-14T00:00:00.000Z"),
    ...overrides,
  };
}

describe("formation assignment", () => {
  it("maps existing agents without changing the shared role contract", () => {
    const assignments = buildFormationAssignments([
      agent({ id: "eng", name: "Atlas", title: "Engineering lead" }),
      agent({ id: "sales", name: "Closer", role: "general", title: "Sales" }),
    ]);

    expect(assignments.find((item) => item.department.id === "engineering")?.agent?.id).toBe("eng");
    expect(assignments.find((item) => item.department.id === "sales")?.agent?.id).toBe("sales");
    expect(assignments).toHaveLength(8);
  });

  it("selects an unstaffed department before healthy staffed departments", () => {
    const assignments = buildFormationAssignments([
      agent({ id: "eng", title: "Engineering" }),
    ]);

    expect(selectFormationConstraint(assignments)?.department.id).toBe("design");
  });

  it("surfaces runtime errors above budget pressure", () => {
    const assignments = buildFormationAssignments([
      agent({ id: "eng", title: "Engineering", spentMonthlyCents: 9_000 }),
      agent({ id: "design", role: "designer", title: "Design", status: "error" }),
      agent({ id: "marketing", role: "cmo", title: "Marketing" }),
      agent({ id: "sales", role: "general", title: "Sales" }),
      agent({ id: "finance", role: "cfo", title: "Finance" }),
      agent({ id: "ops", role: "pm", title: "Operations" }),
      agent({ id: "support", role: "general", title: "Support" }),
      agent({ id: "legal", role: "general", title: "Legal" }),
    ]);

    expect(selectFormationConstraint(assignments)?.department.id).toBe("design");
  });
});

describe("Formation page", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    listMock.mockResolvedValue([agent({ id: "eng", name: "Atlas", urlKey: "atlas" })]);
  });

  afterEach(async () => {
    if (root) await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it("renders all eight positions and the current constraint", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    root = createRoot(container);
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Formation />
        </QueryClientProvider>,
      );
    });
    await flushReact();
    await flushReact();

    expect(container.textContent).toContain("Company formation");
    expect(container.textContent).toContain("Engineering");
    expect(container.textContent).toContain("Legal");
    expect(container.textContent).toContain("One constraint");
    expect(container.querySelectorAll('[aria-label^="Engineering:"]')).toHaveLength(1);
  });
});
