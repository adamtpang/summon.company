import { Router, type Request, type Response } from "express";
import multer from "multer";
import type { Db } from "@paperclipai/db";
import { isAgentStatusInvokable, selectCompanyCofounder } from "@paperclipai/shared";
import { agentService, heartbeatService, instanceSettingsService, issueService } from "../services/index.js";
import { logActivity } from "../services/activity-log.js";
import {
  COMPANY_CHAT_AUDIO_CONTENT_TYPES,
  CompanyAiGatewayPublicError,
  MAX_COMPANY_CHAT_AUDIO_BYTES,
  companyAiGatewayService,
} from "../services/company-ai-gateway.js";
import type { PluginWorkerManager } from "../services/plugin-worker-manager.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

/**
 * Board Chat routes.
 *
 * `POST /board/chat/stream` records the board's message on the standing
 * "Board Operations" issue and wakes the company's configured Cofounder
 * through the normal governed heartbeat runtime. The SSE connection observes
 * that run; it is not a second model executor.
 *
 * The SSE event protocol matches what `ui/src/pages/BoardChat.tsx` consumes:
 *   { type: "start",  issueId }   — emitted once the governed run is queued
 *   { type: "status", text }      — tool-use / progress indicator
 *   { type: "done",   issueId }   — terminal event; UI refetches comments
 *   { type: "error",  message }   — terminal error event
 */
const MAX_BOARD_CHAT_ATTACHMENTS = 8;
const BOARD_CHAT_ATTACHMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BOARD_CHAT_OBSERVER_POLL_MS = 500;
const BOARD_CHAT_OBSERVER_TIMEOUT_MS = 10 * 60 * 1000;
const BOARD_CHAT_REPLY_SETTLE_MS = 1500;
const TERMINAL_HEARTBEAT_STATUSES = new Set([
  "succeeded",
  "interrupted",
  "failed",
  "cancelled",
  "timed_out",
]);

function boardChatRunStatusText(agentName: string, status: string) {
  if (status === "running") return `${agentName} is working...`;
  if (status === "scheduled_retry") return `${agentName} is preparing a retry...`;
  return `${agentName} is queued...`;
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function boardChatRoutes(
  db: Db,
  opts: { pluginWorkerManager?: PluginWorkerManager } = {},
) {
  const router = Router();
  const agents = agentService(db);
  const heartbeat = heartbeatService(db, { pluginWorkerManager: opts.pluginWorkerManager });
  const transcriptionService = companyAiGatewayService(db);
  const audioUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_COMPANY_CHAT_AUDIO_BYTES, files: 1, fields: 3 },
  });

  async function runAudioUpload(req: Request, res: Response) {
    await new Promise<void>((resolve, reject) => {
      audioUpload.single("audio")(req, res, (error: unknown) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  async function assertBoardChatRuntime(res: Response) {
    const experimental = await instanceSettingsService(db).getExperimental();
    if (experimental.enableConferenceRoomChat !== true) {
      res.status(403).json({ error: "Conference Room Chat is not enabled", code: "FEATURE_DISABLED" });
      return false;
    }
    return true;
  }

  async function findOrCreateStandingBoardIssue(
    companyId: string,
    actor: ReturnType<typeof getActorInfo>,
  ) {
    const issueSvc = issueService(db);
    const companyIssues = await issueSvc.list(companyId, { q: "Board Operations" });
    const boardIssue = companyIssues.find(
      (issue) =>
        issue.title === "Board Operations" &&
        issue.status !== "done" &&
        issue.status !== "cancelled",
    );
    if (boardIssue) return { issue: boardIssue, issueId: boardIssue.id, created: false };

    const created = await issueSvc.create(companyId, {
      title: "Board Operations",
      description: "Standing issue for board concierge conversations and decision log",
      status: "todo",
      priority: "medium",
      createdByUserId: actor.actorType === "user" ? actor.actorId : null,
      responsibleUserId: actor.actorType === "user" ? actor.actorId : null,
      trustExplicitResponsibleUserId: actor.actorType === "user",
    });
    return { issue: created, issueId: created.id, created: true };
  }

  router.post("/board/chat/prepare", async (req, res) => {
    if (!await assertBoardChatRuntime(res)) return;

    const companyId = typeof req.body?.companyId === "string" ? req.body.companyId : "";
    if (!companyId) {
      res.status(400).json({ error: "companyId is required" });
      return;
    }
    assertCompanyAccess(req, companyId);
    const prepared = await findOrCreateStandingBoardIssue(companyId, getActorInfo(req));
    res.status(prepared.created ? 201 : 200).json({
      issueId: prepared.issueId,
      created: prepared.created,
    });
  });

  router.get("/board/chat/transcription", async (req, res) => {
    if (!await assertBoardChatRuntime(res)) return;
    const companyId = typeof req.query.companyId === "string" ? req.query.companyId : "";
    if (!companyId) {
      res.status(400).json({ error: "companyId is required" });
      return;
    }
    assertCompanyAccess(req, companyId);
    res.json(await transcriptionService.getTranscriptionCapability(companyId));
  });

  router.post("/board/chat/transcribe", async (req, res) => {
    if (!await assertBoardChatRuntime(res)) return;
    try {
      await runAudioUpload(req, res);
    } catch (error) {
      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
          res.status(413).json({
            error: `Voice recording exceeds ${MAX_COMPANY_CHAT_AUDIO_BYTES} bytes`,
            code: "audio_too_large",
          });
          return;
        }
        res.status(400).json({ error: error.message, code: "audio_upload_invalid" });
        return;
      }
      throw error;
    }
    const companyId = typeof req.body?.companyId === "string" ? req.body.companyId : "";
    const clientRequestId = typeof req.body?.clientRequestId === "string"
      ? req.body.clientRequestId
      : "";
    const file = (req as Request & {
      file?: { buffer: Buffer; mimetype: string; size: number };
    }).file;
    if (!companyId || !BOARD_CHAT_ATTACHMENT_ID.test(clientRequestId) || !file) {
      file?.buffer.fill(0);
      res.status(400).json({
        error: "companyId, a unique clientRequestId, and one audio file are required",
        code: "transcription_request_invalid",
      });
      return;
    }
    assertCompanyAccess(req, companyId);
    const contentType = file.mimetype.split(";", 1)[0]!.trim().toLowerCase();
    if (!COMPANY_CHAT_AUDIO_CONTENT_TYPES.includes(
      contentType as (typeof COMPANY_CHAT_AUDIO_CONTENT_TYPES)[number],
    )) {
      file.buffer.fill(0);
      res.status(415).json({
        error: "Use WebM, Ogg, MP4/M4A, MP3, or WAV audio",
        code: "audio_type_unsupported",
      });
      return;
    }
    try {
      const actor = getActorInfo(req);
      const result = await transcriptionService.transcribeBoardAudio({
        companyId,
        clientRequestId,
        audio: file.buffer,
        contentType,
        actorId: actor.actorId,
      });
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        action: "board_chat.voice_transcribed",
        entityType: "company_ai_gateway_transcription",
        entityId: result.requestId,
        details: {
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          estimatedCostMicrousd: result.estimatedCostMicrousd,
          byteSize: file.size,
          contentType,
          rawAudioPersisted: false,
          draftTranscriptPersisted: false,
          reviewRequired: true,
        },
      });
      res.json(result);
    } catch (error) {
      if (error instanceof CompanyAiGatewayPublicError) {
        if (error.retryAfterSeconds !== null) {
          res.setHeader("Retry-After", String(error.retryAfterSeconds));
        }
        res.status(error.statusCode).json({ error: error.message, code: error.code });
        return;
      }
      throw error;
    } finally {
      file.buffer.fill(0);
    }
  });

  router.post("/board/chat/stream", async (req, res) => {
    if (!await assertBoardChatRuntime(res)) return;

    const { companyId, message, taskId, attachmentIds } = req.body as {
      companyId?: string;
      message?: string;
      taskId?: string;
      attachmentIds?: unknown;
    };

    if (!companyId || !message) {
      res.status(400).json({ error: "companyId and message are required" });
      return;
    }
    assertCompanyAccess(req, companyId);

    if (attachmentIds !== undefined) {
      if (!Array.isArray(attachmentIds) || attachmentIds.length > MAX_BOARD_CHAT_ATTACHMENTS) {
        res.status(400).json({ error: `attachmentIds must contain at most ${MAX_BOARD_CHAT_ATTACHMENTS} IDs` });
        return;
      }
      if (attachmentIds.some((id) => typeof id !== "string" || !BOARD_CHAT_ATTACHMENT_ID.test(id))) {
        res.status(400).json({ error: "attachmentIds contains an invalid ID" });
        return;
      }
      if (new Set(attachmentIds).size !== attachmentIds.length) {
        res.status(400).json({ error: "attachmentIds must not contain duplicates" });
        return;
      }
    }

    const companyAgents = await agents.list(companyId);
    const cofounder = selectCompanyCofounder(companyAgents);

    if (!cofounder) {
      res.status(409).json({
        error: "Add and approve a Cofounder before using Board Chat",
        code: "BOARD_CHAT_COFUNDER_REQUIRED",
      });
      return;
    }
    if (
      !isAgentStatusInvokable(cofounder.status) ||
      cofounder.orgChainHealth?.status === "invalid_org_chain"
    ) {
      res.status(409).json({
        error:
          cofounder.orgChainHealth?.repairGuidance ??
          `${cofounder.name} must be active before using Board Chat`,
        code: "BOARD_CHAT_COFUNDER_UNAVAILABLE",
        agentId: cofounder.id,
        status: cofounder.status,
      });
      return;
    }

    const issueSvc = issueService(db);
    const actor = getActorInfo(req);
    let resolvedIssue: Awaited<ReturnType<typeof issueSvc.getById>>;

    if (taskId) {
      resolvedIssue = await issueSvc.getById(taskId);
      if (!resolvedIssue) {
        res.status(404).json({ error: "Board chat task not found" });
        return;
      }
      if (resolvedIssue.companyId !== companyId) {
        res.status(422).json({ error: "Board chat task does not belong to company" });
        return;
      }
    } else {
      resolvedIssue = (await findOrCreateStandingBoardIssue(companyId, actor)).issue;
    }

    const resolvedIssueId = resolvedIssue.id;
    for (const attachmentId of (attachmentIds as string[] | undefined) ?? []) {
      const attachment = await issueSvc.getAttachmentById(attachmentId);
      if (
        !attachment ||
        attachment.companyId !== companyId ||
        attachment.issueId !== resolvedIssueId
      ) {
        res.status(422).json({ error: "Attachment does not belong to this board conversation" });
        return;
      }
    }

    if (
      resolvedIssue.title === "Board Operations" &&
      (
        resolvedIssue.assigneeAgentId !== cofounder.id ||
        resolvedIssue.assigneeUserId
      )
    ) {
      const previousAssigneeAgentId = resolvedIssue.assigneeAgentId;
      const previousAssigneeUserId = resolvedIssue.assigneeUserId;
      resolvedIssue =
        await issueSvc.update(resolvedIssueId, {
          assigneeAgentId: cofounder.id,
          assigneeUserId: null,
          actorAgentId: actor.agentId,
          actorUserId: actor.actorType === "user" ? actor.actorId : null,
        }) ?? resolvedIssue;
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        action: "issue.updated",
        entityType: "issue",
        entityId: resolvedIssueId,
        details: {
          source: "board_chat",
          assigneeAgentId: cofounder.id,
          assigneeUserId: null,
          _previous: {
            assigneeAgentId: previousAssigneeAgentId,
            assigneeUserId: previousAssigneeUserId,
          },
        },
      });
    }

    const comment = await issueSvc.addComment(resolvedIssueId, message, {
      agentId: actor.agentId ?? undefined,
      userId: actor.agentId ? undefined : actor.actorId,
      runId: actor.runId,
    });
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "issue.comment_added",
      entityType: "issue",
      entityId: resolvedIssueId,
      details: {
        source: "board_chat",
        commentId: comment.id,
        bodySnippet: message.slice(0, 120),
        identifier: resolvedIssue.identifier,
        issueTitle: resolvedIssue.title,
      },
    });

    const run = await heartbeat.wakeup(cofounder.id, {
      source: "on_demand",
      triggerDetail: "manual",
      reason: "issue_commented",
      payload: {
        issueId: resolvedIssueId,
        commentId: comment.id,
        mutation: "comment",
        boardChat: true,
        attachmentIds: (attachmentIds as string[] | undefined) ?? [],
      },
      idempotencyKey: `board-chat:${comment.id}`,
      requestedByActorType: actor.actorType,
      requestedByActorId: actor.actorId,
      contextSnapshot: {
        issueId: resolvedIssueId,
        taskId: resolvedIssueId,
        commentId: comment.id,
        wakeCommentId: comment.id,
        wakeReason: "issue_commented",
        source: "issue.comment",
        boardChat: true,
      },
    });

    if (!run) {
      res.status(409).json({
        error: `${cofounder.name} could not be queued. Check the employee's runtime, budget, and company status.`,
        code: "BOARD_CHAT_WAKE_SKIPPED",
        agentId: cofounder.id,
      });
      return;
    }

    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: cofounder.id,
      runId: run.id,
      action: "board_chat.cofounder_woken",
      entityType: "heartbeat_run",
      entityId: run.id,
      details: {
        issueId: resolvedIssueId,
        commentId: comment.id,
        attachmentCount: (attachmentIds as string[] | undefined)?.length ?? 0,
      },
    });

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();

    let clientConnected = true;
    res.on("close", () => {
      clientConnected = false;
    });
    const writeEvent = (event: Record<string, unknown>) => {
      if (!clientConnected || res.writableEnded || res.destroyed) return;
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    writeEvent({
      type: "start",
      issueId: resolvedIssueId,
      runId: run.id,
      agentId: cofounder.id,
      agentName: cofounder.name,
    });

    const observerStartedAt = Date.now();
    let currentRun = run;
    let lastObservedStatus = "";
    let terminalObservedAt: number | null = null;

    try {
      while (clientConnected) {
        if (currentRun.status !== lastObservedStatus) {
          lastObservedStatus = currentRun.status;
          writeEvent({
            type: "status",
            text: boardChatRunStatusText(cofounder.name, currentRun.status),
            runId: currentRun.id,
            status: currentRun.status,
          });
        }

        if (TERMINAL_HEARTBEAT_STATUSES.has(currentRun.status)) {
          terminalObservedAt ??= Date.now();
          if (
            currentRun.status === "succeeded" &&
            currentRun.issueCommentStatus === "not_applicable" &&
            Date.now() - terminalObservedAt < BOARD_CHAT_REPLY_SETTLE_MS
          ) {
            await delay(BOARD_CHAT_OBSERVER_POLL_MS);
            const refreshed = await heartbeat.getRun(run.id);
            if (refreshed) {
              currentRun = refreshed;
              if (currentRun.issueCommentStatus === "not_applicable") {
                continue;
              }
            }
          }

          if (currentRun.status !== "succeeded") {
            writeEvent({
              type: "error",
              message:
                typeof currentRun.error === "string" && currentRun.error.trim()
                  ? currentRun.error
                  : `${cofounder.name}'s governed run ended with status ${currentRun.status}.`,
              runId: currentRun.id,
              status: currentRun.status,
            });
          }
          writeEvent({
            type: "done",
            issueId: resolvedIssueId,
            runId: currentRun.id,
            status: currentRun.status,
          });
          if (!res.writableEnded && !res.destroyed) res.end();
          return;
        }

        if (Date.now() - observerStartedAt >= BOARD_CHAT_OBSERVER_TIMEOUT_MS) {
          writeEvent({
            type: "status",
            text: `${cofounder.name} is still working. The governed run will continue in the company timeline.`,
            runId: currentRun.id,
            status: currentRun.status,
          });
          writeEvent({
            type: "done",
            issueId: resolvedIssueId,
            runId: currentRun.id,
            status: currentRun.status,
            pending: true,
          });
          if (!res.writableEnded && !res.destroyed) res.end();
          return;
        }

        await delay(BOARD_CHAT_OBSERVER_POLL_MS);
        const refreshed = await heartbeat.getRun(run.id);
        if (!refreshed) {
          writeEvent({
            type: "error",
            message: "The governed Cofounder run could not be found.",
            runId: run.id,
          });
          if (!res.writableEnded && !res.destroyed) res.end();
          return;
        }
        currentRun = refreshed;
      }
    } catch (error) {
      console.error("[board/chat/stream observer error]", error);
      writeEvent({
        type: "error",
        message: "Board Chat lost the run observer. The governed Cofounder run was not cancelled.",
        runId: run.id,
      });
      if (!res.writableEnded && !res.destroyed) res.end();
    }
  });

  return router;
}
