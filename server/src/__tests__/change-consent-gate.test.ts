import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  activityLog,
  agents,
  companies,
  createDb,
  heartbeatRuns,
  issueThreadInteractions,
  issues,
} from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import {
  changeConsentGateService,
  computeChangeGateRowFingerprint,
  computeChangeGateTargetFingerprint,
  founderProtectedFromMetadata,
  refuseFounderProtectedMutation,
  skillChangeTargetKey,
} from "../services/change-consent-gate.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

describeEmbeddedPostgres("changeConsentGateService", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-reflection-coach-gate-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    await db.delete(activityLog);
    await db.delete(issueThreadInteractions);
    await db.delete(issues);
    await db.delete(heartbeatRuns);
    await db.delete(agents);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  async function seedGateFixture() {
    const companyId = randomUUID();
    const coachId = randomUUID();
    const sourceRunId = randomUUID();
    const applyRunId = randomUUID();
    const proposalIssueId = randomUUID();
    const skillId = randomUUID();
    const targetKey = skillChangeTargetKey(skillId);

    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: "PAP",
      defaultResponsibleUserId: "board-user",
    });
    await db.insert(agents).values({
      id: coachId,
      companyId,
      name: "Reflection Coach",
      role: "general",
      adapterType: "codex_local",
      adapterConfig: {},
      runtimeConfig: {},
      permissions: { canCreateSkills: true },
    });
    await db.insert(heartbeatRuns).values([
      {
        id: sourceRunId,
        companyId,
        agentId: coachId,
        status: "succeeded",
      },
      {
        // The apply run must exist as a real heartbeat run: gate audit events
        // (activity_log.run_id) carry a foreign key to heartbeat_runs.
        id: applyRunId,
        companyId,
        agentId: coachId,
        status: "succeeded",
      },
    ]);
    await db.insert(issues).values({
      id: proposalIssueId,
      companyId,
      title: "Review Reflection Coach proposal",
      status: "in_review",
      priority: "medium",
      identifier: "PAP-1",
      issueNumber: 1,
      createdByAgentId: coachId,
    });

    return { companyId, coachId, sourceRunId, applyRunId, proposalIssueId, skillId, targetKey };
  }

  it("rejects Reflection Coach skill mutation without an accepted bound interaction", async () => {
    const { companyId, coachId, targetKey } = await seedGateFixture();

    await expect(changeConsentGateService(db).assertConsented({
      companyId,
      actorAgentId: coachId,
      actorRunId: randomUUID(),
      targetKeys: [targetKey],
    })).rejects.toMatchObject({
      status: 403,
      details: { code: "reflection_coach_mutation_gate_required" },
    });
  });

  it("rejects accepted interactions from the same run as the apply mutation", async () => {
    const { companyId, coachId, sourceRunId, proposalIssueId, targetKey } = await seedGateFixture();
    await db.insert(issueThreadInteractions).values({
      id: randomUUID(),
      companyId,
      issueId: proposalIssueId,
      kind: "request_confirmation",
      status: "accepted",
      continuationPolicy: "wake_assignee_on_accept",
      sourceRunId,
      createdByAgentId: coachId,
      payload: {
        version: 1,
        prompt: "Apply this Reflection Coach skill diff?",
        detailsMarkdown: "```diff\n+Tighten the workflow.\n```",
        target: { type: "custom", key: targetKey, revisionId: "proposal-v1" },
      },
      result: { version: 1, outcome: "accepted" },
      resolvedByUserId: "board-user",
      resolvedAt: new Date(),
    });

    await expect(changeConsentGateService(db).assertConsented({
      companyId,
      actorAgentId: coachId,
      actorRunId: sourceRunId,
      targetKeys: [targetKey],
    })).rejects.toMatchObject({
      status: 403,
      details: { code: "reflection_coach_mutation_gate_required" },
    });
  });

  it("allows a previous-run accepted interaction with a displayed diff for the bound target", async () => {
    const { companyId, coachId, sourceRunId, applyRunId, proposalIssueId, targetKey } = await seedGateFixture();
    const interactionId = randomUUID();
    await db.insert(issueThreadInteractions).values({
      id: interactionId,
      companyId,
      issueId: proposalIssueId,
      kind: "request_confirmation",
      status: "accepted",
      continuationPolicy: "wake_assignee_on_accept",
      sourceRunId,
      createdByAgentId: coachId,
      payload: {
        version: 1,
        prompt: "Apply this Reflection Coach skill diff?",
        detailsMarkdown: "```diff\n+Tighten the workflow.\n```",
        target: { type: "custom", key: targetKey, revisionId: "proposal-v1" },
      },
      result: { version: 1, outcome: "accepted" },
      resolvedByUserId: "board-user",
      resolvedAt: new Date(),
    });
    const actorRunId = applyRunId;

    await expect(changeConsentGateService(db).assertConsented({
      companyId,
      actorAgentId: coachId,
      actorRunId,
      targetKeys: [targetKey],
    })).resolves.toBe(true);

    const [stored] = await db
      .select({ result: issueThreadInteractions.result })
      .from(issueThreadInteractions)
      .where(eq(issueThreadInteractions.id, interactionId));

    expect(stored?.result).toMatchObject({
      consumedByRunId: actorRunId,
      outcome: "accepted",
      version: 1,
    });
    expect((stored?.result as { consumedAt?: unknown } | undefined)?.consumedAt).toEqual(expect.any(String));
  });

  it("rejects reusing an accepted interaction after it is consumed by a mutation", async () => {
    const { companyId, coachId, sourceRunId, applyRunId, proposalIssueId, targetKey } = await seedGateFixture();
    await db.insert(issueThreadInteractions).values({
      id: randomUUID(),
      companyId,
      issueId: proposalIssueId,
      kind: "request_confirmation",
      status: "accepted",
      continuationPolicy: "wake_assignee_on_accept",
      sourceRunId,
      createdByAgentId: coachId,
      payload: {
        version: 1,
        prompt: "Apply this Reflection Coach skill diff?",
        detailsMarkdown: "```diff\n+Tighten the workflow.\n```",
        target: { type: "custom", key: targetKey, revisionId: "proposal-v1" },
      },
      result: { version: 1, outcome: "accepted" },
      resolvedByUserId: "board-user",
      resolvedAt: new Date(),
    });

    await expect(changeConsentGateService(db).assertConsented({
      companyId,
      actorAgentId: coachId,
      actorRunId: applyRunId,
      targetKeys: [targetKey],
    })).resolves.toBe(true);

    await expect(changeConsentGateService(db).assertConsented({
      companyId,
      actorAgentId: coachId,
      actorRunId: randomUUID(),
      targetKeys: [targetKey],
    })).rejects.toMatchObject({
      status: 403,
      details: { code: "reflection_coach_mutation_gate_required" },
    });
  });

  function snapshotInteractionValues(fixture: {
    companyId: string;
    coachId: string;
    sourceRunId: string;
    proposalIssueId: string;
    targetKey: string;
  }, fingerprint: string) {
    return {
      id: randomUUID(),
      companyId: fixture.companyId,
      issueId: fixture.proposalIssueId,
      kind: "request_confirmation",
      status: "accepted",
      continuationPolicy: "wake_assignee_on_accept",
      sourceRunId: fixture.sourceRunId,
      createdByAgentId: fixture.coachId,
      payload: {
        version: 1,
        prompt: "Apply this skill diff?",
        detailsMarkdown: "```diff\n+Tighten the workflow.\n```",
        target: {
          type: "custom",
          key: fixture.targetKey,
          revisionId: "proposal-v1",
          snapshot: { fingerprint, algorithm: "sha256" },
        },
      },
      result: { version: 1, outcome: "accepted" },
      resolvedByUserId: "board-user",
      resolvedAt: new Date(),
    } as const;
  }

  it("blocks the apply and audits when the live target drifted from the proposal snapshot", async () => {
    const fixture = await seedGateFixture();
    const proposalFingerprint = computeChangeGateTargetFingerprint("target-state-at-propose-time");
    const interaction = snapshotInteractionValues(fixture, proposalFingerprint);
    await db.insert(issueThreadInteractions).values(interaction);

    const actorRunId = fixture.applyRunId;
    await expect(changeConsentGateService(db).assertConsented({
      companyId: fixture.companyId,
      actorAgentId: fixture.coachId,
      actorRunId,
      targetKeys: [fixture.targetKey],
      liveTargetFingerprint: computeChangeGateTargetFingerprint("target-state-mutated-after-propose"),
    })).rejects.toMatchObject({
      status: 403,
      details: { code: "change_gate_target_drift", recheck: "drift" },
    });

    const [stored] = await db
      .select({ result: issueThreadInteractions.result })
      .from(issueThreadInteractions)
      .where(eq(issueThreadInteractions.id, interaction.id));
    expect((stored?.result as { consumedByRunId?: unknown } | undefined)?.consumedByRunId).toBeUndefined();

    const auditRows = await db
      .select()
      .from(activityLog)
      .where(eq(activityLog.action, "change_gate.drift_blocked"));
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({
      companyId: fixture.companyId,
      entityId: interaction.id,
      agentId: fixture.coachId,
      runId: actorRunId,
    });
    expect(auditRows[0]!.details).toMatchObject({
      recheck: "drift",
      proposalFingerprint,
      targetKey: fixture.targetKey,
    });
  });

  it("fails closed when the proposal has a snapshot but the live state was not re-read", async () => {
    const fixture = await seedGateFixture();
    await db.insert(issueThreadInteractions).values(
      snapshotInteractionValues(fixture, computeChangeGateTargetFingerprint("target-state-at-propose-time")),
    );

    await expect(changeConsentGateService(db).assertConsented({
      companyId: fixture.companyId,
      actorAgentId: fixture.coachId,
      actorRunId: fixture.applyRunId,
      targetKeys: [fixture.targetKey],
    })).rejects.toMatchObject({
      status: 403,
      details: { code: "change_gate_target_drift", recheck: "live_state_unavailable" },
    });
  });

  it("applies on a matching live fingerprint and links proposal + recheck in the event log", async () => {
    const fixture = await seedGateFixture();
    const fingerprint = computeChangeGateTargetFingerprint("target-state-at-propose-time");
    const interaction = snapshotInteractionValues(fixture, fingerprint);
    await db.insert(issueThreadInteractions).values(interaction);

    const actorRunId = fixture.applyRunId;
    await expect(changeConsentGateService(db).assertConsented({
      companyId: fixture.companyId,
      actorAgentId: fixture.coachId,
      actorRunId,
      targetKeys: [fixture.targetKey],
      liveTargetFingerprint: fingerprint,
    })).resolves.toBe(true);

    const auditRows = await db
      .select()
      .from(activityLog)
      .where(eq(activityLog.action, "change_gate.apply_consumed"));
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({
      companyId: fixture.companyId,
      entityId: interaction.id,
      agentId: fixture.coachId,
      runId: actorRunId,
    });
    expect(auditRows[0]!.details).toMatchObject({
      recheck: "match",
      proposalFingerprint: fingerprint,
      liveFingerprint: fingerprint,
      proposalSourceRunId: fixture.sourceRunId,
      applyRunId: actorRunId,
    });
  });

  it("refuses founder-protected mutations from employees and audits the refusal", async () => {
    const fixture = await seedGateFixture();

    expect(founderProtectedFromMetadata({ founderProtected: true })).toBe(true);
    expect(founderProtectedFromMetadata({ founderProtected: "yes" })).toBe(false);
    expect(founderProtectedFromMetadata({})).toBe(false);
    expect(founderProtectedFromMetadata(null)).toBe(false);

    await expect(refuseFounderProtectedMutation(db, {
      companyId: fixture.companyId,
      actorAgentId: fixture.coachId,
      actorRunId: fixture.sourceRunId,
      targetKey: fixture.targetKey,
    })).rejects.toMatchObject({
      status: 403,
      details: { code: "change_gate_founder_protected", targetKey: fixture.targetKey },
    });

    const auditRows = await db
      .select()
      .from(activityLog)
      .where(eq(activityLog.action, "change_gate.founder_protected_blocked"));
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({
      companyId: fixture.companyId,
      agentId: fixture.coachId,
      runId: fixture.sourceRunId,
      entityId: fixture.targetKey,
    });
  });

  it("derives identical row fingerprints from Date and ISO-string reads of the same updatedAt", () => {
    const updatedAt = new Date("2026-07-16T04:05:06.789Z");
    const fromDate = computeChangeGateRowFingerprint(updatedAt);
    const fromString = computeChangeGateRowFingerprint(updatedAt.toISOString());
    expect(fromDate).toBe(fromString);
    expect(fromDate).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(computeChangeGateRowFingerprint(null)).toBeNull();
    expect(computeChangeGateRowFingerprint("not-a-date")).toBeNull();
  });

  it("allows legacy Reflection Coach target keys for durable accepted interactions", async () => {
    const { companyId, coachId, sourceRunId, applyRunId, proposalIssueId, skillId, targetKey } = await seedGateFixture();
    await db.insert(issueThreadInteractions).values({
      id: randomUUID(),
      companyId,
      issueId: proposalIssueId,
      kind: "request_confirmation",
      status: "accepted",
      continuationPolicy: "wake_assignee_on_accept",
      sourceRunId,
      createdByAgentId: coachId,
      payload: {
        version: 1,
        prompt: "Apply this Reflection Coach skill diff?",
        detailsMarkdown: "```diff\n+Tighten the workflow.\n```",
        target: { type: "custom", key: `reflection-coach:company-skill:${skillId}`, revisionId: "proposal-v1" },
      },
      result: { version: 1, outcome: "accepted" },
      resolvedByUserId: "board-user",
      resolvedAt: new Date(),
    });

    await expect(changeConsentGateService(db).assertConsented({
      companyId,
      actorAgentId: coachId,
      actorRunId: applyRunId,
      targetKeys: [targetKey],
    })).resolves.toBe(true);
  });
});
