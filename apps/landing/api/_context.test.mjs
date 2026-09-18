// node --test apps/landing/api/_context.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { findUrl, gatherSiteFacts, factsToPrompt } from "./_context.mjs";

const html = (body, title = "Acme") => `<html><head><title>${title}</title><meta name="description" content="We fix roofs"></head><body>${body}</body></html>`;
const fakeFetch = (routes) => async (url) => {
  const hit = routes[url];
  if (!hit) return { ok: false, status: 404, text: async () => "" };
  return { ok: true, status: 200, text: async () => hit };
};

test("findUrl reads explicit URLs, bare domains, and nothing", () => {
  assert.equal(findUrl("see https://acme.com/about please"), "https://acme.com");
  assert.equal(findUrl("I run acme-roofing.co in Guam"), "https://acme-roofing.co");
  assert.equal(findUrl("a two-person landscaping company"), null);
});

test("no URL means no fetch and no prompt block", async () => {
  let called = false;
  const facts = await gatherSiteFacts("a bakery", async () => { called = true; });
  assert.equal(facts, null);
  assert.equal(called, false);
  assert.equal(factsToPrompt(null), "");
});

test("facts carry prices, calls to action, proof, and their source URL", async () => {
  const facts = await gatherSiteFacts("acme.com", fakeFetch({
    "https://acme.com/": html("<p>Roof repair. Book a call today. Trusted by 40 homeowners.</p>"),
    "https://acme.com/pricing": html("<p>Inspection $149. Full repair from $2,400.</p>"),
    "https://acme.com/robots.txt": "User-agent: *\nAllow: /",
  }));
  assert.equal(facts.pages.length, 2);
  assert.deepEqual(facts.pages[1].prices, ["$149", "$2,400"]);
  assert.deepEqual(facts.pages[0].calls, ["Book a call"]);
  assert.deepEqual(facts.pages[0].proof, ["Trusted by"]);
  const prompt = factsToPrompt(facts);
  assert.match(prompt, /https:\/\/acme\.com\/pricing \(HTTP 200\)/);
  assert.match(prompt, /prices seen: \$149, \$2,400/);
  assert.equal(facts.robotsDisallowsAll, false);
});

test("an unreadable site is reported as unreadable, not described", async () => {
  const facts = await gatherSiteFacts("https://down.example", async () => { throw new Error("ECONNREFUSED"); });
  assert.equal(facts.pages.length, 0);
  assert.equal(facts.errors.length, 2);
  assert.match(factsToPrompt(facts), /could not be read/);
});

test("next-step links are read from hrefs, not only from button words", async () => {
  const facts = await gatherSiteFacts("acme.com", fakeFetch({
    "https://acme.com/": html('<a href="/contact">Start a project</a><a href="https://buy.stripe.com/abc123">Pay</a>'),
  }));
  assert.deepEqual(facts.pages[0].nextStepLinks, ["/contact", "https://buy.stripe.com/abc123"]);
  assert.deepEqual(facts.pages[0].calls, []);
});
