import { describe, expect, it } from "vitest";
import {
  ACTIVE_AGING_MS,
  ACTIVE_WRONG_MS,
  WAITING_AGING_MS,
  WAITING_WRONG_MS,
  deriveIssueAge,
  formatAgeCompact,
} from "./issue-age";
import type { IssueStatus } from "@paperclipai/shared";

const NOW = new Date("2026-07-16T12:00:00Z").getTime();

function issueAt(status: IssueStatus, overrides: Partial<{
  startedAt: string | null;
  createdAt: string;
  updatedAt: string;
}> = {}) {
  return {
    status,
    startedAt: overrides.startedAt !== undefined ? overrides.startedAt : null,
    createdAt: overrides.createdAt ?? "2026-07-10T12:00:00Z",
    updatedAt: overrides.updatedAt ?? "2026-07-15T12:00:00Z",
  };
}

describe("deriveIssueAge", () => {
  it("returns null for terminal statuses", () => {
    expect(deriveIssueAge(issueAt("done"), NOW)).toBeNull();
    expect(deriveIssueAge(issueAt("cancelled"), NOW)).toBeNull();
  });

  it("anchors in_progress on startedAt with the working label", () => {
    const age = deriveIssueAge(issueAt("in_progress", { startedAt: "2026-07-16T10:00:00Z" }), NOW);
    expect(age).toMatchObject({ anchor: "startedAt", stateLabel: "working", tier: "calm", compact: "2h" });
  });

  it("falls back to createdAt when in_progress has no startedAt", () => {
    const age = deriveIssueAge(issueAt("in_progress", { createdAt: "2026-07-16T09:00:00Z" }), NOW);
    expect(age).toMatchObject({ anchor: "createdAt", compact: "3h" });
  });

  it("anchors review and blocked on updatedAt", () => {
    const review = deriveIssueAge(issueAt("in_review", { updatedAt: "2026-07-16T06:00:00Z" }), NOW);
    expect(review).toMatchObject({ anchor: "updatedAt", stateLabel: "in review", tier: "calm" });
    const blocked = deriveIssueAge(issueAt("blocked", { updatedAt: "2026-07-13T12:00:00Z" }), NOW);
    expect(blocked).toMatchObject({ stateLabel: "blocked", tier: "wrong", compact: "3d" });
  });

  it("escalates active work through calm → aging → wrong", () => {
    const calm = deriveIssueAge(
      issueAt("in_progress", { startedAt: new Date(NOW - ACTIVE_AGING_MS + 60_000).toISOString() }),
      NOW,
    );
    expect(calm?.tier).toBe("calm");
    const aging = deriveIssueAge(
      issueAt("in_progress", { startedAt: new Date(NOW - ACTIVE_AGING_MS).toISOString() }),
      NOW,
    );
    expect(aging?.tier).toBe("aging");
    const wrong = deriveIssueAge(
      issueAt("in_progress", { startedAt: new Date(NOW - ACTIVE_WRONG_MS).toISOString() }),
      NOW,
    );
    expect(wrong?.tier).toBe("wrong");
  });

  it("gives waiting work a longer leash", () => {
    const fresh = deriveIssueAge(
      issueAt("todo", { createdAt: new Date(NOW - WAITING_AGING_MS + 60_000).toISOString() }),
      NOW,
    );
    expect(fresh).toMatchObject({ stateLabel: "waiting", tier: "calm" });
    const aging = deriveIssueAge(
      issueAt("backlog", { createdAt: new Date(NOW - WAITING_AGING_MS).toISOString() }),
      NOW,
    );
    expect(aging?.tier).toBe("aging");
    const wrong = deriveIssueAge(
      issueAt("todo", { createdAt: new Date(NOW - WAITING_WRONG_MS).toISOString() }),
      NOW,
    );
    expect(wrong?.tier).toBe("wrong");
  });

  it("clamps future anchors to zero age", () => {
    const age = deriveIssueAge(issueAt("in_progress", { startedAt: "2026-07-16T13:00:00Z" }), NOW);
    expect(age).toMatchObject({ ageMs: 0, compact: "<1m", tier: "calm" });
  });
});

describe("formatAgeCompact", () => {
  it("renders compact machine-style ages", () => {
    expect(formatAgeCompact(30_000)).toBe("<1m");
    expect(formatAgeCompact(5 * 60_000)).toBe("5m");
    expect(formatAgeCompact(3 * 3_600_000)).toBe("3h");
    expect(formatAgeCompact(5 * 86_400_000)).toBe("5d");
    expect(formatAgeCompact(21 * 86_400_000)).toBe("3w");
  });
});
