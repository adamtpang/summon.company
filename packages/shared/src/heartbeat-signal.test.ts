import { describe, it, expect } from "vitest";
import { parseHeartbeatSignal } from "./heartbeat-signal.js";

/**
 * VIT-44 §2 (SUM-231) — the classifier contract. An explicit HEARTBEAT_OK is
 * recognized and silent; an evidence-backed ```heartbeat-alert block is an
 * alert; anything else is silent (never a false alarm).
 */
describe("parseHeartbeatSignal", () => {
  it("classifies an explicit HEARTBEAT_OK marker as ok", () => {
    const signal = parseHeartbeatSignal("Ran the checklist, nothing to report. HEARTBEAT_OK");
    expect(signal.kind).toBe("ok");
  });

  it("does not treat HEARTBEAT_OK inside a longer token as ok", () => {
    expect(parseHeartbeatSignal("status=HEARTBEAT_OKAY").kind).toBe("none");
    expect(parseHeartbeatSignal("MY_HEARTBEAT_OKISH thing").kind).toBe("none");
  });

  it("classifies a valid ```heartbeat-alert block as an evidence-backed alert", () => {
    const body = [
      "Checklist done, but I found a problem.",
      "",
      "```heartbeat-alert",
      JSON.stringify({
        title: "Prod error rate spiking",
        severity: "critical",
        evidence: "5xx rate went 0.1% -> 4% at 14:02 UTC; see dashboard panel 'api-errors'.",
      }),
      "```",
    ].join("\n");
    const signal = parseHeartbeatSignal(body);
    expect(signal.kind).toBe("alert");
    if (signal.kind !== "alert") throw new Error("expected alert");
    expect(signal.alert.title).toBe("Prod error rate spiking");
    expect(signal.alert.severity).toBe("critical");
    expect(signal.alert.evidence).toContain("5xx rate");
  });

  it("defaults alert severity to high when omitted", () => {
    const body = "```heartbeat-alert\n" + JSON.stringify({ title: "T", evidence: "E" }) + "\n```";
    const signal = parseHeartbeatSignal(body);
    expect(signal.kind).toBe("alert");
    if (signal.kind !== "alert") throw new Error("expected alert");
    expect(signal.alert.severity).toBe("high");
  });

  it("prefers a valid alert block over an OK marker (a finding is never silent)", () => {
    const body =
      "HEARTBEAT_OK\n\n```heartbeat-alert\n" +
      JSON.stringify({ title: "But actually", evidence: "queue depth climbing" }) +
      "\n```";
    expect(parseHeartbeatSignal(body).kind).toBe("alert");
  });

  it("rejects an alert block with no evidence as invalid, not a silent drop", () => {
    const body = "```heartbeat-alert\n" + JSON.stringify({ title: "Something" }) + "\n```";
    const signal = parseHeartbeatSignal(body);
    expect(signal.kind).toBe("invalid");
    if (signal.kind !== "invalid") throw new Error("expected invalid");
    expect(signal.error).toMatch(/evidence/);
  });

  it("rejects a malformed JSON alert block as invalid", () => {
    const signal = parseHeartbeatSignal("```heartbeat-alert\n{ not json }\n```");
    expect(signal.kind).toBe("invalid");
  });

  it("rejects an unknown severity", () => {
    const body =
      "```heartbeat-alert\n" +
      JSON.stringify({ title: "T", evidence: "E", severity: "urgent" }) +
      "\n```";
    expect(parseHeartbeatSignal(body).kind).toBe("invalid");
  });

  it("classifies plain output with neither convention as none (silent)", () => {
    expect(parseHeartbeatSignal("Did some work. Posted a comment.").kind).toBe("none");
    expect(parseHeartbeatSignal("").kind).toBe("none");
    expect(parseHeartbeatSignal(null).kind).toBe("none");
    expect(parseHeartbeatSignal(undefined).kind).toBe("none");
  });
});
