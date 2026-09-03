// @vitest-environment jsdom

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { act, forwardRef, useImperativeHandle } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BoardChat } from "./BoardChat";

/**
 * Regression coverage for the post-wizard Conference Room intro (PAP-134,
 * plan: PAP-133 A+B): a fresh mount shows the three-dot typing bubble for
 * ~2s, then the CEO welcome, then the suggestion chips ~700ms later. The
 * staged reveal must hold while the onboarding wizard overlay is open or
 * the tab is hidden, and must fast-forward when the user already replied.
 */

const mockAgentsApi = vi.hoisted(() => ({ list: vi.fn() }));
const mockGoalsApi = vi.hoisted(() => ({ list: vi.fn() }));
const mockIssuesApi = vi.hoisted(() => ({
  list: vi.fn(),
  listComments: vi.fn(),
  listFeedbackVotes: vi.fn(),
  uploadAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
}));
const mockBoardChatApi = vi.hoisted(() => ({
  prepare: vi.fn(),
  transcription: vi.fn(),
  transcribe: vi.fn(),
}));
const mockAccessApi = vi.hoisted(() => ({ listUserDirectory: vi.fn() }));
const mockAuthApi = vi.hoisted(() => ({ getSession: vi.fn() }));
const mockDialogState = vi.hoisted(() => ({ onboardingOpen: false }));
const mockChatComposer = vi.hoisted(() => ({ props: null as Record<string, unknown> | null }));

vi.mock("../api/agents", () => ({ agentsApi: mockAgentsApi }));
vi.mock("../api/goals", () => ({ goalsApi: mockGoalsApi }));
vi.mock("../api/issues", () => ({ issuesApi: mockIssuesApi }));
vi.mock("../api/board-chat", () => ({ boardChatApi: mockBoardChatApi }));
vi.mock("../api/access", () => ({ accessApi: mockAccessApi }));
vi.mock("../api/auth", () => ({ authApi: mockAuthApi }));

vi.mock("../context/CompanyContext", () => ({
  useCompany: () => ({
    selectedCompanyId: "company-1",
    selectedCompany: { id: "company-1", name: "Acme Robotics", issuePrefix: "PAP" },
  }),
}));

vi.mock("../context/BreadcrumbContext", () => ({
  useBreadcrumbs: () => ({ setBreadcrumbs: vi.fn() }),
}));

vi.mock("../context/DialogContext", () => ({
  useDialogState: () => ({ onboardingOpen: mockDialogState.onboardingOpen }),
}));

// Heavy children that are irrelevant to the staged intro.
vi.mock("../components/ActivityFeed", () => ({
  ActivityFeed: () => <div data-testid="activity-feed" />,
}));
vi.mock("../components/MarkdownBody", () => ({
  MarkdownBody: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("../components/ChatComposer", () => ({
  ChatComposer: forwardRef((props: Record<string, unknown>, ref) => {
    mockChatComposer.props = props;
    useImperativeHandle(ref, () => ({ focus: vi.fn() }));
    return <div data-testid="chat-composer" />;
  }),
}));
vi.mock("../components/AgentBubbleActionRow", () => ({
  AgentBubbleActionRow: () => null,
  agentBubbleDateLabel: () => "",
}));
vi.mock("../components/AgentIconPicker", () => ({
  AgentIcon: () => null,
}));
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: () => null,
}));
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SheetContent: () => null,
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const CEO_AGENT = {
  id: "agent-ceo",
  name: "Alex",
  role: "ceo",
  status: "active",
  icon: null,
};
const BOARD_ISSUE = { id: "issue-board", title: "Board Operations", status: "in_progress" };
const USER_COMMENT = {
  id: "comment-user-1",
  body: "Hi Alex!",
  authorAgentId: null,
  authorUserId: "user-1",
  createdAt: "2026-06-10T00:00:00.000Z",
};

function hasTypingDots(container: HTMLElement) {
  return container.querySelectorAll(".typing-dots").length > 0;
}

function hasWelcome(container: HTMLElement) {
  return (container.textContent ?? "").includes("Welcome to");
}

function hasChips(container: HTMLElement) {
  // Chips are priority-driven now; with no issues mocked, the baseline
  // "Status" chip is the one that always renders.
  return [...container.querySelectorAll("button")].some(
    (button) => button.textContent?.trim() === "Status",
  );
}

describe("BoardChat staged typing intro", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    container = document.createElement("div");
    document.body.appendChild(container);
    mockDialogState.onboardingOpen = false;
    mockAgentsApi.list.mockResolvedValue([CEO_AGENT]);
    mockGoalsApi.list.mockResolvedValue([
      { id: "goal-1", title: "Build affordable robots", status: "active" },
    ]);
    mockIssuesApi.list.mockResolvedValue([BOARD_ISSUE]);
    mockIssuesApi.listComments.mockResolvedValue([]);
    mockIssuesApi.listFeedbackVotes.mockResolvedValue([]);
    mockIssuesApi.uploadAttachment.mockResolvedValue({
      id: "10000000-0000-4000-8000-000000000000",
      companyId: "company-1",
      issueId: "issue-board",
      originalFilename: "plan.pdf",
      contentType: "application/pdf",
      byteSize: 4,
      contentPath: "/api/attachments/10000000-0000-4000-8000-000000000000/content",
    });
    mockIssuesApi.deleteAttachment.mockResolvedValue({ ok: true });
    mockBoardChatApi.prepare.mockResolvedValue({ issueId: "issue-board", created: true });
    mockBoardChatApi.transcription.mockResolvedValue({
      available: false,
      reason: "transcription_not_enabled",
      provider: "openai",
      model: null,
      maxSeconds: 60,
      maxBytes: 12 * 1024 * 1024,
      requestReservationMicrousd: 25_000,
      usedMicrousd: 0,
      reservedMicrousd: 0,
      monthlyMicrousdLimit: 0,
      rawAudioPersisted: false,
      draftTranscriptPersisted: false,
      reviewRequired: true,
    });
    mockBoardChatApi.transcribe.mockResolvedValue({
      transcript: "Review the Stripe runway this week.",
      requestId: "10000000-0000-4000-8000-000000000001",
      model: "gpt-4o-mini-transcribe-2025-12-15",
      inputTokens: 10,
      outputTokens: 8,
      totalTokens: 18,
      estimatedCostMicrousd: 53,
      remainingMicrousd: 999_947,
      rawAudioPersisted: false,
      draftTranscriptPersisted: false,
      reviewRequired: true,
    });
    mockAccessApi.listUserDirectory.mockResolvedValue({
      users: [
        {
          principalId: "user-1",
          status: "active",
          user: { id: "user-1", name: "Adam", email: "adam@example.com", image: null },
        },
      ],
    });
    mockAuthApi.getSession.mockResolvedValue({
      session: { id: "session-1", userId: "user-1" },
      user: { id: "user-1", name: "Adam", email: "adam@example.com", image: null },
    });
    mockChatComposer.props = null;
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    root = null;
    container.remove();
    sessionStorage.clear();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.clearAllMocks();
    // Drop any per-test document.visibilityState override.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (document as any).visibilityState;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (navigator as any).mediaDevices;
  });

  let queryClient: QueryClient | null = null;

  function buildElement() {
    // A fresh element every time — rendering an identical element reference
    // lets React bail out of re-rendering, which would hide mock-state flips.
    return (
      <QueryClientProvider client={queryClient!}>
        <BoardChat />
      </QueryClientProvider>
    );
  }

  async function render() {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    root = createRoot(container);
    await act(async () => {
      root!.render(buildElement());
    });
    // Let the agent/goal/issue queries resolve, plus the follow-up render
    // that enables the comments query off boardIssueId. react-query batches
    // notifications through zero-delay timers, so flush those too.
    for (let i = 0; i < 6; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
    }
  }

  /** Re-render the existing tree so hooks re-read mutated mock state. */
  async function rerender() {
    await act(async () => {
      root!.render(buildElement());
    });
    await act(async () => {
      await Promise.resolve();
    });
  }

  async function advance(ms: number) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  }

  it("reveals typing dots, then the welcome at 2s, then chips at +700ms", async () => {
    await render();

    // Fresh mount: dots only.
    expect(hasTypingDots(container)).toBe(true);
    expect(hasWelcome(container)).toBe(false);

    // Just before the reveal: still dots.
    await advance(1900);
    expect(hasTypingDots(container)).toBe(true);
    expect(hasWelcome(container)).toBe(false);

    // t=2s: welcome bubble lands, dots leave, chips not yet.
    await advance(100);
    expect(hasWelcome(container)).toBe(true);
    expect(hasTypingDots(container)).toBe(false);
    expect(hasChips(container)).toBe(false);
    expect(container.textContent).toContain("Alex");
    expect(container.textContent).toContain("this company's Cofounder");
    expect(container.textContent).toContain("Board Chat");

    // t=2.7s: chips stage in.
    await advance(700);
    expect(hasChips(container)).toBe(true);
  });

  it("skips the staged reveal when a user comment already exists", async () => {
    mockIssuesApi.listComments.mockResolvedValue([USER_COMMENT]);
    await render();

    // Fast-forwarded: no dots, welcome immediately, no timer needed.
    expect(hasTypingDots(container)).toBe(false);
    expect(hasWelcome(container)).toBe(true);
  });

  it("holds the dots while the onboarding wizard overlay is open (PAP-134)", async () => {
    mockDialogState.onboardingOpen = true;
    await render();

    // The 2s window must not burn behind the wizard overlay.
    await advance(2500);
    expect(hasTypingDots(container)).toBe(true);
    expect(hasWelcome(container)).toBe(false);

    // Wizard closes → reveal timer starts fresh.
    mockDialogState.onboardingOpen = false;
    await rerender();
    await advance(2000);
    expect(hasWelcome(container)).toBe(true);
    expect(hasTypingDots(container)).toBe(false);
  });

  it("holds the dots while the document is hidden (PAP-134)", async () => {
    let visibility: DocumentVisibilityState = "hidden";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibility,
    });
    await render();

    // The 2s window must not burn while the tab is hidden.
    await advance(2500);
    expect(hasTypingDots(container)).toBe(true);
    expect(hasWelcome(container)).toBe(false);

    // Tab becomes visible → reveal timer starts fresh.
    visibility = "visible";
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await advance(2000);
    expect(hasWelcome(container)).toBe(true);
    expect(hasTypingDots(container)).toBe(false);
  });

  it("labels a persisted concierge reply as the concierge, not the Cofounder employee", async () => {
    mockIssuesApi.listComments.mockResolvedValue([
      {
        id: "comment-concierge-1",
        body: "I found the next constraint.",
        authorAgentId: null,
        authorUserId: "board-concierge",
        createdAt: "2026-06-10T00:00:00.000Z",
      },
    ]);
    await render();

    expect(container.textContent).toContain("Board Concierge");
    expect(container.textContent).toContain("I found the next constraint.");
    expect(container.textContent).not.toContain("AlexI found the next constraint.");
  });

  it("labels each human speaker when more than one company member shares Board Chat", async () => {
    mockAccessApi.listUserDirectory.mockResolvedValue({
      users: [
        {
          principalId: "user-1",
          status: "active",
          user: { id: "user-1", name: "Adam", email: "adam@example.com", image: null },
        },
        {
          principalId: "user-2",
          status: "active",
          user: { id: "user-2", name: "Taylor", email: "taylor@example.com", image: null },
        },
      ],
    });
    mockIssuesApi.listComments.mockResolvedValue([
      USER_COMMENT,
      {
        id: "comment-user-2",
        body: "I will verify the customer evidence.",
        authorAgentId: null,
        authorUserId: "user-2",
        createdAt: "2026-06-10T00:01:00.000Z",
      },
    ]);

    await render();

    expect(container.querySelector('[data-board-chat-speaker="user-1"]')?.textContent).toBe("You");
    expect(container.querySelector('[data-board-chat-speaker="user-2"]')?.textContent).toBe("Taylor");
    expect(container.textContent).toContain("I will verify the customer evidence.");
  });

  it("keeps single-founder Board Chat free of redundant speaker labels", async () => {
    mockIssuesApi.listComments.mockResolvedValue([USER_COMMENT]);

    await render();

    expect(container.querySelector("[data-board-chat-speaker]")).toBeNull();
  });

  it("uploads company-chat files onto the standing board issue and exposes attached state", async () => {
    await render();
    const attach = mockChatComposer.props?.onAttachFiles;
    expect(attach).toBeTypeOf("function");

    const file = new File(["plan"], "plan.pdf", { type: "application/pdf" });
    await act(async () => {
      await (attach as (files: File[]) => Promise<void>)([file]);
    });
    await advance(0);

    expect(mockIssuesApi.uploadAttachment).toHaveBeenCalledWith(
      "company-1",
      "issue-board",
      file,
    );
    expect(mockChatComposer.props?.attachments).toEqual([
      expect.objectContaining({
        id: "10000000-0000-4000-8000-000000000000",
        name: "plan.pdf",
        status: "attached",
        serverAttachmentId: "10000000-0000-4000-8000-000000000000",
      }),
    ]);
    expect(mockChatComposer.props?.attaching).toBe(false);

    const remove = mockChatComposer.props?.onRemoveAttachment;
    const [attachment] = mockChatComposer.props?.attachments as Array<Record<string, unknown>>;
    await act(async () => {
      await (remove as (item: Record<string, unknown>) => Promise<void>)(attachment);
    });
    expect(mockIssuesApi.deleteAttachment).toHaveBeenCalledWith(
      "10000000-0000-4000-8000-000000000000",
    );
    expect(mockChatComposer.props?.attachments).toEqual([]);
  });

  it("prepares the standing board issue only when the first attachment is explicitly chosen", async () => {
    mockIssuesApi.list.mockResolvedValue([]);
    await render();
    expect(mockBoardChatApi.prepare).not.toHaveBeenCalled();
    const attach = mockChatComposer.props?.onAttachFiles;
    expect(attach).toBeTypeOf("function");

    const file = new File(["plan"], "plan.pdf", { type: "application/pdf" });
    await act(async () => {
      await (attach as (files: File[]) => Promise<void>)([file]);
    });
    await advance(0);

    expect(mockBoardChatApi.prepare).toHaveBeenCalledWith("company-1");
    expect(mockIssuesApi.uploadAttachment).toHaveBeenCalledWith(
      "company-1",
      "issue-board",
      file,
    );
  });

  it("transcribes a bounded recording into an editable draft without auto-sending", async () => {
    mockBoardChatApi.transcription.mockResolvedValue({
      available: true,
      reason: "ready",
      provider: "openai",
      model: "gpt-4o-mini-transcribe-2025-12-15",
      maxSeconds: 60,
      maxBytes: 12 * 1024 * 1024,
      requestReservationMicrousd: 25_000,
      usedMicrousd: 0,
      reservedMicrousd: 0,
      monthlyMicrousdLimit: 1_000_000,
      rawAudioPersisted: false,
      draftTranscriptPersisted: false,
      reviewRequired: true,
    });
    const stopTrack = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }) },
    });
    class MediaRecorderStub {
      static isTypeSupported() { return true; }
      state: RecordingState = "inactive";
      mimeType = "audio/webm;codecs=opus";
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      onstop: (() => void) | null = null;
      constructor(_stream: MediaStream, _options?: MediaRecorderOptions) {}
      start() {
        this.state = "recording";
        this.ondataavailable?.({ data: new Blob(["voice"], { type: "audio/webm" }) } as BlobEvent);
      }
      stop() {
        this.state = "inactive";
        this.onstop?.();
      }
    }
    vi.stubGlobal("MediaRecorder", MediaRecorderStub);

    await render();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const onVoice = mockChatComposer.props?.onVoice;
    expect(onVoice).toBeTypeOf("function");
    await act(async () => {
      await (onVoice as () => Promise<void>)();
    });
    expect(mockChatComposer.props?.voiceStatus).toBe("recording");

    const stopVoice = mockChatComposer.props?.onVoice;
    await act(async () => {
      await (stopVoice as () => Promise<void>)();
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });
    for (let attempt = 0; attempt < 4; attempt += 1) await advance(0);

    expect(mockBoardChatApi.transcribe).toHaveBeenCalledWith(
      "company-1",
      expect.any(String),
      expect.any(Blob),
    );
    expect(mockChatComposer.props?.value).toBe("Review the Stripe runway this week.");
    expect(mockChatComposer.props?.voiceStatus).toBe("idle");
    expect(container.textContent).toContain("Transcript added for review");
    expect(stopTrack).toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("typing-dots CSS animation guard (PAP-54 failure mode)", () => {
  // PAP-54: the .typing-dots CSS block was silently dropped from index.css
  // during a theme migration, leaving static markup with no animation. Guard
  // the source so the block can't vanish again without failing a test. The
  // browser-computed `animationName !== "none"` assertion lives in
  // tests/e2e/conference-room-typing-intro.spec.ts.
  // Locate ui/src/index.css regardless of whether vitest runs from ui/ or
  // the workspace root (import.meta.url is an http URL under jsdom, and the
  // css pipeline swallows `?raw` imports — plain fs is the reliable path).
  function readIndexCss(): string {
    let dir = process.cwd();
    for (let depth = 0; depth < 6; depth++) {
      for (const candidate of [
        path.join(dir, "src/index.css"),
        path.join(dir, "ui/src/index.css"),
      ]) {
        if (existsSync(candidate)) return readFileSync(candidate, "utf8");
      }
      dir = path.dirname(dir);
    }
    throw new Error("ui/src/index.css not found from " + process.cwd());
  }
  const css = readIndexCss();

  it("keeps the bounce animation wired to .typing-dots span", () => {
    const spanRules = [...css.matchAll(/\.typing-dots span\s*\{[^}]*\}/g)].map(
      (m) => m[0],
    );
    expect(spanRules.length).toBeGreaterThan(0);
    expect(
      spanRules.some((rule) => /animation:\s*typing-bounce/.test(rule)),
    ).toBe(true);
  });

  it("keeps the typing-bounce keyframes", () => {
    expect(css).toMatch(/@keyframes typing-bounce\s*\{/);
  });
});
