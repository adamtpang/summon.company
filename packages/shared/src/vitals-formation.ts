import { z } from "zod";
import {
  personasForDepartment,
  vitalsDepartmentSchema,
  VITALS_DEPARTMENTS,
  type VitalsDepartment,
} from "./vitals-personas.js";

/**
 * Core-8 formation (VIT-114).
 *
 * Every company starts with the eight-department formation: at company
 * creation (and import) the engine seeds one PROPOSED employee per department
 * as a `pending_approval` agent, plus exactly ONE board decision card — a
 * `staff_formation` approval — asking, in plain language:
 *
 *   "Staff the formation? [8 employees, $X/mo total cap]"
 *
 * Nothing runs and nothing spends before the board approves. The board may
 * decline individual seats; a declined seat is documented with a named human
 * owner and its proposed agent is terminated, never activated.
 */

/** Approval type for the single formation decision card. */
export const STAFF_FORMATION_APPROVAL_TYPE = "staff_formation" as const;

/** Marker stored on seeded agents under `metadata.vitalsFormation.formation`. */
export const CORE8_FORMATION_KEY = "core8" as const;

/** Conservative default cap per seeded seat. The board can raise it later. */
export const CORE8_SEAT_DEFAULT_BUDGET_CENTS = 1000;

export interface FormationSeat {
  department: VitalsDepartment;
  /** Agent display name for the proposal. */
  name: string;
  title: string;
  /** Agent role key; matches the department. */
  role: string;
  /** One-line ownership mandate, from the company standard. */
  capabilities: string;
  /** Department instruction template materialized for the seeded employee. */
  instructionsTemplate: string;
  defaultBudgetMonthlyCents: number;
}

const DEPARTMENT_OWNERSHIP: Record<VitalsDepartment, string> = {
  engineering: "Product execution, software, infrastructure, integrations, reliability",
  design: "Identity, product experience, marketing site, visual and interaction quality",
  marketing: "Positioning, content, acquisition, referrals, demand generation",
  sales: "Prospecting, qualification, pipeline, proposals, closing",
  finance: "Pricing, billing, bookkeeping, budgets, cash, runway",
  operations: "Company setup, standards, workspaces, process, operating cadence",
  support: "Onboarding, service, community, feedback, retention",
  legal: "Incorporation, contracts, privacy, compliance, risk",
};

function departmentTitle(department: VitalsDepartment): string {
  return department.charAt(0).toUpperCase() + department.slice(1);
}

function buildDepartmentInstructionsTemplate(department: VitalsDepartment): string {
  const title = departmentTitle(department);
  return [
    `# ${title}`,
    "",
    `You own ${title} for this company.`,
    "",
    `**Ownership.** ${DEPARTMENT_OWNERSHIP[department]}.`,
    "",
    "## Operating contract",
    "",
    "- Work one assigned issue at a time. Return `SOLVED` with evidence,",
    "  `BLOCKED` with the exact missing input or board decision, or `STOPPED`",
    "  when a budget, security, legal, or safety boundary fires.",
    "- Every deliverable must improve a measured lever: time saved, money",
    "  saved, revenue grown, or companies improved.",
    "- Product is not a ninth department. The CEO owns product strategy;",
    "  Engineering owns product execution. Supply requirements and evidence",
    "  through your own ownership.",
    "- Board approval is required for hires, spending beyond caps,",
    "  incorporation, banking, contracts, production deployment, customer",
    "  data access, destructive changes, public claims, and outbound",
    "  messages.",
    "",
    "## Persona slot (optional)",
    "",
    "This seat has an optional GOAT persona slot. A persona shapes HOW you",
    "work — voice, priorities, mental models — never WHETHER you follow",
    "governance. No persona is assigned by default.",
  ].join("\n");
}

/** The eight seeded seats, one per core department, in canonical order. */
export const CORE8_FORMATION_SEATS: readonly FormationSeat[] = VITALS_DEPARTMENTS.map(
  (department) => ({
    department,
    name: departmentTitle(department),
    title: `Head of ${departmentTitle(department)}`,
    role: department,
    capabilities: DEPARTMENT_OWNERSHIP[department],
    instructionsTemplate: buildDepartmentInstructionsTemplate(department),
    defaultBudgetMonthlyCents: CORE8_SEAT_DEFAULT_BUDGET_CENTS,
  }),
);

/** Persona ids that are a defensible fit for a seat's department (VIT-42). */
export function formationSeatPersonaOptions(department: VitalsDepartment): string[] {
  return personasForDepartment(department).map((persona) => persona.id);
}

/** A declined seat must document the named human who owns the department. */
export const formationDeclinedSeatSchema = z.object({
  department: vitalsDepartmentSchema,
  humanOwner: z.string().trim().min(1),
});

export type FormationDeclinedSeat = z.infer<typeof formationDeclinedSeatSchema>;

function formatUsdPerMonth(cents: number): string {
  const dollars = cents / 100;
  const rendered = Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2);
  return `$${rendered}/mo`;
}

export interface StaffFormationCard {
  question: string;
  summary: string;
  totalBudgetMonthlyCents: number;
  seatLines: string[];
}

/**
 * The plain-language decision card copy for the single formation approval.
 * One question, one total cap — never eight separate decisions.
 */
export function buildStaffFormationCard(
  seats: readonly Pick<FormationSeat, "department" | "title" | "defaultBudgetMonthlyCents">[],
): StaffFormationCard {
  const totalBudgetMonthlyCents = seats.reduce(
    (total, seat) => total + seat.defaultBudgetMonthlyCents,
    0,
  );
  return {
    question: "Staff the formation?",
    summary: `${seats.length} employees, ${formatUsdPerMonth(totalBudgetMonthlyCents)} total cap`,
    totalBudgetMonthlyCents,
    seatLines: seats.map(
      (seat) =>
        `${departmentTitle(seat.department)} — ${seat.title}, ${formatUsdPerMonth(seat.defaultBudgetMonthlyCents)} cap`,
    ),
  };
}

export interface FormationSeatResolution<Seat extends { department: string }> {
  activate: Seat[];
  declined: { seat: Seat; humanOwner: string }[];
}

/**
 * Split the card's seats into seats to activate and seats the board declined.
 * Declined departments that are not part of the card are rejected loudly so a
 * typo cannot silently activate a seat the board meant to decline.
 */
export function resolveFormationSeatDecisions<Seat extends { department: string }>(
  seats: readonly Seat[],
  declinedSeats: readonly FormationDeclinedSeat[] | null | undefined,
): FormationSeatResolution<Seat> {
  const declinedByDepartment = new Map<string, string>();
  for (const declined of declinedSeats ?? []) {
    declinedByDepartment.set(declined.department, declined.humanOwner);
  }
  const knownDepartments = new Set(seats.map((seat) => seat.department));
  for (const department of declinedByDepartment.keys()) {
    if (!knownDepartments.has(department)) {
      throw new Error(`Declined seat does not exist on this formation card: ${department}`);
    }
  }
  const resolution: FormationSeatResolution<Seat> = { activate: [], declined: [] };
  for (const seat of seats) {
    const humanOwner = declinedByDepartment.get(seat.department);
    if (humanOwner) {
      resolution.declined.push({ seat, humanOwner });
    } else {
      resolution.activate.push(seat);
    }
  }
  return resolution;
}
