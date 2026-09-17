import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Agent } from "@paperclipai/shared";
import { ArrowDown, Check, CheckCheck, Mail, MessageCircle, Search, Send, Users } from "lucide-react";
import { AgentIcon } from "../components/AgentIconPicker";
import { ChatComposer } from "../components/ChatComposer";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { agentsApi } from "../api/agents";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { agentStatusDot, agentStatusDotDefault } from "../lib/status-colors";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";

/**
 * Messages (VIT-41) — a WhatsApp-feel, per-employee chat inbox.
 *
 * One always-on thread per AI employee: a left rail of employees (avatar, name,
 * persona, presence dot, last-message preview, unread count) and a right pane of
 * chronological bubbles with day dividers, timestamps, delivered/read ticks, a
 * running/typing indicator, and a quick composer.
 *
 * This is the single messaging surface the board asked for — it coordinates with
 * VIT-40 (continuity: the "remembers everything" backend that will replace the
 * local thread state below) and VIT-57 (CEO front door). It is intentionally
 * additive and draft-only: presence, avatars, and personas are live agent data,
 * while the thread transcript is a local prototype so the board can review the
 * *feel* before the continuity backend is wired in. No existing surface changes.
 */

export type PresenceKey = Agent["status"];

const PRESENCE_LABEL: Record<string, string> = {
  running: "Working",
  active: "Available",
  idle: "Idle",
  paused: "Paused",
  pending_approval: "Awaiting approval",
  error: "Needs attention",
  terminated: "Offline",
};

export interface AgentPresence {
  key: PresenceKey;
  label: string;
  /** Tailwind classes for the small solid presence dot (shared agent vocabulary). */
  dotClass: string;
  /** True while the employee is actively running — drives the typing indicator. */
  isBusy: boolean;
}

export function agentPresence(agent: Pick<Agent, "status">): AgentPresence {
  const key = agent.status;
  return {
    key,
    label: PRESENCE_LABEL[key] ?? "Offline",
    dotClass: agentStatusDot[key] ?? agentStatusDotDefault,
    isBusy: key === "running",
  };
}

export type MessageAuthor = "you" | "employee";
export type DeliveryState = "delivered" | "read";

export interface ChatMessage {
  id: string;
  author: MessageAuthor;
  text: string;
  at: Date;
  /** Only outgoing ("you") messages carry a delivery state. */
  delivery?: DeliveryState;
}

export interface MessageDayGroup {
  key: string;
  label: string;
  messages: ChatMessage[];
}

/** The employee's opening line, seeded so every thread starts non-empty and unread. */
export function buildInitialGreeting(agent: Pick<Agent, "name" | "title" | "status">): string {
  const presence = agentPresence(agent);
  const role = agent.title?.trim();
  const intro = role ? `${agent.name} here, your ${role}.` : `${agent.name} here.`;
  switch (presence.key) {
    case "running":
      return `${intro} I'm mid-run right now, but message me anytime and I'll fold it into the work.`;
    case "paused":
      return `${intro} I'm paused at the moment, resume me and I'll pick straight back up.`;
    case "error":
      return `${intro} I hit a snag and could use a hand when you have a second.`;
    case "pending_approval":
      return `${intro} I'm waiting on your approval before I can start.`;
    default:
      return `${intro} All clear, message me and I'll get on it.`;
  }
}

/** A presence-aware reply. Deterministic so the "feel" is reviewable and testable. */
export function buildEmployeeReply(
  agent: Pick<Agent, "name" | "status" | "pauseReason" | "errorReason">,
  prompt: string,
): string {
  const asksStatus = /\bstatus\b|how'?s it going|update|progress|where are (we|you)/i.test(prompt);
  const presence = agentPresence(agent);
  if (asksStatus) {
    switch (presence.key) {
      case "running":
        return "Mid-run right now, heads-down on your work. I'll report back the second it lands.";
      case "paused":
        return `I'm paused${agent.pauseReason ? ` (${agent.pauseReason})` : ""} right now. Resume me and I'll pick straight back up.`;
      case "error":
        return `I hit a snag and need a hand${agent.errorReason ? `: ${agent.errorReason}` : ""}.`;
      case "pending_approval":
        return "Waiting on your approval before I can move, green-light me and I'll go.";
      default:
        return "All clear on my end. Nothing blocking, ready for the next thing.";
    }
  }
  return presence.key === "running"
    ? "Got it, I'm on a run right now, but I've noted this and I'll act on it."
    : "Got it. On it.";
}

/** Group a chronological message list into per-day sections with friendly labels. */
export function groupMessagesByDay(messages: ChatMessage[], now: Date = new Date()): MessageDayGroup[] {
  const groups: MessageDayGroup[] = [];
  const byKey = new Map<string, MessageDayGroup>();
  for (const message of messages) {
    const key = message.at.toDateString();
    let group = byKey.get(key);
    if (!group) {
      group = { key, label: formatDayDivider(message.at, now), messages: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.messages.push(message);
  }
  return groups;
}

export function formatDayDivider(at: Date, now: Date = new Date()): string {
  const day = new Date(at.getFullYear(), at.getMonth(), at.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return at.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function formatClock(at: Date): string {
  return at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Short preview of the most recent message for the employee list rail. */
export function previewText(messages: ChatMessage[]): string {
  const last = messages[messages.length - 1];
  if (!last) return "";
  const prefix = last.author === "you" ? "You: " : "";
  return `${prefix}${last.text}`;
}

/** Which half of the inbox is showing. */
type InboxLane = "employees" | "users";

/** A user-originated email thread (prototype, mirrors employee thread pattern). */
export interface UserThread {
  id: string;
  sender: string;
  email: string;
  subject: string;
  /** Original email body */
  body: string;
  receivedAt: Date;
  unread: boolean;
  /** AI-drafted reply, pending board approval. */
  draft: string;
  /** After board approval, the sent reply is recorded here. */
  sentReply?: string;
  sentAt?: Date;
}

/** Seed data — real-looking inbound emails for the board to review the feel. */
const SEED_USER_THREADS: UserThread[] = [
  {
    id: "usr-1",
    sender: "Maya Okonkwo",
    email: "maya@foundingteam.io",
    subject: "Interested in founding tier",
    body: "Hi — saw the founding offer. We're a 4-person team that just raised a pre-seed. Can you walk me through what the first 30 days look like? Specifically wondering how the diagnosis works and who owns the work.",
    receivedAt: new Date(Date.now() - 1000 * 60 * 47),
    unread: true,
    draft: "Hi Maya, congratulations on the pre-seed. The first 30 days start with a 48-hour free diagnosis: I map your one binding constraint, then assign an accountable AI employee to own it. You stay on the board — you approve decisions, I execute. The diagnosis happens before any payment so you can see exactly what you're buying. Want to schedule a 15-minute call to walk through it?",
  },
  {
    id: "usr-2",
    sender: "Daniel Marsh",
    email: "d.marsh@techventures.co",
    subject: "Re: AI employee for ops",
    body: "Quick question — does the support employee handle inbound tickets or just outbound research? We get about 200 tickets a week and need something that can triage and draft replies.",
    receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 3),
    unread: true,
    draft: "Hi Daniel — the Support employee triages inbound tickets, drafts replies, and flags anything that needs your call before it goes out. You're the board: every external reply sits in your approval queue before it sends. For 200 tickets a week the typical board time is around 15 minutes. I can show you the exact flow in a diagnosis if that helps.",
  },
  {
    id: "usr-3",
    sender: "Priya Nair",
    email: "priya@smallbatch.studio",
    subject: "Pricing question",
    body: "Is the $99/mo on top of the $500 setup, or is the setup a one-time thing? Also what happens if I cancel in month 2?",
    receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 18),
    unread: false,
    draft: "Hi Priya — the $500 is a one-time setup fee and the $99/mo is the ongoing company rate, locked for life as a founding member. If you cancel in month 2, billing stops at the end of that billing period. No lock-in, no penalty. The setup fee is non-refundable after the first 7-day guarantee window — but that window only starts once I've delivered the first plated result, so you see value before you're committed.",
    sentReply: "Hi Priya — the $500 is a one-time setup fee and the $99/mo is the ongoing company rate, locked for life as a founding member. If you cancel in month 2, billing stops at the end of that billing period. No lock-in, no penalty.",
    sentAt: new Date(Date.now() - 1000 * 60 * 60 * 17),
  },
];

interface EmployeeThreadState {
  messages: ChatMessage[];
  unread: number;
}

function makeId(seed: string): string {
  return `${seed}-${Math.random().toString(36).slice(2, 9)}`;
}

export function Messages() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  const agentsQuery = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Messages" }]);
  }, [setBreadcrumbs]);

  const employees = useMemo(
    () => (agentsQuery.data ?? []).filter((agent) => agent.status !== "terminated"),
    [agentsQuery.data],
  );

  if (!selectedCompanyId) {
    return (
      <EmptyState
        icon={MessageCircle}
        title="No company selected"
        message="Select a company to message its employees."
      />
    );
  }

  if (agentsQuery.isLoading) {
    return (
      <div className="flex h-full min-h-0 gap-4">
        <div className="w-80 shrink-0 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
        <Skeleton className="min-h-0 flex-1" />
      </div>
    );
  }

  if (agentsQuery.isError) {
    return (
      <EmptyState
        icon={MessageCircle}
        title="Could not load your employees"
        message="The employee list did not load. Retry without leaving this page."
        action="Retry"
        hideActionIcon
        onAction={() => void agentsQuery.refetch()}
      />
    );
  }

  if (employees.length === 0) {
    return (
      <EmptyState
        icon={MessageCircle}
        title="No employees yet"
        message="Hire your first employee to start a conversation."
      />
    );
  }

  return <MessagesView employees={employees} companyName={selectedCompany?.name} />;
}

/**
 * Presentational Messages surface — pure props, owns its own interaction state.
 * Split from the data container so the visual suite can render it with fixtures
 * (light + dark) without mocking queries or company context.
 */
export function MessagesView({
  employees,
  companyName,
}: {
  employees: Agent[];
  companyName?: string;
}) {
  const [lane, setLane] = useState<InboxLane>("employees");
  const [threads, setThreads] = useState<Record<string, EmployeeThreadState>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [userThreads, setUserThreads] = useState<UserThread[]>(SEED_USER_THREADS);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [pendingReply, setPendingReply] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showJump, setShowJump] = useState(false);
  // Track the active id for the async reply without re-creating the timeout.
  const activeIdRef = useRef<string | null>(activeId);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // Seed one greeting per employee (unread) so every thread starts populated —
  // the WhatsApp "you already have messages waiting" feel. Local-only prototype
  // state; VIT-40 continuity replaces this with the durable per-employee log.
  useEffect(() => {
    setThreads((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const agent of employees) {
        if (next[agent.id]) continue;
        changed = true;
        next[agent.id] = {
          unread: 1,
          messages: [
            {
              id: makeId(`greet-${agent.id}`),
              author: "employee",
              text: buildInitialGreeting(agent),
              at: new Date(),
            },
          ],
        };
      }
      return changed ? next : prev;
    });
  }, [employees]);

  // Default to the first employee once loaded.
  useEffect(() => {
    if (!activeId && employees.length > 0) {
      setActiveId(employees[0]!.id);
    }
  }, [activeId, employees]);

  const activeAgent = useMemo(
    () => employees.find((agent) => agent.id === activeId) ?? null,
    [employees, activeId],
  );
  const activeThread = activeId ? threads[activeId] : undefined;
  const dayGroups = useMemo(
    () => groupMessagesByDay(activeThread?.messages ?? []),
    [activeThread?.messages],
  );

  const filteredEmployees = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (agent) =>
        agent.name.toLowerCase().includes(q) ||
        (agent.title ?? "").toLowerCase().includes(q),
    );
  }, [employees, query]);

  const activeUserThread = useMemo(
    () => userThreads.find((t) => t.id === activeUserId) ?? null,
    [userThreads, activeUserId],
  );

  function handleLaneSwitch(next: InboxLane) {
    setLane(next);
    setActiveId(null);
    setActiveUserId(null);
  }

  function selectUserThread(id: string) {
    setActiveUserId(id);
    setUserThreads((prev) => prev.map((t) => (t.id === id ? { ...t, unread: false } : t)));
  }

  function handleApproveAndSend() {
    if (!activeUserThread || activeUserThread.sentReply) return;
    setApproving(true);
    window.setTimeout(() => {
      setUserThreads((prev) =>
        prev.map((t) =>
          t.id === activeUserThread.id
            ? { ...t, sentReply: t.draft, sentAt: new Date(), unread: false }
            : t,
        ),
      );
      setApproving(false);
    }, 700);
  }

  // Mark the active thread read when it is opened / receives messages.
  useEffect(() => {
    if (!activeId) return;
    setThreads((prev) => {
      const thread = prev[activeId];
      if (!thread || thread.unread === 0) return prev;
      return { ...prev, [activeId]: { ...thread, unread: 0 } };
    });
  }, [activeId, activeThread?.messages.length]);

  // Keep the transcript pinned to the latest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [activeThread?.messages.length, pendingReply, activeId]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowJump(distanceFromBottom > 120);
  }

  function jumpToLatest() {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    setShowJump(false);
  }

  function handleSend() {
    const text = draft.trim();
    if (!text || !activeAgent) return;
    const agent = activeAgent;
    const outgoing: ChatMessage = {
      id: makeId("you"),
      author: "you",
      text,
      at: new Date(),
      delivery: "delivered",
    };
    setThreads((prev) => {
      const thread = prev[agent.id] ?? { messages: [], unread: 0 };
      return {
        ...prev,
        [agent.id]: { ...thread, messages: [...thread.messages, outgoing] },
      };
    });
    setDraft("");
    setPendingReply(true);

    // Simulate the employee reading + replying. Real runs replace this via VIT-40.
    window.setTimeout(() => {
      setThreads((prev) => {
        const thread = prev[agent.id];
        if (!thread) return prev;
        const reply: ChatMessage = {
          id: makeId("employee"),
          author: "employee",
          text: buildEmployeeReply(agent, text),
          at: new Date(),
        };
        const messages = thread.messages.map((message) =>
          message.author === "you" ? { ...message, delivery: "read" as DeliveryState } : message,
        );
        const isActive = activeIdRef.current === agent.id;
        return {
          ...prev,
          [agent.id]: {
            messages: [...messages, reply],
            unread: isActive ? 0 : thread.unread + 1,
          },
        };
      });
      setPendingReply(false);
    }, 900);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Messages</h1>
        <p className="text-sm text-muted-foreground">
          One always-on thread per employee at {companyName ?? "your company"}. Presence and
          avatars are live; the transcript is a draft preview pending continuity wiring.
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card lg:flex-row">
        {/* Left rail */}
        <aside
          className={cn(
            "min-h-0 flex-col border-border lg:w-80 lg:shrink-0 lg:border-r",
            activeAgent || activeUserThread ? "hidden lg:flex" : "flex",
          )}
          aria-label="Inbox"
        >
          {/* Lane toggle */}
          <div className="flex border-b border-border">
            <button
              type="button"
              onClick={() => handleLaneSwitch("employees")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2.5 text-xs font-medium transition-colors",
                lane === "employees"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <MessageCircle className="size-3.5" aria-hidden="true" />
              Employees
            </button>
            <button
              type="button"
              onClick={() => handleLaneSwitch("users")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2.5 text-xs font-medium transition-colors",
                lane === "users"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Users className="size-3.5" aria-hidden="true" />
              Users
              {userThreads.some((t) => t.unread) ? (
                <span className="grid min-w-4 place-items-center rounded-full bg-primary px-1 text-(length:--text-micro) font-semibold text-primary-foreground">
                  {userThreads.filter((t) => t.unread).length}
                </span>
              ) : null}
            </button>
          </div>

          {lane === "employees" ? (
            <>
              <div className="border-b border-border p-3">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search employees"
                    aria-label="Search employees"
                    className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-muted-foreground/40"
                  />
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-2" role="list">
                {filteredEmployees.map((agent) => {
                  const thread = threads[agent.id];
                  const preview = thread ? previewText(thread.messages) : "";
                  const unread = thread?.unread ?? 0;
                  return (
                    <EmployeeRow
                      key={agent.id}
                      agent={agent}
                      preview={preview}
                      unread={unread}
                      active={agent.id === activeId}
                      onSelect={() => setActiveId(agent.id)}
                    />
                  );
                })}
                {filteredEmployees.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">No employees match.</p>
                ) : null}
              </div>
            </>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto p-2" role="list">
              {userThreads.map((thread) => (
                <UserThreadRow
                  key={thread.id}
                  thread={thread}
                  active={thread.id === activeUserId}
                  onSelect={() => selectUserThread(thread.id)}
                />
              ))}
            </div>
          )}
        </aside>

        {/* Right pane */}
        <section
          className={cn(
            "min-h-0 flex-1 flex-col",
            activeAgent || activeUserThread ? "flex" : "hidden lg:flex",
          )}
          aria-label="Conversation"
        >
          {lane === "employees" && activeAgent ? (
            <>
              <ThreadHeader agent={activeAgent} onBack={() => setActiveId(null)} />
              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="relative min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
                data-testid="messages-transcript"
              >
                {dayGroups.map((group) => (
                  <div key={group.key} className="space-y-2">
                    <DayDivider label={group.label} />
                    {group.messages.map((message) => (
                      <MessageBubble key={message.id} message={message} agent={activeAgent} />
                    ))}
                  </div>
                ))}
                {pendingReply ? <TypingIndicator agent={activeAgent} /> : null}
              </div>

              {showJump ? (
                <div className="pointer-events-none relative">
                  <button
                    type="button"
                    onClick={jumpToLatest}
                    className="pointer-events-auto absolute -top-12 right-4 grid size-9 place-items-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground"
                    aria-label="Jump to latest"
                  >
                    <ArrowDown className="size-4" />
                  </button>
                </div>
              ) : null}

              <div className="border-t border-border p-3">
                <ChatComposer
                  value={draft}
                  onChange={setDraft}
                  onSubmit={handleSend}
                  submitKey="enter"
                  placeholder={`Message ${activeAgent.name}…`}
                  sendLabel={`Send message to ${activeAgent.name}`}
                />
              </div>
            </>
          ) : lane === "users" && activeUserThread ? (
            <UserThreadPane
              thread={activeUserThread}
              onBack={() => setActiveUserId(null)}
              onApproveAndSend={handleApproveAndSend}
              approving={approving}
            />
          ) : (
            <div className="hidden min-h-0 flex-1 place-items-center lg:grid">
              <EmptyState
                icon={lane === "users" ? Users : MessageCircle}
                title={lane === "users" ? "Pick a user thread" : "Pick an employee"}
                message={
                  lane === "users"
                    ? "Choose a user email on the left to review and approve a reply."
                    : "Choose someone on the left to open your thread with them."
                }
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function PresenceDot({ agent, className }: { agent: Pick<Agent, "status">; className?: string }) {
  const presence = agentPresence(agent);
  return (
    <span
      className={cn("inline-block size-2.5 rounded-full ring-2 ring-card", presence.dotClass, className)}
      title={presence.label}
      aria-label={presence.label}
    />
  );
}

function EmployeeAvatar({ agent, size = "size-10" }: { agent: Agent; size?: string }) {
  return (
    <div className="relative shrink-0">
      <div className={cn("grid place-items-center rounded-full bg-accent text-foreground", size)}>
        <AgentIcon icon={agent.icon} className="size-5" />
      </div>
      <PresenceDot agent={agent} className="absolute -bottom-0.5 -right-0.5" />
    </div>
  );
}

function EmployeeRow({
  agent,
  preview,
  unread,
  active,
  onSelect,
}: {
  agent: Agent;
  preview: string;
  unread: number;
  active: boolean;
  onSelect: () => void;
}) {
  const presence = agentPresence(agent);
  return (
    <button
      type="button"
      onClick={onSelect}
      role="listitem"
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
        active ? "bg-accent" : "hover:bg-accent/60",
      )}
    >
      <EmployeeAvatar agent={agent} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground">{agent.name}</span>
          {unread > 0 ? (
            <span className="grid min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-(length:--text-micro) font-semibold text-primary-foreground">
              {unread}
            </span>
          ) : null}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {preview || agent.title || presence.label}
        </p>
      </div>
    </button>
  );
}

function ThreadHeader({ agent, onBack }: { agent: Agent; onBack: () => void }) {
  const presence = agentPresence(agent);
  return (
    <header className="flex items-center gap-3 border-b border-border px-4 py-3">
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-muted-foreground lg:hidden"
        aria-label="Back to employees"
      >
        ‹
      </button>
      <EmployeeAvatar agent={agent} />
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-foreground">{agent.name}</div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn("inline-block size-2 rounded-full", presence.dotClass)} aria-hidden="true" />
          <span>{presence.isBusy ? "Working now" : presence.label}</span>
          {agent.title ? <span className="truncate">· {agent.title}</span> : null}
        </div>
      </div>
    </header>
  );
}

function DayDivider({ label }: { label: string }) {
  return (
    <div className="flex justify-center py-1">
      <span className="rounded-full bg-muted px-2.5 py-0.5 text-(length:--text-micro) font-medium text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function MessageBubble({ message, agent }: { message: ChatMessage; agent: Agent }) {
  const isYou = message.author === "you";
  return (
    <div className={cn("flex items-end gap-2", isYou ? "justify-end" : "justify-start")}>
      {!isYou ? (
        <div className="grid size-7 shrink-0 place-items-center self-end rounded-full bg-accent text-foreground">
          <AgentIcon icon={agent.icon} className="size-4" />
        </div>
      ) : null}
      <div
        className={cn(
          "max-w-(--pct-85) rounded-2xl px-3 py-2 text-sm",
          isYou
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm bg-muted text-foreground",
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.text}</p>
        <div
          className={cn(
            "mt-1 flex items-center justify-end gap-1 text-(length:--text-micro)",
            isYou ? "text-primary-foreground/70" : "text-muted-foreground",
          )}
        >
          <span>{formatClock(message.at)}</span>
          {isYou ? (
            message.delivery === "read" ? (
              <CheckCheck className="size-3.5" aria-label="Read" />
            ) : (
              <Check className="size-3.5" aria-label="Delivered" />
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TypingIndicator({ agent }: { agent: Agent }) {
  return (
    <div className="flex items-end gap-2">
      <div className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-foreground">
        <AgentIcon icon={agent.icon} className="size-4" />
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-muted px-3 py-2.5">
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.2s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.1s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
      </div>
    </div>
  );
}

function UserThreadRow({
  thread,
  active,
  onSelect,
}: {
  thread: UserThread;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      role="listitem"
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
        active ? "bg-accent" : "hover:bg-accent/60",
      )}
    >
      <div className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
        <Mail className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={cn("truncate text-sm", thread.unread ? "font-semibold text-foreground" : "font-medium text-foreground")}>
            {thread.sender}
          </span>
          {thread.unread ? (
            <span className="grid min-w-4 shrink-0 place-items-center rounded-full bg-primary px-1 text-(length:--text-micro) font-semibold text-primary-foreground">
              1
            </span>
          ) : null}
        </div>
        <p className="truncate text-xs text-muted-foreground">{thread.subject}</p>
      </div>
    </button>
  );
}

function UserThreadPane({
  thread,
  onBack,
  onApproveAndSend,
  approving,
}: {
  thread: UserThread;
  onBack: () => void;
  onApproveAndSend: () => void;
  approving: boolean;
}) {
  const hasSent = !!thread.sentReply;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-muted-foreground lg:hidden"
          aria-label="Back to users"
        >
          ‹
        </button>
        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
          <Mail className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-foreground">{thread.sender}</div>
          <div className="truncate text-xs text-muted-foreground">{thread.email}</div>
        </div>
        <div className="shrink-0 text-xs text-muted-foreground">{formatClock(thread.receivedAt)}</div>
      </header>

      {/* Email body */}
      <div className="min-h-0 flex-1 overflow-y-auto space-y-4 px-4 py-4">
        {/* Inbound email */}
        <div className="rounded-lg border border-border bg-background px-4 py-3 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Inbound email</p>
          <p className="text-sm font-semibold text-foreground">{thread.subject}</p>
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{thread.body}</p>
        </div>

        {/* AI-drafted reply */}
        <div className="rounded-lg border border-border bg-background px-4 py-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Support drafted a reply
          </p>
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{thread.draft}</p>
        </div>

        {/* Sent confirmation */}
        {hasSent ? (
          <div className="rounded-lg border border-border bg-background px-4 py-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <Check className="size-3.5 text-green-600" aria-hidden="true" />
              Sent by board · {thread.sentAt ? formatClock(thread.sentAt) : ""}
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{thread.sentReply}</p>
          </div>
        ) : null}
      </div>

      {/* Board action footer */}
      {!hasSent ? (
        <div className="border-t border-border p-3 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Board approval required before send. The reply goes from your account.
          </p>
          <button
            type="button"
            disabled={approving}
            onClick={onApproveAndSend}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <Send className="size-3.5" aria-hidden="true" />
            {approving ? "Sending…" : "Approve and send"}
          </button>
        </div>
      ) : (
        <div className="border-t border-border p-3">
          <p className="text-xs text-muted-foreground text-center">
            Reply sent. The full exchange is recorded above.
          </p>
        </div>
      )}
    </div>
  );
}
