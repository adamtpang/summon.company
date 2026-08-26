// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PersonaCard, personaMonogram } from "./PersonaPicker";
import {
  DEPARTMENTS,
  PERSONAS,
  defaultPersonaFor,
  personaBySlug,
  personasForDepartment,
} from "../lib/personas";
import { isPersonaUnlocked, reachedRoadmapSequence } from "../lib/persona-unlock";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("persona roster", () => {
  it("gives every department exactly one default plus alternates", () => {
    for (const dept of DEPARTMENTS) {
      const roster = personasForDepartment(dept.key);
      const defaults = roster.filter((p) => p.isDefault);
      expect(defaults).toHaveLength(1);
      expect(roster.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("seeds the finance swap named in the acceptance test (Rockefeller | Buffett | Munger)", () => {
    const finance = personasForDepartment("finance").map((p) => p.slug);
    expect(defaultPersonaFor("finance")?.archetype).toBe("John D. Rockefeller");
    expect(finance).toContain("warren-buffett");
    expect(finance).toContain("charlie-munger");
  });

  it("has unique slugs", () => {
    const slugs = PERSONAS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("only ships verbatim quotes on the primary-sourced core-8 (never on alternates)", () => {
    for (const p of PERSONAS) {
      if (p.quote) {
        expect(p.isDefault).toBe(true);
        expect(p.quote.source.length).toBeGreaterThan(0);
      }
    }
  });

  it("resolves personas by slug", () => {
    expect(personaBySlug("dieter-rams")?.archetype).toBe("Dieter Rams");
    expect(personaBySlug("nobody")).toBeUndefined();
  });

  it("gates alternates behind roadmap stages while defaults stay unlocked", () => {
    const rockefeller = personaBySlug("john-d-rockefeller")!;
    const buffett = personaBySlug("warren-buffett")!;
    const munger = personaBySlug("charlie-munger")!;
    expect(isPersonaUnlocked(rockefeller, 0)).toBe(true);
    expect(isPersonaUnlocked(buffett, 0)).toBe(false);
    expect(isPersonaUnlocked(buffett, 3)).toBe(true); // identity complete
    expect(isPersonaUnlocked(munger, 3)).toBe(false);
    expect(isPersonaUnlocked(munger, 4)).toBe(true); // build complete
  });

  it("computes reached roadmap sequence from completed stages only", () => {
    expect(
      reachedRoadmapSequence([
        { stage: { id: "initial_idea", sequence: 1 }, progress: 100 },
        { stage: { id: "found_it", sequence: 2 }, progress: 100 },
        { stage: { id: "identity", sequence: 3 }, progress: 40 },
      ]),
    ).toBe(2);
  });

  it("assigns a portrait motif to every persona", () => {
    for (const p of PERSONAS) {
      expect(p.portraitMotif.length).toBeGreaterThan(0);
    }
  });
});

describe("personaMonogram", () => {
  it("takes first + last initials", () => {
    expect(personaMonogram("Dieter Rams")).toBe("DR");
    expect(personaMonogram("John D. Rockefeller")).toBe("JR");
    expect(personaMonogram("Cher")).toBe("CH");
  });
});

describe("PersonaCard", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });
  afterEach(() => {
    container.remove();
  });

  function render(node: React.ReactElement) {
    const root = createRoot(container);
    act(() => {
      root.render(node);
    });
    return () => act(() => root.unmount());
  }

  it("selecting a card fires onSelect with that persona (the one-click swap)", () => {
    const buffett = personaBySlug("warren-buffett")!;
    let picked: string | null = null;
    render(
      <PersonaCard
        persona={buffett}
        selected={false}
        onSelect={(p) => {
          picked = p.slug;
        }}
      />,
    );
    const btn = container.querySelector("button")!;
    expect(btn.getAttribute("aria-checked")).toBe("false");
    act(() => {
      btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(picked).toBe("warren-buffett");
  });

  it("renders locked state without selecting", () => {
    const buffett = personaBySlug("warren-buffett")!;
    let picked: string | null = null;
    render(
      <PersonaCard
        persona={buffett}
        selected={false}
        locked
        onSelect={(p) => {
          picked = p.slug;
        }}
      />,
    );
    const btn = container.querySelector("button")!;
    expect(btn.getAttribute("data-state")).toBe("locked");
    expect(btn.getAttribute("aria-disabled")).toBe("true");
    expect(container.textContent).toMatch(/Unlocks at Identity/i);
    act(() => {
      btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(picked).toBeNull();
  });

  it("renders read-only (disabled, no radio role) when onSelect is omitted and unlocked", () => {
    const rams = personaBySlug("dieter-rams")!;
    render(<PersonaCard persona={rams} selected />);
    const btn = container.querySelector("button")!;
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute("role")).toBeNull();
    expect(container.textContent).toContain("Dieter Rams");
  });
});
