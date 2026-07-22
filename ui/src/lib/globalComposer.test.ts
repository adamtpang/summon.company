import { describe, expect, it } from "vitest";
import type { Agent, Company } from "@paperclipai/shared";
import {
  agentHandle,
  buildRoster,
  companyCeo,
  dispatchIssueTitle,
  findActiveMention,
  matchMentions,
  resolveRouting,
  routingEcho,
  type ComposerRoster,
} from "./globalComposer";

// ---- Fixtures ---------------------------------------------------------------

function agent(partial: Partial<Agent> & Pick<Agent, "id" | "name" | "urlKey" | "role">): Agent {
  return {
    companyId: "c",
    title: null,
    icon: null,
    status: "active",
    reportsTo: null,
    capabilities: null,
    adapterType: "claude_local",
    adapterConfig: {},
    runtimeConfig: {},
    budgetMonthlyCents: 0,
    spentMonthlyCents: 0,
    pauseReason: null,
    pausedAt: null,
    permissions: { canCreateAgents: false },
    lastHeartbeatAt: null,
    metadata: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...partial,
  } as Agent;
}

function company(id: string, name: string, issuePrefix: string): Company {
  return { id, name, issuePrefix } as Company;
}

// Two companies, each with a CEO + a couple of employees.
const SUMMON = company("summon", "Summon", "VIT");
const QUANTUS = company("quantus", "Quantus", "QNT");

const AGENTS: Record<string, Agent[]> = {
  summon: [
    agent({ id: "s-ceo", companyId: "summon", name: "Summon CEO", urlKey: "ceo", role: "ceo" }),
    agent({ id: "s-eng", companyId: "summon", name: "Vitals Engineer", urlKey: "engineer", role: "engineer", title: "Engineer" }),
    agent({ id: "s-pending", companyId: "summon", name: "Pending Hire", urlKey: "pending", role: "general", status: "pending_approval" }),
    agent({ id: "s-gone", companyId: "summon", name: "Old Hand", urlKey: "oldhand", role: "general", status: "terminated" }),
  ],
  quantus: [
    agent({ id: "q-ceo", companyId: "quantus", name: "Quantus CEO", urlKey: "ceo", role: "ceo" }),
    agent({ id: "q-deal", companyId: "quantus", name: "Dealmaker", urlKey: "dealmaker", role: "general", title: "Sales" }),
  ],
};

const ROSTER: ComposerRoster = buildRoster([SUMMON, QUANTUS], AGENTS);

// ---- buildRoster ------------------------------------------------------------

describe("buildRoster", () => {
  it("drops terminated agents but keeps everyone addressable", () => {
    const summon = ROSTER.find((c) => c.id === "summon")!;
    expect(summon.agents.map((a) => a.id)).toEqual(["s-ceo", "s-eng"]);
    expect(summon.agents.some((a) => a.id === "s-gone")).toBe(false);
    expect(summon.agents.some((a) => a.id === "s-pending")).toBe(false);
  });

  it("resolves the CEO per company", () => {
    expect(companyCeo(ROSTER[0])?.id).toBe("s-ceo");
    expect(companyCeo(ROSTER[1])?.id).toBe("q-ceo");
    expect(companyCeo(null)).toBeNull();
  });
});

// ---- dispatchIssueTitle ----------------------------------------------------

describe("dispatchIssueTitle", () => {
  it("uses the first meaningful line and strips markdown lead-in", () => {
    expect(dispatchIssueTitle("\n## Fix the prompt loop\nAcceptance follows"))
      .toBe("Fix the prompt loop");
  });

  it("truncates long prompts to an issue-sized title", () => {
    const title = dispatchIssueTitle("x".repeat(140));
    expect(title).toHaveLength(96);
    expect(title.endsWith("…")).toBe(true);
  });
});

// ---- findActiveMention ------------------------------------------------------

describe("findActiveMention", () => {
  it("detects a mention token under the caret", () => {
    const text = "hey @deal";
    expect(findActiveMention(text, text.length)).toEqual({ query: "deal", start: 4, end: 9 });
  });

  it("detects a bare @ (empty query lists everyone)", () => {
    expect(findActiveMention("@", 1)).toEqual({ query: "", start: 0, end: 1 });
  });

  it("ignores an @ that is not preceded by whitespace (e.g. an email)", () => {
    expect(findActiveMention("mail me at a@b", 14)).toBeNull();
  });

  it("returns null once the caret moves past the token onto whitespace", () => {
    const text = "@deal ";
    expect(findActiveMention(text, text.length)).toBeNull();
  });

  it("supports combined company-agent handles as one token", () => {
    const text = "@Quantus-Deal";
    expect(findActiveMention(text, text.length)).toEqual({ query: "Quantus-Deal", start: 0, end: 13 });
  });
});

// ---- matchMentions ----------------------------------------------------------

describe("matchMentions", () => {
  it("suggests companies and agents for a fuzzy query", () => {
    const hits = matchMentions(ROSTER, "deal");
    expect(hits[0]?.agent?.id).toBe("q-deal");
    expect(hits[0]?.handle).toBe("QNT-dealmaker");
  });

  it("ranks CEO above peers for a company-name query", () => {
    const hits = matchMentions(ROSTER, "quantus");
    // The company row and the CEO both surface; agent CEO gets the small boost.
    const agentHits = hits.filter((h) => h.kind === "agent");
    expect(agentHits[0]?.agent?.role).toBe("ceo");
  });

  it("matches a combined company-agent fragment", () => {
    const hits = matchMentions(ROSTER, "quantus-deal");
    expect(hits.some((h) => h.agent?.id === "q-deal")).toBe(true);
  });

  it("returns nothing for a query that matches no one", () => {
    expect(matchMentions(ROSTER, "zzz")).toEqual([]);
  });
});

// ---- resolveRouting ---------------------------------------------------------

describe("resolveRouting", () => {
  it("routes a plain message to the scoped company CEO (Claude-Code default)", () => {
    const d = resolveRouting({ text: "what's our constraint right now?", roster: ROSTER, scopedCompanyId: "summon" });
    expect(d.targetKind).toBe("ceo");
    expect(d.companyId).toBe("summon");
    expect(d.ceo?.id).toBe("s-ceo");
    expect(d.routedVia).toBe("scoped_company_ceo");
    expect(d.message).toBe("what's our constraint right now?");
    expect(d.ambiguous).toBe(false);
  });

  it("routes to the scoped agent when a unit is selected", () => {
    const d = resolveRouting({ text: "ship the fix", roster: ROSTER, scopedCompanyId: "summon", scopedAgentId: "s-eng" });
    expect(d.targetKind).toBe("agent");
    expect(d.agent?.id).toBe("s-eng");
    expect(d.routedVia).toBe("scoped_agent");
  });

  it("treats a scoped CEO unit as a CEO route, not an agent route", () => {
    const d = resolveRouting({ text: "status?", roster: ROSTER, scopedCompanyId: "summon", scopedAgentId: "s-ceo" });
    expect(d.targetKind).toBe("ceo");
    expect(d.agent).toBeNull();
  });

  it("routes an explicit @agent mention to that employee and strips the handle", () => {
    const d = resolveRouting({ text: "@dealmaker status?", roster: ROSTER, scopedCompanyId: "summon" });
    expect(d.targetKind).toBe("agent");
    expect(d.agent?.id).toBe("q-deal");
    expect(d.companyId).toBe("quantus"); // cross-company: mention wins over scope
    expect(d.message).toBe("status?");
    expect(d.routedVia).toBe("explicit_agent");
  });

  it("routes a combined @Company-Agent mention across companies", () => {
    const d = resolveRouting({ text: "@QNT-dealmaker how's the pipeline?", roster: ROSTER, scopedCompanyId: "summon" });
    expect(d.agent?.id).toBe("q-deal");
    expect(d.companyId).toBe("quantus");
    expect(d.message).toBe("how's the pipeline?");
  });

  it("routes an explicit @company mention to that company's CEO", () => {
    const d = resolveRouting({ text: "@Quantus please prioritise revenue", roster: ROSTER, scopedCompanyId: "summon" });
    expect(d.targetKind).toBe("ceo");
    expect(d.companyId).toBe("quantus");
    expect(d.ceo?.id).toBe("q-ceo");
    expect(d.routedVia).toBe("explicit_company_ceo");
    expect(d.message).toBe("please prioritise revenue");
  });

  it("hands an unresolvable @mention to the scoped CEO (ambiguous → CEO routes)", () => {
    const d = resolveRouting({ text: "@nobody do the thing", roster: ROSTER, scopedCompanyId: "summon" });
    expect(d.ambiguous).toBe(true);
    expect(d.targetKind).toBe("ceo");
    expect(d.companyId).toBe("summon");
    // Full text is preserved so the CEO can see the intended target.
    expect(d.message).toBe("@nobody do the thing");
    expect(d.routedVia).toBe("ambiguous_ceo");
  });

  it("falls back to the first company when scope is unknown", () => {
    const d = resolveRouting({ text: "hi", roster: ROSTER, scopedCompanyId: null });
    expect(d.companyId).toBe("summon");
  });
});

// ---- routingEcho ------------------------------------------------------------

describe("routingEcho", () => {
  it("names the employee for an agent route", () => {
    const d = resolveRouting({ text: "@dealmaker hi", roster: ROSTER, scopedCompanyId: "summon" });
    expect(routingEcho(d)).toBe("→ Dealmaker (Quantus) picks this up.");
  });

  it("names the CEO for a CEO route", () => {
    const d = resolveRouting({ text: "hi", roster: ROSTER, scopedCompanyId: "summon" });
    expect(routingEcho(d)).toBe("→ Summon CEO is routing this.");
  });

  it("explains the ambiguous fallback", () => {
    const d = resolveRouting({ text: "@nobody hi", roster: ROSTER, scopedCompanyId: "summon" });
    expect(routingEcho(d)).toBe("Couldn't match that name, Summon CEO will route it.");
  });
});

// ---- agentHandle ------------------------------------------------------------

describe("agentHandle", () => {
  it("builds a Prefix-urlKey handle", () => {
    const summon = ROSTER[0]!;
    expect(agentHandle(summon, summon.agents[1]!)).toBe("VIT-engineer");
  });
});
