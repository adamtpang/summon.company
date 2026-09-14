import { describe, expect, it, vi } from "vitest";
import type { Issue } from "@paperclipai/shared";
import { closeFocusTask, closureBlockReason, focusQueue } from "./summon-focus";

const task = (overrides: Partial<Issue> = {}) => ({ id: "task-1", companyId: "company-1", projectId: "project-1", status: "blocked", priority: "high", createdAt: new Date("2026-09-01"), executionRunId: null, ...overrides }) as Issue;

describe("Summon focus queue", () => {
  it("shows only this company's blocked and review tasks in the chosen project", () => {
    const rows = [task(), task({ id: "foreign", companyId: "other" }), task({ id: "done", status: "done" }), task({ id: "other-project", projectId: "other" }), task({ id: "review", status: "in_review" })];
    expect(focusQueue(rows, "company-1", "project-1").map((row) => row.id)).toEqual(["review", "task-1"]);
    expect(rows).toHaveLength(5);
  });
  it("puts urgent work first, then older work, without mutating its input", () => {
    const rows = [task(), task({ id: "old", createdAt: new Date("2026-08-01") }), task({ id: "urgent", priority: "critical" })];
    expect(focusQueue(rows, "company-1").map((row) => row.id)).toEqual(["urgent", "old", "task-1"]);
    expect(rows[0].id).toBe("task-1");
  });
});

describe("verified closure", () => {
  it.each([
    { companyId: "other" }, { status: "done" }, { executionRunId: "active-run" },
    { blockedBy: [{ id: "dependency", status: "in_progress" }] },
  ])("rejects a changed or unsafe task before writing: %j", async (overrides) => {
    const api = { get: vi.fn().mockResolvedValue(task(overrides as Partial<Issue>)), update: vi.fn() };
    await expect(closeFocusTask(api, task(), "company-1", "Checked receipt")).rejects.toThrow();
    expect(api.update).not.toHaveBeenCalled();
  });
  it("requires evidence before any request", async () => {
    const api = { get: vi.fn(), update: vi.fn() };
    await expect(closeFocusTask(api, task(), "company-1", "  ")).rejects.toThrow("evidence");
    expect(api.get).not.toHaveBeenCalled();
  });
  it("saves the evidence and terminal status together through the existing contract", async () => {
    const api = { get: vi.fn().mockResolvedValue(task()), update: vi.fn().mockResolvedValue(task({ status: "done" })) };
    await closeFocusTask(api, task(), "company-1", "  Receipt: isolated checkout passes  ");
    expect(api.update).toHaveBeenCalledWith("task-1", { status: "done", comment: "Verified closure\n\nReceipt: isolated checkout passes" });
  });
  it("surfaces a rejected save without retrying or claiming success", async () => {
    const api = { get: vi.fn().mockResolvedValue(task()), update: vi.fn().mockRejectedValue(new Error("Conflict")) };
    await expect(closeFocusTask(api, task(), "company-1", "Receipt")).rejects.toThrow("Conflict");
    expect(api.update).toHaveBeenCalledTimes(1);
  });
  it("allows completed dependencies", () => {
    expect(closureBlockReason(task({ blockedBy: [{ status: "done" }, { status: "cancelled" }] as Issue["blockedBy"] }), "company-1")).toBeNull();
  });
  it("does not claim closure when the server leaves the task open", async () => {
    const api = { get: vi.fn().mockResolvedValue(task()), update: vi.fn().mockResolvedValue(task()) };
    await expect(closeFocusTask(api, task(), "company-1", "Receipt")).rejects.toThrow("did not confirm closure");
  });
});
