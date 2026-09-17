/**
 * SUM-102 desired-state reconciler unit tests.
 *
 * All DB calls are mocked so no actual database is needed.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { companyDesiredStateService } from "./company-desired-state.js";

// ---------------------------------------------------------------------------
// Minimal DB mock builder
// ---------------------------------------------------------------------------

type AgentRow = {
  id: string;
  role: string;
  status: string;
  metadata: Record<string, unknown> | null;
  budgetMonthlyCents: number;
};

type CompanyRow = {
  goal: string | null;
  budgetMonthlyCents: number;
};

type ApprovalRow = {
  id: string;
};

type IssueRow = {
  id: string;
  status: string;
};

function makeDb(opts: {
  agents?: AgentRow[];
  company?: CompanyRow | null;
  pendingFormation?: ApprovalRow | null;
  openReconcileIssues?: IssueRow[];
}) {
  const agents = opts.agents ?? [];
  const company = opts.company ?? { goal: null, budgetMonthlyCents: 50_000 };
  const pendingFormation = opts.pendingFormation ?? null;
  const openReconcileIssues = opts.openReconcileIssues ?? [];

  // Track issues created so tests can inspect them.
  const createdIssues: { companyId: string; input: Record<string, unknown> }[] = [];

  const db = {
    _createdIssues: createdIssues,
    select: vi.fn().mockImplementation(() => db),
    from: vi.fn().mockImplementation(() => db),
    where: vi.fn().mockImplementation(() => db),
    then: vi.fn(),
    insert: vi.fn().mockImplementation(() => ({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: "new-issue-id", identifier: "TST-1", ...{} }]) }) })),
    update: vi.fn(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let callCount = 0;
  db.then.mockImplementation((resolve: (v: unknown) => unknown) => {
    callCount++;
    // Call sequence depends on computeViolations:
    //  1st: agents query
    //  2nd: company query (single row)
    //  3rd: pendingFormation query (single row)
    // Then reconcileCompanyDesiredState adds per-violation dedup queries.
    const results: unknown[] = [
      agents,
      company ? [company] : [],
      pendingFormation ? [pendingFormation] : [],
      // subsequent calls are dedup checks - return open issues if any exist
      openReconcileIssues,
    ];
    const val = results[Math.min(callCount - 1, results.length - 1)];
    return Promise.resolve(resolve ? resolve(val) : val);
  });

  return db;
}

// ---------------------------------------------------------------------------
// importCompanyConfig
// ---------------------------------------------------------------------------

describe("importCompanyConfig", () => {
  it("parses a valid config document", () => {
    const svc = companyDesiredStateService({} as never);
    const config = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      companyId: "00000000-0000-0000-0000-000000000001",
      goal: "Reach $1M ARR",
      budgetCeilingMonthlyCents: 50_000,
      formation: [
        {
          department: "engineering",
          hasActiveOwner: true,
          activeAgentIds: ["agent-1"],
          desiredBudgetMonthlyCents: 10_000,
        },
      ],
    };
    expect(() => svc.importCompanyConfig(config)).not.toThrow();
    const parsed = svc.importCompanyConfig(config);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.formation[0].department).toBe("engineering");
  });

  it("rejects a config missing schemaVersion", () => {
    const svc = companyDesiredStateService({} as never);
    expect(() => svc.importCompanyConfig({ exportedAt: new Date().toISOString() })).toThrow();
  });

  it("rejects a config with wrong schemaVersion", () => {
    const svc = companyDesiredStateService({} as never);
    expect(() =>
      svc.importCompanyConfig({
        schemaVersion: 2,
        exportedAt: new Date().toISOString(),
        companyId: "00000000-0000-0000-0000-000000000001",
        goal: null,
        budgetCeilingMonthlyCents: 0,
        formation: [],
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// computeHireCounterfactual
// ---------------------------------------------------------------------------

describe("computeHireCounterfactual", () => {
  it("returns positive headroom when hire fits in budget", async () => {
    // Company ceiling 50k, one active agent at 10k, proposed hire at 5k
    const companyId = "00000000-0000-0000-0000-000000000001";
    let call = 0;
    const db = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockImplementation(function (this: unknown) {
        call++;
        return {
          then: (resolve: (v: unknown) => unknown) => {
            if (call === 1) return Promise.resolve(resolve([{ budgetMonthlyCents: 50_000 }]));
            return Promise.resolve(resolve([{ budgetMonthlyCents: 10_000, status: "active" }]));
          },
        };
      }),
    };
    const svc = companyDesiredStateService(db as never);
    const result = await svc.computeHireCounterfactual(companyId, 5_000);
    expect(result.overBudget).toBe(false);
    expect(result.headroomAfterCents).toBe(35_000);
    expect(result.summary).toContain("$350.00/mo headroom");
  });

  it("flags over-budget when hire exceeds ceiling", async () => {
    const companyId = "00000000-0000-0000-0000-000000000001";
    let call = 0;
    const db = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockImplementation(function (this: unknown) {
        call++;
        return {
          then: (resolve: (v: unknown) => unknown) => {
            if (call === 1) return Promise.resolve(resolve([{ budgetMonthlyCents: 20_000 }]));
            return Promise.resolve(resolve([{ budgetMonthlyCents: 15_000, status: "active" }]));
          },
        };
      }),
    };
    const svc = companyDesiredStateService(db as never);
    const result = await svc.computeHireCounterfactual(companyId, 10_000);
    expect(result.overBudget).toBe(true);
    expect(result.headroomAfterCents).toBe(-5_000);
    expect(result.summary).toContain("$50.00/mo over");
  });
});

// ---------------------------------------------------------------------------
// exportCompanyConfig / importCompanyConfig round-trip
// ---------------------------------------------------------------------------

describe("exportCompanyConfig + importCompanyConfig round-trip", () => {
  it("produces a valid importable document", async () => {
    const companyId = "00000000-0000-0000-0000-000000000001";
    let call = 0;
    const db = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockImplementation(function (this: unknown) {
        call++;
        return {
          then: (resolve: (v: unknown) => unknown) => {
            if (call === 1)
              return Promise.resolve(
                resolve([{ goal: "hit $1M ARR", budgetMonthlyCents: 100_000 }]),
              );
            // agents: one active engineering agent
            return Promise.resolve(
              resolve([
                {
                  id: "agent-eng",
                  status: "active",
                  metadata: { vitalsFormation: { department: "engineering" } },
                  budgetMonthlyCents: 5_000,
                },
              ]),
            );
          },
        };
      }),
    };
    const svc = companyDesiredStateService(db as never);
    const exported = await svc.exportCompanyConfig(companyId);
    expect(exported.schemaVersion).toBe(1);
    expect(exported.companyId).toBe(companyId);
    // Should round-trip cleanly.
    expect(() => svc.importCompanyConfig(exported)).not.toThrow();
    const imported = svc.importCompanyConfig(exported);
    expect(imported.budgetCeilingMonthlyCents).toBe(100_000);
    const engSeat = imported.formation.find((s) => s.department === "engineering");
    expect(engSeat?.hasActiveOwner).toBe(true);
    expect(engSeat?.activeAgentIds).toEqual(["agent-eng"]);
  });
});
