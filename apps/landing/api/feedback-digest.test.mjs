// Tests for the weekly feedback digest (SUM-192, item 4). Built-in runner, no
// deps:  node --test apps/landing/api/feedback-digest.test.mjs
//
// The handler reads process.env at call time and reaches the board only through
// global fetch, so we stub both, exactly like feedback.test.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import handler, { buildDigest, renderDigest } from "./feedback-digest.mjs";

const REAL_FETCH = globalThis.fetch;
const REAL_ENV = { ...process.env };

function configureBoard() {
  process.env.SUMMON_API_URL = "https://summon.company";
  process.env.SUMMON_API_KEY = "test-key";
  process.env.SUMMON_SUM_COMPANY_ID = "company-123";
  process.env.SUMMON_HAVEN_AGENT_ID = "haven-agent-9";
  process.env.FEEDBACK_DIGEST_TOKEN = "digest-token";
}

function mockReqRes(method, body, headers = {}) {
  const req = { method, body, headers };
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

const WEEK = "2026-W29";
function weekTickets() {
  return [
    { id: "t-acme", title: `Customer feedback: 2/5 · acme · ${WEEK} [fb:acme:${WEEK}]`, description: "Stars: 2/5\nWhy not a 5: slow onboarding" },
    { id: "t-beta", title: `Customer feedback: 5/5 · beta · ${WEEK} [fb:beta:${WEEK}]`, description: "Stars: 5/5\nPerfect score." },
    { id: "t-gamma", title: `Customer feedback: 4/5 · gamma · ${WEEK} [fb:gamma:${WEEK}]`, description: "Stars: 4/5\nWhy not a 5: minor bug" },
  ];
}

test.afterEach(() => {
  globalThis.fetch = REAL_FETCH;
  process.env = { ...REAL_ENV };
});

test("OPTIONS preflight returns 204", async () => {
  const { req, res } = mockReqRes("OPTIONS");
  await handler(req, res);
  assert.equal(res.statusCode, 204);
});

test("non-POST is rejected 405", async () => {
  const { req, res } = mockReqRes("GET");
  await handler(req, res);
  assert.equal(res.statusCode, 405);
});

test("digest is fail-closed: missing/bad token is 401 with no board call", async () => {
  configureBoard();
  const calls = stubFetch([{ match: () => true, json: [] }]);
  const { req, res } = mockReqRes("POST", { week: WEEK }, { "x-feedback-token": "nope" });
  await handler(req, res);
  assert.equal(res.statusCode, 401);
  assert.equal(calls.length, 0);
});

test("503 when board credentials are absent (even with a valid token)", async () => {
  process.env.FEEDBACK_DIGEST_TOKEN = "digest-token"; // token set, board not
  const { req, res } = mockReqRes("POST", { week: WEEK }, { "x-feedback-token": "digest-token" });
  await handler(req, res);
  assert.equal(res.statusCode, 503);
});

test("bad week shape is 400", async () => {
  configureBoard();
  const { req, res } = mockReqRes("POST", { week: "week-29" }, { "x-feedback-token": "digest-token" });
  await handler(req, res);
  assert.equal(res.statusCode, 400);
});

test("first run creates one digest ticket routed to Haven with average and detractors", async () => {
  configureBoard();
  const calls = stubFetch([
    { match: (u, m) => m === "GET" && u.includes("/issues?"), json: weekTickets() },
    { match: (u, m) => m === "POST" && u.endsWith("/issues"), status: 201, json: { id: "digest-1" } },
  ]);
  const { req, res } = mockReqRes("POST", { week: WEEK }, { "x-feedback-token": "digest-token" });
  await handler(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.status, "created");
  assert.equal(res.body.count, 3);
  assert.ok(Math.abs(res.body.average - 11 / 3) < 1e-9, "average is (2+5+4)/3");
  assert.equal(res.body.detractors, 1);

  const create = calls.find((c) => c.method === "POST" && c.url.endsWith("/issues"));
  assert.match(create.body.title, /\[fbdigest:2026-W29\]/, "carries the digest marker");
  assert.match(create.body.title, /3 instances/);
  assert.match(create.body.title, /avg 3\.67/);
  assert.equal(create.body.assigneeAgentId, "haven-agent-9", "routed to Haven");
  assert.equal(create.body.priority, "high", "detractors present -> high priority");
  assert.match(create.body.description, /acme · 2\/5 · slow onboarding/, "detractor listed with reason");
  assert.match(create.body.description, /\[4\/5\] gamma: minor bug/, "verbatim captured");
  assert.doesNotMatch(create.body.description, /beta:/, "a 5/5 has no why-not-a-5 verbatim");
});

test("re-run refreshes the existing digest via a comment (no duplicate ticket)", async () => {
  configureBoard();
  const existing = { id: "digest-1", title: `Weekly feedback digest: 3 instances · avg 3.67/5 · ${WEEK} [fbdigest:${WEEK}]` };
  const calls = stubFetch([
    { match: (u, m) => m === "GET" && u.includes("/issues?"), json: [...weekTickets(), existing] },
    { match: (u, m) => m === "POST" && u.includes("/comments"), status: 200, json: {} },
  ]);
  const { req, res } = mockReqRes("POST", { week: WEEK }, { "x-feedback-token": "digest-token" });
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, "refreshed");
  assert.equal(res.body.issueId, "digest-1");
  const comment = calls.find((c) => c.method === "POST" && c.url.includes("/comments"));
  assert.ok(comment, "refresh posts a comment");
  assert.match(comment.body.body, /Digest refreshed/);
  assert.match(comment.body.body, /Average stars: 3\.67/);
  assert.ok(!calls.some((c) => c.method === "POST" && c.url.endsWith("/issues")), "never creates a second ticket");
});

test("empty week renders a clean 'no feedback' digest", async () => {
  configureBoard();
  const calls = stubFetch([
    { match: (u, m) => m === "GET" && u.includes("/issues?"), json: [] },
    { match: (u, m) => m === "POST" && u.endsWith("/issues"), status: 201, json: { id: "digest-empty" } },
  ]);
  const { req, res } = mockReqRes("POST", { week: WEEK }, { "x-feedback-token": "digest-token" });
  await handler(req, res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.count, 0);
  const create = calls.find((c) => c.method === "POST" && c.url.endsWith("/issues"));
  assert.match(create.body.description, /No customer feedback submitted this week/);
  assert.equal(create.body.priority, "medium", "no detractors -> medium");
});

test("buildDigest falls back to fetching detail when the list omits description", async () => {
  configureBoard();
  stubFetch([
    {
      match: (u, m) => m === "GET" && u.includes("/issues?"),
      json: [{ id: "t-acme", title: `Customer feedback: 1/5 · acme · ${WEEK} [fb:acme:${WEEK}]` }], // no description
    },
    { match: (u, m) => m === "GET" && u.includes("/issues/t-acme"), json: { id: "t-acme", description: "Why not a 5: it broke" } },
  ]);
  const d = await buildDigest("https://summon.company", "company-123", WEEK);
  assert.equal(d.n, 1);
  assert.equal(d.rows[0].why, "it broke");
  assert.match(renderDigest(d), /Average stars: 1\.00/);
});
