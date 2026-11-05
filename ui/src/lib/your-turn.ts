// The Your turn screen's model. Inspired by nebula's session grid: every
// department is a card with one status dot, and the cards sort into bands so
// the board sees who needs it before anything else. Every item here is a real
// attention-feed entry or a real blocked issue; nothing is inferred.

import type { Agent, AttentionFeed, AttentionItem, Issue } from "@paperclipai/shared";

export type TurnState = "needs_you" | "error" | "working" | "idle";

export type TurnItem = {
  key: string;
  title: string;
  why: string;
  href: string | null;
  kind: "decision" | "blocked";
};

export type TurnCard = {
  agentId: string | null;
  name: string;
  state: TurnState;
  /** What the department is on right now: its newest in-progress quest, else its newest open one. */
  focus: { identifier: string; title: string; href: string } | null;
  items: TurnItem[];
  errorReason: string | null;
};

export type YourTurn = {
  cards: TurnCard[];
  needsYouTotal: number;
  counts: Record<TurnState, number>;
};

const ORDER: Record<TurnState, number> = { needs_you: 0, error: 1, working: 2, idle: 3 };
const OPEN = new Set(["todo", "backlog", "in_progress", "in_review"]);

function time(value: Date | string | null | undefined): number {
  if (!value) return 0;
  const t = (value instanceof Date ? value : new Date(value)).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function issueIdOf(item: AttentionItem): string | null {
  if (item.relatedIssue?.kind === "issue") return item.relatedIssue.id;
  if (item.subject.kind === "issue") return item.subject.id;
  const fromMeta = item.subject.metadata?.issueId;
  return typeof fromMeta === "string" ? fromMeta : null;
}

export function computeYourTurn(input: {
  companyPrefix: string;
  agents: Agent[];
  issues: Issue[];
  attention: AttentionFeed | null | undefined;
}): YourTurn {
  const issueById = new Map(input.issues.map((issue) => [issue.id, issue]));
  const live = input.agents.filter((agent) => agent.status !== "paused" && agent.status !== "terminated");
  const itemsByAgent = new Map<string | null, TurnItem[]>();
  const push = (agentId: string | null, item: TurnItem) => {
    const list = itemsByAgent.get(agentId) ?? [];
    list.push(item);
    itemsByAgent.set(agentId, list);
  };

  for (const item of input.attention?.items ?? []) {
    if (item.dismissal) continue;
    const issueId = issueIdOf(item);
    const owner = issueId ? issueById.get(issueId)?.assigneeAgentId ?? null : null;
    push(owner && live.some((agent) => agent.id === owner) ? owner : null, {
      key: `a:${item.id}`,
      title: item.subject.title ?? item.relatedIssue?.title ?? "Decision",
      why: item.whyNow,
      href: item.subject.href ?? item.relatedIssue?.href ?? null,
      kind: "decision",
    });
  }

  for (const issue of input.issues) {
    if (issue.status !== "blocked") continue;
    const owner = issue.assigneeAgentId && live.some((agent) => agent.id === issue.assigneeAgentId) ? issue.assigneeAgentId : null;
    push(owner, {
      key: `b:${issue.id}`,
      title: issue.title,
      why: "Blocked",
      href: `/${input.companyPrefix}/issues/${issue.identifier ?? issue.id}`,
      kind: "blocked",
    });
  }

  const cards: TurnCard[] = live.map((agent) => {
    const items = itemsByAgent.get(agent.id) ?? [];
    const mine = input.issues
      .filter((issue) => issue.assigneeAgentId === agent.id && OPEN.has(issue.status))
      .sort((a, b) => {
        const rank = (issue: Issue) => (issue.status === "in_progress" ? 0 : 1);
        return rank(a) - rank(b) || time(b.updatedAt) - time(a.updatedAt);
      });
    const top = mine[0];
    const state: TurnState =
      items.length > 0 ? "needs_you" : agent.status === "error" ? "error" : agent.status === "running" ? "working" : "idle";
    return {
      agentId: agent.id,
      name: agent.name,
      state,
      focus: top
        ? { identifier: top.identifier ?? top.id, title: top.title, href: `/${input.companyPrefix}/issues/${top.identifier ?? top.id}` }
        : null,
      items,
      errorReason: agent.status === "error" ? ((agent as Agent & { errorReason?: string | null }).errorReason ?? null) : null,
    };
  });

  const board = itemsByAgent.get(null) ?? [];
  if (board.length > 0) {
    cards.push({ agentId: null, name: "Board", state: "needs_you", focus: null, items: board, errorReason: null });
  }

  cards.sort((a, b) => ORDER[a.state] - ORDER[b.state] || b.items.length - a.items.length || a.name.localeCompare(b.name));

  const counts: Record<TurnState, number> = { needs_you: 0, error: 0, working: 0, idle: 0 };
  for (const card of cards) counts[card.state] += 1;
  return { cards, needsYouTotal: cards.reduce((sum, card) => sum + card.items.length, 0), counts };
}
