#!/usr/bin/env node
// Summon MCP server — "even from within a Claude Code session it can see all
// that Summon sees" (board, 2026-07-18).
//
// A dependency-free MCP stdio server (newline-delimited JSON-RPC 2.0) wrapping
// the local control plane at http://127.0.0.1:3100/api. Registered for this
// repo via the project-scoped .mcp.json; register globally with:
//   claude mcp add --scope user summon -- node <repo>/scripts/summon-mcp-server.mjs
//
// Tools are the board's own verbs: see companies/tasks/agents, file and comment
// tasks, watch the fleet, and pull the kill switch. Comment/create tools note
// their side effects honestly (a comment on an assigned task WAKES the agent).

import readline from "node:readline";

const API = process.env.SUMMON_API_URL ?? "http://127.0.0.1:3100/api";
const PROTOCOL_VERSION = "2025-06-18";

async function api(path, init) {
  const res = await fetch(`${API}${path}`, init);
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path} -> ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}

const post = (path, body) =>
  api(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

async function resolveCompany(ref) {
  const companies = await api("/companies");
  const needle = (ref ?? "").trim().toLowerCase();
  const company = companies.find(
    (c) => c.id === ref || c.issuePrefix.toLowerCase() === needle || c.name.toLowerCase() === needle,
  );
  if (!company) {
    throw new Error(
      `Unknown company "${ref}". Available: ${companies.map((c) => `${c.name} (${c.issuePrefix})`).join(", ")}`,
    );
  }
  return company;
}

const trimTask = (t) => ({
  identifier: t.identifier,
  title: t.title,
  status: t.status,
  priority: t.priority,
  assigneeAgentId: t.assigneeAgentId,
  updatedAt: t.updatedAt,
});

const TOOLS = [
  {
    name: "summon_companies",
    description:
      "List every company on the Summon control plane: name, ticket prefix, operating mode (manual/always_on), status, monthly spend.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    run: async () => {
      const companies = await api("/companies");
      return companies.map((c) => ({
        name: c.name,
        prefix: c.issuePrefix,
        id: c.id,
        operatingMode: c.operatingMode,
        status: c.status,
        spentMonthlyCents: c.spentMonthlyCents,
      }));
    },
  },
  {
    name: "summon_tasks",
    description:
      "List a company's tasks. company = name or ticket prefix (e.g. 'SUM', 'Regain'). Optional status filter (backlog|todo|in_progress|in_review|blocked|done).",
    inputSchema: {
      type: "object",
      properties: {
        company: { type: "string" },
        status: { type: "string" },
      },
      required: ["company"],
      additionalProperties: false,
    },
    run: async ({ company, status }) => {
      const c = await resolveCompany(company);
      const tasks = await api(`/companies/${c.id}/issues`);
      const filtered = status ? tasks.filter((t) => t.status === status) : tasks;
      return { company: c.name, count: filtered.length, tasks: filtered.map(trimTask) };
    },
  },
  {
    name: "summon_task",
    description: "Read one task in full (description + comments) by its identifier, e.g. 'SUM-137' or 'REG-1'.",
    inputSchema: {
      type: "object",
      properties: { identifier: { type: "string" } },
      required: ["identifier"],
      additionalProperties: false,
    },
    run: async ({ identifier }) => {
      const prefix = identifier.split("-")[0];
      const c = await resolveCompany(prefix);
      const tasks = await api(`/companies/${c.id}/issues`);
      const task = tasks.find((t) => t.identifier === identifier);
      if (!task) throw new Error(`No task ${identifier} in ${c.name}`);
      const comments = await api(`/issues/${task.id}/comments?companyId=${c.id}`);
      return {
        ...trimTask(task),
        description: task.description,
        comments: comments.map((m) => ({ authorType: m.authorType, createdAt: m.createdAt, body: m.body })),
      };
    },
  },
  {
    name: "summon_create_task",
    description:
      "File a new task in a company (status todo, unassigned — filing never wakes an agent). priority: critical|high|medium|low.",
    inputSchema: {
      type: "object",
      properties: {
        company: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
      },
      required: ["company", "title"],
      additionalProperties: false,
    },
    run: async ({ company, title, description, priority }) => {
      const c = await resolveCompany(company);
      const task = await post(`/companies/${c.id}/issues`, {
        title,
        description: description ?? "",
        status: "todo",
        priority: priority ?? "medium",
      });
      return { created: task.identifier, company: c.name };
    },
  },
  {
    name: "summon_comment",
    description:
      "Comment on a task by identifier. SIDE EFFECT: if the task has an assignee, a comment WAKES that agent to act (this is Summon's wake mechanic) — say so before using it on assigned tasks.",
    inputSchema: {
      type: "object",
      properties: {
        identifier: { type: "string" },
        body: { type: "string" },
      },
      required: ["identifier", "body"],
      additionalProperties: false,
    },
    run: async ({ identifier, body }) => {
      const prefix = identifier.split("-")[0];
      const c = await resolveCompany(prefix);
      const tasks = await api(`/companies/${c.id}/issues`);
      const task = tasks.find((t) => t.identifier === identifier);
      if (!task) throw new Error(`No task ${identifier} in ${c.name}`);
      await post(`/issues/${task.id}/comments?companyId=${c.id}`, { body });
      return { commented: identifier, wakes: Boolean(task.assigneeAgentId) };
    },
  },
  {
    name: "summon_agents",
    description: "List a company's AI employees: name, role, status (idle/running/paused/error), adapter.",
    inputSchema: {
      type: "object",
      properties: { company: { type: "string" } },
      required: ["company"],
      additionalProperties: false,
    },
    run: async ({ company }) => {
      const c = await resolveCompany(company);
      const agents = await api(`/companies/${c.id}/agents`);
      return agents.map((a) => ({ name: a.name, role: a.role, status: a.status, adapterType: a.adapterType }));
    },
  },
  {
    name: "summon_fleet_running",
    description: "Everything live or queued across the whole fleet right now (the RUNNING NOW panel's data).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    run: () => api("/fleet/running"),
  },
  {
    name: "summon_fleet_stop",
    description:
      "THE KILL SWITCH. One sweep: pause every agent, cancel queued wakes, cancel active runs. Scope to one company by name/prefix or omit for the entire fleet. Destructive to in-flight work — confirm with the human first.",
    inputSchema: {
      type: "object",
      properties: {
        company: { type: "string" },
        reason: { type: "string" },
      },
      additionalProperties: false,
    },
    run: async ({ company, reason }) => {
      const companyId = company ? (await resolveCompany(company)).id : null;
      return post("/fleet/stop", { companyId, reason: reason ?? "Kill switch via Summon MCP" });
    },
  },
];

function respond(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}
function respondError(id, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32000, message } }) + "\n");
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg;
  try { msg = JSON.parse(trimmed); } catch { return; }
  const { id, method, params } = msg;

  try {
    if (method === "initialize") {
      respond(id, {
        protocolVersion: params?.protocolVersion ?? PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "summon", version: "1.0.0" },
      });
    } else if (method === "notifications/initialized" || method?.startsWith("notifications/")) {
      // notifications carry no id and expect no response
    } else if (method === "ping") {
      respond(id, {});
    } else if (method === "tools/list") {
      respond(id, {
        tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
      });
    } else if (method === "tools/call") {
      const tool = TOOLS.find((t) => t.name === params?.name);
      if (!tool) throw new Error(`Unknown tool: ${params?.name}`);
      const result = await tool.run(params?.arguments ?? {});
      respond(id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
    } else if (id !== undefined) {
      respondError(id, `Method not supported: ${method}`);
    }
  } catch (error) {
    if (id !== undefined) respondError(id, error instanceof Error ? error.message : String(error));
  }
});
