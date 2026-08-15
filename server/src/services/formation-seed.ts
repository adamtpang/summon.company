import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { approvals } from "@paperclipai/db";
import {
  CORE8_FORMATION_KEY,
  CORE8_FORMATION_SEATS,
  STAFF_FORMATION_APPROVAL_TYPE,
  buildStaffFormationCard,
} from "@paperclipai/shared";
import { agentService } from "./agents.js";
import { logActivity } from "./activity-log.js";
import { logger } from "../middleware/logger.js";

/**
 * Core-8 formation seeding (VIT-114).
 *
 * Every company starts with the eight-department formation: one proposed
 * employee per core department, created as `pending_approval` (frozen config,
 * cannot run, cannot spend), plus exactly ONE `staff_formation` board decision
 * card covering all eight seats. Company creation and company import both flow
 * through `companyService.create`, so both are covered by one call site.
 */

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * True for a formation-seed placeholder agent (metadata.vitalsFormation.formation
 * === CORE8_FORMATION_KEY, set in seedCoreEightFormation above). These are
 * pending_approval proposals scoped to the company that seeded them, not
 * portable employees: every company (including one created via import) seeds
 * its own fresh core-8 formation independently, so company export/import must
 * exclude them the same way it already excludes built-in managed agents.
 */
export function readCoreEightFormationMarker(metadata: unknown): boolean {
  if (!isPlainRecord(metadata)) return false;
  const marker = metadata.vitalsFormation;
  if (!isPlainRecord(marker)) return false;
  return marker.formation === CORE8_FORMATION_KEY;
}

export function formationSeedService(db: Db) {
  const agentsSvc = agentService(db);

  async function seedCoreEightFormation(companyId: string) {
      const existingCard = await db
        .select({ id: approvals.id })
        .from(approvals)
        .where(and(
          eq(approvals.companyId, companyId),
          eq(approvals.type, STAFF_FORMATION_APPROVAL_TYPE),
        ))
        .then((rows) => rows[0] ?? null);
      if (existingCard) return null;

      const seatAgents: { seat: (typeof CORE8_FORMATION_SEATS)[number]; agentId: string; name: string }[] = [];
      for (const seat of CORE8_FORMATION_SEATS) {
        const created = await agentsSvc.create(companyId, {
          name: seat.name,
          role: seat.role,
          title: seat.title,
          capabilities: seat.capabilities,
          adapterType: "process",
          adapterConfig: {},
          runtimeConfig: {},
          budgetMonthlyCents: seat.defaultBudgetMonthlyCents,
          status: "pending_approval",
          spentMonthlyCents: 0,
          lastHeartbeatAt: null,
          metadata: {
            vitalsFormation: {
              formation: CORE8_FORMATION_KEY,
              department: seat.department,
              personaSlot: null,
              instructionsTemplate: seat.instructionsTemplate,
            },
          },
        });
        seatAgents.push({ seat, agentId: created.id, name: created.name });
      }

      const card = buildStaffFormationCard(CORE8_FORMATION_SEATS);
      const approval = await db
        .insert(approvals)
        .values({
          companyId,
          type: STAFF_FORMATION_APPROVAL_TYPE,
          status: "pending",
          requestedByAgentId: null,
          requestedByUserId: null,
          payload: {
            formation: CORE8_FORMATION_KEY,
            question: card.question,
            summary: card.summary,
            totalBudgetMonthlyCents: card.totalBudgetMonthlyCents,
            seats: seatAgents.map(({ seat, agentId, name }) => ({
              department: seat.department,
              agentId,
              name,
              title: seat.title,
              budgetMonthlyCents: seat.defaultBudgetMonthlyCents,
            })),
          },
          decisionNote: null,
          decidedByUserId: null,
          decidedAt: null,
          updatedAt: new Date(),
        })
        .returning()
        .then((rows) => rows[0]);

      await logActivity(db, {
        companyId,
        actorType: "system",
        actorId: "system",
        action: "approval.created",
        entityType: "approval",
        entityId: approval.id,
        details: {
          type: STAFF_FORMATION_APPROVAL_TYPE,
          formation: CORE8_FORMATION_KEY,
          seatCount: seatAgents.length,
          totalBudgetMonthlyCents: card.totalBudgetMonthlyCents,
        },
      });

      return { approval, seatAgentIds: seatAgents.map(({ agentId }) => agentId) };
  }

  return {
    seedCoreEightFormation,

    /**
     * Company creation must never fail because formation seeding failed —
     * seed best-effort and surface the failure in logs instead.
     */
    seedCoreEightFormationBestEffort: async (companyId: string) => {
      try {
        return await seedCoreEightFormation(companyId);
      } catch (err) {
        logger.warn({ err, companyId }, "core-8 formation seeding failed");
        return null;
      }
    },
  };
}
