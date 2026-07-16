import { describe, expect, it } from "vitest";
import {
  PERSONA_GOVERNANCE_GUARDRAIL,
  VITALS_PERSONAS,
  buildPersonaBrief,
  getPersonaById,
  injectPersonaBrief,
  personasForDepartment,
  resolvePersona,
  vitalsPersonaSchema,
} from "./vitals-personas.js";

// A minimal stand-in for an agent's governance/approval block. Persona
// injection must never remove or weaken this.
const GOVERNANCE_BLOCK = [
  "# Vitals Engineer",
  "",
  "GOVERNANCE: You must obtain board approval before any send or spend.",
  "Never bypass budget, pause/cancel, or approval gates.",
].join("\n");

describe("persona catalog", () => {
  it("ships valid, schema-conforming personas", () => {
    expect(VITALS_PERSONAS.length).toBeGreaterThan(0);
    for (const persona of VITALS_PERSONAS) {
      expect(() => vitalsPersonaSchema.parse(persona)).not.toThrow();
      expect(persona.departmentFit).toContain(persona.department);
    }
  });

  it("assigns Elon to Engineering and Rockefeller to Finance (acceptance)", () => {
    expect(getPersonaById("elon")?.department).toBe("engineering");
    expect(getPersonaById("rockefeller")?.department).toBe("finance");
  });

  it("has unique persona ids", () => {
    const ids = VITALS_PERSONAS.map((persona) => persona.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("resolvePersona", () => {
  it("resolves by id, name, and alias case-insensitively", () => {
    expect(resolvePersona("elon")?.id).toBe("elon");
    expect(resolvePersona("Elon Musk")?.id).toBe("elon");
    expect(resolvePersona("  MUSK ")?.id).toBe("elon");
    expect(resolvePersona("John D. Rockefeller")?.id).toBe("rockefeller");
  });

  it("returns null for unknown or unported guides (default behavior)", () => {
    expect(resolvePersona("Jeff Bezos")).toBeNull();
    expect(resolvePersona("Jony Ive")).toBeNull();
    expect(resolvePersona("")).toBeNull();
    expect(resolvePersona(null)).toBeNull();
    expect(resolvePersona(undefined)).toBeNull();
  });
});

describe("personasForDepartment", () => {
  it("filters by department fit", () => {
    const finance = personasForDepartment("finance").map((p) => p.id);
    expect(finance).toContain("rockefeller");
    expect(finance).not.toContain("elon");
  });

  it("returns all personas when no department is given", () => {
    expect(personasForDepartment(null)).toHaveLength(VITALS_PERSONAS.length);
  });
});

describe("buildPersonaBrief", () => {
  it("includes the in-the-style-of guardrail and never-claim-to-be language", () => {
    const brief = buildPersonaBrief(getPersonaById("elon")!);
    expect(brief).toContain("in the style of");
    expect(brief).toContain("Never claim to be Elon Musk");
    expect(brief).toContain(PERSONA_GOVERNANCE_GUARDRAIL);
    // Voice and at least one principle are surfaced.
    expect(brief).toContain("first principles");
  });
});

describe("injectPersonaBrief — governance preservation", () => {
  it("preserves the governance/approval block verbatim after injection", () => {
    const elon = getPersonaById("elon")!;
    const injected = injectPersonaBrief(GOVERNANCE_BLOCK, elon);
    // Original governance text survives unchanged.
    expect(injected).toContain(GOVERNANCE_BLOCK);
    expect(injected).toContain("board approval before any send or spend");
    // The persona brief is prepended (appears before the governance block).
    expect(injected.indexOf("Persona: in the style of")).toBeLessThan(
      injected.indexOf("GOVERNANCE:"),
    );
    // The governance guardrail is present in the brief too.
    expect(injected).toContain(PERSONA_GOVERNANCE_GUARDRAIL);
  });

  it("returns instructions unchanged when no persona is set (default agents)", () => {
    expect(injectPersonaBrief(GOVERNANCE_BLOCK, null)).toBe(GOVERNANCE_BLOCK);
    expect(injectPersonaBrief(GOVERNANCE_BLOCK, undefined)).toBe(GOVERNANCE_BLOCK);
  });

  it("returns just the brief when there are no base instructions", () => {
    const rockefeller = getPersonaById("rockefeller")!;
    const injected = injectPersonaBrief("", rockefeller);
    expect(injected).toBe(buildPersonaBrief(rockefeller));
  });

  it("does not weaken instructions — output always contains the full original", () => {
    for (const persona of VITALS_PERSONAS) {
      const injected = injectPersonaBrief(GOVERNANCE_BLOCK, persona);
      expect(injected.includes(GOVERNANCE_BLOCK)).toBe(true);
    }
  });
});
