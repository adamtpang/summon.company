import {
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useDialogState } from "../context/DialogContext";
import { agentsApi } from "../api/agents";
import { issuesApi } from "../api/issues";
import { goalsApi } from "../api/goals";
import { boardChatApi } from "../api/board-chat";
import { accessApi } from "../api/access";
import { authApi } from "../api/auth";
import { queryKeys } from "../lib/queryKeys";
import { buildCompanyUserLabelMap } from "../lib/company-members";
import { MarkdownBody } from "../components/MarkdownBody";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Activity, ArrowDown, History, ListChecks, MessageSquarePlus } from "lucide-react";
import { ActivityFeed } from "../components/ActivityFeed";
import { PrioritiesPanel } from "../components/PrioritiesPanel";
import { selectCompanyCofounder, type Agent, type Issue } from "@paperclipai/shared";
import {
  ChatComposer,
  type ChatComposerAttachment,
  type ChatComposerHandle,
} from "../components/ChatComposer";
import {
  AgentBubbleActionRow,
  agentBubbleDateLabel,
} from "../components/AgentBubbleActionRow";
import { AgentIcon } from "../components/AgentIconPicker";
import { buildScoreboard } from "../lib/scoreboard";
import { cn, formatDateTime } from "../lib/utils";
import type { FeedbackVoteValue } from "@paperclipai/shared";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

/**
 * Board Chat records company-scoped conversation and observes the configured
 * Cofounder through Summon's governed runtime. The user manages their company
 * through natural conversation without a second hidden model executor.
 */
/** Hit zone to the right of the 1px line (line sits on chat pane’s right edge). */
const SPLIT_DIVIDER_PX = 12;
const SPLIT_MIN_PANE_PX = 280;
/** Chat pane share of width below the divider (agent feed gets the rest). */
const DEFAULT_CHAT_FRACTION = 2 / 3;

type BoardChatAttachment = ChatComposerAttachment & {
  serverAttachmentId?: string;
  contentPath?: string;
  contentType?: string | null;
};

type VoiceReview = {
  estimatedCostMicrousd: number;
  model: string;
};

function recorderMimeType() {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
}

function formatVoiceTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

function formatVoiceCost(microusd: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(microusd / 1_000_000);
}


/** Wrapped markdown in bubbles; pre/table scroll horizontally when needed. */
const BOARD_CHAT_MARKDOWN_CLASS =
  "max-w-full overflow-visible [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto";

const boardChatBubbleShell =
  "min-w-0 max-w-(--pct-85) break-words px-3 py-2 text-sm overflow-x-auto overflow-y-visible";

/** First-letter(s) fallback for an agent with no icon. */
function agentInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase()) || "A";
}

/**
 * Icon-adjacent-to-name header rendered directly above an agent bubble —
 * the shared `[agent icon][agent name]` convention (PAP-105 / PAP-97).
 */
function AgentBubbleHeader({ name, icon }: { name: string; icon: string | null }) {
  return (
    <div className="mb-1 flex items-center gap-1.5 pl-1">
      <Avatar size="sm" className="shrink-0">
        <AvatarFallback>
          {icon ? (
            <AgentIcon icon={icon} className="h-3.5 w-3.5" />
          ) : (
            agentInitials(name)
          )}
        </AvatarFallback>
      </Avatar>
      <span className="text-sm font-medium text-foreground">{name}</span>
    </div>
  );
}

function UserBubbleHeader({ name, userId }: { name: string; userId: string | null }) {
  return (
    <div
      className="mb-1 pr-1 text-xs font-medium text-muted-foreground"
      data-board-chat-speaker={userId ?? "unknown"}
    >
      {name}
    </div>
  );
}

/** Agent-styled chat bubble containing the three-dot typing indicator. */
function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div
        className={cn(
          boardChatBubbleShell,
          "bg-card border border-border text-foreground [border-radius:14px_14px_14px_4px]",
        )}
      >
        <span className="typing-dots" aria-label="typing">
          <span />
          <span />
          <span />
        </span>
      </div>
    </div>
  );
}

type RightPaneView = "priorities" | "feed";

/**
 * Right-hand companion pane for the Conference Room. Defaults to the VIT-70
 * Priorities scoreboard (board-approved side-by-side-with-chat surface) with a
 * toggle back to the live Activity feed. Shared between the desktop split pane
 * and the mobile sheet so both stay in sync.
 */
function BoardRightPane({
  view,
  onViewChange,
  issues,
  agents,
}: {
  view: RightPaneView;
  onViewChange: (view: RightPaneView) => void;
  issues: Issue[] | undefined;
  agents: Agent[] | undefined;
}) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-background">
      <div className="relative flex shrink-0 items-center gap-1 px-3 py-2">
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-border"
          aria-hidden
        />
        <div className="inline-flex items-center gap-0.5 rounded-md bg-muted p-0.5">
          <Button
            type="button"
            size="sm"
            variant={view === "priorities" ? "secondary" : "ghost"}
            className="h-7 gap-1.5 px-2 text-xs"
            aria-pressed={view === "priorities"}
            onClick={() => onViewChange("priorities")}
          >
            <ListChecks className="h-3.5 w-3.5" />
            Priorities
          </Button>
          <Button
            type="button"
            size="sm"
            variant={view === "feed" ? "secondary" : "ghost"}
            className="h-7 gap-1.5 px-2 text-xs"
            aria-pressed={view === "feed"}
            onClick={() => onViewChange("feed")}
          >
            <Activity className="h-3.5 w-3.5" />
            Feed
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {view === "priorities" ? (
          <PrioritiesPanel issues={issues} agents={agents} />
        ) : (
          <ActivityFeed />
        )}
      </div>
    </div>
  );
}

export function BoardChat({
  zenMode = false,
  manageBreadcrumbs = true,
}: {
  zenMode?: boolean;
  manageBreadcrumbs?: boolean;
} = {}) {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (manageBreadcrumbs) setBreadcrumbs([{ label: "Chat" }]);
  }, [manageBreadcrumbs, setBreadcrumbs]);

  const splitContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [chatPaneFraction, setChatPaneFraction] = useState(DEFAULT_CHAT_FRACTION);
  const splitDragging = useRef(false);


  useLayoutEffect(() => {
    const el = splitContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setContainerWidth(el.clientWidth);
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const innerWidth = Math.max(0, containerWidth - SPLIT_DIVIDER_PX);
  const splitLowerPx = SPLIT_MIN_PANE_PX;
  const splitUpperPx = innerWidth - SPLIT_MIN_PANE_PX;
  const minChatFraction =
    innerWidth > 0 ? Math.min(1, SPLIT_MIN_PANE_PX / innerWidth) : 0;
  const maxChatFraction =
    innerWidth > 0 ? Math.max(0, 1 - SPLIT_MIN_PANE_PX / innerWidth) : 1;
  const leftPaneWidth =
    innerWidth > 0
      ? splitUpperPx < splitLowerPx
        ? Math.max(0, Math.round(innerWidth / 2))
        : Math.round(
            innerWidth *
              Math.min(
                maxChatFraction,
                Math.max(minChatFraction, chatPaneFraction),
              ),
          )
      : 0;

  const handleSplitDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      splitDragging.current = true;
      const startX = e.clientX;
      const startWidth = leftPaneWidth;

      const onMouseMove = (ev: MouseEvent) => {
        if (!splitDragging.current) return;
        const containerW = splitContainerRef.current?.clientWidth ?? containerWidth;
        const inner = containerW - SPLIT_DIVIDER_PX;
        const lower = SPLIT_MIN_PANE_PX;
        const upper = inner - SPLIT_MIN_PANE_PX;
        const next = startWidth + ev.clientX - startX;
        if (inner <= 0) return;
        if (upper < lower) {
          setChatPaneFraction(0.5);
        } else {
          const clamped = Math.min(upper, Math.max(lower, next));
          setChatPaneFraction(clamped / inner);
        }
      };

      const onMouseUp = () => {
        splitDragging.current = false;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [containerWidth, leftPaneWidth],
  );

  const [input, setInput] = useState("");
  /** Guards the draft-persistence effect so it doesn't overwrite a saved
   *  draft with "" before we've had a chance to load it. */
  const loadedDraftCompanyRef = useRef<string | null>(null);
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [statusText, setStatusText] = useState("");
  const [errorText, setErrorText] = useState("");
  const [boardIssueId, setBoardIssueId] = useState<string | null>(null);
  const [composerAttachments, setComposerAttachments] = useState<BoardChatAttachment[]>([]);
  const [attaching, setAttaching] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<"idle" | "recording" | "processing">("idle");
  const [voiceElapsedSeconds, setVoiceElapsedSeconds] = useState(0);
  const [voiceReview, setVoiceReview] = useState<VoiceReview | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [optimisticMessage, setOptimisticMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasRestoredScrollRef = useRef(false);
  const composerRef = useRef<ChatComposerHandle>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const discardVoiceRef = useRef(false);

  /** True when the user is scrolled away from the bottom AND new content
   *  has arrived they can't see. Drives the floating "jump to latest" chip. */
  const [hasNewBelow, setHasNewBelow] = useState(false);

  /** Tracks whether the user was near the bottom BEFORE the latest content
   *  change. Updated on scroll events (and after programmatic scrolls) so
   *  that when a tall new message inflates scrollHeight, we still know the
   *  user's pre-update position and can decide whether to auto-scroll. */
  const wasNearBottomRef = useRef(true);

  const scrollToLatest = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
    wasNearBottomRef.current = true;
    setHasNewBelow(false);
  }, []);

  // Welcome typing intro: staged reveal of typing → welcome bubble → chips.
  // The timers don't start until the data needed to render the welcome is
  // actually loaded, so the animation plays at the moment the user arrives
  // at the chat (e.g. right after creating a new company) rather than
  // burning off while a spinner is on screen.
  const [welcomeRevealed, setWelcomeRevealed] = useState(false);
  const [chipsRevealed, setChipsRevealed] = useState(false);

  // Reset state and clear cached comments when company changes. The
  // composer draft is NOT wiped — it's loaded from per-company
  // sessionStorage in the effect below so users don't lose typed content
  // when switching between companies or navigating away and back.
  const prevCompanyRef = useRef(selectedCompanyId);
  useEffect(() => {
    if (prevCompanyRef.current !== selectedCompanyId) {
      if (boardIssueId) {
        queryClient.removeQueries({ queryKey: queryKeys.issues.comments(boardIssueId) });
      }
      setBoardIssueId(null);
      setStreamingText("");
      setStatusText("");
      setSending(false);
      setOptimisticMessage(null);
      setComposerAttachments([]);
      setAttaching(false);
      discardVoiceRef.current = true;
      if (voiceRecorderRef.current?.state !== "inactive") voiceRecorderRef.current?.stop();
      voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
      voiceRecorderRef.current = null;
      voiceStreamRef.current = null;
      voiceChunksRef.current = [];
      voiceTimerRef.current = null;
      setVoiceStatus("idle");
      setVoiceElapsedSeconds(0);
      setVoiceReview(null);
      prevCompanyRef.current = selectedCompanyId;
    }
  }, [selectedCompanyId, boardIssueId, queryClient]);

  // Load a saved composer draft (if any) whenever the active company
  // changes — runs on first mount too.
  useEffect(() => {
    if (!selectedCompanyId) return;
    if (loadedDraftCompanyRef.current === selectedCompanyId) return;
    try {
      const saved = sessionStorage.getItem(
        `paperclip.boardChat.draft.${selectedCompanyId}`,
      );
      setInput(saved ?? "");
    } catch {
      setInput("");
    }
    loadedDraftCompanyRef.current = selectedCompanyId;
  }, [selectedCompanyId]);

  // Persist composer draft to sessionStorage on change (per company).
  // Only runs after the initial load for this company to avoid clobbering
  // a saved draft with an empty initial value.
  useEffect(() => {
    if (!selectedCompanyId) return;
    if (loadedDraftCompanyRef.current !== selectedCompanyId) return;
    try {
      const key = `paperclip.boardChat.draft.${selectedCompanyId}`;
      if (input) {
        sessionStorage.setItem(key, input);
      } else {
        sessionStorage.removeItem(key);
      }
    } catch { /* sessionStorage unavailable */ }
  }, [input, selectedCompanyId]);

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const cofounderAgent = useMemo(
    () => selectCompanyCofounder(agents ?? []),
    [agents],
  );

  // Pull the company's top-level goal so the Cofounder's welcome can reference
  // the mission verbatim.
  const { data: goals } = useQuery({
    queryKey: queryKeys.goals.list(selectedCompanyId!),
    queryFn: () => goalsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const missionText = useMemo(() => {
    const active = (goals ?? []).find((g) => g.status === "active");
    return active?.title ?? null;
  }, [goals]);

  // Find or detect the board operations issue
  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const transcriptionQuery = useQuery({
    queryKey: queryKeys.boardChat.transcription(selectedCompanyId!),
    queryFn: () => boardChatApi.transcription(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    staleTime: 15_000,
  });
  const transcription = transcriptionQuery.data;

  useEffect(() => () => {
    discardVoiceRef.current = true;
    if (voiceRecorderRef.current?.state !== "inactive") voiceRecorderRef.current?.stop();
    voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
    if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
    voiceChunksRef.current = [];
  }, []);

  // Choose-your-adventure chips (board, 2026-07-19): suggestions come from the
  // company's REAL priorities, not canned prompts. Same evidence engine as the
  // dashboard: the parked review, the top ranked task, the blocked pile.
  const priorityChips = useMemo(() => {
    const rows = buildScoreboard(issues ?? []).rows;
    const topReview = rows.find((row) => row.reviewNeeded);
    const topActive = rows.find(
      (row) => !row.reviewNeeded && row.status !== "done" && row.status !== "cancelled",
    );
    const blockedCount = (issues ?? []).filter((issue) => issue.status === "blocked").length;
    // A bare identifier means nothing to a human (board, 2026-07-22: "idk
    // what VIT-115 means") — every chip carries the ticket's one-liner.
    const brief = (title: string) => (title.length > 34 ? `${title.slice(0, 33).trimEnd()}…` : title);
    const chips: Array<{ label: string; prompt: string }> = [{ label: "Status", prompt: "status" }];
    if (topReview) {
      chips.push({
        label: `Review ${topReview.identifier} · ${brief(topReview.title)}`,
        prompt: `Walk me through the ${topReview.identifier} review (${topReview.title}). What am I approving, and what happens after I do?`,
      });
    }
    if (topActive) {
      chips.push({
        label: `${topActive.tier} · ${topActive.identifier} · ${brief(topActive.title)}`,
        prompt: `What should we do about ${topActive.identifier}: ${topActive.title}? Who runs it, and what does it move on the roadmap?`,
      });
    }
    if (blockedCount > 0) {
      chips.push({
        label: `Unblock ${blockedCount}`,
        prompt: "What is blocking us right now, and what single move clears the most?",
      });
    }
    return chips;
  }, [issues]);

  useEffect(() => {
    if (!issues) {
      setBoardIssueId(null);
      return;
    }
    const boardIssue = issues.find(
      (i) => i.title === "Board Operations" && i.status !== "done" && i.status !== "cancelled",
    );
    setBoardIssueId(boardIssue?.id ?? null);
  }, [issues]);

  // Fetch comments for the board issue
  const { data: comments } = useQuery({
    queryKey: queryKeys.issues.comments(boardIssueId ?? ""),
    queryFn: () => issuesApi.listComments(boardIssueId!),
    enabled: !!boardIssueId,
    refetchInterval: 3000,
  });

  const sortedComments = (comments ?? [])
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const { data: session } = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
  });
  const currentUserId = session?.user?.id ?? session?.session?.userId ?? null;
  const { data: userDirectory } = useQuery({
    queryKey: queryKeys.access.companyUserDirectory(selectedCompanyId ?? ""),
    queryFn: () => accessApi.listUserDirectory(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const userLabelById = useMemo(
    () => buildCompanyUserLabelMap(userDirectory?.users),
    [userDirectory?.users],
  );
  const showUserSpeakerLabels = (userDirectory?.users.length ?? 0) > 1;

  const userSpeakerLabel = useCallback(
    (userId: string | null | undefined) => {
      if (userId && currentUserId && userId === currentUserId) return "You";
      if (userId) return userLabelById.get(userId) ?? "Board member";
      return "Board member";
    },
    [currentUserId, userLabelById],
  );

  // Agent lookup so each bubble can show its author's name + icon header.
  const agentMap = useMemo(
    () => new Map((agents ?? []).map((a) => [a.id, a] as const)),
    [agents],
  );

  // Feedback votes for the board issue power the 👍/👎 affordance — the same
  // store the task thread reads (PAP-105 shares the action row).
  const { data: feedbackVotes } = useQuery({
    queryKey: queryKeys.issues.feedbackVotes(boardIssueId ?? ""),
    queryFn: () => issuesApi.listFeedbackVotes(boardIssueId!),
    enabled: !!boardIssueId,
  });

  const voteByComment = useMemo(() => {
    const map = new Map<string, FeedbackVoteValue>();
    for (const vote of feedbackVotes ?? []) {
      if (vote.targetType === "issue_comment") map.set(vote.targetId, vote.vote);
    }
    return map;
  }, [feedbackVotes]);

  const handleCommentVote = useCallback(
    async (
      commentId: string,
      vote: FeedbackVoteValue,
      options?: { allowSharing?: boolean; reason?: string },
    ) => {
      if (!boardIssueId) return;
      await issuesApi.upsertFeedbackVote(boardIssueId, {
        targetType: "issue_comment",
        targetId: commentId,
        vote,
        reason: options?.reason,
        allowSharing: options?.allowSharing,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.issues.feedbackVotes(boardIssueId),
      });
    },
    [boardIssueId, queryClient],
  );

  // Reset the staged reveal on mount AND whenever the active company
  // changes, so every arrival at the Conference Room replays the typing
  // intro from scratch (a freshly-created company included). The effect's
  // mount run is intentional — it keeps the intro fresh even if a future
  // refactor preserves this component instance across navigations (PAP-134).
  useEffect(() => {
    setWelcomeRevealed(false);
    setChipsRevealed(false);
  }, [selectedCompanyId]);

  // The onboarding wizard renders as an overlay above an already-mounted
  // Conference Room (sidebar "Create new company..." path). Holding the reveal
  // timer while it's open guarantees the dots window can't burn off behind
  // the wizard before the user ever sees the chat (PAP-134).
  const { onboardingOpen } = useDialogState();

  // Likewise, don't let the dots window burn while the tab is hidden —
  // e.g. the user completes the wizard, switches tabs, and comes back.
  const [pageVisible, setPageVisible] = useState(
    () => document.visibilityState !== "hidden",
  );
  useEffect(() => {
    const onVisibilityChange = () =>
      setPageVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  // Start the typing → welcome timer only once we have the ingredients
  // needed to render the welcome bubble. This guarantees the animation is
  // visible at the moment the user arrives, even if agent/goal queries
  // take a beat to resolve.
  const canRenderWelcome = agents !== undefined && !!selectedCompany;
  useEffect(() => {
    if (!canRenderWelcome) return;
    if (welcomeRevealed) return;
    if (onboardingOpen || !pageVisible) return;
    const timeout = setTimeout(() => setWelcomeRevealed(true), 2000);
    return () => clearTimeout(timeout);
  }, [canRenderWelcome, welcomeRevealed, onboardingOpen, pageVisible]);

  // Stage the suggestion chips in shortly after the welcome bubble lands
  // so the eye reads the message first, then the actions.
  useEffect(() => {
    if (!welcomeRevealed) return;
    if (chipsRevealed) return;
    const timeout = setTimeout(() => setChipsRevealed(true), 700);
    return () => clearTimeout(timeout);
  }, [welcomeRevealed, chipsRevealed]);

  // If the user has already replied in this conversation, fast-forward
  // past the intro — the welcome isn't a "new" event anymore.
  useEffect(() => {
    if (welcomeRevealed && chipsRevealed) return;
    if (!comments) return;
    const userHasReplied = comments.some(
      (c) => !c.authorAgentId && c.authorUserId !== "board-concierge",
    );
    if (userHasReplied) {
      setWelcomeRevealed(true);
      setChipsRevealed(true);
    }
  }, [comments, welcomeRevealed, chipsRevealed]);

  // Clear optimistic message once server-persisted comments include it
  useEffect(() => {
    if (optimisticMessage && sortedComments.length > 0) {
      const lastUserComment = [...sortedComments]
        .reverse()
        .find((c) => !c.authorAgentId && c.authorUserId !== "board-concierge");
      if (lastUserComment?.body === optimisticMessage) {
        setOptimisticMessage(null);
      }
    }
  }, [sortedComments, optimisticMessage]);

  // Scroll behavior:
  //   - First mount in a session (no saved position): jump to bottom instantly.
  //   - Returning to the page within the same session: restore last scrollTop.
  //   - New content arriving: smooth-scroll to bottom only if user is already
  //     near the bottom, so we don't yank them away from reading history.
  //   - Scroll position is persisted to sessionStorage (cleared when tab closes).
  useEffect(() => {
    if (hasRestoredScrollRef.current) return;
    if (sortedComments.length === 0) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    try {
      const saved = sessionStorage.getItem("paperclip.boardChat.scrollTop");
      if (saved != null) {
        const parsed = Number(saved);
        if (Number.isFinite(parsed)) {
          container.scrollTop = parsed;
          hasRestoredScrollRef.current = true;
          return;
        }
      }
    } catch { /* sessionStorage unavailable */ }

    container.scrollTop = container.scrollHeight;
    hasRestoredScrollRef.current = true;
  }, [sortedComments.length]);

  // User sent a message: always scroll so their just-typed message is in
  // view, even if they were scrolled up reading history.
  useEffect(() => {
    if (!optimisticMessage) return;
    scrollToLatest("smooth");
  }, [optimisticMessage, scrollToLatest]);

  // Agent activity (new persisted comment, streaming chunks, status):
  // auto-scroll only if the user was near the bottom BEFORE the new content
  // arrived. Using the ref (updated on scroll events) instead of measuring
  // after the render, because the new content has already grown scrollHeight
  // by the time this effect fires — making the post-update "distance from
  // bottom" misleading.
  useEffect(() => {
    if (!hasRestoredScrollRef.current) return;
    if (wasNearBottomRef.current) {
      scrollToLatest("smooth");
    } else {
      setHasNewBelow(true);
    }
  }, [sortedComments.length, streamingText, statusText, scrollToLatest]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    let rafId: number | null = null;
    const handleScroll = () => {
      const near = container.scrollHeight - container.scrollTop - container.clientHeight <= 80;
      wasNearBottomRef.current = near;
      if (near) setHasNewBelow(false);

      if (rafId != null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        try {
          sessionStorage.setItem(
            "paperclip.boardChat.scrollTop",
            String(container.scrollTop),
          );
        } catch { /* sessionStorage unavailable */ }
      });
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, []);

  // Elapsed timer for thinking state — tick at 100ms so the tenths place
  // updates smoothly and the wait feels quicker than a whole-second counter.
  useEffect(() => {
    if (sending) {
      setElapsedSec(0);
      const startedAt = Date.now();
      elapsedTimerRef.current = setInterval(() => {
        setElapsedSec((Date.now() - startedAt) / 1000);
      }, 100);
    } else {
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
        elapsedTimerRef.current = null;
      }
    }
    return () => {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, [sending]);

  const attachFiles = useCallback(
    async (files: File[]) => {
      if (!selectedCompanyId || files.length === 0) return;
      const occupied = composerAttachments.filter((attachment) => attachment.status !== "error").length;
      const available = Math.max(0, 8 - occupied);
      const accepted = files.slice(0, available);
      if (accepted.length < files.length) {
        setErrorText("Board chat accepts up to 8 attached files per message.");
      }
      if (accepted.length === 0) return;

      setAttaching(true);
      try {
        let targetIssueId = boardIssueId;
        if (!targetIssueId) {
          const prepared = await boardChatApi.prepare(selectedCompanyId);
          targetIssueId = prepared.issueId;
          setBoardIssueId(prepared.issueId);
          await queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(selectedCompanyId) });
        }
        for (const file of accepted) {
          const clientId = `${file.name}:${file.size}:${file.lastModified}:${crypto.randomUUID()}`;
          setComposerAttachments((current) => [
            ...current,
            {
              id: clientId,
              name: file.name,
              size: file.size,
              status: "uploading",
            },
          ]);
          try {
            const attachment = await issuesApi.uploadAttachment(selectedCompanyId, targetIssueId, file);
            setComposerAttachments((current) => current.map((item) => (
              item.id === clientId
                ? {
                    ...item,
                    id: attachment.id,
                    name: attachment.originalFilename ?? item.name,
                    size: attachment.byteSize,
                    status: "attached",
                    serverAttachmentId: attachment.id,
                    contentPath: attachment.contentPath,
                    contentType: attachment.contentType,
                  }
                : item
            )));
          } catch (error) {
            setComposerAttachments((current) => current.map((item) => (
              item.id === clientId
                ? {
                    ...item,
                    status: "error",
                    error: error instanceof Error ? error.message : "Upload failed",
                  }
                : item
            )));
          }
        }
      } catch (error) {
        setErrorText(error instanceof Error ? error.message : "Could not prepare the board conversation for attachments.");
      } finally {
        setAttaching(false);
      }
    },
    [boardIssueId, composerAttachments, queryClient, selectedCompanyId],
  );

  const sendMessage = useCallback(
    async (body: string) => {
      const trimmed = body.trim();
      if (!trimmed || sending || !selectedCompanyId) return;

      // Show user message immediately
      setOptimisticMessage(trimmed);
      setSending(true);
      setInput("");
      setStreamingText("");
      setErrorText("");
      setStatusText("Connecting...");

      try {
        const controller = new AbortController();
        const fetchTimeout = setTimeout(() => controller.abort(), 11 * 60 * 1000);
        const res = await fetch("/api/board/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId: selectedCompanyId,
            message: trimmed,
            taskId: boardIssueId ?? undefined,
            attachmentIds: composerAttachments
              .filter((attachment) => attachment.status === "attached" && attachment.serverAttachmentId)
              .map((attachment) => attachment.serverAttachmentId),
          }),
          signal: controller.signal,
        });
        clearTimeout(fetchTimeout);

        if (!res.ok) {
          const failure = await res.json().catch(() => null) as { error?: unknown } | null;
          throw new Error(
            typeof failure?.error === "string"
              ? failure.error
              : "Board Chat could not start the governed Cofounder run.",
          );
        }
        if (!res.body) {
          throw new Error("Board Chat started without a run observer.");
        }

        setStatusText("Thinking...");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === "chunk" && event.text) {
                accumulated += event.text;
                setStreamingText(accumulated);
                setStatusText("");
              } else if (event.type === "status" && event.text) {
                setStatusText(event.text);
              } else if (event.type === "start" && event.issueId) {
                setBoardIssueId(event.issueId);
              } else if (event.type === "error") {
                setErrorText(
                  event.message ||
                    "The Cofounder couldn't respond. Check the employee runtime and try again.",
                );
                setStatusText("");
              } else if (event.type === "done") {
                if (event.issueId) {
                  queryClient.invalidateQueries({
                    queryKey: queryKeys.issues.comments(event.issueId),
                  });
                  queryClient.invalidateQueries({
                    queryKey: queryKeys.issues.list(selectedCompanyId),
                  });
                }
              }
            } catch {
              /* malformed SSE line */
            }
          }
        }

        setStreamingText("");
        setStatusText("");
        setComposerAttachments([]);
        setVoiceReview(null);
        if (boardIssueId) {
          queryClient.invalidateQueries({ queryKey: queryKeys.issues.comments(boardIssueId) });
        }
      } catch (err) {
        console.error("Board chat error:", err);
        setStatusText("");
        setErrorText(
          err instanceof Error
            ? err.message
            : "The Cofounder is unavailable right now. Check the employee runtime and try again.",
        );
      } finally {
        setSending(false);
        composerRef.current?.focus();
      }
    },
    [sending, selectedCompanyId, boardIssueId, composerAttachments, queryClient],
  );

  const handleSend = useCallback(() => {
    sendMessage(input);
  }, [input, sendMessage]);

  const removeAttachment = useCallback(async (attachment: ChatComposerAttachment) => {
    const boardAttachment = attachment as BoardChatAttachment;
    try {
      if (boardAttachment.serverAttachmentId) {
        await issuesApi.deleteAttachment(boardAttachment.serverAttachmentId);
      }
      setComposerAttachments((current) => current.filter((item) => item.id !== attachment.id));
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Could not remove the attachment.");
    }
  }, []);

  const cancelVoice = useCallback(() => {
    discardVoiceRef.current = true;
    const recorder = voiceRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
    if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
    voiceTimerRef.current = null;
    voiceChunksRef.current = [];
    setVoiceStatus("idle");
    setVoiceElapsedSeconds(0);
  }, []);

  const handleVoice = useCallback(async () => {
    if (voiceStatus === "recording") {
      const recorder = voiceRecorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      return;
    }
    if (voiceStatus === "processing") return;
    if (!transcription) {
      setErrorText(transcriptionQuery.isLoading
        ? "Reading the company voice policy…"
        : "Voice policy is unavailable. Open Company Stack → AI gateway to review setup.");
      return;
    }
    if (!transcription.available) {
      const guidance: Record<typeof transcription.reason, string> = {
        ready: "Voice direction is ready.",
        gateway_not_configured: "Configure Company Stack → AI gateway before using voice direction.",
        gateway_revoked: "Reconnect the company AI gateway before using voice direction.",
        transcription_not_enabled: "Enable reviewed voice direction in Company Stack → AI gateway.",
        monthly_limit_reached: "The monthly voice ceiling is full. Review the gateway policy before recording more.",
        company_budget_blocked: "The company budget hard stop has paused voice transcription.",
      };
      setErrorText(guidance[transcription.reason]);
      return;
    }
    const mimeType = recorderMimeType();
    if (
      mimeType === null
      || typeof navigator === "undefined"
      || !navigator.mediaDevices?.getUserMedia
    ) {
      setErrorText("This browser cannot capture a reviewable voice recording.");
      return;
    }

    setErrorText("");
    setVoiceReview(null);
    discardVoiceRef.current = false;
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      voiceStreamRef.current = stream;
      voiceRecorderRef.current = recorder;
      voiceChunksRef.current = [];
      const startedAt = performance.now();
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) voiceChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        discardVoiceRef.current = true;
        setErrorText("The browser could not finish this voice recording.");
      };
      recorder.onstop = async () => {
        if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
        voiceTimerRef.current = null;
        stream?.getTracks().forEach((track) => track.stop());
        voiceStreamRef.current = null;
        voiceRecorderRef.current = null;
        const chunks = voiceChunksRef.current;
        voiceChunksRef.current = [];
        setVoiceElapsedSeconds(0);
        if (discardVoiceRef.current) {
          discardVoiceRef.current = false;
          setVoiceStatus("idle");
          return;
        }
        const audio = new Blob(chunks, {
          type: recorder.mimeType || mimeType || "audio/webm",
        });
        if (audio.size < 1) {
          setVoiceStatus("idle");
          setErrorText("No audio was captured. Check microphone permission and try again.");
          return;
        }
        setVoiceStatus("processing");
        try {
          const result = await boardChatApi.transcribe(
            selectedCompanyId!,
            crypto.randomUUID(),
            audio,
          );
          setInput((current) => current.trim()
            ? `${current.trimEnd()}\n\n${result.transcript}`
            : result.transcript);
          setVoiceReview({
            estimatedCostMicrousd: result.estimatedCostMicrousd,
            model: result.model,
          });
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: queryKeys.boardChat.transcription(selectedCompanyId!),
            }),
            queryClient.invalidateQueries({
              queryKey: queryKeys.companyAiGateway.state(selectedCompanyId!),
            }),
          ]);
        } catch (error) {
          setErrorText(error instanceof Error
            ? error.message
            : "Voice transcription failed. The recording was discarded.");
        } finally {
          setVoiceStatus("idle");
          composerRef.current?.focus();
        }
      };
      recorder.start(250);
      setVoiceStatus("recording");
      setVoiceElapsedSeconds(0);
      voiceTimerRef.current = setInterval(() => {
        const elapsed = Math.max(0, Math.floor((performance.now() - startedAt) / 1000));
        setVoiceElapsedSeconds(elapsed);
        if (elapsed >= transcription.maxSeconds && recorder.state !== "inactive") {
          recorder.stop();
        }
      }, 250);
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      voiceStreamRef.current = null;
      voiceRecorderRef.current = null;
      setVoiceStatus("idle");
      setErrorText(error instanceof Error && error.name === "NotAllowedError"
        ? "Microphone permission was not granted. Nothing was recorded."
        : "The microphone could not start. Nothing was recorded.");
    }
  }, [queryClient, selectedCompanyId, transcription, transcriptionQuery.isLoading, voiceStatus]);

  // NOTE: declared before the early return below — all hooks must run on
  // every render (Rules of Hooks). Placing it after the `!selectedCompanyId`
  // guard caused "Rendered more hooks than during the previous render" and a
  // blank page once a company was selected.
  const [mobileFeedOpen, setMobileFeedOpen] = useState(false);
  // Right pane defaults to the VIT-70 Priorities scoreboard beside chat; the
  // board can flip to the live Activity feed.
  const [rightPaneView, setRightPaneView] = useState<RightPaneView>("priorities");

  if (!selectedCompanyId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-sm">
          <h2 className="text-lg font-semibold">No company selected</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Select a company to start chatting with its Cofounder.
          </p>
        </div>
      </div>
    );
  }

  return (
    // Standalone route: escape main's p-6 with negative margins and grow by
    // the same 3rem (the --sz-calc-29 trick). Embedded in ChatMode (zen), the
    // parent box is already exact, and the negative top margin was pulling
    // the thread up OVER the progression HUD (board, 2026-07-22).
    <div className={cn("flex flex-col", zenMode ? "h-full min-h-0" : "h-(--sz-calc-29) -m-6")}>
      <div
        ref={splitContainerRef}
        className="flex min-h-0 min-w-0 flex-1 flex-row"
      >
        {/* Left: chat (self-contained pane) — full width on mobile, 2/3 default on desktop */}
        <div
          className={cn(
            "relative flex min-h-0 min-w-0 shrink-0 flex-col bg-background",
            zenMode ? "w-full flex-1" : "w-full md:w-auto",
            !zenMode && innerWidth <= 0 && "md:w-2/3",
          )}
          style={!zenMode && innerWidth > 0 && containerWidth >= 2 * SPLIT_MIN_PANE_PX + SPLIT_DIVIDER_PX ? { width: leftPaneWidth } : undefined}
        >
          {/* Zen mode: ChatMode owns the header; this internal one would be
              duplicate chrome, so it renders only in the classic surface. */}
          {!zenMode && <div className="relative flex shrink-0 items-center justify-between gap-2 px-4 py-3">
            <div
              className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-border"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold">
                {cofounderAgent?.name ?? "Cofounder"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {selectedCompany?.name ?? "Your company"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground"
                    aria-label="chat history"
                  >
                    <History className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">chat history</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground"
                    aria-label="new chat"
                  >
                    <MessageSquarePlus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">new chat</TooltipContent>
              </Tooltip>
            </div>
          </div>}
          {/* Messages — scroll viewport flush right so the scrollbar sits on the pane/divider edge */}
          <div className="relative min-h-0 min-w-0 flex-1">
          <div
            ref={scrollContainerRef}
            className="scrollbar-auto-hide absolute inset-0 overflow-y-auto overflow-x-hidden"
          >
            {/* pb clears the floating glass dock (PAP-131) so the last bubble can
                 scroll fully above the composer. */}
            <div className="flex flex-col gap-4 px-6 pt-3 pb-32">
              {/* Typing bubble — shown unconditionally until the reveal
                   timer fires, so the animation is guaranteed to be
                   visible even while agent/goal data is still loading. */}
              {!welcomeRevealed && <TypingBubble />}

              {welcomeRevealed && selectedCompany && (() => {
                const companyName = selectedCompany.name;
                const missionLine = missionText
                  ? ` The company mission is "${missionText}".`
                  : "";
                const cofounderLine = cofounderAgent
                  ? ` **${cofounderAgent.name}** is configured as this company's Cofounder.`
                  : " No Cofounder is configured yet; add and approve one before sending direction.";
                const welcomeBody =
                  `Welcome to **${companyName}**.${cofounderLine}${missionLine}\n\n` +
                  `Give the company an outcome or attach evidence. Board Chat will use Summon's governed employee runtime and keep execution and proof attached to accountable work.`;

                const userHasReplied = sortedComments.some(
                  (c) => !c.authorAgentId && c.authorUserId !== "board-concierge",
                );

                // Priority-driven, same list the composer chips use.
                const chips = priorityChips;

                return (
                  <>
                    <div className="flex flex-col items-start">
                      <AgentBubbleHeader name="Board Chat" icon={null} />
                      <div
                        className={cn(
                          boardChatBubbleShell,
                          "bg-card border border-border text-foreground [border-radius:14px_14px_14px_4px]",
                        )}
                      >
                        <MarkdownBody className={BOARD_CHAT_MARKDOWN_CLASS}>{welcomeBody}</MarkdownBody>
                      </div>
                    </div>
                    {!userHasReplied && chipsRevealed && (
                      <div className="flex flex-wrap gap-2 pl-1">
                        {chips.map((chip) => (
                          <button
                            key={chip.label}
                            type="button"
                            onClick={() => {
                              setInput(chip.prompt);
                              composerRef.current?.focus();
                            }}
                            // design-allow(card-pattern): interactive suggestion-pill <button>, not a content card (C5a Run 3)
                            className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
                          >
                            {chip.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}

              {sortedComments.map((comment) => {
                const isUser = !comment.authorAgentId && comment.authorUserId !== "board-concierge";
                if (isUser) {
                  return (
                    <div key={comment.id} className="flex flex-col items-end">
                      {showUserSpeakerLabels ? (
                        <UserBubbleHeader
                          name={userSpeakerLabel(comment.authorUserId)}
                          userId={comment.authorUserId ?? null}
                        />
                      ) : null}
                      <div
                        className={cn(
                          boardChatBubbleShell,
                          "bg-blue-600 text-white [border-radius:14px_14px_4px_14px]",
                        )}
                      >
                        {comment.body ?? ""}
                      </div>
                    </div>
                  );
                }
                // Agent bubble — name/icon header above + action row below so
                // the room speaks the same bubble language as the task thread.
                const isConcierge = !comment.authorAgentId && comment.authorUserId === "board-concierge";
                const agent = comment.authorAgentId
                  ? agentMap.get(comment.authorAgentId) ?? null
                  : null;
                const agentName = isConcierge ? "Board Concierge" : agent?.name ?? "Assistant";
                const agentIconValue = isConcierge ? null : agent?.icon ?? null;
                return (
                  <div key={comment.id} className="flex flex-col items-start">
                    <AgentBubbleHeader name={agentName} icon={agentIconValue} />
                    <div
                      className={cn(
                        boardChatBubbleShell,
                        "bg-card border border-border text-foreground [border-radius:14px_14px_14px_4px]",
                      )}
                    >
                      <MarkdownBody className={BOARD_CHAT_MARKDOWN_CLASS}>
                        {comment.body ?? ""}
                      </MarkdownBody>
                    </div>
                    <AgentBubbleActionRow
                      copyText={comment.body ?? ""}
                      dateLabel={agentBubbleDateLabel(comment.createdAt)}
                      dateTitle={formatDateTime(comment.createdAt)}
                      anchorHref={`#comment-${comment.id}`}
                      feedback={
                        boardIssueId
                          ? {
                              activeVote: voteByComment.get(comment.id) ?? null,
                              sharingPreference: "prompt",
                              termsUrl: null,
                              onVote: (vote, options) =>
                                handleCommentVote(comment.id, vote, options),
                            }
                          : null
                      }
                    />
                  </div>
                );
              })}

              {/* Optimistic user message — shows instantly before server persists */}
              {optimisticMessage && (
                <div className="flex flex-col items-end">
                  {showUserSpeakerLabels ? (
                    <UserBubbleHeader name="You" userId={currentUserId} />
                  ) : null}
                  <div
                    className={cn(
                      boardChatBubbleShell,
                      "bg-blue-600 text-white [border-radius:14px_14px_4px_14px]",
                    )}
                  >
                    {optimisticMessage}
                  </div>
                </div>
              )}

              {/* Streaming response */}
              {streamingText && (
                <div className="flex flex-col items-start">
                  {cofounderAgent && (
                    <AgentBubbleHeader name={cofounderAgent.name} icon={cofounderAgent.icon} />
                  )}
                  <div
                    className={cn(
                      boardChatBubbleShell,
                      "bg-card border border-border text-foreground [border-radius:14px_14px_14px_4px]",
                    )}
                  >
                    <MarkdownBody className={BOARD_CHAT_MARKDOWN_CLASS}>{streamingText}</MarkdownBody>
                  </div>
                </div>
              )}

              {/* Typing bubble — sits above the status line while the governed
                   Cofounder run is queued or working. The durable employee
                   comment replaces it when the run reports back. */}
              {sending && !streamingText && <TypingBubble />}

              {/* Status bar — always visible while sending, independent from the chat bubble */}
              {sending && (
                <div className="flex items-center gap-2 pl-1 text-xs text-muted-foreground">
                  <img src="/paperclip-thinking.svg" alt="" className="inline-block shrink-0" style={{ width: 14, height: 14 }} />
                  <span>{statusText || "Thinking..."}</span>
                  {elapsedSec > 0 && (
                    <span className="opacity-50">{elapsedSec.toFixed(1)}s</span>
                  )}
                </div>
              )}

              {/* Error notice — surfaced when the stream endpoint fails so
                  the message doesn't silently sit with no response. */}
              {errorText && !sending && (
                <div
                  role="alert"
                  className="flex justify-start"
                >
                  <div
                    className={cn(
                      boardChatBubbleShell,
                      "bg-destructive/10 border border-destructive/30 text-destructive [border-radius:14px_14px_14px_4px]",
                    )}
                  >
                    {errorText}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
          </div>

          {/* Jump-to-latest — shows when user is scrolled away and new content has arrived */}
          {hasNewBelow && (
            <button
              type="button"
              onClick={() => scrollToLatest("smooth")}
              aria-label="Jump to latest messages"
              // design-allow(card-pattern): floating scroll-to-bottom <button>, not a content card (C5a Run 3)
              className="absolute bottom-24 left-1/2 z-20 grid h-8 w-8 -translate-x-1/2 place-items-center rounded-full border border-border bg-card text-foreground shadow-md transition-colors duration-150 hover:bg-accent hover:border-muted-foreground/30"
            >
              <ArrowDown className="h-4 w-4" />
            </button>
          )}

          {/* Input — shared ChatComposer (PAP-95a), adopted bare: textarea + send.
               No mode chip (the room has no task lifecycle). Multiline like task
               comments (PAP-116): text soft-wraps and the box auto-grows instead of
               clipping / showing a horizontal scrollbar. Sends on plain Enter today
               (Shift+Enter for a newline); flipping to ⌘/Ctrl+Enter is pending board
               confirmation.

               PAP-131 (PAP-128 A): the dock floats over the message stream so text
               scrolls behind the translucent glass box. The old hard black gradient
               mask is gone — the dock carries the task-style soft top fade instead
               (mirrors IssueChatThread's composer dock). pointer-events pass through
               the fade so the scrollbar stays usable; the composer re-enables them. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-background via-background/95 to-background/0 px-6 pt-6 pb-5">
            {/* Zen mode keeps the adventure chips docked above the composer,
                always current: the company's real priorities as tappable moves. */}
            {zenMode && priorityChips.length > 0 && (
              <div className="pointer-events-auto mb-2 flex flex-wrap gap-2">
                {priorityChips.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => {
                      setInput(chip.prompt);
                      composerRef.current?.focus();
                    }}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            )}
            {voiceStatus !== "idle" || voiceReview ? (
              <div
                data-testid="board-chat-voice-status"
                role="status"
                className="pointer-events-auto mb-2 flex flex-col gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
              >
                <span>
                  {voiceStatus === "recording"
                    ? `Recording ${formatVoiceTime(voiceElapsedSeconds)} / ${formatVoiceTime(transcription?.maxSeconds ?? 60)} · stop to transcribe · no auto-send`
                    : voiceStatus === "processing"
                      ? `Transcribing · reserves at most ${formatVoiceCost(transcription?.requestReservationMicrousd ?? 25_000)} · raw audio will be discarded`
                      : `Transcript added for review · estimated ${formatVoiceCost(voiceReview?.estimatedCostMicrousd ?? 0)} · edit before sending`}
                </span>
                {voiceStatus === "recording" ? (
                  <Button type="button" variant="ghost" size="sm" onClick={cancelVoice}>
                    Cancel recording
                  </Button>
                ) : voiceStatus === "idle" && voiceReview ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setVoiceReview(null)}>
                    Dismiss
                  </Button>
                ) : null}
              </div>
            ) : null}
            <ChatComposer
              ref={composerRef}
              value={input}
              onChange={setInput}
              onSubmit={handleSend}
              placeholder="Ask anything about your company..."
              submitKey="enter"
              surface="translucent"
              submitting={sending}
              disabled={sending || attaching}
              onAttachFiles={attachFiles}
              onRemoveAttachment={removeAttachment}
              attachments={composerAttachments}
              attaching={attaching}
              onVoice={handleVoice}
              voiceStatus={voiceStatus}
              voiceDisabled={sending || attaching}
              voiceLabel={voiceStatus === "recording"
                ? "Stop and transcribe voice direction"
                : voiceStatus === "processing"
                  ? "Transcribing voice direction"
                  : "Record voice direction"}
              sendLabel="Send message"
              className="pointer-events-auto"
            />
          </div>
        </div>

        {/* Resize handle — hidden on mobile */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize board chat and agent feed"
          className={zenMode ? "hidden" : "group relative hidden w-3 shrink-0 cursor-col-resize bg-background md:flex"}
          onMouseDown={handleSplitDragStart}
        >
          <div
            className="pointer-events-none absolute top-0 bottom-0 left-0 w-px bg-border transition-colors group-hover:bg-foreground/20"
            aria-hidden
          />
        </div>

        {/* Right: Priorities scoreboard / Agent Feed — hidden on mobile, and
            hidden entirely in chat zen mode (the thread IS the interface). */}
        <div className={zenMode ? "hidden" : "hidden md:flex md:min-h-0 md:min-w-0 md:flex-1"}>
          <BoardRightPane
            view={rightPaneView}
            onViewChange={setRightPaneView}
            issues={issues}
            agents={agents}
          />
        </div>
      </div>

      {/* Mobile: floating companion toggle + sheet drawer */}
      <div className={zenMode ? "hidden" : "md:hidden"}>
        <Sheet open={mobileFeedOpen} onOpenChange={setMobileFeedOpen}>
          <SheetTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="fixed bottom-20 right-4 z-20 h-10 w-10 rounded-full shadow-lg"
              aria-label="Open priorities and feed"
            >
              <ListChecks className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-(--sz-70vh) p-0 rounded-t-xl">
            <BoardRightPane
              view={rightPaneView}
              onViewChange={setRightPaneView}
              issues={issues}
              agents={agents}
            />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
