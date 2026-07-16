import { describe, expect, it } from "vitest";

import {
  deriveResumeAffordances,
  formatResumeAffordanceLabel,
  resumeAffordanceForRun,
  type ResumeAffordanceMessage,
} from "./resume-affordance";

function msg(
  partial: Partial<ResumeAffordanceMessage> & { createdAtMs: number },
): ResumeAffordanceMessage {
  return {
    role: partial.role ?? "assistant",
    runId: partial.runId ?? null,
    createdAtMs: partial.createdAtMs,
  };
}

describe("deriveResumeAffordances", () => {
  it("returns no affordances for an empty thread", () => {
    expect(deriveResumeAffordances([]).size).toBe(0);
  });

  it("marks the first run of a thread as not resumed, even behind a user opener", () => {
    const messages: ResumeAffordanceMessage[] = [
      msg({ role: "user", runId: null, createdAtMs: 1 }),
      msg({ role: "assistant", runId: "run-a", createdAtMs: 2 }),
    ];
    const affordance = deriveResumeAffordances(messages).get("run-a");
    // A user opener precedes run-a, but run-a is the FIRST run in the thread,
    // so nothing was resumed — a genuinely fresh chat shows no affordance.
    expect(affordance).toEqual({
      runId: "run-a",
      resumed: false,
      priorMessageCount: 1,
      label: "",
    });
  });

  it("does not flag a run when nothing precedes it", () => {
    const messages: ResumeAffordanceMessage[] = [
      msg({ role: "assistant", runId: "run-a", createdAtMs: 1 }),
      msg({ role: "assistant", runId: "run-a", createdAtMs: 2 }),
    ];
    expect(deriveResumeAffordances(messages).get("run-a")).toEqual({
      runId: "run-a",
      resumed: false,
      priorMessageCount: 0,
      label: "",
    });
  });

  it("counts prior conversational turns for a later run (resumed chat)", () => {
    const messages: ResumeAffordanceMessage[] = [
      msg({ role: "user", runId: null, createdAtMs: 1 }),
      msg({ role: "assistant", runId: "run-a", createdAtMs: 2 }),
      msg({ role: "user", runId: null, createdAtMs: 3 }),
      msg({ role: "assistant", runId: "run-b", createdAtMs: 4 }),
    ];
    const affordances = deriveResumeAffordances(messages);
    expect(affordances.get("run-b")).toEqual({
      runId: "run-b",
      resumed: true,
      priorMessageCount: 3,
      label: "Resumed · 3 earlier messages in this conversation",
    });
  });

  it("excludes system notices from the prior-turn count", () => {
    const messages: ResumeAffordanceMessage[] = [
      msg({ role: "user", runId: null, createdAtMs: 1 }),
      msg({ role: "system", runId: null, createdAtMs: 2 }),
      msg({ role: "assistant", runId: "run-a", createdAtMs: 3 }),
      msg({ role: "system", runId: null, createdAtMs: 4 }),
      msg({ role: "assistant", runId: "run-b", createdAtMs: 5 }),
    ];
    const affordances = deriveResumeAffordances(messages);
    // Before run-b: user(1) + assistant run-a(1) = 2 conversational turns; the
    // two system notices are ignored.
    expect(affordances.get("run-b")?.priorMessageCount).toBe(2);
  });

  it("orders defensively by createdAtMs regardless of input order", () => {
    const messages: ResumeAffordanceMessage[] = [
      msg({ role: "assistant", runId: "run-b", createdAtMs: 40 }),
      msg({ role: "assistant", runId: "run-a", createdAtMs: 10 }),
      msg({ role: "user", runId: null, createdAtMs: 30 }),
      msg({ role: "user", runId: null, createdAtMs: 20 }),
    ];
    const affordances = deriveResumeAffordances(messages);
    expect(affordances.get("run-a")?.priorMessageCount).toBe(0);
    expect(affordances.get("run-a")?.resumed).toBe(false);
    // run-b at t=40 is preceded by run-a(t10), user(t20), user(t30) = 3 turns.
    expect(affordances.get("run-b")?.priorMessageCount).toBe(3);
    expect(affordances.get("run-b")?.resumed).toBe(true);
  });
});

describe("resumeAffordanceForRun", () => {
  const messages: ResumeAffordanceMessage[] = [
    msg({ role: "user", runId: null, createdAtMs: 1 }),
    msg({ role: "assistant", runId: "run-a", createdAtMs: 2 }),
    msg({ role: "user", runId: null, createdAtMs: 3 }),
    msg({ role: "assistant", runId: "run-b", createdAtMs: 4 }),
  ];

  it("returns the affordance for a resumed run", () => {
    expect(resumeAffordanceForRun(messages, "run-b")?.priorMessageCount).toBe(3);
  });

  it("returns null for a run that opened a fresh conversation", () => {
    const fresh: ResumeAffordanceMessage[] = [
      msg({ role: "assistant", runId: "run-a", createdAtMs: 1 }),
    ];
    expect(resumeAffordanceForRun(fresh, "run-a")).toBeNull();
  });

  it("degrades gracefully for a missing or empty runId", () => {
    expect(resumeAffordanceForRun(messages, null)).toBeNull();
    expect(resumeAffordanceForRun(messages, undefined)).toBeNull();
    expect(resumeAffordanceForRun(messages, "")).toBeNull();
    expect(resumeAffordanceForRun(messages, "run-unknown")).toBeNull();
  });
});

describe("formatResumeAffordanceLabel", () => {
  it("uses singular for one prior message", () => {
    expect(formatResumeAffordanceLabel(1)).toBe(
      "Resumed · 1 earlier message in this conversation",
    );
  });

  it("uses plural for many prior messages", () => {
    expect(formatResumeAffordanceLabel(5)).toBe(
      "Resumed · 5 earlier messages in this conversation",
    );
  });

  it("returns empty for zero or negative counts", () => {
    expect(formatResumeAffordanceLabel(0)).toBe("");
    expect(formatResumeAffordanceLabel(-2)).toBe("");
  });
});
