// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { DashboardSummary, Issue } from "@paperclipai/shared";
import { computeMarketCapSnapshot } from "@paperclipai/shared/vitals-market-cap";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MissionControl } from "./MissionControl";

vi.mock("../api/fleet", () => ({
  fleetApi: {
    running: vi.fn().mockResolvedValue({ runs: [], queuedWakeups: 0 }),
    stop: vi.fn(),
    cancelRun: vi.fn(),
  },
}));

// FleetRunningNow reads the selected company for the VIT-127 mode dial.
vi.mock("../context/CompanyContext", () => ({
  useCompany: () => ({
    companies: [],
    selectedCompany: null,
    selectedCompanyId: null,
    setSelectedCompanyId: () => {},
    loading: false,
  }),
}));

vi.mock("@/lib/router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>{children}</a>
  ),
}));

const summary: DashboardSummary = {
  companyId: "company-1",
  agents: { active: 0, running: 0, paused: 0, error: 0 },
  tasks: { open: 8, inProgress: 0, blocked: 0, done: 0 },
  costs: { monthSpendCents: 125, monthBudgetCents: 10000, monthUtilizationPercent: 1 },
  pendingApprovals: 0,
  budgets: { activeIncidents: 0, pendingApprovals: 0, pausedAgents: 0, pausedProjects: 0 },
  runActivity: [
    { date: "2026-07-16", succeeded: 3, failed: 1, recovered: 1, other: 0, total: 5, failedByErrorCode: {} },
  ],
  outcomes: {
    receiptCount: 3,
    unmeasurableCount: 2,
    moneySavedCents: 12000,
    timeSavedMinutes: 90,
    timeValueCents: 9000,
    revenueMovedCents: 50000,
    risksAvoided: 1,
  },
};

function issue(index: number): Issue {
  return {
    id: `issue-${index}`,
    identifier: `VIT-${index}`,
    title: index === 1 ? "Build the product" : `Company task ${index}`,
    description: null,
    status: "todo",
    priority: index === 1 ? "critical" : "medium",
    assigneeAgentId: null,
    projectId: null,
    goalId: null,
    hiddenAt: null,
    blockedBy: [],
    executionRunId: null,
    checkoutRunId: null,
    executionLockedAt: null,
    scheduledRetry: null,
    blockedInboxAttention: null,
    createdAt: "2026-07-16T00:00:00.000Z",
    updatedAt: `2026-07-16T00:00:0${index}.000Z`,
  } as unknown as Issue;
}

describe("MissionControl", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MissionControl
          companyId="company-1"
          summary={summary}
          agents={[]}
          issues={Array.from({ length: 8 }, (_, index) => issue(index + 1))}
          projects={[]}
          goals={[]}
          decisionCount={2}
          marketCapSnapshot={computeMarketCapSnapshot({
            stripeConnected: false,
            arrCents: null,
            payingCompanies: null,
            totalCompanies: 2,
            totalEmployees: 0,
            retentionRate: null,
            grossMarginPct: null,
            arrGrowth30dPct: null,
          }, "2026-07-16T00:00:00.000Z")}
        />
        </QueryClientProvider>,
      );
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("answers company state in four evidence-backed zones", () => {
    const text = container.textContent ?? "";
    expect(text).toContain("Mission Control");
    // Ruthless pass (2026-07-19): market cap + Pressure left the dashboard;
    // the Next-move card leads (decisionCount=2 in this fixture → the deck).
    expect(text).not.toContain("option value only");
    expect(text).not.toContain("Pressure");
    expect(text).toContain("Your next move");
    expect(text).toContain("Clear 2 decisions");
    expect(text).toContain("One binding constraint");
    expect(text).toContain("Engineering");
    expect(text).toContain("Legal");
    // Via-negativa pass (2026-07-18): the Roadmap 8-card grid and the
    // "proxy score" caption failed the deletion test — the constraint card
    // is the roadmap's dashboard presence, and the bare score reads alone.
    expect(text).not.toContain("Eight stages, constraint outlined");
    expect(text).not.toContain("proxy score");
    expect(container.querySelectorAll('a[href^="/issues/"]')).toHaveLength(7);
    expect(container.querySelector('a[href="/decisions"]')).not.toBeNull();
  });

  it("renders the Outcomes (30d) rollup from receipts, with the honest denominator", () => {
    const text = container.textContent ?? "";
    expect(text).toContain("Outcomes (30d)");
    // Four separate levers; money and revenue formatted as cents→dollars.
    expect(text).toContain("$120.00");
    expect(text).toContain("saved");
    expect(text).toContain("1.5 h");
    // Time value is a parenthetical @ $60/h, NEVER folded into money saved.
    expect(text).toContain("(≈ $90.00 @ $60/h)");
    expect(text).toContain("$500.00");
    expect(text).toContain("revenue moved");
    expect(text).toContain("1 risk avoided");
    // The denominator that makes the total trustworthy.
    expect(text).toContain("from 3 receipts");
    expect(text).toContain("2 marked unmeasurable");
    expect(text).not.toContain("No receipts yet");
  });
});
