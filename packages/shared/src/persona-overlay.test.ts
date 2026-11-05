import { describe, expect, it } from "vitest";
import {
  PERSONA_OVERLAY_HEADING,
  buildPersonaOverlaySection,
  personaOverlayRoster,
  resolvePersonaOverlay,
  swapPersonaOverlaySection,
} from "./persona-overlay.js";

// The shipped Engineering AGENTS.md persona block, verbatim in shape, used to
// prove in-place swaps preserve everything around the overlay.
const ENGINEERING_INSTRUCTIONS = [
  "# Vitals CTO",
  "",
  "You own Engineering leadership for vitals.run.",
  "",
  "Operating rules:",
  "",
  "- Work one assigned issue at a time through Paperclip.",
  "",
  "## Your persona: Elon Musk (1971–present) — the fun-game layer (board, 2026-07-19)",
  "",
  "The engineer who rebuilt rockets and cars from the atoms up.",
  "",
  "Principles:",
  "- Delete first, optimize second.",
  "",
  "Full persona: company/engineering/persona.json.",
].join("\n");

describe("resolvePersonaOverlay", () => {
  it("resolves shipped slugs to their archetype", () => {
    expect(resolvePersonaOverlay("elon-musk")?.archetype).toBe("Elon Musk");
    expect(resolvePersonaOverlay("warren-buffett")?.archetype).toBe("Warren Buffett");
    expect(resolvePersonaOverlay("  john-d-rockefeller ")?.archetype).toBe("John D. Rockefeller");
  });

  it("returns null for unknown / empty slugs so default agents are untouched", () => {
    expect(resolvePersonaOverlay("napoleon")).toBeNull();
    expect(resolvePersonaOverlay("")).toBeNull();
    expect(resolvePersonaOverlay("   ")).toBeNull();
    expect(resolvePersonaOverlay(null)).toBeNull();
    expect(resolvePersonaOverlay(undefined)).toBeNull();
  });

  it("carries a full, per-department roster", () => {
    const roster = personaOverlayRoster();
    expect(roster.length).toBe(24);
    // exactly one default per department
    const defaults = roster.filter((p) => p.isDefault).map((p) => p.department).sort();
    expect(defaults).toEqual([
      "design",
      "engineering",
      "finance",
      "legal",
      "marketing",
      "operations",
      "sales",
      "support",
    ]);
  });
});

describe("buildPersonaOverlaySection", () => {
  it("emits a primary-sourced quote when the archetype has one", () => {
    const buffett = buildPersonaOverlaySection(resolvePersonaOverlay("john-d-rockefeller")!);
    expect(buffett).toContain(PERSONA_OVERLAY_HEADING);
    expect(buffett).toContain("Verified words:");
    expect(buffett).toContain("Full persona: company/finance/persona.json.");
  });

  it("NEVER fabricates a quote for an un-sourced alternate archetype", () => {
    const buffett = resolvePersonaOverlay("warren-buffett")!;
    expect(buffett.quote).toBeNull();
    const section = buildPersonaOverlaySection(buffett);
    expect(section).not.toContain("Verified words:");
    // still carries the doctrine
    expect(section).toContain("wonderful businesses");
  });
});

describe("swapPersonaOverlaySection", () => {
  it("leaves instructions unchanged when no persona is set", () => {
    expect(swapPersonaOverlaySection(ENGINEERING_INSTRUCTIONS, null)).toBe(ENGINEERING_INSTRUCTIONS);
    expect(swapPersonaOverlaySection(ENGINEERING_INSTRUCTIONS, undefined)).toBe(ENGINEERING_INSTRUCTIONS);
  });

  it("shifts the register from Rockefeller to Buffett — the SUM-253 acceptance", () => {
    // Start from a Finance instruction bundle wearing the default (Rockefeller).
    const financeBase = ENGINEERING_INSTRUCTIONS
      .replace("# Vitals CTO", "# Vitals CFO")
      .replace(
        /## Your persona:[\s\S]*$/,
        buildPersonaOverlaySection(resolvePersonaOverlay("john-d-rockefeller")!),
      );
    expect(financeBase).toContain("respect the smallest figure"); // cost-accounting doctrine
    expect(financeBase).not.toContain("wonderful businesses");

    const swapped = swapPersonaOverlaySection(financeBase, resolvePersonaOverlay("warren-buffett"));

    // Register has shifted to Buffett's moats / hold-forever doctrine...
    expect(swapped).toContain("wonderful businesses at fair prices");
    expect(swapped).toContain("Warren Buffett");
    // ...and the Rockefeller doctrine is gone.
    expect(swapped).not.toContain("respect the smallest figure");
    expect(swapped).not.toContain("John D. Rockefeller");
    // Everything OUTSIDE the overlay is preserved verbatim (governance intact).
    expect(swapped).toContain("# Vitals CFO");
    expect(swapped).toContain("- Work one assigned issue at a time through Paperclip.");
    // Exactly one persona heading remains.
    expect(swapped.match(/## Your persona:/g)?.length).toBe(1);
  });

  it("preserves content that follows the overlay when it is not the last section", () => {
    const withTrailer = `${ENGINEERING_INSTRUCTIONS}\n\n## Tooling\n\nUse curl for API calls.\n`;
    const swapped = swapPersonaOverlaySection(withTrailer, resolvePersonaOverlay("linus-torvalds"));
    expect(swapped).toContain("Linus Torvalds");
    expect(swapped).toContain("## Tooling");
    expect(swapped).toContain("Use curl for API calls.");
    expect(swapped).not.toContain("Elon Musk");
  });

  it("appends an overlay when the instructions have none", () => {
    const bare = "# Vitals Ops\n\nDo the work.";
    const swapped = swapPersonaOverlaySection(bare, resolvePersonaOverlay("jeff-bezos"));
    expect(swapped).toContain("# Vitals Ops");
    expect(swapped).toContain("## Your persona: Jeff Bezos");
  });

  it("is idempotent", () => {
    const once = swapPersonaOverlaySection(ENGINEERING_INSTRUCTIONS, resolvePersonaOverlay("grace-hopper"));
    const twice = swapPersonaOverlaySection(once, resolvePersonaOverlay("grace-hopper"));
    expect(twice).toBe(once);
  });
});
