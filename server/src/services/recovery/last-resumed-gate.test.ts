import { describe, expect, it } from "vitest";
import {
  hasPostResumeIntent,
  readLastResumedAt,
  shouldSkipStaleBacklogAfterResume,
} from "./last-resumed-gate.js";

describe("last-resumed-gate (SUM-170)", () => {
  const resumeAt = new Date("2026-07-19T06:00:00.000Z");
  const before = new Date("2026-07-18T12:00:00.000Z");
  const after = new Date("2026-07-19T06:05:00.000Z");

  it("skips stale backlog after unpause", () => {
    const agent = { lastResumedAt: resumeAt };
    expect(shouldSkipStaleBacklogAfterResume(agent, {
      issueUpdatedAt: before,
      issueCreatedAt: before,
    })).toBe(true);
  });

  it("allows post-resume issue update", () => {
    const agent = { lastResumedAt: resumeAt };
    expect(shouldSkipStaleBacklogAfterResume(agent, {
      issueUpdatedAt: after,
      issueCreatedAt: before,
    })).toBe(false);
  });

  it("keeps legacy null lastResumedAt behaviour", () => {
    expect(readLastResumedAt({ lastResumedAt: null })).toBeNull();
    expect(hasPostResumeIntent(null, {})).toBe(true);
    expect(shouldSkipStaleBacklogAfterResume({ lastResumedAt: null }, {
      issueUpdatedAt: before,
    })).toBe(false);
  });
});
