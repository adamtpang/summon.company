import { describe, expect, it, vi } from "vitest";

import {
  findDrift,
  proposeRegisterEdit,
  renderReceipt,
  runReconciliation,
  shouldTriggerFromWebhook,
  unifiedDiff,
  type RunStore,
  type TaskFiler,
} from "../services/register-truth-runner.js";
import type { ReconciliationReceipt } from "../services/register-truth.js";

vi.mock("../services/register-truth.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/register-truth.js")>();
  return { ...actual, reconcileRegister: vi.fn(() => RECEIPT) };
});

const RECEIPT: ReconciliationReceipt = {
  repo: "regain-inc/miss",
  registerPath: "docs/register.md",
  registerCommit: "03ef9825f",
  registerDate: "2026-07-14",
  headCommit: "d93947d91",
  headBranch: "main",
  commitsSinceRegister: 262,
  generatedAt: "2026-07-31T00:00:00.000Z",
  findings: [
    {
      id: "P0-2",
      claim: "nightly build is dead code",
      claimedStatus: "open",
      actualStatus: "closed",
      probes: [
        {
          file: "apps/queue/src/index.ts",
          needle: "await scheduleBatchEtl()",
          countAtRegister: 0,
          countAtHead: 1,
          verdict: "satisfied",
          firstPresent: { sha: "b4af6e64c", date: "2026-07-14" },
        },
      ],
    },
    {
      id: "P0-1",
      claim: "route authz missing, PHI exposure",
      claimedStatus: "open",
      actualStatus: "needs_human",
      humanReason: "Security or money finding: evidence is reported, never auto-closed.",
      probes: [],
    },
  ],
};

describe("webhook trigger", () => {
  it("fires only on a merged pull request", () => {
    expect(
      shouldTriggerFromWebhook("pull_request", { action: "closed", pull_request: { merged: true } }),
    ).toBe(true);
  });

  it("ignores a PR closed without merging", () => {
    expect(
      shouldTriggerFromWebhook("pull_request", { action: "closed", pull_request: { merged: false } }),
    ).toBe(false);
  });

  it("ignores pushes and other events", () => {
    expect(shouldTriggerFromWebhook("push", { action: "closed" })).toBe(false);
    expect(shouldTriggerFromWebhook("pull_request", { action: "opened" })).toBe(false);
    expect(shouldTriggerFromWebhook("pull_request", null)).toBe(false);
  });
});

describe("drift detection", () => {
  it("counts closed and partial rows as drift, not needs_human", () => {
    expect(findDrift(RECEIPT).map((f) => f.id)).toEqual(["P0-2"]);
  });
});

describe("receipt rendering", () => {
  it("carries id, file, counts and closing commit", () => {
    const text = renderReceipt(RECEIPT);
    expect(text).toContain("P0-2: CLOSED");
    expect(text).toContain("apps/queue/src/index.ts");
    expect(text).toContain("closed by b4af6e64c 2026-07-14");
    expect(text).toContain("262 commits");
  });

  it("says the repo is read-only", () => {
    expect(renderReceipt(RECEIPT)).toContain("read-only");
  });
});

describe("proposed register edit", () => {
  const register = [
    "| #    | Finding |",
    "| ---- | ------- |",
    "| P0-2 | nightly build is dead code |",
    "| P0-1 | route authz missing |",
  ].join("\n");

  it("annotates a closed row with evidence", () => {
    const { updated } = proposeRegisterEdit(register, RECEIPT);
    expect(updated).toContain("CLOSED in code as of d93947d91");
    expect(updated).toContain("b4af6e64c");
  });

  it("annotates a security row as needing review, never as closed", () => {
    const { updated } = proposeRegisterEdit(register, RECEIPT);
    const p01 = updated.split("\n").find((l) => l.startsWith("| P0-1"));
    expect(p01).toContain("NEEDS REVIEW");
    expect(p01).not.toContain("CLOSED");
  });

  it("produces a diff, and never mutates the input", () => {
    const before = register;
    const { diff } = proposeRegisterEdit(register, RECEIPT);
    expect(diff).toContain("--- a/docs/register.md");
    expect(diff).toContain("+++ b/docs/register.md");
    expect(register).toBe(before);
  });

  it("returns an empty diff when nothing changed", () => {
    expect(unifiedDiff("x.md", ["a"], ["a"])).toBe("");
  });
});

describe("run orchestration", () => {
  const base = {
    companyId: "c1",
    repoDir: "/tmp/miss",
    repo: "regain-inc/miss",
    registerPath: "docs/register.md",
    trigger: "webhook" as const,
  };

  it("files a task with the receipt when drift exists", async () => {
    const filed: unknown[] = [];
    const filer: TaskFiler = {
      file: async (input) => {
        filed.push(input);
        return { id: "issue-1" };
      },
    };
    const outcome = await runReconciliation(base, { filer });
    expect(outcome.ran).toBe(true);
    expect(outcome.task?.title).toContain("Register drift");
    expect(filed).toHaveLength(1);
  });

  it("skips a head commit that was already reconciled", async () => {
    const store: RunStore = { hasRun: async () => true, record: async () => {} };
    const outcome = await runReconciliation(base, { store });
    expect(outcome.ran).toBe(false);
    expect(outcome.skippedReason).toContain("already reconciled");
  });

  it("records history when it does run", async () => {
    const rows: unknown[] = [];
    const store: RunStore = { hasRun: async () => false, record: async (r) => void rows.push(r) };
    await runReconciliation(base, { store });
    expect(rows).toHaveLength(1);
  });

  it("does not file a task when there is no drift", async () => {
    const filer: TaskFiler = { file: vi.fn(async () => ({ id: "x" })) };
    const clean = { ...RECEIPT, findings: [RECEIPT.findings[1]] };
    const mod = await import("../services/register-truth.js");
    vi.mocked(mod.reconcileRegister).mockReturnValueOnce(clean);
    const outcome = await runReconciliation(base, { filer });
    expect(outcome.task).toBeUndefined();
    expect(filer.file).not.toHaveBeenCalled();
  });
});
