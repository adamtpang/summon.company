import { Router, type Request } from "express";
import type { Db } from "@paperclipai/db";
import {
  buildVitalsAiSdrDogfoodBundle,
  renderVitalsAiSdrDossiersMarkdown,
  renderVitalsAiSdrDraftsMarkdown,
  renderVitalsAiSdrIntakeMarkdown,
  renderVitalsAiSdrMeasurementsMarkdown,
  summarizeVitalsAiSdrBundle,
  vitalsAiSdrDogfoodRequestSchema,
  VITALS_AI_SDR_DOWNSTREAM_BLOCKS,
  VITALS_AI_SDR_LOCAL_LEAD_FIXTURES,
  VITALS_AI_SDR_DOCUMENT_KEYS,
  type VitalsAiSdrDogfoodBundle,
} from "@paperclipai/shared/vitals-ai-sdr";
import { forbidden, notFound, unprocessable } from "../errors.js";
import {
  documentService,
  issueService,
  issueThreadInteractionService,
  logActivity,
  workProductService,
} from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

type DogfoodIssue = NonNullable<Awaited<ReturnType<ReturnType<typeof issueService>["getById"]>>>;
type IssueDocument = Awaited<ReturnType<ReturnType<typeof documentService>["upsertIssueDocument"]>>["document"];

function assertVitalsAiSdrMutationAllowed(req: Request, issue: DogfoodIssue) {
  if (req.actor.type === "board") return;
  if (req.actor.type !== "agent") {
    throw forbidden("Board or agent access required");
  }
  if (!req.actor.runId) {
    throw unprocessable("Agent AI SDR dogfood writes require a run id", { code: "run_id_required" });
  }
  const isAssignee = issue.assigneeAgentId === req.actor.agentId;
  const isActiveRun = issue.checkoutRunId === req.actor.runId || issue.executionRunId === req.actor.runId;
  if (!isAssignee && !isActiveRun) {
    throw forbidden("Agent can only run the AI SDR dogfood loop for an assigned or active-run issue");
  }
}

async function upsertIssueMarkdownDocument(args: {
  documents: ReturnType<typeof documentService>;
  issueId: string;
  key: string;
  title: string;
  body: string;
  changeSummary: string;
  actor: ReturnType<typeof getActorInfo>;
}): Promise<IssueDocument> {
  const existing = await args.documents.getIssueDocumentByKey(args.issueId, args.key);
  const result = await args.documents.upsertIssueDocument({
    issueId: args.issueId,
    key: args.key,
    title: args.title,
    format: "markdown",
    body: args.body,
    changeSummary: args.changeSummary,
    baseRevisionId: existing?.latestRevisionId ?? null,
    createdByAgentId: args.actor.agentId,
    createdByUserId: args.actor.actorType === "user" ? args.actor.actorId : null,
    createdByRunId: args.actor.runId,
    sourceTrust: null,
    lockedDocumentStrategy: "conflict",
  });
  return result.document;
}

function approvalDetailsMarkdown(bundle: VitalsAiSdrDogfoodBundle) {
  return [
    `Campaign ${bundle.campaign.id} generated ${bundle.drafts.length} local-only draft${bundle.drafts.length === 1 ? "" : "s"}.`,
    "",
    "Board review is required before any downstream action. Deliverability, outbound, CRM sync, calendar sync, and external lead-source access are blocked.",
  ].join("\n");
}

function draftPreviewMarkdown(bundle: VitalsAiSdrDogfoodBundle, draftId: string) {
  const draft = bundle.drafts.find((item) => item.id === draftId);
  const dossier = bundle.dossiers.find((item) => item.id === draft?.dossierId);
  if (!draft || !dossier) return null;
  return [
    `Subject: ${draft.subject}`,
    "",
    "```text",
    draft.body,
    "```",
    "",
    "Citations:",
    ...dossier.citations.map((citation) => `- [${citation.id}] ${citation.text} Source: ${citation.source}`),
  ].join("\n");
}

export function vitalsAiSdrRoutes(db: Db) {
  const router = Router();
  const issues = issueService(db);
  const documents = documentService(db);
  const workProducts = workProductService(db);
  const interactions = issueThreadInteractionService(db);

  router.get("/companies/:companyId/vitals/ai-sdr/local-fixtures", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    res.json({
      leadSourceKind: "local_fixture",
      fixtures: VITALS_AI_SDR_LOCAL_LEAD_FIXTURES.map((fixture) => ({
        id: fixture.id,
        companyName: fixture.companyName,
        website: fixture.website,
        prospectRole: fixture.prospectRole,
        geography: fixture.geography,
        segment: fixture.segment,
        citationCount: fixture.citations.length,
      })),
      downstreamBlocks: VITALS_AI_SDR_DOWNSTREAM_BLOCKS,
    });
  });

  router.post("/companies/:companyId/vitals/ai-sdr/local-dogfood", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const parsed = vitalsAiSdrDogfoodRequestSchema.parse(req.body);
    const issue = await issues.getById(parsed.issueId);
    if (!issue) {
      throw notFound("Issue not found");
    }
    if (issue.companyId !== companyId) {
      throw notFound("Issue not found");
    }
    assertVitalsAiSdrMutationAllowed(req, issue);

    const actor = getActorInfo(req);
    const bundle = buildVitalsAiSdrDogfoodBundle(parsed.intake);
    const intakeDocument = await upsertIssueMarkdownDocument({
      documents,
      issueId: issue.id,
      key: VITALS_AI_SDR_DOCUMENT_KEYS.intake,
      title: "AI SDR intake",
      body: renderVitalsAiSdrIntakeMarkdown(bundle),
      changeSummary: "Captured local AI SDR intake.",
      actor,
    });
    const dossierDocument = await upsertIssueMarkdownDocument({
      documents,
      issueId: issue.id,
      key: VITALS_AI_SDR_DOCUMENT_KEYS.dossiers,
      title: "AI SDR cited dossiers",
      body: renderVitalsAiSdrDossiersMarkdown(bundle),
      changeSummary: "Generated local cited AI SDR dossiers.",
      actor,
    });
    const draftDocument = await upsertIssueMarkdownDocument({
      documents,
      issueId: issue.id,
      key: VITALS_AI_SDR_DOCUMENT_KEYS.drafts,
      title: "AI SDR personalized drafts",
      body: renderVitalsAiSdrDraftsMarkdown(bundle),
      changeSummary: "Generated local personalized AI SDR drafts.",
      actor,
    });
    const measurementsDocument = await upsertIssueMarkdownDocument({
      documents,
      issueId: issue.id,
      key: VITALS_AI_SDR_DOCUMENT_KEYS.measurements,
      title: "AI SDR measurement and blocked stages",
      body: renderVitalsAiSdrMeasurementsMarkdown(bundle),
      changeSummary: "Recorded local AI SDR measurements and downstream blocks.",
      actor,
    });

    const dossierWorkProduct = await workProducts.createForIssue(issue.id, companyId, {
      type: "document",
      provider: "vitals-local-ai-sdr",
      title: `AI SDR dossier batch - ${bundle.campaign.companyHost}`,
      status: "ready_for_review",
      reviewState: "needs_board_review",
      isPrimary: false,
      healthStatus: "unknown",
      summary: `${bundle.dossiers.length} cited local fixture dossier${bundle.dossiers.length === 1 ? "" : "s"} generated for board review.`,
      metadata: {
        vitalsAiSdr: {
          kind: "dossiers",
          campaignId: bundle.campaign.id,
          documentId: dossierDocument.id,
          documentKey: dossierDocument.key,
          revisionId: dossierDocument.latestRevisionId,
          revisionNumber: dossierDocument.latestRevisionNumber,
        },
      },
      createdByRunId: actor.runId,
    });
    const draftWorkProduct = await workProducts.createForIssue(issue.id, companyId, {
      type: "document",
      provider: "vitals-local-ai-sdr",
      title: `AI SDR draft batch - ${bundle.campaign.companyHost}`,
      status: "draft",
      reviewState: "needs_board_review",
      isPrimary: false,
      healthStatus: "unknown",
      summary: `${bundle.drafts.length} personalized draft${bundle.drafts.length === 1 ? "" : "s"} held for board approval; no outbound stage is connected.`,
      metadata: {
        vitalsAiSdr: {
          kind: "drafts",
          campaignId: bundle.campaign.id,
          documentId: draftDocument.id,
          documentKey: draftDocument.key,
          revisionId: draftDocument.latestRevisionId,
          revisionNumber: draftDocument.latestRevisionNumber,
        },
      },
      createdByRunId: actor.runId,
    });

    const interaction = await interactions.create(issue, {
      kind: "request_item_verdicts",
      idempotencyKey: `vitals-ai-sdr:${bundle.campaign.id}:draft-approval:${draftDocument.latestRevisionId}`,
      sourceRunId: actor.actorType === "agent" ? actor.runId : null,
      title: "Approve AI SDR draft batch",
      summary: "Review local-only AI SDR drafts before any outbound exists.",
      continuationPolicy: "none",
      payload: {
        version: 1,
        prompt: "Approve, reject, or defer each local AI SDR draft.",
        detailsMarkdown: approvalDetailsMarkdown(bundle),
        items: bundle.drafts.map((draft, index) => ({
          id: draft.id,
          label: `${index + 1}. ${draft.prospectCompany}`,
          description: `${draft.prospectName}, ${draft.prospectRole}. Subject: ${draft.subject}`,
          previewMarkdown: draftPreviewMarkdown(bundle, draft.id),
          href: `/issues/${issue.identifier ?? issue.id}#documents`,
        })),
        verdicts: ["approve", "reject", "defer"],
        requireReasonOn: ["reject"],
        reasonLabel: "Decision reason",
        allowBulkApprove: true,
        supersedeOnUserComment: true,
        target: {
          type: "issue_document",
          issueId: issue.id,
          documentId: draftDocument.id,
          key: draftDocument.key,
          revisionId: draftDocument.latestRevisionId!,
          revisionNumber: draftDocument.latestRevisionNumber,
          label: "AI SDR draft batch",
          href: `/issues/${issue.identifier ?? issue.id}#documents`,
        },
      },
    }, {
      agentId: actor.agentId,
      userId: actor.actorType === "user" ? actor.actorId : null,
    });

    for (const eventItem of bundle.measurementEvents) {
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        action: `vitals.ai_sdr.${eventItem.eventName}`,
        entityType: "issue",
        entityId: issue.id,
        details: {
          ...eventItem.metadata,
          campaignId: eventItem.campaignId,
          measurementEventId: eventItem.id,
          stageKey: eventItem.stageKey,
        },
      });
    }

    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "vitals.ai_sdr.local_dogfood_generated",
      entityType: "issue",
      entityId: issue.id,
      details: {
        ...summarizeVitalsAiSdrBundle(bundle),
        documentKeys: Object.values(VITALS_AI_SDR_DOCUMENT_KEYS),
        interactionId: interaction.id,
      },
    });

    res.status(201).json({
      bundle,
      documents: {
        intake: intakeDocument,
        dossiers: dossierDocument,
        drafts: draftDocument,
        measurements: measurementsDocument,
      },
      workProducts: [dossierWorkProduct, draftWorkProduct].filter(Boolean),
      interaction,
    });
  });

  return router;
}
