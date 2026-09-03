import { beforeEach, describe, expect, it, vi } from "vitest";
import { approvalService } from "../services/approvals.ts";

const mockAgentService = vi.hoisted(() => ({
  activatePendingApproval: vi.fn(),
  create: vi.fn(),
  terminate: vi.fn(),
}));

const mockBudgetService = vi.hoisted(() => ({
  upsertPolicy: vi.fn(),
}));

vi.mock("../services/agents.js", () => ({
  agentService: vi.fn(() => mockAgentService),
}));

vi.mock("../services/budgets.js", () => ({
  budgetService: vi.fn(() => mockBudgetService),
}));

vi.mock("../services/hire-hook.js", () => ({
  notifyHireApproved: vi.fn(async () => undefined),
}));

type ApprovalRecord = {
  id: string;
  companyId: string;
  type: string;
  status: string;
  payload: Record<string, unknown>;
  requestedByAgentId: string | null;
};

function createFormationApproval(status: string): ApprovalRecord {
  return {
    id: "approval-formation",
    companyId: "company-1",
    type: "staff_formation",
    status,
    payload: {
      formation: "core8",
      question: "Staff the formation?",
      summary: "2 employees, $20/mo total cap",
      totalBudgetMonthlyCents: 2000,
      seats: [
        { department: "engineering", agentId: "agent-eng", name: "Engineering", budgetMonthlyCents: 1000 },
        { department: "legal", agentId: "agent-legal", name: "Legal", budgetMonthlyCents: 1000 },
      ],
    },
    requestedByAgentId: null,
  };
}

function createDbStub(
  selectResults: unknown[][],
  updateResults: ApprovalRecord[][],
) {
  const pendingSelectResults = [...selectResults];
  const selectWhere = vi.fn(async () => pendingSelectResults.shift() ?? []);
  const from = vi.fn(() => ({ where: selectWhere }));
  const select = vi.fn(() => ({ from }));

  const pendingUpdateResults = [...updateResults];
  const setCalls: Record<string, unknown>[] = [];
  const returning = vi.fn(async () => pendingUpdateResults.shift() ?? []);
  const updateWhere = vi.fn(() => ({ returning }));
  const set = vi.fn((values: Record<string, unknown>) => {
    setCalls.push(values);
    return { where: updateWhere };
  });
  const update = vi.fn(() => ({ set }));

  return {
    db: { select, update },
    setCalls,
  };
}

describe("approvalService staff_formation decisions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgentService.activatePendingApproval.mockImplementation(async (id: string) => ({
      agent: { id },
      activated: true,
    }));
    mockAgentService.terminate.mockResolvedValue(undefined);
    mockBudgetService.upsertPolicy.mockResolvedValue(undefined);
  });

  it("activates every seat and sets per-seat budget caps when nothing is declined", async () => {
    const approved = createFormationApproval("approved");
    const dbStub = createDbStub(
      [[createFormationApproval("pending")], [{ budgetMonthlyCents: 0 }]],
      [[approved], [approved]],
    );

    const svc = approvalService(dbStub.db as any);
    const result = await svc.approve("approval-formation", "board", "staff it");

    expect(result.applied).toBe(true);
    expect(mockAgentService.activatePendingApproval).toHaveBeenCalledTimes(2);
    expect(mockAgentService.activatePendingApproval).toHaveBeenCalledWith("agent-eng");
    expect(mockAgentService.activatePendingApproval).toHaveBeenCalledWith("agent-legal");
    expect(mockAgentService.terminate).not.toHaveBeenCalled();
    expect(mockBudgetService.upsertPolicy).toHaveBeenCalledTimes(3);
    expect(mockBudgetService.upsertPolicy).toHaveBeenNthCalledWith(
      1,
      "company-1",
      expect.objectContaining({ scopeType: "company", scopeId: "company-1", amount: 2000 }),
      "board",
    );
    expect(mockBudgetService.upsertPolicy).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({ scopeType: "agent", scopeId: "agent-eng", amount: 1000 }),
      "board",
    );

    const resolutionSet = dbStub.setCalls.find((values) => values.payload);
    expect((resolutionSet?.payload as Record<string, unknown>).resolution).toEqual({
      previousCompanyBudgetMonthlyCents: 0,
      companyBudgetMonthlyCents: 2000,
      companyBudgetRaised: true,
      activatedSeats: [
        { department: "engineering", agentId: "agent-eng" },
        { department: "legal", agentId: "agent-legal" },
      ],
      declinedSeats: [],
    });
  });

  it("terminates declined seats and records the named human owner", async () => {
    const approved = createFormationApproval("approved");
    const dbStub = createDbStub(
      [[createFormationApproval("pending")], [{ budgetMonthlyCents: 5000 }]],
      [[approved], [approved]],
    );

    const svc = approvalService(dbStub.db as any);
    const result = await svc.approve("approval-formation", "board", "legal stays human", {
      declinedSeats: [{ department: "legal", humanOwner: "Adam Pang" }],
    });

    expect(result.applied).toBe(true);
    expect(mockAgentService.activatePendingApproval).toHaveBeenCalledTimes(1);
    expect(mockAgentService.activatePendingApproval).toHaveBeenCalledWith("agent-eng");
    expect(mockAgentService.terminate).toHaveBeenCalledTimes(1);
    expect(mockAgentService.terminate).toHaveBeenCalledWith("agent-legal");
    expect(mockBudgetService.upsertPolicy).toHaveBeenCalledTimes(2);
    expect(mockBudgetService.upsertPolicy).toHaveBeenNthCalledWith(
      1,
      "company-1",
      expect.objectContaining({ scopeType: "company", scopeId: "company-1", amount: 5000 }),
      "board",
    );

    const resolutionSet = dbStub.setCalls.find((values) => values.payload);
    expect((resolutionSet?.payload as Record<string, unknown>).resolution).toEqual({
      previousCompanyBudgetMonthlyCents: 5000,
      companyBudgetMonthlyCents: 5000,
      companyBudgetRaised: false,
      activatedSeats: [{ department: "engineering", agentId: "agent-eng" }],
      declinedSeats: [
        { department: "legal", agentId: "agent-legal", humanOwner: "Adam Pang" },
      ],
    });
  });

  it("recovers an approved formation whose activation side effects never completed", async () => {
    const approved = createFormationApproval("approved");
    mockAgentService.activatePendingApproval.mockImplementation(async (id: string) => ({
      agent: { id, status: "idle" },
      activated: false,
    }));
    const dbStub = createDbStub(
      [[approved], [{ budgetMonthlyCents: 0 }]],
      [[approved]],
    );

    const svc = approvalService(dbStub.db as any);
    const result = await svc.approve("approval-formation", "board", "resume safe activation");

    expect(result.applied).toBe(true);
    expect(mockBudgetService.upsertPolicy).toHaveBeenNthCalledWith(
      1,
      "company-1",
      expect.objectContaining({ scopeType: "company", amount: 2000 }),
      "board",
    );
    expect(mockAgentService.activatePendingApproval).toHaveBeenCalledTimes(2);
    const resolutionSet = dbStub.setCalls.find((values) => values.payload);
    expect((resolutionSet?.payload as Record<string, unknown>).resolution).toMatchObject({
      companyBudgetMonthlyCents: 2000,
      companyBudgetRaised: true,
      activatedSeats: [
        { department: "engineering", agentId: "agent-eng" },
        { department: "legal", agentId: "agent-legal" },
      ],
    });
  });

  it("terminates all seats and never activates or spends when the card is rejected", async () => {
    const rejected = createFormationApproval("rejected");
    const dbStub = createDbStub(
      [[createFormationApproval("pending")]],
      [[rejected], [rejected]],
    );

    const svc = approvalService(dbStub.db as any);
    const result = await svc.reject("approval-formation", "board", "all departments stay human-owned");

    expect(result.applied).toBe(true);
    expect(mockAgentService.activatePendingApproval).not.toHaveBeenCalled();
    expect(mockBudgetService.upsertPolicy).not.toHaveBeenCalled();
    expect(mockAgentService.terminate).toHaveBeenCalledTimes(2);

    const resolutionSet = dbStub.setCalls.find((values) => values.payload);
    const resolution = (resolutionSet?.payload as Record<string, unknown>).resolution as {
      declinedSeats: { humanOwnerNote: string | null }[];
    };
    expect(resolution.declinedSeats).toHaveLength(2);
    expect(resolution.declinedSeats[0]!.humanOwnerNote).toBe("all departments stay human-owned");
  });
});
