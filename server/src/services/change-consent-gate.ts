import { createHash } from "node:crypto";
import type { Db } from "@paperclipai/db";
import { issueThreadInteractions } from "@paperclipai/db";
import { and, desc, eq, or, sql } from "drizzle-orm";
import type { RequestConfirmationPayload, RequestConfirmationResult } from "@paperclipai/shared";
import { forbidden } from "../errors.js";
import { logActivity } from "./activity-log.js";

export const AGENT_PROFILE_CHANGE_CONSENT_FIELDS = ["name", "role", "title", "capabilities"] as const;

type ConsumedRequestConfirmationResult = RequestConfirmationResult & {
  consumedAt?: string | null;
  consumedByRunId?: string | null;
};

export function agentInstructionsChangeTargetKey(agentId: string) {
  return `agent:${agentId}:instructions`;
}

export function agentProfileChangeTargetKey(agentId: string) {
  return `agent:${agentId}:profile`;
}

export function skillChangeTargetKey(skillId: string) {
  return `skill:${skillId}`;
}

export function skillSlugChangeTargetKey(slug: string) {
  return `skill-slug:${slug}`;
}

export function skillImportChangeTargetKey(source: string) {
  return `skill-import:${source}`;
}

export function skillsScanProjectsChangeTargetKey() {
  return "skills:scan-projects";
}

/**
 * Canonical fingerprint for propose/apply drift detection (VIT-43). Proposers
 * embed this over the live target content at propose time
 * (payload.target.snapshot.fingerprint); the apply gate recomputes it over the
 * live target immediately before applying and refuses on any mismatch.
 */
export function computeChangeGateTargetFingerprint(content: string) {
  return `sha256:${createHash("sha256").update(content, "utf8").digest("hex")}`;
}

/**
 * Live-state fingerprint for DB-row change-gate targets (VIT-43). The
 * canonical content both sides fingerprint is the row's updatedAt as an
 * ISO-8601 string: every mutation bumps it, the proposer reads it from the
 * public GET response at propose time, and the apply path re-reads it from
 * the database immediately before applying. Returns null when the live row
 * (or its updatedAt) cannot be read; the gate fails closed on null for
 * snapshot-bearing proposals.
 */
export function computeChangeGateRowFingerprint(updatedAt: Date | string | null | undefined) {
  const parsed = updatedAt instanceof Date
    ? updatedAt
    : (typeof updatedAt === "string" && updatedAt.trim().length > 0 ? new Date(updatedAt) : null);
  if (!parsed || Number.isNaN(parsed.getTime())) return null;
  return computeChangeGateTargetFingerprint(parsed.toISOString());
}

/**
 * Founder protection tier (VIT-43): artifacts flagged founder-protected cannot
 * be mutated by employee (agent) actors at all — no proposal, accepted or not,
 * unlocks them. Only the board can set or clear the flag, because flagged
 * artifacts refuse every agent mutation including the flag itself.
 */
export function founderProtectedFromMetadata(metadata: Record<string, unknown> | null | undefined) {
  return metadata?.founderProtected === true;
}

export async function refuseFounderProtectedMutation(db: Db, input: {
  companyId: string;
  actorAgentId: string | null | undefined;
  actorRunId: string | null | undefined;
  targetKey: string;
}): Promise<never> {
  await logActivity(db, {
    companyId: input.companyId,
    actorType: "system",
    actorId: "change-consent-gate",
    action: "change_gate.founder_protected_blocked",
    entityType: "change_gate_target",
    entityId: input.targetKey,
    agentId: readNonEmptyString(input.actorAgentId),
    runId: readNonEmptyString(input.actorRunId),
    details: { targetKey: input.targetKey },
  });
  throw forbidden(
    "This artifact is founder-protected: employee mutations are refused regardless of consent.",
    {
      code: "change_gate_founder_protected",
      targetKey: input.targetKey,
    },
  );
}

export function touchesAgentProfileChangeConsentFields(patchData: Record<string, unknown>) {
  return AGENT_PROFILE_CHANGE_CONSENT_FIELDS.some((key) =>
    Object.prototype.hasOwnProperty.call(patchData, key),
  );
}

function readNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function payloadHasDisplayedDiff(payload: RequestConfirmationPayload) {
  const details = readNonEmptyString(payload.detailsMarkdown);
  if (!details) return false;
  if (/```diff\b/i.test(details)) return true;
  return /(^|\n)[+-][^\n]+/.test(details);
}

function requestConfirmationResultConsumed(result: RequestConfirmationResult | null) {
  const consumed = result as ConsumedRequestConfirmationResult | null;
  return Boolean(readNonEmptyString(consumed?.consumedByRunId) || readNonEmptyString(consumed?.consumedAt));
}

function markRequestConfirmationResultConsumed(
  result: RequestConfirmationResult,
  actorRunId: string,
  consumedAt: Date,
): ConsumedRequestConfirmationResult {
  return {
    ...result,
    consumedAt: consumedAt.toISOString(),
    consumedByRunId: actorRunId,
  };
}

function legacyTargetKeysFor(targetKey: string) {
  if (targetKey.startsWith("agent:") && targetKey.endsWith(":instructions")) {
    const agentId = targetKey.slice("agent:".length, -":instructions".length);
    if (agentId) return [`reflection-coach:agent-instructions:${agentId}`];
  }
  if (targetKey.startsWith("agent:") && targetKey.endsWith(":profile")) {
    const agentId = targetKey.slice("agent:".length, -":profile".length);
    if (agentId) return [`reflection-coach:agent-description:${agentId}`];
  }
  if (targetKey.startsWith("skill:")) {
    const skillId = targetKey.slice("skill:".length);
    if (skillId) return [`reflection-coach:company-skill:${skillId}`];
  }
  if (targetKey.startsWith("skill-slug:")) {
    const slug = targetKey.slice("skill-slug:".length);
    if (slug) return [`reflection-coach:company-skill-slug:${slug}`];
  }
  if (targetKey.startsWith("skill-import:")) {
    const source = targetKey.slice("skill-import:".length);
    if (source) {
      return [
        `reflection-coach:company-skill-import:${source}`,
        `reflection-coach:company-skill-catalog:${source}`,
      ];
    }
  }
  if (targetKey === "skills:scan-projects") {
    return ["reflection-coach:company-skills:scan-projects"];
  }
  return [];
}

function expandTargetKeysForLegacyCompatibility(targetKeys: string[]) {
  const expanded = new Set<string>();
  for (const targetKey of targetKeys) {
    expanded.add(targetKey);
    for (const legacyTargetKey of legacyTargetKeysFor(targetKey)) {
      expanded.add(legacyTargetKey);
    }
  }
  return [...expanded];
}

export function changeConsentGateService(db: Db) {
  return {
    assertConsented: async (input: {
      companyId: string;
      actorAgentId: string | null | undefined;
      actorRunId: string | null | undefined;
      targetKeys: string[];
      /**
       * Fingerprint of the live target state re-read immediately before this
       * apply (computeChangeGateTargetFingerprint over current content). When
       * the accepted proposal carries a target snapshot, a missing or
       * mismatched live fingerprint blocks the apply as drift.
       */
      liveTargetFingerprint?: string | null;
    }): Promise<boolean> => {
      const actorAgentId = readNonEmptyString(input.actorAgentId);
      if (!actorAgentId) return false;

      const actorRunId = readNonEmptyString(input.actorRunId);
      if (!actorRunId) {
        throw forbidden("Reflection Coach mutations require a run id", {
          code: "reflection_coach_mutation_run_id_required",
        });
      }

      const targetKeys = [...new Set(input.targetKeys.map(readNonEmptyString).filter((key): key is string => Boolean(key)))];
      if (targetKeys.length === 0) {
        throw forbidden("Reflection Coach mutation target is not gateable", {
          code: "reflection_coach_mutation_target_required",
        });
      }
      const queryTargetKeys = expandTargetKeysForLegacyCompatibility(targetKeys);

      const targetKeyPredicate = or(
        ...queryTargetKeys.map((targetKey) =>
          sql`${issueThreadInteractions.payload}->'target'->>'key' = ${targetKey}`,
        ),
      );

      const rows = await db
        .select({
          id: issueThreadInteractions.id,
          issueId: issueThreadInteractions.issueId,
          sourceRunId: issueThreadInteractions.sourceRunId,
          payload: issueThreadInteractions.payload,
          result: issueThreadInteractions.result,
        })
        .from(issueThreadInteractions)
        .where(and(
          eq(issueThreadInteractions.companyId, input.companyId),
          eq(issueThreadInteractions.createdByAgentId, actorAgentId),
          eq(issueThreadInteractions.kind, "request_confirmation"),
          eq(issueThreadInteractions.status, "accepted"),
          targetKeyPredicate,
        ))
        .orderBy(desc(issueThreadInteractions.resolvedAt), desc(issueThreadInteractions.createdAt))
        .limit(10);

      const accepted = rows.find((row) => {
        const payload = row.payload as RequestConfirmationPayload;
        const result = row.result as RequestConfirmationResult | null;
        return payload.target?.type === "custom"
          && queryTargetKeys.includes(payload.target.key)
          && result?.outcome === "accepted"
          && !requestConfirmationResultConsumed(result)
          && payloadHasDisplayedDiff(payload)
          && Boolean(row.sourceRunId)
          && row.sourceRunId !== actorRunId;
      });

      if (!accepted) {
        throw forbidden(
          "Reflection Coach mutations require an accepted request_confirmation with a displayed diff for this target, "
            + "created in a previous run and not already consumed.",
          {
            code: "reflection_coach_mutation_gate_required",
            targetKeys,
          },
        );
      }

      const acceptedResult = accepted.result as RequestConfirmationResult | null;
      if (!acceptedResult) {
        throw forbidden(
          "Reflection Coach mutations require an accepted request_confirmation with a displayed diff for this target, "
            + "created in a previous run and not already consumed.",
          {
            code: "reflection_coach_mutation_gate_required",
            targetKeys,
          },
        );
      }

      // Pre-apply live-state recheck (VIT-43): when the proposal captured a
      // target snapshot, the live target re-read by the caller must match it
      // exactly. Any drift — or an apply path that failed to re-read the live
      // state — blocks the mutation and surfaces an audit alert. Proposals
      // without a snapshot predate this contract and pass as legacy.
      const acceptedPayload = accepted.payload as RequestConfirmationPayload;
      const acceptedTarget = acceptedPayload.target?.type === "custom" ? acceptedPayload.target : null;
      const proposalFingerprint = readNonEmptyString(acceptedTarget?.snapshot?.fingerprint);
      const liveFingerprint = readNonEmptyString(input.liveTargetFingerprint);
      const recheck = proposalFingerprint
        ? (liveFingerprint === proposalFingerprint ? "match" : (liveFingerprint ? "drift" : "live_state_unavailable"))
        : "proposal_has_no_snapshot";
      if (recheck === "drift" || recheck === "live_state_unavailable") {
        await logActivity(db, {
          companyId: input.companyId,
          actorType: "system",
          actorId: "change-consent-gate",
          action: "change_gate.drift_blocked",
          entityType: "issue_thread_interaction",
          entityId: accepted.id,
          agentId: actorAgentId,
          runId: actorRunId,
          details: {
            issueId: accepted.issueId,
            targetKey: acceptedTarget?.key ?? targetKeys[0],
            recheck,
            proposalFingerprint,
            liveFingerprint,
            proposalSourceRunId: accepted.sourceRunId,
          },
        });
        throw forbidden(
          "The live target state changed after this proposal was created (or could not be re-read); the apply is blocked. "
            + "Re-propose against the current target state.",
          {
            code: "change_gate_target_drift",
            targetKeys,
            interactionId: accepted.id,
            recheck,
          },
        );
      }

      const now = new Date();
      const [consumed] = await db
        .update(issueThreadInteractions)
        .set({
          result: markRequestConfirmationResultConsumed(acceptedResult, actorRunId, now),
          updatedAt: now,
        })
        .where(and(
          eq(issueThreadInteractions.id, accepted.id),
          eq(issueThreadInteractions.companyId, input.companyId),
          eq(issueThreadInteractions.createdByAgentId, actorAgentId),
          eq(issueThreadInteractions.kind, "request_confirmation"),
          eq(issueThreadInteractions.status, "accepted"),
          sql`${issueThreadInteractions.result}->>'outcome' = 'accepted'`,
          sql`coalesce(${issueThreadInteractions.result}->>'consumedByRunId', ${issueThreadInteractions.result}->>'consumedAt') is null`,
        ))
        .returning({ id: issueThreadInteractions.id });

      if (!consumed) {
        throw forbidden(
          "Reflection Coach mutations require an accepted request_confirmation with a displayed diff for this target, "
            + "created in a previous run and not already consumed.",
          {
            code: "reflection_coach_mutation_gate_required",
            targetKeys,
          },
        );
      }

      // Event-log linkage (VIT-43): every gated mutation records the proposal
      // it consumed and the pre-apply live-state recheck result.
      await logActivity(db, {
        companyId: input.companyId,
        actorType: "system",
        actorId: "change-consent-gate",
        action: "change_gate.apply_consumed",
        entityType: "issue_thread_interaction",
        entityId: accepted.id,
        agentId: actorAgentId,
        runId: actorRunId,
        details: {
          issueId: accepted.issueId,
          targetKey: acceptedTarget?.key ?? targetKeys[0],
          recheck,
          proposalFingerprint,
          liveFingerprint,
          proposalSourceRunId: accepted.sourceRunId,
          applyRunId: actorRunId,
        },
      });

      return true;
    },
  };
}
