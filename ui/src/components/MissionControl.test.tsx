// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Agent, DashboardSummary, Issue } from "@paperclipai/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MissionControl } from "./MissionControl";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const listInboxConnectorsMock = vi.hoisted(() => vi.fn());
const listInboxMessagesMock = vi.hoisted(() => vi.fn());

vi.mock("../api/fleet", () => ({
  fleetApi: {
    running: vi.fn().mockResolvedValue({ runs: [], queuedWakeups: 0 }),
    stop: vi.fn(),
    cancelRun: vi.fn(),
  },
}));

vi.mock("../api/companyWebsite", () => ({
  companyWebsiteApi: {
    list: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../api/companyPayments", () => ({
  companyPaymentsApi: {
    listAccounts: vi.fn().mockResolvedValue([]),
    listOffers: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../api/companyOutreach", () => ({
  companyOutreachApi: {
    listConnections: vi.fn().mockResolvedValue([]),
    listCampaigns: vi.fn().mockResolvedValue([]),
    listLeads: vi.fn().mockResolvedValue([]),
    listSuppressions: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../api/companyAds", () => ({
  companyAdsApi: {
    listConnections: vi.fn().mockResolvedValue([]),
    listCampaigns: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../api/companyStack", () => ({
  companyStackApi: {
    list: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../api/companyInbox", () => ({
  companyInboxApi: {
    listConnectors: (...args: unknown[]) => listInboxConnectorsMock(...args),
    listMessages: (...args: unknown[]) => listInboxMessagesMock(...args),
    notificationStatus: vi.fn().mockResolvedValue({ authorizedDestinations: 1, pending: 2, failed: 1, outcomeUnknown: 1, delivered: 7, lastDeliveredAt: "2026-08-26T01:00:00.000Z" }),
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

vi.mock("../pages/BoardChat", () => ({
  BoardChat: () => <div data-testid="mock-board-chat">Board chat</div>,
}));

vi.mock("../pages/MarketCap", () => ({
  useMarketCapSnapshot: () => ({
    snapshot: { capProxyLabel: "$1.2M - $2.4M" },
    loading: false,
    published: true,
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
  finance: {
    period: "current_calendar_month_utc",
    stripeConnected: true,
    stripeMode: "live",
    revenueAsOf: "2026-08-29T03:50:00.000Z",
    revenueFreshness: "fresh",
    nextRevenueSyncAt: "2026-08-29T04:05:00.000Z",
    currency: "usd",
    revenueCents: 5_000,
    revenueCoverage: "complete",
    arrCents: 118_800,
    arrCurrency: "usd",
    arrCoverage: "complete",
    payingCustomerCount: 1,
    aiExpenseCents: 125,
    transcriptionExpenseMicrousd: 0,
    transcriptionExpenseEvents: 0,
    operatingExpenseCents: 875,
    estimatedOperatingExpenseCents: 0,
    recordedOperatingExpenseEvents: 2,
    statementOperatingExpenseEvents: 2,
    boardRecordedOperatingExpenseEvents: 0,
    expenseEvidenceSource: "statement_import",
    expenseCents: 1_000,
    expenseCurrency: "usd",
    expenseCoverage: "ai_and_recorded_operating",
    profitCents: 4_000,
    profitStatus: "measured_proxy",
    availableCashCents: 25_000,
    pendingCashCents: 1_500,
    cashStatus: "measured",
    monthlyBurnCents: 0,
    runwayMonths: null,
    runwayStatus: "profitable",
  },
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

function employee(id: string, name: string, status: Agent["status"], department: string | null): Agent {
  return {
    id,
    companyId: "company-1",
    name,
    urlKey: id,
    role: "general",
    title: name,
    icon: null,
    status,
    reportsTo: null,
    capabilities: null,
    adapterType: "codex_local",
    adapterConfig: {},
    runtimeConfig: {},
    budgetMonthlyCents: 0,
    spentMonthlyCents: 0,
    pauseReason: null,
    pausedAt: status === "paused" ? new Date("2026-08-29T00:00:00.000Z") : null,
    permissions: { canCreateAgents: false },
    lastHeartbeatAt: null,
    metadata: department ? { department } : null,
    createdAt: new Date("2026-08-29T00:00:00.000Z"),
    updatedAt: new Date("2026-08-29T00:00:00.000Z"),
  };
}

describe("MissionControl", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    listInboxConnectorsMock.mockResolvedValue([{
      id: "connector-1",
      providerKey: "slack",
      accountLabel: "Summon · #company",
      status: "connected",
    }]);
    listInboxMessagesMock.mockResolvedValue([{
      id: "message-1",
      direction: "inbound",
      status: "read",
      workIssue: {
        id: "customer-issue-1",
        identifier: "SUM-101",
        title: "Customer request: Need help",
        status: "in_progress",
        priority: "high",
        assigneeAgentId: "support-agent",
      },
    }]);
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
        />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("puts market cap and tracked profitability above operating activity", () => {
    const scoreboard = container.querySelector('[data-testid="financial-scoreboard"]');
    expect(scoreboard?.textContent).toContain("Market cap");
    expect(scoreboard?.textContent).toContain("$1.2M - $2.4M");
    expect(scoreboard?.textContent).toContain("Profitability");
    expect(scoreboard?.textContent).toContain("Stripe revenue minus recorded expenses");
    expect(scoreboard?.textContent).toContain("AI + 2 statement transactions");
    expect(scoreboard?.textContent).toContain("Available cash / statement-backed burn");
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
    expect(text).toContain("5 runs observed · 80% reliable.");
    expect(text).toContain("Run reliability: 80%(5 runs)");
    expect(text).toContain("One binding constraint");
    expect(text).toContain("Customer channels");
    expect(text).toContain("1 customer task open");
    expect(text).toContain("Board alerts: 2 pending · 2 need attention");
    expect(text).toContain("Ask your company anything.");
    expect(text).toContain("Engineering");
    expect(text).toContain("Legal");
    // Via-negativa pass (2026-07-18): the Roadmap 8-card grid and the
    // "proxy score" caption failed the deletion test — the constraint card
    // is the roadmap's dashboard presence, and the bare score reads alone.
    expect(text).not.toContain("Eight stages, constraint outlined");
    expect(text).not.toContain("proxy score");
    expect(container.querySelectorAll('a[href^="/issues/"]')).toHaveLength(7);
    expect(container.querySelector('a[href="/decisions"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="board-chat-rail"]')).not.toBeNull();
  });

  it("separates pending formation seats from the employee roster and count", async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <MissionControl
            companyId="company-1"
            summary={summary}
            agents={[
              employee("pending-engineering", "Pending Engineering", "pending_approval", "engineering"),
              employee("reflection-coach", "Reflection Coach", "paused", null),
            ]}
            issues={[]}
            projects={[]}
            goals={[]}
            decisionCount={0}
          />
        </QueryClientProvider>,
      );
    });

    const team = container.querySelector("#team-heading")?.closest("section");
    expect(team?.textContent).toContain("Reflection Coach");
    expect(team?.textContent).not.toContain("Pending Engineering");
    expect(team?.textContent).toContain("1 seat awaiting approval");
    const business = container.querySelector("#business-heading")?.closest("section");
    const employeesRow = [...(business?.querySelectorAll("dl > div") ?? [])]
      .find((node) => node.textContent?.startsWith("Employees:"));
    expect(employeesRow?.textContent).toContain("1");
    expect(employeesRow?.textContent).toContain("0 live · 1 pending");
  });

  it("keeps run reliability unproven until at least one run exists", async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <MissionControl
            companyId="company-1"
            summary={{ ...summary, runActivity: [] }}
            agents={[]}
            issues={[]}
            projects={[]}
            goals={[]}
            decisionCount={0}
          />
        </QueryClientProvider>,
      );
    });

    const text = container.textContent ?? "";
    expect(text).toContain("No runs observed · reliability unproven.");
    expect(text).toContain("Run reliability: Unproven(0 runs)");
    expect(text).not.toContain("0% reliable");
  });

  it("opens company controls in a wide transient workspace instead of the newspaper column", async () => {
    const trigger = container.querySelector<HTMLButtonElement>('[data-testid="company-controls-trigger"]');
    expect(trigger).not.toBeNull();
    expect(container.querySelector("details")).toBeNull();

    await act(async () => trigger?.click());

    const workspace = document.querySelector<HTMLElement>('[data-testid="company-controls-workspace"]');
    expect(workspace).not.toBeNull();
    expect(workspace?.className).toContain("!max-w-(--sz-1280px)");
    expect(workspace?.textContent).toContain("Decide the next work");
    expect(workspace?.querySelector("[data-company-loop-steps]")?.className).toContain("lg:grid-cols-3");
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
