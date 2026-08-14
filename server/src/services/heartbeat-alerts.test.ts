import { describe, it, expect } from "vitest";
import {
  parseHeartbeatSignal,
  HEARTBEAT_ALERT_ACTIVITY_ACTION,
  HEARTBEAT_OK_ACTIVITY_ACTION,
} from "@paperclipai/shared";
import {
  heartbeatSignalActivity,
  readHeartbeatAlertDetails,
  type HeartbeatAlertEmitContext,
} from "./heartbeat-alerts.js";
import {
  heartbeatAlertAttentionItems,
  type HeartbeatAlertActivityRow,
} from "./attention.js";
import type { LogActivityInput } from "./activity-log.js";

/**
 * VIT-44 §2 (SUM-231) — the OK-silent / alert-surfaces contract, proven end to
 * end over the REAL pipeline (classify → emit decision → board reader) without a
 * live database. Criterion (c): an OK turn produces zero founder notifications
 * while a seeded alert condition surfaces exactly one.
 */

const ctx: HeartbeatAlertEmitContext = {
  companyId: "co-1",
  agentId: "agent-1",
  agentName: "Vitals CTO",
  runId: "run-1",
  issueId: null,
};

/**
 * Mimic the attention reader query + build: keep only `heartbeat.alert`
 * activity rows (exactly what `attentionService.list` selects), normalize their
 * details, and build the board items. This is the founder-facing notification.
 */
function foundersBoardItems(activities: Array<LogActivityInput | null>) {
  const rows: HeartbeatAlertActivityRow[] = activities
    .filter((a): a is LogActivityInput => a?.action === HEARTBEAT_ALERT_ACTIVITY_ACTION)
    .flatMap((a, index) => {
      const details = readHeartbeatAlertDetails(a.details);
      return details ? [{ id: `act-${index}`, createdAt: new Date(0), details }] : [];
    });
  return heartbeatAlertAttentionItems({
    companyId: ctx.companyId,
    prefix: "SUM",
    rows,
    issueMap: new Map(),
  });
}

const ALERT_BODY = [
  "Checklist complete, but I found a real problem.",
  "",
  "```heartbeat-alert",
  JSON.stringify({
    title: "Prod error rate spiking",
    severity: "critical",
    evidence: "5xx rate 0.1% -> 4% at 14:02 UTC; dashboard panel api-errors.",
  }),
  "```",
].join("\n");

describe("heartbeatSignalActivity (emit decision)", () => {
  it("records a silent heartbeat.ok audit row for an OK turn", () => {
    const activity = heartbeatSignalActivity(parseHeartbeatSignal("all clear HEARTBEAT_OK"), ctx);
    expect(activity?.action).toBe(HEARTBEAT_OK_ACTIVITY_ACTION);
  });

  it("records a board-visible heartbeat.alert row for an alert turn", () => {
    const activity = heartbeatSignalActivity(parseHeartbeatSignal(ALERT_BODY), ctx);
    expect(activity?.action).toBe(HEARTBEAT_ALERT_ACTIVITY_ACTION);
    expect(activity?.details?.title).toBe("Prod error rate spiking");
    expect(activity?.details?.severity).toBe("critical");
  });

  it("emits nothing for an unclassified or malformed turn", () => {
    expect(heartbeatSignalActivity(parseHeartbeatSignal("did some work"), ctx)).toBeNull();
    expect(
      heartbeatSignalActivity(parseHeartbeatSignal("```heartbeat-alert\n{bad}\n```"), ctx),
    ).toBeNull();
  });
});

describe("OK-silent / alert-surfaces board contract", () => {
  it("produces zero founder notifications for an OK turn", () => {
    const okActivity = heartbeatSignalActivity(parseHeartbeatSignal("HEARTBEAT_OK"), ctx);
    expect(foundersBoardItems([okActivity])).toHaveLength(0);
  });

  it("surfaces exactly one evidence-backed board item for an alert turn", () => {
    const alertActivity = heartbeatSignalActivity(parseHeartbeatSignal(ALERT_BODY), ctx);
    const items = foundersBoardItems([alertActivity]);
    expect(items).toHaveLength(1);
    expect(items[0].sourceKind).toBe("heartbeat_alert");
    expect(items[0].severity).toBe("critical");
    expect(items[0].whyNow).toContain("Prod error rate spiking");
    expect(items[0].detail).toMatchObject({ kind: "generic" });
    expect((items[0].detail as { summaryExcerpt: string }).summaryExcerpt).toContain("5xx rate");
  });

  it("over one cycle of one OK turn and one alert turn, the board shows exactly one", () => {
    const okActivity = heartbeatSignalActivity(parseHeartbeatSignal("HEARTBEAT_OK"), ctx);
    const alertActivity = heartbeatSignalActivity(parseHeartbeatSignal(ALERT_BODY), ctx);
    expect(foundersBoardItems([okActivity, alertActivity])).toHaveLength(1);
  });
});
