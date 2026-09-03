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
            companyBudgetMonthlyCents: card.totalBudgetMonthlyCents,
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

  async function seedStewardshipFormation(
    companyId: string,
    contract: Record<string, unknown> | null = null,
  ) {
    const existingCards = await db
      .select({ id: approvals.id, payload: approvals.payload })
      .from(approvals)
      .where(and(
        eq(approvals.companyId, companyId),
        eq(approvals.type, "hire_agent"),
      ));
    if (existingCards.some((card) => (
      (card.payload as Record<string, unknown> | null)?.formation === "aether_stewardship_v1"
    ))) return null;

    const steward = await agentsSvc.create(companyId, {
      name: "Steward",
      role: "stewardship",
      title: "Portfolio Steward",
      capabilities: "Maintain the beneficiary contract, inspect evidence, select one bounded next action, and preserve human approval boundaries.",
      adapterType: "process",
      adapterConfig: {},
      runtimeConfig: {},
      budgetMonthlyCents: 1_000,
      status: "pending_approval",
      spentMonthlyCents: 0,
      lastHeartbeatAt: null,
      metadata: {
        vitalsFormation: {
          formation: "aether_stewardship_v1",
          department: "operations",
          personaSlot: null,
          instructionsTemplate: "aether-stewardship-v1",
        },
        aetherStewardship: contract,
      },
    });
    const approval = await db.insert(approvals).values({
      companyId,
      type: "hire_agent",
      status: "pending",
      requestedByAgentId: null,
      requestedByUserId: null,
      payload: {
        formation: "aether_stewardship_v1",
        name: steward.name,
        role: steward.role,
        title: steward.title,
        capabilities: steward.capabilities,
        adapterType: steward.adapterType,
        adapterConfig: steward.adapterConfig,
        runtimeConfig: steward.runtimeConfig,
        budgetMonthlyCents: steward.budgetMonthlyCents,
        metadata: steward.metadata,
        agentId: steward.id,
        beneficiaryContract: contract,
      },
      decisionNote: null,
      decidedByUserId: null,
      decidedAt: null,
      updatedAt: new Date(),
    }).returning().then((rows) => rows[0]);
    await logActivity(db, {
      companyId,
      actorType: "system",
      actorId: "system",
      action: "approval.created",
      entityType: "approval",
      entityId: approval.id,
      details: {
        type: "hire_agent",
        formation: "aether_stewardship_v1",
        seatCount: 1,
        totalBudgetMonthlyCents: steward.budgetMonthlyCents,
      },
    });
    return { approval, stewardAgentId: steward.id };
  }

  return {
    seedCoreEightFormation,
    seedStewardshipFormation,

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
    seedStewardshipFormationBestEffort: async (
      companyId: string,
      contract: Record<string, unknown> | null = null,
    ) => {
      try {
        return await seedStewardshipFormation(companyId, contract);
      } catch (err) {
        logger.warn({ err, companyId }, "stewardship formation seeding failed");
        return null;
      }
    },
  };
}
