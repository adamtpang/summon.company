import { describe, expect, it } from "vitest";
import {
  CORE8_FORMATION_SEATS,
  CORE8_SEAT_DEFAULT_BUDGET_CENTS,
  STAFF_FORMATION_APPROVAL_TYPE,
  buildStaffFormationCard,
  formationDeclinedSeatSchema,
  formationSeatPersonaOptions,
  resolveFormationSeatDecisions,
} from "./vitals-formation.js";
import { PERSONA_GOVERNANCE_GUARDRAIL, VITALS_DEPARTMENTS } from "./vitals-personas.js";

describe("CORE8_FORMATION_SEATS", () => {
  it("has exactly one seat per core department, in canonical order", () => {
    expect(CORE8_FORMATION_SEATS.map((seat) => seat.department)).toEqual([...VITALS_DEPARTMENTS]);
    expect(CORE8_FORMATION_SEATS).toHaveLength(8);
  });

  it("gives every seat a mandate, an instruction template, and a persona slot note", () => {
    for (const seat of CORE8_FORMATION_SEATS) {
      expect(seat.name.length).toBeGreaterThan(0);
      expect(seat.title).toContain("Head of");
      expect(seat.capabilities.length).toBeGreaterThan(0);
      expect(seat.instructionsTemplate).toContain(`You own ${seat.name} for this company.`);
      expect(seat.instructionsTemplate).toContain("Persona slot (optional)");
      expect(seat.instructionsTemplate).toContain("Board approval is required");
      expect(seat.defaultBudgetMonthlyCents).toBe(CORE8_SEAT_DEFAULT_BUDGET_CENTS);
    }
  });

  it("keeps the persona guardrail semantics: personas shape HOW, never WHETHER", () => {
    expect(PERSONA_GOVERNANCE_GUARDRAIL).toContain("never WHETHER");
    expect(formationSeatPersonaOptions("engineering")).toContain("elon");
    expect(formationSeatPersonaOptions("finance")).toContain("rockefeller");
  });
});

describe("buildStaffFormationCard", () => {
  it("asks one plain-language question with the employee count and total cap", () => {
    const card = buildStaffFormationCard(CORE8_FORMATION_SEATS);
    expect(card.question).toBe("Staff the formation?");
    expect(card.summary).toBe("8 employees, $80/mo total cap");
    expect(card.totalBudgetMonthlyCents).toBe(8 * CORE8_SEAT_DEFAULT_BUDGET_CENTS);
    expect(card.seatLines).toHaveLength(8);
    expect(card.seatLines[0]).toContain("Engineering — Head of Engineering");
  });

  it("renders fractional-dollar caps with cents", () => {
    const card = buildStaffFormationCard([
      { department: "legal", title: "Head of Legal", defaultBudgetMonthlyCents: 1250 },
    ]);
    expect(card.summary).toBe("1 employees, $12.50/mo total cap");
  });
});

describe("resolveFormationSeatDecisions", () => {
  const seats = CORE8_FORMATION_SEATS.map((seat) => ({
    department: seat.department,
    agentId: `agent-${seat.department}`,
  }));

  it("activates every seat when nothing is declined", () => {
    const resolution = resolveFormationSeatDecisions(seats, undefined);
    expect(resolution.activate).toHaveLength(8);
    expect(resolution.declined).toHaveLength(0);
  });

  it("splits declined seats out with their named human owner", () => {
    const resolution = resolveFormationSeatDecisions(seats, [
      { department: "legal", humanOwner: "Adam Pang" },
    ]);
    expect(resolution.activate).toHaveLength(7);
    expect(resolution.declined).toEqual([
      { seat: { department: "legal", agentId: "agent-legal" }, humanOwner: "Adam Pang" },
    ]);
  });

  it("rejects declines for departments that are not on the card", () => {
    expect(() =>
      resolveFormationSeatDecisions(
        seats.filter((seat) => seat.department !== "legal"),
        [{ department: "legal", humanOwner: "Adam Pang" }],
      ),
    ).toThrow(/does not exist on this formation card/);
  });
});

describe("formationDeclinedSeatSchema", () => {
  it("requires a named human owner for a declined seat", () => {
    expect(formationDeclinedSeatSchema.safeParse({ department: "legal", humanOwner: "  " }).success).toBe(false);
    expect(formationDeclinedSeatSchema.safeParse({ department: "legal", humanOwner: "Adam" }).success).toBe(true);
    expect(formationDeclinedSeatSchema.safeParse({ department: "product", humanOwner: "Adam" }).success).toBe(false);
  });

  it("keeps the staff_formation approval type stable", () => {
    expect(STAFF_FORMATION_APPROVAL_TYPE).toBe("staff_formation");
  });
});
