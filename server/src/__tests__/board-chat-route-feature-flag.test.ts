import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetExperimental = vi.hoisted(() => vi.fn());
const mockIssueService = vi.hoisted(() => ({
  list: vi.fn(),
  getById: vi.fn(),
  getAttachmentById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  addComment: vi.fn(),
}));
const mockAgentList = vi.hoisted(() => vi.fn());
const mockWakeup = vi.hoisted(() => vi.fn());
const mockGetRun = vi.hoisted(() => vi.fn());
const mockCancelRun = vi.hoisted(() => vi.fn());
const mockGetTranscriptionCapability = vi.hoisted(() => vi.fn());
const mockTranscribeBoardAudio = vi.hoisted(() => vi.fn());
const mockLogActivity = vi.hoisted(() => vi.fn());

vi.mock("../services/index.js", () => ({
  agentService: () => ({ list: mockAgentList }),
  heartbeatService: () => ({
    wakeup: mockWakeup,
    getRun: mockGetRun,
    cancelRun: mockCancelRun,
  }),
  instanceSettingsService: () => ({ getExperimental: mockGetExperimental }),
  issueService: () => mockIssueService,
}));

vi.mock("../services/activity-log.js", () => ({ logActivity: mockLogActivity }));

vi.mock("../services/company-ai-gateway.js", () => {
  class CompanyAiGatewayPublicError extends Error {
    statusCode: number;
    code: string;
    retryAfterSeconds: number | null;
    constructor(statusCode: number, code: string, message: string) {
      super(message);
      this.statusCode = statusCode;
      this.code = code;
      this.retryAfterSeconds = null;
    }
  }
  return {
    COMPANY_CHAT_AUDIO_CONTENT_TYPES: ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav"],
    CompanyAiGatewayPublicError,
    MAX_COMPANY_CHAT_AUDIO_BYTES: 12 * 1024 * 1024,
    companyAiGatewayService: () => ({
      getTranscriptionCapability: mockGetTranscriptionCapability,
      transcribeBoardAudio: mockTranscribeBoardAudio,
    }),
  };
});

vi.mock("../routes/authz.js", () => ({
  getActorInfo: () => ({
    actorType: "user",
    actorId: "user-1",
    agentId: null,
    runId: null,
  }),
  assertCompanyAccess: () => {},
}));

function cofounder(overrides: Record<string, unknown> = {}) {
  return {
    id: "agent-cofounder",
    companyId: "company-1",
    name: "Mira",
    role: "ceo",
    reportsTo: null,
    status: "idle",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    orgChainHealth: { status: "healthy" },
    ...overrides,
  };
}

function boardIssue(overrides: Record<string, unknown> = {}) {
  return {
    id: "issue-board",
    companyId: "company-1",
    title: "Board Operations",
    status: "todo",
    assigneeAgentId: null,
    assigneeUserId: null,
    ...overrides,
  };
}

function run(overrides: Record<string, unknown> = {}) {
  return {
    id: "run-1",
    companyId: "company-1",
    agentId: "agent-cofounder",
    status: "queued",
    issueCommentStatus: "not_applicable",
    error: null,
    ...overrides,
  };
}

async function createApp() {
  const { boardChatRoutes } = await import("../routes/board-chat.js");
  const app = express();
  app.use(express.json());
  app.use("/api", boardChatRoutes({} as any));
  return app;
}

function parseSse(text: string) {
  return text
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice(6)) as Record<string, unknown>);
}

describe("POST /api/board/chat/stream governed Cofounder rail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetExperimental.mockResolvedValue({ enableConferenceRoomChat: true });
    mockAgentList.mockResolvedValue([cofounder()]);
    mockIssueService.list.mockResolvedValue([boardIssue()]);
    mockIssueService.create.mockResolvedValue(boardIssue());
    mockIssueService.update.mockImplementation(async (_id, patch) => boardIssue({
      assigneeAgentId: patch.assigneeAgentId,
      assigneeUserId: patch.assigneeUserId,
    }));
    mockIssueService.addComment.mockResolvedValue({ id: "comment-1" });
    mockWakeup.mockResolvedValue(run());
    mockGetRun.mockResolvedValue(run({
      status: "succeeded",
      issueCommentStatus: "satisfied",
    }));
    mockLogActivity.mockResolvedValue(undefined);
  });

  it("returns 403 FEATURE_DISABLED before creating work", async () => {
    mockGetExperimental.mockResolvedValue({ enableConferenceRoomChat: false });
    const app = await createApp();

    const res = await request(app)
      .post("/api/board/chat/stream")
      .send({ companyId: "company-1", message: "hello" });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      error: "Conference Room Chat is not enabled",
      code: "FEATURE_DISABLED",
    });
    expect(mockIssueService.addComment).not.toHaveBeenCalled();
    expect(mockIssueService.create).not.toHaveBeenCalled();
    expect(mockWakeup).not.toHaveBeenCalled();
  });

  it("admits the governed route independent of local-shell deployment mode", async () => {
    const app = await createApp();
    const res = await request(app).post("/api/board/chat/stream").send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "companyId and message are required" });
  });

  it("rejects malformed or oversized attachment references before creating work", async () => {
    const app = await createApp();

    const malformed = await request(app)
      .post("/api/board/chat/stream")
      .send({ companyId: "company-1", message: "inspect this", attachmentIds: ["not-an-id"] });
    expect(malformed.status).toBe(400);
    expect(malformed.body.error).toBe("attachmentIds contains an invalid ID");

    const oversized = await request(app)
      .post("/api/board/chat/stream")
      .send({
        companyId: "company-1",
        message: "inspect these",
        attachmentIds: Array.from({ length: 9 }, () => "10000000-0000-4000-8000-000000000000"),
      });
    expect(oversized.status).toBe(400);
    expect(oversized.body.error).toContain("at most 8 IDs");
    expect(mockIssueService.addComment).not.toHaveBeenCalled();
    expect(mockWakeup).not.toHaveBeenCalled();
  });

  it("requires an approved company Cofounder without activating anyone", async () => {
    mockAgentList.mockResolvedValue([]);
    const app = await createApp();

    const missing = await request(app)
      .post("/api/board/chat/stream")
      .send({ companyId: "company-1", message: "hello" });

    expect(missing.status).toBe(409);
    expect(missing.body.code).toBe("BOARD_CHAT_COFUNDER_REQUIRED");
    expect(mockIssueService.create).not.toHaveBeenCalled();
    expect(mockIssueService.addComment).not.toHaveBeenCalled();
    expect(mockWakeup).not.toHaveBeenCalled();

    mockAgentList.mockResolvedValue([cofounder({ status: "pending_approval" })]);
    const pending = await request(app)
      .post("/api/board/chat/stream")
      .send({ companyId: "company-1", message: "hello" });

    expect(pending.status).toBe(409);
    expect(pending.body).toMatchObject({
      code: "BOARD_CHAT_COFUNDER_UNAVAILABLE",
      agentId: "agent-cofounder",
      status: "pending_approval",
    });
    expect(mockWakeup).not.toHaveBeenCalled();
  });

  it("rejects a board task from another company", async () => {
    mockIssueService.getById.mockResolvedValue({
      ...boardIssue({ id: "issue-other" }),
      companyId: "company-2",
    });
    const app = await createApp();

    const res = await request(app)
      .post("/api/board/chat/stream")
      .send({ companyId: "company-1", taskId: "issue-other", message: "hello" });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe("Board chat task does not belong to company");
    expect(mockIssueService.addComment).not.toHaveBeenCalled();
    expect(mockWakeup).not.toHaveBeenCalled();
  });

  it("assigns the standing issue and observes the configured CEO through heartbeat", async () => {
    mockAgentList.mockResolvedValue([
      cofounder({
        id: "agent-operator",
        name: "Operator",
        role: "operations",
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
      }),
      cofounder(),
    ]);
    const app = await createApp();

    const res = await request(app)
      .post("/api/board/chat/stream")
      .send({ companyId: "company-1", message: "Review runway." });

    expect(res.status).toBe(200);
    expect(mockIssueService.update).toHaveBeenCalledWith(
      "issue-board",
      expect.objectContaining({
        assigneeAgentId: "agent-cofounder",
        assigneeUserId: null,
        actorUserId: "user-1",
      }),
    );
    expect(mockIssueService.addComment).toHaveBeenCalledWith(
      "issue-board",
      "Review runway.",
      { agentId: undefined, userId: "user-1", runId: null },
    );
    expect(mockWakeup).toHaveBeenCalledWith("agent-cofounder", {
      source: "on_demand",
      triggerDetail: "manual",
      reason: "issue_commented",
      payload: {
        issueId: "issue-board",
        commentId: "comment-1",
        mutation: "comment",
        boardChat: true,
        attachmentIds: [],
      },
      idempotencyKey: "board-chat:comment-1",
      requestedByActorType: "user",
      requestedByActorId: "user-1",
      contextSnapshot: {
        issueId: "issue-board",
        taskId: "issue-board",
        commentId: "comment-1",
        wakeCommentId: "comment-1",
        wakeReason: "issue_commented",
        source: "issue.comment",
        boardChat: true,
      },
    });
    expect(mockGetRun).toHaveBeenCalledWith("run-1");
    expect(mockCancelRun).not.toHaveBeenCalled();
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "issue.updated",
        entityId: "issue-board",
        details: expect.objectContaining({
          source: "board_chat",
          assigneeAgentId: "agent-cofounder",
        }),
      }),
    );
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "issue.comment_added",
        entityId: "issue-board",
        details: expect.objectContaining({
          source: "board_chat",
          commentId: "comment-1",
        }),
      }),
    );
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "board_chat.cofounder_woken",
        agentId: "agent-cofounder",
        runId: "run-1",
      }),
    );

    const events = parseSse(res.text);
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "start",
        issueId: "issue-board",
        runId: "run-1",
        agentName: "Mira",
      }),
      expect.objectContaining({
        type: "done",
        issueId: "issue-board",
        runId: "run-1",
        status: "succeeded",
      }),
    ]));
    expect(events.some((event) => event.type === "chunk")).toBe(false);
  });

  it("keeps an accepted governed run alive when the browser observer disconnects", async () => {
    mockGetRun.mockResolvedValue(run({ status: "running" }));
    const app = await createApp();
    const req = request(app)
      .post("/api/board/chat/stream")
      .send({ companyId: "company-1", message: "Keep working." });
    const pending = req.then(
      () => undefined,
      () => undefined,
    );

    await vi.waitFor(() => expect(mockWakeup).toHaveBeenCalledTimes(1));
    req.abort();
    await pending;

    expect(mockCancelRun).not.toHaveBeenCalled();
  });

  it("prepares an existing standing conversation without assigning or waking an employee", async () => {
    const app = await createApp();

    const res = await request(app)
      .post("/api/board/chat/prepare")
      .send({ companyId: "company-1" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ issueId: "issue-board", created: false });
    expect(mockIssueService.create).not.toHaveBeenCalled();
    expect(mockIssueService.update).not.toHaveBeenCalled();
    expect(mockIssueService.addComment).not.toHaveBeenCalled();
    expect(mockWakeup).not.toHaveBeenCalled();
  });

  it("exposes voice budget metadata and zeroes uploaded audio after a review draft", async () => {
    mockGetTranscriptionCapability.mockResolvedValue({
      available: true,
      reason: "ready",
      maxSeconds: 60,
      requestReservationMicrousd: 25_000,
      rawAudioPersisted: false,
      draftTranscriptPersisted: false,
      reviewRequired: true,
    });
    mockTranscribeBoardAudio.mockResolvedValue({
      transcript: "Review runway.",
      requestId: "10000000-0000-4000-8000-000000000001",
      model: "gpt-4o-mini-transcribe-2025-12-15",
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
      estimatedCostMicrousd: 38,
      remainingMicrousd: 999_962,
      rawAudioPersisted: false,
      draftTranscriptPersisted: false,
      reviewRequired: true,
    });
    const app = await createApp();
    const capability = await request(app)
      .get("/api/board/chat/transcription")
      .query({ companyId: "10000000-0000-4000-8000-000000000000" })
      .expect(200);
    expect(capability.body).toMatchObject({ available: true, reviewRequired: true });

    const response = await request(app)
      .post("/api/board/chat/transcribe")
      .field("companyId", "10000000-0000-4000-8000-000000000000")
      .field("clientRequestId", "20000000-0000-4000-8000-000000000000")
      .attach("audio", Buffer.from("voice"), { filename: "voice.webm", contentType: "audio/webm" })
      .expect(200);
    expect(response.body).toMatchObject({
      transcript: "Review runway.",
      rawAudioPersisted: false,
      draftTranscriptPersisted: false,
      reviewRequired: true,
    });
    expect(mockTranscribeBoardAudio).toHaveBeenCalledWith(expect.objectContaining({
      companyId: "10000000-0000-4000-8000-000000000000",
      clientRequestId: "20000000-0000-4000-8000-000000000000",
      contentType: "audio/webm",
      actorId: "user-1",
    }));
    const [{ audio }] = mockTranscribeBoardAudio.mock.calls[0] as [{ audio: Buffer }];
    expect(audio.equals(Buffer.alloc(audio.byteLength))).toBe(true);
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "board_chat.voice_transcribed",
        details: expect.objectContaining({
          rawAudioPersisted: false,
          draftTranscriptPersisted: false,
          reviewRequired: true,
        }),
      }),
    );
  });
});
