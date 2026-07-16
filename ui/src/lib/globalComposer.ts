import {
  isAgentAssignableToWork,
  type Agent,
  type AgentRole,
  type AgentStatus,
  type Company,
} from "@paperclipai/shared";

/**
 * Global composer routing brain (VIT-57).
 *
 * The board asked for Claude-Code-parity prompting: one always-available prompt
 * box that can address ANY company or agent, where "type, enter" lands the work
 * on the right employee and **the CEO routes when the target is ambiguous**.
 *
 * This module is the pure, framework-free decision layer behind that box. Given
 * the cross-company roster and the raw composer text (plus whatever the sidebar
 * has scoped), it answers one question: *who picks this up?* — as a plain
 * `RoutingDecision` the UI can act on (file an issue for a named employee, or
 * hand an ambiguous ask to the company CEO) and echo back in one line.
 *
 * It has no React, no network, and no Date/Math.random dependency, so the whole
 * routing contract is unit-testable in isolation (`globalComposer.test.ts`).
 */

/** A single addressable employee in the roster. */
export interface RosterAgent {
  id: string;
  companyId: string;
  name: string;
  urlKey: string;
  role: AgentRole;
  title: string | null;
  status: AgentStatus;
}

/** A company plus its addressable (non-terminated) employees. */
export interface RosterCompany {
  id: string;
  name: string;
  issuePrefix: string;
  agents: RosterAgent[];
}

/** The full cross-company roster — the "StarCraft unit roster" the board wants. */
export type ComposerRoster = RosterCompany[];

/** Lowercase, alphanumeric-only slug for forgiving name/handle comparison. */
function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Build the cross-company roster from the companies list and a per-company map
 * of agents (as returned by `agentsApi.list`). Employees who cannot accept an
 * assignment are dropped, including pending approval and invalid org chains.
 */
export function buildRoster(
  companies: Pick<Company, "id" | "name" | "issuePrefix">[],
  agentsByCompanyId: Record<string, Agent[] | undefined>,
): ComposerRoster {
  return companies.map((company) => ({
    id: company.id,
    name: company.name,
    issuePrefix: company.issuePrefix,
    agents: (agentsByCompanyId[company.id] ?? [])
      .filter((agent, _index, agents) => isAgentAssignableToWork({ agent, agents }))
      .map((agent) => ({
        id: agent.id,
        companyId: company.id,
        name: agent.name,
        urlKey: agent.urlKey,
        role: agent.role,
        title: agent.title,
        status: agent.status,
      })),
  }));
}

/** The CEO of a company, if one is present and addressable. */
export function companyCeo(company: RosterCompany | null | undefined): RosterAgent | null {
  if (!company) return null;
  return company.agents.find((agent) => agent.role === "ceo") ?? null;
}

/**
 * The active `@mention` token under the caret, if any — the hook the autocomplete
 * dropdown reads. A mention is "active" when the caret sits inside an unbroken
 * run of mention characters immediately after an `@` that itself is at the start
 * of the text or preceded by whitespace. Returns the query (text after `@`) and
 * its character range so the UI can replace it on selection.
 */
export interface ActiveMention {
  query: string;
  /** Index of the `@`. */
  start: number;
  /** Caret index (exclusive end of the token). */
  end: number;
}

// Mention tokens allow letters, digits, and hyphens so combined "Company-Agent"
// handles autocomplete as one unit.
const MENTION_CHAR = /[a-zA-Z0-9-]/;

export function findActiveMention(text: string, caret: number): ActiveMention | null {
  const pos = Math.max(0, Math.min(caret, text.length));
  let i = pos - 1;
  while (i >= 0 && MENTION_CHAR.test(text[i]!)) i -= 1;
  if (i < 0 || text[i] !== "@") return null;
  const at = i;
  // The `@` must open a mention: start-of-text or preceded by whitespace.
  if (at > 0 && !/\s/.test(text[at - 1]!)) return null;
  return { query: text.slice(at + 1, pos), start: at, end: pos };
}

/** A ranked autocomplete suggestion for the mention dropdown. */
export interface MentionCandidate {
  kind: "company" | "agent";
  companyId: string;
  companyName: string;
  /** Present for agent candidates. */
  agent: RosterAgent | null;
  /** Human label for the row. */
  label: string;
  /** Canonical token inserted into the composer, e.g. `Quantus-Dealmaker`. */
  handle: string;
  score: number;
}

/** Canonical `Company-Agent` (or `Company`) handle inserted on selection. */
export function agentHandle(company: RosterCompany, agent: RosterAgent): string {
  return `${company.issuePrefix}-${agent.urlKey}`;
}

function scoreMatch(needle: string, haystacks: string[]): number {
  if (!needle) return 1; // empty query: everything is a weak match (list all)
  let best = 0;
  for (const raw of haystacks) {
    const hay = slug(raw);
    if (!hay) continue;
    if (hay === needle) best = Math.max(best, 100);
    else if (hay.startsWith(needle)) best = Math.max(best, 70);
    else if (hay.includes(needle)) best = Math.max(best, 40);
  }
  return best;
}

/**
 * Rank roster entries for an `@`-query. Both companies and agents are offered:
 * addressing a company alone routes to its CEO; addressing an agent routes to
 * that employee. Combined `Company-Agent` fragments (e.g. `quantus-deal`) match
 * on the agent within the named company.
 */
export function matchMentions(roster: ComposerRoster, query: string, limit = 8): MentionCandidate[] {
  const q = slug(query);
  // A combined "company-agent" fragment: split on the first hyphen.
  const hyphen = query.indexOf("-");
  const companyFragment = hyphen >= 0 ? slug(query.slice(0, hyphen)) : "";
  const agentFragment = hyphen >= 0 ? slug(query.slice(hyphen + 1)) : "";

  const candidates: MentionCandidate[] = [];
  for (const company of roster) {
    const companyScore = scoreMatch(q, [company.name, company.issuePrefix]);
    if (companyScore > 0) {
      candidates.push({
        kind: "company",
        companyId: company.id,
        companyName: company.name,
        agent: null,
        label: `${company.name} — CEO routes`,
        handle: company.issuePrefix,
        score: companyScore,
      });
    }
    const companyMatchesFragment =
      hyphen >= 0 && scoreMatch(companyFragment, [company.name, company.issuePrefix]) >= 70;
    for (const agent of company.agents) {
      const flat = scoreMatch(q, [agent.name, agent.urlKey, agent.role, agent.title ?? ""]);
      const combined = companyMatchesFragment
        ? scoreMatch(agentFragment, [agent.name, agent.urlKey, agent.role, agent.title ?? ""])
        : 0;
      const score = Math.max(flat, combined);
      if (score <= 0) continue;
      candidates.push({
        kind: "agent",
        companyId: company.id,
        companyName: company.name,
        agent,
        label: `${agent.name} · ${agent.title ?? agent.role} — ${company.name}`,
        handle: agentHandle(company, agent),
        score: agent.role === "ceo" ? score + 2 : score,
      });
    }
  }
  return candidates.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** How a message got routed — surfaced for the echo line and tests. */
export type RoutedVia =
  | "explicit_agent"
  | "explicit_company_ceo"
  | "scoped_agent"
  | "scoped_company_ceo"
  | "ambiguous_ceo";

export type RoutingTargetKind = "agent" | "ceo";

export interface RoutingDecision {
  companyId: string | null;
  companyName: string | null;
  targetKind: RoutingTargetKind;
  /** The named employee, when addressing one directly. */
  agent: RosterAgent | null;
  /** The company CEO, when known — the router / fallback recipient. */
  ceo: RosterAgent | null;
  /** Message with a resolved leading mention stripped; unchanged otherwise. */
  message: string;
  /** True when a leading mention was present but matched no one → CEO routes. */
  ambiguous: boolean;
  routedVia: RoutedVia;
}

export interface ResolveContext {
  text: string;
  roster: ComposerRoster;
  /** Company scoped by the sidebar / company switcher. */
  scopedCompanyId: string | null;
  /** Agent scoped by selecting a unit in the roster (optional). */
  scopedAgentId?: string | null;
}

/** Resolve a leading `@handle` to a company (+ agent) using the roster. */
function resolveLeadingHandle(
  roster: ComposerRoster,
  handle: string,
): { company: RosterCompany; agent: RosterAgent | null } | null {
  const flat = slug(handle);
  if (!flat) return null;

  // 1) Exact agent urlKey / name across the roster (prefer a unique hit).
  const agentHits = roster.flatMap((company) =>
    company.agents
      .filter((agent) => slug(agent.urlKey) === flat || slug(agent.name) === flat)
      .map((agent) => ({ company, agent })),
  );
  if (agentHits.length === 1) return agentHits[0]!;

  // 2) Combined "company-agent": split on each hyphen, left = company, right = agent.
  const parts = handle.split("-");
  for (let i = 1; i < parts.length; i += 1) {
    const left = slug(parts.slice(0, i).join("-"));
    const right = slug(parts.slice(i).join("-"));
    const company = roster.find(
      (c) => slug(c.issuePrefix) === left || slug(c.name) === left,
    );
    if (!company) continue;
    if (!right || right === "ceo") return { company, agent: companyCeo(company) };
    const agent = company.agents.find(
      (a) => slug(a.urlKey) === right || slug(a.name) === right || slug(a.role) === right,
    );
    if (agent) return { company, agent };
  }

  // 3) Company alone (name or prefix) → route to its CEO.
  const company = roster.find((c) => slug(c.issuePrefix) === flat || slug(c.name) === flat);
  if (company) return { company, agent: null };

  // 4) Ambiguous multi-hit agent name — do not guess.
  return null;
}

/** Split a leading `@mention` off the text, if one is present. */
function splitLeadingMention(text: string): { handle: string; rest: string } | null {
  const match = /^\s*@([a-zA-Z0-9-]+)(?:\s+([\s\S]*))?$/.exec(text);
  if (!match) return null;
  return { handle: match[1]!, rest: (match[2] ?? "").trim() };
}

/**
 * The core decision: who picks up this message? Precedence:
 *  1. A resolvable leading `@mention` (agent → that employee; company → its CEO).
 *  2. An unresolvable leading `@mention` → the scoped company CEO routes it
 *     (ambiguous), so nothing is silently dropped.
 *  3. No mention: the sidebar-scoped agent, else the scoped company's CEO.
 */
export function resolveRouting(ctx: ResolveContext): RoutingDecision {
  const scopedCompany =
    ctx.roster.find((c) => c.id === ctx.scopedCompanyId) ?? ctx.roster[0] ?? null;

  const decide = (
    company: RosterCompany | null,
    agent: RosterAgent | null,
    message: string,
    routedVia: RoutedVia,
    ambiguous = false,
  ): RoutingDecision => {
    const ceo = companyCeo(company);
    // Addressing the CEO directly is a CEO route, not an "agent" route.
    const isCeoTarget = !agent || agent.role === "ceo";
    return {
      companyId: company?.id ?? null,
      companyName: company?.name ?? null,
      targetKind: isCeoTarget ? "ceo" : "agent",
      agent: isCeoTarget ? null : agent,
      ceo,
      message,
      ambiguous,
      routedVia,
    };
  };

  const leading = splitLeadingMention(ctx.text);
  if (leading) {
    const resolved = resolveLeadingHandle(ctx.roster, leading.handle);
    if (resolved) {
      const via: RoutedVia = resolved.agent && resolved.agent.role !== "ceo"
        ? "explicit_agent"
        : "explicit_company_ceo";
      return decide(resolved.company, resolved.agent, leading.rest, via);
    }
    // Leading mention that matched no one: keep the full text so the CEO sees the
    // intended target, and let the scoped company CEO route it.
    return decide(scopedCompany, null, ctx.text.trim(), "ambiguous_ceo", true);
  }

  const scopedAgent = ctx.scopedAgentId
    ? scopedCompany?.agents.find((a) => a.id === ctx.scopedAgentId) ?? null
    : null;
  if (scopedAgent) {
    return decide(scopedCompany, scopedAgent, ctx.text.trim(), "scoped_agent");
  }
  return decide(scopedCompany, null, ctx.text.trim(), "scoped_company_ceo");
}

/**
 * One-line "who picked it up" echo — the Claude-Code-style confirmation the CEO
 * chat surfaces instead of process steps. Kept deterministic for tests; the UI
 * appends the filed issue identifier ("Filed as VIT-61 → …") once it has one.
 */
export function routingEcho(decision: RoutingDecision): string {
  const company = decision.companyName ?? "your company";
  if (decision.ambiguous) {
    return `Couldn't match that name — ${company} CEO will route it.`;
  }
  if (decision.targetKind === "agent" && decision.agent) {
    return `→ ${decision.agent.name} (${company}) picks this up.`;
  }
  return `→ ${company} CEO is routing this.`;
}

const DISPATCH_TITLE_MAX_LENGTH = 96;

/** Turn the first meaningful line of a board prompt into a compact issue title. */
export function dispatchIssueTitle(message: string): string {
  const firstLine = message
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)
    ?.replace(/^(?:#{1,6}|[-*+])\s+/, "")
    .trim();
  const title = firstLine || "Board request";
  if (title.length <= DISPATCH_TITLE_MAX_LENGTH) return title;
  return `${title.slice(0, DISPATCH_TITLE_MAX_LENGTH - 1).trimEnd()}…`;
}
