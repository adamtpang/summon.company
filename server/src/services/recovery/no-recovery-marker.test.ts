import { describe, expect, it } from "vitest";
import {
  NO_RECOVERY_RESULT_KEY,
  buildNoRecoveryMarker,
  isNoRecoveryCancelActor,
  readNoRecoveryMarker,
} from "./no-recovery-marker.js";

describe("no-recovery-marker (SUM-173 / SUM-144 D2)", () => {
  it("stamps a durable suppressed marker for board cancel", () => {
    const fragment = buildNoRecoveryMarker({
      reason: "board_cancel",
      actorType: "user",
      actorId: "board",
    });
    expect(fragment[NO_RECOVERY_RESULT_KEY]?.suppressed).toBe(true);
    expect(readNoRecoveryMarker({ resultJson: fragment })?.reason).toBe("board_cancel");
  });

  it("survives JSON persistence and string storage", () => {
    const fragment = buildNoRecoveryMarker({
      reason: "board_cancel",
      actorType: "user",
      actorId: "board",
    });
    const persisted = JSON.parse(JSON.stringify(fragment));
    expect(readNoRecoveryMarker({ resultJson: persisted })?.actorType).toBe("user");
    expect(readNoRecoveryMarker({ resultJson: JSON.stringify(persisted) })?.actorId).toBe("board");
  });

  it("treats user/board actors as no-recovery and leaves agent/system alone", () => {
    expect(isNoRecoveryCancelActor("user")).toBe(true);
    expect(isNoRecoveryCancelActor("board")).toBe(true);
    expect(isNoRecoveryCancelActor("agent")).toBe(false);
    expect(isNoRecoveryCancelActor("system")).toBe(false);
    expect(isNoRecoveryCancelActor(null)).toBe(false);
  });

  it("returns null when marker is absent or not suppressed", () => {
    expect(readNoRecoveryMarker({ resultJson: {} })).toBeNull();
    expect(readNoRecoveryMarker({ resultJson: { [NO_RECOVERY_RESULT_KEY]: { suppressed: false } } })).toBeNull();
    expect(readNoRecoveryMarker(null)).toBeNull();
  });
});
