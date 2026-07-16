import { describe, expect, it } from "vitest";
import {
  buildVitalsAiSdrDogfoodBundle,
  renderVitalsAiSdrDossiersMarkdown,
  renderVitalsAiSdrDraftsMarkdown,
  VITALS_AI_SDR_MEASUREMENT_EVENT_NAMES,
} from "./vitals-ai-sdr.js";

const INTAKE = {
  companyUrl: "https://vitals.run",
  icp: "Founder-led B2B software companies preparing their first outbound workflow",
  senderIdentity: "Adam from vitals.run",
  objective: "book a short diagnosis call around a board-approved AI SDR loop",
  bannedClaims: ["guaranteed meetings", "inbox placement"],
  geography: "United States",
  maxDraftCount: 1,
  notes: "Dogfood inside Paperclip only.",
};

describe("Vitals AI SDR dogfood bundle", () => {
  it("generates a cited dossier and personalized draft from local fixtures", () => {
    const bundle = buildVitalsAiSdrDogfoodBundle(INTAKE, { now: "2026-07-15T00:00:00.000Z" });

    expect(bundle.campaign.companyHost).toBe("vitals.run");
    expect(bundle.leadSourcePlan.kind).toBe("local_fixture");
    expect(bundle.dossiers).toHaveLength(1);
    expect(bundle.drafts).toHaveLength(1);
    expect(bundle.dossiers[0]?.citations.map((citation) => citation.id)).toEqual(["F1", "F2", "F3"]);
    expect(bundle.drafts[0]?.body).toContain("Maya");
    expect(bundle.drafts[0]?.body).toContain("[F1]");
    expect(bundle.drafts[0]?.approvalStatus).toBe("pending_board_approval");
    expect(bundle.drafts[0]?.body.toLowerCase()).not.toContain("guaranteed meetings");
    expect(bundle.drafts[0]?.blockedBannedClaims).toEqual([]);

    const dossierMarkdown = renderVitalsAiSdrDossiersMarkdown(bundle);
    const draftMarkdown = renderVitalsAiSdrDraftsMarkdown(bundle);
    expect(dossierMarkdown).toContain("[F1]");
    expect(dossierMarkdown).toContain("Local sample fixture");
    expect(draftMarkdown).toContain("Every draft is pending board approval");
  });

  it("emits all required internal measurement events", () => {
    const bundle = buildVitalsAiSdrDogfoodBundle(INTAKE, { now: "2026-07-15T00:00:00.000Z" });
    const eventNames = bundle.measurementEvents.map((event) => event.eventName);

    for (const name of VITALS_AI_SDR_MEASUREMENT_EVENT_NAMES) {
      expect(eventNames).toContain(name);
    }
  });

  it("renders downstream external stages as blocked", () => {
    const bundle = buildVitalsAiSdrDogfoodBundle({ ...INTAKE, maxDraftCount: 2 }, { now: "2026-07-15T00:00:00.000Z" });

    expect(bundle.drafts).toHaveLength(2);
    expect(bundle.downstreamBlocks.map((block) => block.stageKey)).toEqual([
      "external_lead_source_access",
      "deliverability",
      "outbound",
      "crm_sync",
      "calendar_sync",
    ]);
    expect(bundle.downstreamBlocks.every((block) => block.status === "blocked")).toBe(true);
  });
});
