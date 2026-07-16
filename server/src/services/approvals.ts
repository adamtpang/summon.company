import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { approvalComments, approvals } from "@paperclipai/db";
import {
  STAFF_FORMATION_APPROVAL_TYPE,
  resolveFormationSeatDecisions,
  type FormationDeclinedSeat,
} from "@paperclipai/shared";
import { notFound, unprocessable } from "../errors.js";
import { redactCurrentUserText } from "../log-redaction.js";
import { agentService } from "./agents.js";
import { budgetService } from "./budgets.js";
import { notifyHireApproved } from "./hire-hook.js";
import { instanceSettingsService } from "./instance-settings.js";

export function approvalService(db: Db) {
  const agentsSvc = agentService(db);
  const budgets = budgetService(db);
  const instanceSettings = instanceSettingsService(db);
  const canResolveStatuses = new Set(["pending", "revision_requested"]);
  const resolvableStatuses = Array.from(canResolveStatuses);
  type ApprovalRecord = typeof approvals.$inferSelect;
  type ResolutionResult = { approval: ApprovalRecord; applied: boolean };

  function redactApprovalComment<T extends { body: string }>(comment: T, censorUsernameInLogs: boolean): T {
    return {
      ...comment,
      body: redactCurrentUserText(comment.body, { enabled: censorUsernameInLogs }),
    };
  }

  interface FormationPayloadSeat {
    department: string;
    agentId: string;
    budgetMonthlyCents: number;
  }

  function readFormationPayloadSeats(payload: Record<string, unknown>): FormationPayloadSeat[] {
    if (!Array.isArray(payload.seats)) return [];
    const seats: FormationPayloadSeat[] = [];
    for (const raw of payload.seats) {
      if (typeof raw !== "object" || raw === null) continue;
      const seat = raw as Record<string, unknown>;
      if (typeof seat.department !== "string" || typeof seat.agentId !== "string") continue;
      seats.push({
        department: seat.department,
        agentId: seat.agentId,
        budgetMonthlyCents:
          typeof seat.budgetMonthlyCents === "number" ? seat.budgetMonthlyCents : 0,
      });
    }
    return seats;
  }

  async function persistApprovalResolution(
    id: string,
    payload: Record<string, unknown>,
    resolution: Record<string, unknown>,
  ) {
    const nextPayload = { ...payload, resolution };
    const persisted = await db
      .update(approvals)
      .set({ payload: nextPayload, updatedAt: new Date() })
      .where(eq(approvals.id, id))
      .returning()
      .then((rows) => rows[0] ?? null);
    return { persisted, nextPayload };
  }

  async function applyStaffFormationApproval(
    approval: ApprovalRecord,
    decidedByUserId: string,
    declinedSeats: FormationDeclinedSeat[] | undefined,
  ) {
    const payload = approval.payload as Record<string, unknown>;
    const seats = readFormationPayloadSeats(payload);
    const decisions = resolveFormationSeatDecisions(seats, declinedSeats);

    const activatedSeats: { department: string; agentId: string }[] = [];
    for (const seat of decisions.activate) {
      const activated = await agentsSvc.activatePendingApproval(seat.agentId);
      if (!activated?.activated) continue;
      if (seat.budgetMonthlyCents > 0) {
        await budgets.upsertPolicy(
          approval.companyId,
          {
            scopeType: "agent",
            scopeId: seat.agentId,
            amount: seat.budgetMonthlyCents,
            windowKind: "calendar_month_utc",
          },
          decidedByUserId,
        );
      }
      activatedSeats.push({ department: seat.department, agentId: seat.agentId });
    }

    const declinedResolution: { department: string; agentId: string; humanOwner: string }[] = [];
    for (const { seat, humanOwner } of decisions.declined) {
      await agentsSvc.terminate(seat.agentId);
      declinedResolution.push({ department: seat.department, agentId: seat.agentId, humanOwner });
    }

    const { persisted, nextPayload } = await persistApprovalResolution(approval.id, payload, {
      activatedSeats,
      declinedSeats: declinedResolution,
    });
    return persisted ?? { ...approval, payload: nextPayload };
  }

  async function applyStaffFormationRejection(
    approval: ApprovalRecord,
    decisionNote: string | null | undefined,
  ) {
    const payload = approval.payload as Record<string, unknown>;
    const seats = readFormationPayloadSeats(payload);
    const declinedResolution: {
      department: string;
      agentId: string;
      humanOwner: string | null;
      humanOwnerNote: string | null;
    }[] = [];
    for (const seat of seats) {
      await agentsSvc.terminate(seat.agentId);
      declinedResolution.push({
        department: seat.department,
        agentId: seat.agentId,
        humanOwner: null,
        humanOwnerNote: decisionNote?.trim() || null,
      });
    }
    const { persisted, nextPayload } = await persistApprovalResolution(approval.id, payload, {
      activatedSeats: [],
      declinedSeats: declinedResolution,
    });
    return persisted ?? { ...approval, payload: nextPayload };
  }

  async function reconcileApprovedBuiltInAgent(companyId: string, payload: Record<string, unknown>) {
    const sourceBuiltInAgentKey = typeof payload.sourceBuiltInAgentKey === "string" ? payload.sourceBuiltInAgentKey : null;
    if (!sourceBuiltInAgentKey) return;
    const { builtInAgentService } = await import("./built-in-agents.js");
    await builtInAgentService(db).ensure(companyId, sourceBuiltInAgentKey);
  }

  async function getExistingApproval(id: string) {
    const existing = await db
      .select()
      .from(approvals)
      .where(eq(approvals.id, id))
      .then((rows) => rows[0] ?? null);
    if (!existing) throw notFound("Approval not found");
    return existing;
  }

  async function resolveApproval(
    id: string,
    targetStatus: "approved" | "rejected",
    decidedByUserId: string,
    decisionNote: string | null | undefined,
  ): Promise<ResolutionResult> {
    const existing = await getExistingApproval(id);
    if (!canResolveStatuses.has(existing.status)) {
      if (existing.status === targetStatus) {
        return { approval: existing, applied: false };
      }
      throw unprocessable(
        `Only pending or revision requested approvals can be ${targetStatus === "approved" ? "approved" : "rejected"}`,
      );
    }

    const now = new Date();
    const updated = await db
      .update(approvals)
      .set({
        status: targetStatus,
        decidedByUserId,
        decisionNote: decisionNote ?? null,
        decidedAt: now,
        updatedAt: now,
      })
      .where(and(eq(approvals.id, id), inArray(approvals.status, resolvableStatuses)))
      .returning()
      .then((rows) => rows[0] ?? null);

    if (updated) {
      return { approval: updated, applied: true };
    }

    const latest = await getExistingApproval(id);
    if (latest.status === targetStatus) {
      return { approval: latest, applied: false };
    }

    throw unprocessable(
      `Only pending or revision requested approvals can be ${targetStatus === "approved" ? "approved" : "rejected"}`,
    );
  }

  return {
    list: (companyId: string, status?: string) => {
      const conditions = [eq(approvals.companyId, companyId)];
      if (status) conditions.push(eq(approvals.status, status));
      return db.select().from(approvals).where(and(...conditions));
    },

    getById: (id: string) =>
      db
        .select()
        .from(approvals)
        .where(eq(approvals.id, id))
        .then((rows) => rows[0] ?? null),

    findOpenHireApprovalForAgent: async (companyId: string, agentId: string) => {
      const rows = await db
        .select()
        .from(approvals)
        .where(
          and(
            eq(approvals.companyId, companyId),
            eq(approvals.type, "hire_agent"),
            inArray(approvals.status, resolvableStatuses),
            sql`${approvals.payload} ->> 'agentId' = ${agentId}`,
          ),
        );
      return rows[0] ?? null;
    },

    create: (companyId: string, data: Omit<typeof approvals.$inferInsert, "companyId">) =>
      db
        .insert(approvals)
        .values({ ...data, companyId })
        .returning()
        .then((rows) => rows[0]),

    approve: async (
      id: string,
      decidedByUserId: string,
      decisionNote?: string | null,
      options?: { declinedSeats?: FormationDeclinedSeat[] },
    ) => {
      const { approval: updated, applied } = await resolveApproval(
        id,
        "approved",
        decidedByUserId,
        decisionNote,
      );

      if (applied && updated.type === STAFF_FORMATION_APPROVAL_TYPE) {
        const resolved = await applyStaffFormationApproval(
          updated,
          decidedByUserId,
          options?.declinedSeats,
        );
        return { approval: resolved, applied };
      }

      let hireApprovedAgentId: string | null = null;
      const now = new Date();
      if (applied && updated.type === "hire_agent") {
        const payload = updated.payload as Record<string, unknown>;
        const payloadAgentId = typeof payload.agentId === "string" ? payload.agentId : null;
        if (payloadAgentId) {
          await agentsSvc.activatePendingApproval(payloadAgentId, payload);
          await reconcileApprovedBuiltInAgent(updated.companyId, payload);
          hireApprovedAgentId = payloadAgentId;
        } else {
          const created = await agentsSvc.create(updated.companyId, {
            name: String(payload.name ?? "New Agent"),
            role: String(payload.role ?? "general"),
            title: typeof payload.title === "string" ? payload.title : null,
            reportsTo: typeof payload.reportsTo === "string" ? payload.reportsTo : null,
            capabilities: typeof payload.capabilities === "string" ? payload.capabilities : null,
            adapterType: String(payload.adapterType ?? "process"),
            adapterConfig:
              typeof payload.adapterConfig === "object" && payload.adapterConfig !== null
                ? (payload.adapterConfig as Record<string, unknown>)
                : {},
            budgetMonthlyCents:
              typeof payload.budgetMonthlyCents === "number" ? payload.budgetMonthlyCents : 0,
            metadata:
              typeof payload.metadata === "object" && payload.metadata !== null
                ? (payload.metadata as Record<string, unknown>)
                : null,
            status: "idle",
            spentMonthlyCents: 0,
            permissions: undefined,
            lastHeartbeatAt: null,
          });
          hireApprovedAgentId = created?.id ?? null;
        }
        if (hireApprovedAgentId) {
          const budgetMonthlyCents =
            typeof payload.budgetMonthlyCents === "number" ? payload.budgetMonthlyCents : 0;
          if (budgetMonthlyCents > 0) {
            await budgets.upsertPolicy(
              updated.companyId,
              {
                scopeType: "agent",
                scopeId: hireApprovedAgentId,
                amount: budgetMonthlyCents,
                windowKind: "calendar_month_utc",
              },
              decidedByUserId,
            );
          }
          void notifyHireApproved(db, {
            companyId: updated.companyId,
            agentId: hireApprovedAgentId,
            source: "approval",
            sourceId: id,
            approvedAt: now,
          }).catch(() => {});
        }
      }

      return { approval: updated, applied };
    },

    reject: async (id: string, decidedByUserId: string, decisionNote?: string | null) => {
      const { approval: updated, applied } = await resolveApproval(
        id,
        "rejected",
        decidedByUserId,
        decisionNote,
      );

      if (applied && updated.type === STAFF_FORMATION_APPROVAL_TYPE) {
        const resolved = await applyStaffFormationRejection(updated, decisionNote);
        return { approval: resolved, applied };
      }

      if (applied && updated.type === "hire_agent") {
        const payload = updated.payload as Record<string, unknown>;
        const payloadAgentId = typeof payload.agentId === "string" ? payload.agentId : null;
        if (payloadAgentId) {
          await agentsSvc.terminate(payloadAgentId);
        }
      }

      return { approval: updated, applied };
    },

    requestRevision: async (id: string, decidedByUserId: string, decisionNote?: string | null) => {
      const existing = await getExistingApproval(id);
      if (existing.status !== "pending") {
        throw unprocessable("Only pending approvals can request revision");
      }

      const now = new Date();
      return db
        .update(approvals)
        .set({
          status: "revision_requested",
          decidedByUserId,
          decisionNote: decisionNote ?? null,
          decidedAt: now,
          updatedAt: now,
        })
        .where(eq(approvals.id, id))
        .returning()
        .then((rows) => rows[0]);
    },

    resubmit: async (id: string, payload?: Record<string, unknown>) => {
      const existing = await getExistingApproval(id);
      if (existing.status !== "revision_requested") {
        throw unprocessable("Only revision requested approvals can be resubmitted");
      }

      const now = new Date();
      return db
        .update(approvals)
        .set({
          status: "pending",
          payload: payload ?? existing.payload,
          decisionNote: null,
          decidedByUserId: null,
          decidedAt: null,
          updatedAt: now,
        })
        .where(eq(approvals.id, id))
        .returning()
        .then((rows) => rows[0]);
    },

    listComments: async (approvalId: string) => {
      const existing = await getExistingApproval(approvalId);
      const { censorUsernameInLogs } = await instanceSettings.getGeneral();
      return db
        .select()
        .from(approvalComments)
        .where(
          and(
            eq(approvalComments.approvalId, approvalId),
            eq(approvalComments.companyId, existing.companyId),
          ),
        )
        .orderBy(asc(approvalComments.createdAt))
        .then((comments) => comments.map((comment) => redactApprovalComment(comment, censorUsernameInLogs)));
    },

    addComment: async (
      approvalId: string,
      body: string,
      actor: { agentId?: string; userId?: string },
    ) => {
      const existing = await getExistingApproval(approvalId);
      const currentUserRedactionOptions = {
        enabled: (await instanceSettings.getGeneral()).censorUsernameInLogs,
      };
      const redactedBody = redactCurrentUserText(body, currentUserRedactionOptions);
      return db
        .insert(approvalComments)
        .values({
          companyId: existing.companyId,
          approvalId,
          authorAgentId: actor.agentId ?? null,
          authorUserId: actor.userId ?? null,
          body: redactedBody,
        })
        .returning()
        .then((rows) => redactApprovalComment(rows[0], currentUserRedactionOptions.enabled));
    },
  };
}
