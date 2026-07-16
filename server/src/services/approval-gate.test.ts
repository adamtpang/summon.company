import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLogActivity = vi.fn();

vi.mock("./activity-log.js", () => ({
  logActivity: (...args: unknown[]) => mockLogActivity(...args),
}));

import {
  ALWAYS_ASK_CATEGORIES,
  approvalGateService,
  assertSeparationOfDuties,
  classifyRiskTier,
  decideApprovalRoute,
  RISK_GATED_ACTION_APPROVAL_TYPE,
  type RiskAxes,
} from "./approval-gate.js";

type Row = Record<string, unknown>;

function createFakeDb(selectResults: Row[][]) {
  let selectIndex = 0;
  const inserted: Row[] = [];
  const updates: Row[] = [];
  let nextInsertId = 0;

  const db: any = {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          then: (callback: (rows: Row[]) => unknown) => {
            const rows = selectResults[selectIndex] ?? [];
            selectIndex += 1;
            return Promise.resolve(callback(rows));
          },
        }),
      }),
    })),
    insert: vi.fn(() => ({
      values: (values: Row) => {
        inserted.push(values);
        nextInsertId += 1;
        const row = { id: `inserted-${nextInsertId}`, createdAt: new Date(), ...values };
        return {
          returning: () => ({
            then: (callback: (rows: Row[]) => unknown) => Promise.resolve(callback([row])),
          }),
          onConflictDoNothing: () => Promise.resolve(),
        };
      },
    })),
    update: vi.fn(() => ({
      set: (set: Row) => {
        updates.push(set);
        return {
          where: () => ({
            returning: () => ({
              then: (callback: (rows: Row[]) => unknown) => Promise.resolve(callback([{ id: "gate-approval", ...set }])),
            }),
          }),
        };
      },
    })),
  };

  return { db, inserted, updates };
}

const lowAxes: RiskAxes = {
  reversibility: "reversible",
  blastRadius: "internal",
  moneyAtStakeUsd: 0,
  dataLegal: "none",
};

function agentRow(overrides: Row = {}): Row {
  return {
    id: "initiator-agent",
    reportsTo: null,
    metadata: null,
    budgetMonthlyCents: 10_000,
    spentMonthlyCents: 0,
    ...overrides,
  };
}

function pendingGateRow(payloadOverrides: Row = {}, rowOverrides: Row = {}): Row {
  return {
    id: "gate-approval",
    companyId: "company-1",
    type: RISK_GATED_ACTION_APPROVAL_TYPE,
    requestedByAgentId: "initiator-agent",
    status: "pending",
    createdAt: new Date("2026-07-15T00:00:00Z"),
    payload: {
      action: "Send outbound email to a real prospect",
      evidence: [{ kind: "draft", summary: "Email draft", ref: "doc/draft.md" }],
      riskTier: "high",
      drivingAxis: "blastRadius",
      axes: { ...lowAxes, blastRadius: "public" },
      categories: ["outbound_message"],
      initiatorAgentId: "initiator-agent",
      initiatorRunId: "run-1",
      initiatorParentAgentId: null,
      budgetImpactCents: 0,
      route: "digest",
      gate: "board",
      reason: "test",
      urgent: false,
      defaultOnTimeout: "fail_closed",
      ...payloadOverrides,
    },
    ...rowOverrides,
  };
}

beforeEach(() => {
  mockLogActivity.mockReset();
  mockLogActivity.mockResolvedValue(undefined);
});

describe("classifyRiskTier (Policy v1 §1)", () => {
  it("scores all four axes and returns LOW when every axis is low", () => {
    expect(classifyRiskTier(lowAxes)).toEqual({ tier: "low", drivingAxis: "reversibility" });
  });

  it("tier is the highest axis reached, with the driving axis named", () => {
    expect(classifyRiskTier({ ...lowAxes, reversibility: "recoverable" }))
      .toEqual({ tier: "medium", drivingAxis: "reversibility" });
    expect(classifyRiskTier({ ...lowAxes, blastRadius: "public" }))
      .toEqual({ tier: "high", drivingAxis: "blastRadius" });
    expect(classifyRiskTier({ ...lowAxes, dataLegal: "sensitive" }))
      .toEqual({ tier: "high", drivingAxis: "dataLegal" });
    // one medium axis + one high axis → high wins
    expect(classifyRiskTier({ ...lowAxes, reversibility: "recoverable", dataLegal: "sensitive" }))
      .toEqual({ tier: "high", drivingAxis: "dataLegal" });
  });

  it("maps money boundaries: ≤$20 low, $20–$200 medium, >$200 or recurring high", () => {
    expect(classifyRiskTier({ ...lowAxes, moneyAtStakeUsd: 20 }).tier).toBe("low");
    expect(classifyRiskTier({ ...lowAxes, moneyAtStakeUsd: 21 }).tier).toBe("medium");
    expect(classifyRiskTier({ ...lowAxes, moneyAtStakeUsd: 200 }).tier).toBe("medium");
    expect(classifyRiskTier({ ...lowAxes, moneyAtStakeUsd: 201 }).tier).toBe("high");
    expect(classifyRiskTier({ ...lowAxes, moneyAtStakeUsd: 5, moneyRecurring: true }).tier).toBe("high");
  });
});

describe("decideApprovalRoute (Policy v1 §2, §3, §5)", () => {
  const base = {
    trustLevel: "trusted" as const,
    categories: [] as string[],
    withinStandingBudget: true,
    budgetUsedFraction: 0.1,
    reversible: true,
  };

  it("LOW auto-approves, log-only", () => {
    const decision = decideApprovalRoute({ ...base, tier: "low" });
    expect(decision).toMatchObject({ route: "auto_approve", gate: "none", autoApproved: true });
  });

  it("MED auto-approves for trusted agents within budget", () => {
    expect(decideApprovalRoute({ ...base, tier: "medium" }).autoApproved).toBe(true);
  });

  it("MED queues to the founder gate when the agent is untrusted", () => {
    const decision = decideApprovalRoute({ ...base, tier: "medium", trustLevel: "untrusted" });
    expect(decision).toMatchObject({ route: "digest", gate: "founder", autoApproved: false });
  });

  it("HIGH always routes to the board digest, or urgent for immediate attention", () => {
    expect(decideApprovalRoute({ ...base, tier: "high" }))
      .toMatchObject({ route: "digest", gate: "board", autoApproved: false });
    expect(decideApprovalRoute({ ...base, tier: "high", urgent: true }))
      .toMatchObject({ route: "board_urgent", gate: "board", autoApproved: false });
  });

  it("HIGH auto-approves only for Autonomous trust on a reversible action within budget", () => {
    expect(decideApprovalRoute({ ...base, tier: "high", trustLevel: "autonomous" }).autoApproved).toBe(true);
    expect(decideApprovalRoute({ ...base, tier: "high", trustLevel: "autonomous", reversible: false }).autoApproved).toBe(false);
  });

  it("always-ask categories never auto-approve, even at LOW", () => {
    for (const category of ALWAYS_ASK_CATEGORIES) {
      const decision = decideApprovalRoute({ ...base, tier: "low", categories: [category] });
      expect(decision.autoApproved).toBe(false);
      expect(decision.gate).toBe("board");
    }
  });

  it("80% budget coupling: MED stops auto-approving and escalates to the board", () => {
    const decision = decideApprovalRoute({ ...base, tier: "medium", budgetUsedFraction: 0.85 });
    expect(decision).toMatchObject({ route: "digest", gate: "board", autoApproved: false });
  });

  it("unknown budget state is treated as tightened", () => {
    const decision = decideApprovalRoute({ ...base, tier: "medium", budgetUsedFraction: null });
    expect(decision.autoApproved).toBe(false);
  });
});

describe("approvalGateService.requestGate — tier routing (acceptance 3)", () => {
  it("LOW: auto-applies with an audit record and no approval row", async () => {
    const { db, inserted } = createFakeDb([[agentRow()]]);
    const result = await approvalGateService(db).requestGate({
      companyId: "company-1",
      action: "Reword an internal doc heading",
      evidence: [],
      axes: lowAxes,
      initiatorAgentId: "initiator-agent",
    });

    expect(result).toMatchObject({ approvalId: null, tier: "low", autoApproved: true });
    expect(inserted).toHaveLength(0);
    expect(mockLogActivity).toHaveBeenCalledWith(db, expect.objectContaining({
      action: "approval_gate.auto_approved",
    }));
  });

  it("MED from an untrusted agent: suspends into the founder gate", async () => {
    const { db, inserted } = createFakeDb([[agentRow({ metadata: { trustLevel: "untrusted" } })]]);
    const result = await approvalGateService(db).requestGate({
      companyId: "company-1",
      action: "Refund a $50 order",
      evidence: [{ kind: "order", summary: "Order #123, customer asked for refund" }],
      axes: { ...lowAxes, moneyAtStakeUsd: 50 },
      initiatorAgentId: "initiator-agent",
      budgetImpactCents: 5_000,
    });

    expect(result).toMatchObject({ tier: "medium", gate: "founder", autoApproved: false });
    expect(result.approvalId).toBeTruthy();
    expect(inserted[0]).toMatchObject({ type: RISK_GATED_ACTION_APPROVAL_TYPE, status: "pending" });
  });

  it("HIGH: suspends into the board gate with fail-closed timeout", async () => {
    const { db, inserted } = createFakeDb([[agentRow()]]);
    const result = await approvalGateService(db).requestGate({
      companyId: "company-1",
      issueId: "issue-1",
      action: "Publish a public claim on the landing page",
      evidence: [{ kind: "diff", summary: "Landing page copy diff", ref: "ui/src/pages/Landing.tsx" }],
      axes: { ...lowAxes, blastRadius: "public" },
      initiatorAgentId: "initiator-agent",
      initiatorRunId: "run-9",
    });

    expect(result).toMatchObject({ tier: "high", gate: "board", autoApproved: false });
    const payload = inserted[0].payload as Row;
    expect(payload.defaultOnTimeout).toBe("fail_closed");
    expect(payload.initiatorAgentId).toBe("initiator-agent");
    expect(payload.evidence).toHaveLength(1);
    // linked to the initiating issue for the approve-route resume wake
    expect(inserted[1]).toMatchObject({ issueId: "issue-1", approvalId: result.approvalId });
    expect(mockLogActivity).toHaveBeenCalledWith(db, expect.objectContaining({
      action: "approval_gate.suspended",
      entityId: result.approvalId,
    }));
  });

  it("refuses to suspend a gated action without an evidence bundle (acceptance 4 precondition)", async () => {
    const { db } = createFakeDb([[agentRow()]]);
    await expect(approvalGateService(db).requestGate({
      companyId: "company-1",
      action: "Publish a public claim",
      evidence: [],
      axes: { ...lowAxes, blastRadius: "public" },
      initiatorAgentId: "initiator-agent",
    })).rejects.toMatchObject({ status: 422 });
  });
});

describe("separation of duties (acceptance 2)", () => {
  it("rejects self-approval at the executor level and logs a violation event", async () => {
    const { db, updates } = createFakeDb([[pendingGateRow()]]);
    await expect(approvalGateService(db).decide({
      approvalId: "gate-approval",
      decision: "approved",
      approverAgentId: "initiator-agent",
    })).rejects.toMatchObject({ status: 403 });

    expect(updates).toHaveLength(0);
    expect(mockLogActivity).toHaveBeenCalledWith(db, expect.objectContaining({
      action: "approval_gate.self_approval_blocked",
      details: expect.objectContaining({ violation: "self_approval" }),
    }));
  });

  it("rejects a sub-agent approving its parent's proposal", async () => {
    // approver reports to the initiator (one lineage hop)
    const { db, updates } = createFakeDb([
      [pendingGateRow()],
      [{ reportsTo: "initiator-agent" }],
    ]);
    await expect(approvalGateService(db).decide({
      approvalId: "gate-approval",
      decision: "approved",
      approverAgentId: "sub-agent",
    })).rejects.toMatchObject({ status: 403 });

    expect(updates).toHaveLength(0);
    expect(mockLogActivity).toHaveBeenCalledWith(db, expect.objectContaining({
      action: "approval_gate.self_approval_blocked",
      details: expect.objectContaining({ violation: "sub_agent_of_initiator" }),
    }));
  });

  it("assertSeparationOfDuties passes for board users and unrelated agents", async () => {
    const { db } = createFakeDb([[{ reportsTo: null }]]);
    await expect(assertSeparationOfDuties(db, {
      companyId: "company-1",
      approvalId: "gate-approval",
      initiatorAgentId: "initiator-agent",
      approverUserId: "board",
    })).resolves.toBeUndefined();

    await expect(assertSeparationOfDuties(db, {
      companyId: "company-1",
      approvalId: "gate-approval",
      initiatorAgentId: "initiator-agent",
      approverAgentId: "peer-agent",
    })).resolves.toBeUndefined();
    expect(mockLogActivity).not.toHaveBeenCalled();
  });
});

describe("durable suspend/resume (acceptance 1)", () => {
  it("a gate suspended by one service instance is decidable by a fresh instance over the same store", async () => {
    // Suspend with instance A: the only state left behind is the DB row.
    const { db: dbA, inserted } = createFakeDb([[agentRow()]]);
    const suspended = await approvalGateService(dbA).requestGate({
      companyId: "company-1",
      action: "Publish a public claim",
      evidence: [{ kind: "diff", summary: "copy diff" }],
      axes: { ...lowAxes, blastRadius: "public" },
      initiatorAgentId: "initiator-agent",
    });
    expect(suspended.approvalId).toBeTruthy();

    // "Restart": a brand-new service + db handle seeded only with the persisted row.
    const persistedRow = {
      id: suspended.approvalId,
      companyId: "company-1",
      type: RISK_GATED_ACTION_APPROVAL_TYPE,
      requestedByAgentId: "initiator-agent",
      status: "pending",
      createdAt: new Date(),
      payload: inserted[0].payload,
    };
    const { db: dbB, updates } = createFakeDb([[persistedRow]]);
    const decided = await approvalGateService(dbB).decide({
      approvalId: suspended.approvalId as string,
      decision: "approved",
      approverUserId: "board",
    });

    expect(decided.status).toBe("approved");
    expect(updates[0]).toMatchObject({ status: "approved", decidedByUserId: "board" });
    expect(mockLogActivity).toHaveBeenCalledWith(dbB, expect.objectContaining({
      action: "approval_gate.approved",
    }));
  });
});

describe("approval digest + timeout rules (Policy v1 §4)", () => {
  it("buildDigest batches pending items oldest-first with decision-ready fields", async () => {
    const older = pendingGateRow({}, { id: "gate-old", createdAt: new Date("2026-07-14T00:00:00Z") });
    const newer = pendingGateRow(
      { action: "Sign a vendor contract", riskTier: "high", urgent: true },
      { id: "gate-new", createdAt: new Date("2026-07-15T12:00:00Z") },
    );
    const { db } = createFakeDb([[newer, older]]);

    const digest = await approvalGateService(db).buildDigest("company-1");
    expect(digest.items.map((item) => item.approvalId)).toEqual(["gate-old", "gate-new"]);
    expect(digest.items[0]).toMatchObject({
      riskTier: "high",
      gate: "board",
      defaultOnTimeout: "fail_closed",
    });
    expect(digest.markdown).toContain("Approval Digest (2 pending)");
    expect(digest.markdown).toContain("URGENT");
  });

  it("sweepTimeouts fails open for LOW/MED and fails closed for HIGH", async () => {
    const now = new Date("2026-07-16T12:00:00Z");
    const staleOpen = pendingGateRow(
      { riskTier: "medium", defaultOnTimeout: "fail_open" },
      { id: "gate-med", createdAt: new Date("2026-07-15T00:00:00Z") },
    );
    const staleClosed = pendingGateRow({}, { id: "gate-high", createdAt: new Date("2026-07-15T00:00:00Z") });
    const fresh = pendingGateRow(
      { riskTier: "medium", defaultOnTimeout: "fail_open" },
      { id: "gate-fresh", createdAt: new Date("2026-07-16T11:00:00Z") },
    );
    const { db, updates } = createFakeDb([[staleOpen, staleClosed, fresh]]);

    const result = await approvalGateService(db).sweepTimeouts({
      companyId: "company-1",
      now,
      failOpenAfterHours: 24,
    });

    expect(result.failedOpen).toEqual(["gate-med"]);
    expect(result.heldClosed).toEqual(["gate-high"]);
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ status: "approved", decidedByUserId: "system:timeout-fail-open" });
    expect(mockLogActivity).toHaveBeenCalledWith(db, expect.objectContaining({
      action: "approval_gate.timeout_fail_open",
      entityId: "gate-med",
    }));
  });
});
