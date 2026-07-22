// Tests for the hosted feedback intake (SUM-190). Runs on the built-in Node
// test runner with no extra deps:  node --test apps/landing/api/feedback.test.mjs
//
// The handler reads process.env at call time and talks to the vendor board only
// through global fetch, so we stub both. Every case uses a distinct instanceId
// so the module-level rate-limit map never bleeds across tests.
import test from "node:test";
import assert from "node:assert/strict";
import handler from "./feedback.mjs";

const REAL_FETCH = globalThis.fetch;
const REAL_ENV = { ...process.env };

function configureBoard() {
  process.env.SUMMON_API_URL = "https://summon.company";
  process.env.SUMMON_API_KEY = "test-key";
  process.env.SUMMON_SUM_COMPANY_ID = "company-123";
  process.env.SUMMON_HAVEN_AGENT_ID = "haven-agent-9";
}

function clearBoard() {
  delete process.env.SUMMON_API_URL;
  delete process.env.SUMMON_API_KEY;
  delete process.env.SUMMON_SUM_COMPANY_ID;
  delete process.env.SUMMON_HAVEN_AGENT_ID;
}

/** Minimal Vercel-style req/res doubles that capture what the handler emits. */
function mockReqRes(method, body) {
  const req = { method, body, headers: {} };
  const res = {
    statusCode: null,
    headers: {},
    body: undefined,
    ended: false,
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      this.body = obj;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
  return { req, res };
}

/** Record every fetch and reply per a scripted route table. */
function stubFetch(routes) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method ?? "GET", body: init.body ? JSON.parse(init.body) : null });
    for (const route of routes) {
      if (route.match(String(url), init.method ?? "GET")) {
        return {
          ok: route.ok ?? true,
          status: route.status ?? 200,
          async json() {
            return route.json ?? {};
          },
          async text() {
            return route.text ?? "";
          },
        };
      }
    }
    throw new Error(`unstubbed fetch: ${init.method ?? "GET"} ${url}`);
  };
  return calls;
}

test.afterEach(() => {
  globalThis.fetch = REAL_FETCH;
  process.env = { ...REAL_ENV };
});

test("OPTIONS preflight returns 204 with CORS headers", async () => {
  const { req, res } = mockReqRes("OPTIONS");
  await handler(req, res);
  assert.equal(res.statusCode, 204);
  assert.equal(res.headers["Access-Control-Allow-Origin"], "*");
});

test("non-POST is rejected 405", async () => {
  const { req, res } = mockReqRes("GET");
  await handler(req, res);
  assert.equal(res.statusCode, 405);
});

test("fail-closed 503 when board credentials are absent", async () => {
  clearBoard();
  const { req, res } = mockReqRes("POST", { instanceId: "a", rating: 3, week: "2026-W29" });
  await handler(req, res);
  assert.equal(res.statusCode, 503);
});

test("validation: bad instanceId, rating, and week each 400", async () => {
  configureBoard();
  for (const [payload, field] of [
    [{ instanceId: "bad id!", rating: 3, week: "2026-W29" }, "instanceId"],
    [{ instanceId: "ok", rating: 9, week: "2026-W29" }, "rating"],
    [{ instanceId: "ok", rating: 3, week: "week29" }, "week"],
  ]) {
    const { req, res } = mockReqRes("POST", payload);
    await handler(req, res);
    assert.equal(res.statusCode, 400, `expected 400 for bad ${field}`);
  }
});

test("first submission creates one ticket routed to Haven with the dedupe marker", async () => {
  configureBoard();
  const calls = stubFetch([
    { match: (u, m) => m === "GET" && u.includes("/issues?"), json: [] },
    { match: (u, m) => m === "POST" && u.endsWith("/issues"), status: 201, json: { id: "issue-1" } },
  ]);
  const { req, res } = mockReqRes("POST", {
    instanceId: "acme-inc",
    rating: 2,
    why: "onboarding was slow",
    week: "2026-W29",
    context: "/board · 2026-07-22T10:00:00Z",
  });
  await handler(req, res);

  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body, { status: "created", issueId: "issue-1" });

  const create = calls.find((c) => c.method === "POST" && c.url.endsWith("/issues"));
  assert.ok(create, "expected a create-issue POST");
  assert.match(create.body.title, /\[fb:acme-inc:2026-W29\]/, "title carries the dedupe marker");
  assert.equal(create.body.assigneeAgentId, "haven-agent-9", "routed to Haven");
  assert.equal(create.body.priority, "high", "rating <=2 is high priority");
  assert.match(create.body.description, /onboarding was slow/);
});

test("second submission for the same instance+week appends a digest comment", async () => {
  configureBoard();
  const calls = stubFetch([
    {
      match: (u, m) => m === "GET" && u.includes("/issues?"),
      json: [{ id: "issue-1", title: "Customer feedback: 2/5 · acme-inc · 2026-W29 [fb:acme-inc:2026-W29]" }],
    },
    { match: (u, m) => m === "POST" && u.includes("/comments"), status: 200, json: {} },
  ]);
  const { req, res } = mockReqRes("POST", {
    instanceId: "acme-inc",
    rating: 4,
    why: "much better now",
    week: "2026-W29",
    context: "/board",
  });
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { status: "appended", issueId: "issue-1" });
  const comment = calls.find((c) => c.method === "POST" && c.url.includes("/comments"));
  assert.ok(comment, "expected a digest comment POST");
  assert.match(comment.body.body, /much better now/);
});

test("rate limit trips after the per-instance window budget", async () => {
  configureBoard();
  stubFetch([
    { match: (u, m) => m === "GET" && u.includes("/issues?"), json: [] },
    { match: (u, m) => m === "POST" && u.endsWith("/issues"), status: 201, json: { id: "x" } },
  ]);
  let last = 200;
  for (let i = 0; i < 8; i += 1) {
    const { req, res } = mockReqRes("POST", { instanceId: "flooder", rating: 5, week: "2026-W29" });
    await handler(req, res);
    last = res.statusCode;
  }
  assert.equal(last, 429, "an eighth rapid submission is rate limited");
});

test("PII hygiene: why is length-capped and no IP/header is written to the ticket", async () => {
  configureBoard();
  const calls = stubFetch([
    { match: (u, m) => m === "GET" && u.includes("/issues?"), json: [] },
    { match: (u, m) => m === "POST" && u.endsWith("/issues"), status: 201, json: { id: "issue-2" } },
  ]);
  const huge = "x".repeat(5000);
  const { req, res } = mockReqRes("POST", {
    instanceId: "cap-test",
    rating: 1,
    why: huge,
    week: "2026-W29",
    context: "y".repeat(5000),
  });
  req.headers["x-forwarded-for"] = "203.0.113.7";
  await handler(req, res);

  const create = calls.find((c) => c.method === "POST" && c.url.endsWith("/issues"));
  const whyLine = create.body.description.split("\n").find((l) => l.startsWith("Why not a 5:"));
  assert.ok(whyLine.length <= "Why not a 5: ".length + 1000, "why is capped at 1000 chars");
  assert.ok(!create.body.description.includes("203.0.113.7"), "client IP never reaches the ticket");
});
