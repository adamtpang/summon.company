import { describe, it, expect } from "vitest";
import {
  extractOutcomeBlock,
  parseOutcomeReceipt,
  outcomeTimeValueCents,
} from "./outcome-receipt.js";

/**
 * The canonical worked receipt from OUTCOME-RECEIPTS.md §5 (VIT-62). If this
 * stops validating, the standard and the code have drifted.
 */
const VIT62_RECEIPT = `Closing VIT-62. The local AI SDR loop is done.

\`\`\`outcome
{
  "outcome": {
    "timeSavedMinutes": 60,
    "revenueMovedCents": 0,
    "riskAvoided": "un-gated outbound send prevented — every draft held in pending_board_approval; no live sender wired"
  },
  "confidence": "estimated",
  "method": "Time: industry-standard 1:1 SDR research+personalized-draft baseline of ~30 min/prospect × 2 real prospects = 60 min. Revenue: 0 — nothing sent. Risk: qualitative. Time value ≈ $60 @ $60/h, shown separately."
}
\`\`\`
`;

describe("extractOutcomeBlock", () => {
  it("pulls the inner JSON from a fenced ```outcome block", () => {
    const inner = extractOutcomeBlock(VIT62_RECEIPT);
    expect(inner).not.toBeNull();
    expect(inner).toContain("timeSavedMinutes");
  });

  it("accepts the ```outcome json info-string variant", () => {
    const inner = extractOutcomeBlock('```outcome json\n{"a":1}\n```');
    expect(inner).toBe('{"a":1}\n');
  });

  it("returns null when there is no outcome block", () => {
    expect(extractOutcomeBlock("just a normal closing comment")).toBeNull();
    // A fenced block that is not an outcome block must be ignored.
    expect(extractOutcomeBlock("```json\n{}\n```")).toBeNull();
  });
});

describe("parseOutcomeReceipt — the VIT-62 worked example (§5)", () => {
  const result = parseOutcomeReceipt(VIT62_RECEIPT);

  it("validates and normalizes the §5 receipt", () => {
    expect(result.present).toBe(true);
    if (!(result.present && result.ok)) throw new Error("expected ok receipt");
    expect(result.receipt.timeSavedMinutes).toBe(60);
    // revenueMovedCents: 0 normalizes to null (0 = "not populated").
    expect(result.receipt.revenueMovedCents).toBeNull();
    expect(result.receipt.moneySavedCents).toBeNull();
    expect(result.receipt.riskAvoided).toContain("un-gated outbound send");
    expect(result.receipt.confidence).toBe("estimated");
    expect(result.receipt.method.length).toBeGreaterThan(0);
  });

  it("values the 60 saved minutes at $60/h = 6000¢, kept separate from money", () => {
    if (!(result.present && result.ok)) throw new Error("expected ok receipt");
    expect(outcomeTimeValueCents(result.receipt.timeSavedMinutes)).toBe(6000);
    // GUARDRAIL: time value must never be merged into the (null) cash total.
    expect(result.receipt.moneySavedCents).toBeNull();
  });
});

describe("parseOutcomeReceipt — presence", () => {
  it("reports not-present when no block exists", () => {
    expect(parseOutcomeReceipt("done, no receipt")).toEqual({ present: false });
  });
});

describe("parseOutcomeReceipt — honesty rules (§1)", () => {
  const wrap = (json: string) => "closing\n```outcome\n" + json + "\n```";

  it("rejects invalid JSON", () => {
    const r = parseOutcomeReceipt(wrap("{ not json }"));
    expect(r).toMatchObject({ present: true, ok: false });
  });

  it("rejects a missing/empty method", () => {
    const r = parseOutcomeReceipt(
      wrap('{"outcome":{"timeSavedMinutes":30},"confidence":"estimated","method":"  "}'),
    );
    expect(r).toMatchObject({ present: true, ok: false });
    if (r.present && !r.ok) expect(r.error).toContain("method");
  });

  it("rejects an unknown confidence tier", () => {
    const r = parseOutcomeReceipt(
      wrap('{"outcome":{"timeSavedMinutes":30},"confidence":"high","method":"x"}'),
    );
    expect(r).toMatchObject({ present: true, ok: false });
    if (r.present && !r.ok) expect(r.error).toContain("confidence");
  });

  it("rejects a receipt with no lever and confidence != unmeasurable", () => {
    const r = parseOutcomeReceipt(
      wrap('{"outcome":{"moneySavedCents":0,"revenueMovedCents":0,"riskAvoided":null},"confidence":"estimated","method":"nothing moved"}'),
    );
    expect(r).toMatchObject({ present: true, ok: false });
    if (r.present && !r.ok) expect(r.error).toContain("at least one lever");
  });

  it("accepts a lever-less receipt when confidence=unmeasurable", () => {
    const r = parseOutcomeReceipt(
      wrap('{"outcome":{},"confidence":"unmeasurable","method":"no honest basis — de-risking only"}'),
    );
    expect(r).toMatchObject({ present: true, ok: true });
  });

  it("rejects negative and non-integer levers", () => {
    expect(
      parseOutcomeReceipt(wrap('{"outcome":{"moneySavedCents":-5},"confidence":"measured","method":"x"}')),
    ).toMatchObject({ ok: false });
    expect(
      parseOutcomeReceipt(wrap('{"outcome":{"timeSavedMinutes":1.5},"confidence":"measured","method":"x"}')),
    ).toMatchObject({ ok: false });
  });

  it("accepts a single-lever measured money receipt", () => {
    const r = parseOutcomeReceipt(
      wrap('{"outcome":{"moneySavedCents":9900},"confidence":"measured","method":"canceled a $99/mo tool, first month counted"}'),
    );
    expect(r).toMatchObject({ present: true, ok: true });
    if (r.present && r.ok) {
      expect(r.receipt.moneySavedCents).toBe(9900);
      expect(r.receipt.timeSavedMinutes).toBeNull();
    }
  });
});
