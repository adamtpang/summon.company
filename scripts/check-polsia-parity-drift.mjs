import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

const HELP_ORIGIN = "https://help.polsia.com";
const NAV_URL = `${HELP_ORIGIN}/api/v2/help-center/nav`;
const FAQ_URL = `${HELP_ORIGIN}/api/v2/help-center/faq`;
const BASELINE_URL = new URL("../doc/research/polsia-public-surface-baseline.json", import.meta.url);
const COVERAGE_URL = new URL("../doc/research/polsia-public-surface-coverage.json", import.meta.url);
const FEATURE_PARITY_URL = new URL("../FEATURE-PARITY.md", import.meta.url);
const MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_ARTICLE_RESPONSE_BYTES = 64 * 1024;
const ARTICLE_FETCH_CONCURRENCY = 6;
const REQUEST_TIMEOUT_MS = 30_000;

function requireArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

function requireRecord(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function requireIdentifier(value, label, pattern) {
  if (typeof value !== "string" || !pattern.test(value)) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

function sortedUnique(values, label) {
  const unique = new Set(values);
  if (unique.size !== values.length) throw new Error(`${label} contains duplicate identifiers`);
  return [...unique].sort((left, right) => left.localeCompare(right));
}

function normalizePublicText(value, label, maxLength = 128_000) {
  if (typeof value !== "string") throw new Error(`${label} must be text`);
  if (value.length > maxLength) throw new Error(`${label} exceeds ${maxLength} characters`);
  return value
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trim();
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function requireFingerprintMap(rawMap, expectedIds, label) {
  const map = requireRecord(rawMap, `${label} fingerprint map`);
  const ids = sortedUnique(Object.keys(map), `${label} fingerprint identifiers`);
  const missing = setDifference(expectedIds, ids);
  const stale = setDifference(ids, expectedIds);
  if (missing.length > 0 || stale.length > 0) {
    throw new Error(
      `${label} fingerprint mismatch (missing: ${missing.join(", ") || "none"}; stale: ${stale.join(", ") || "none"})`,
    );
  }
  for (const id of ids) {
    requireIdentifier(map[id], `${label} ${id} fingerprint`, /^[a-f0-9]{64}$/);
  }
  return map;
}

export function collectPublicSurface(navPayload, faqPayload) {
  const navCategories = requireArray(navPayload?.categories, "navigation categories");
  const faqCategories = requireArray(faqPayload?.categories, "FAQ categories");

  const guideSlugs = [];
  for (const [categoryIndex, category] of navCategories.entries()) {
    const items = requireArray(category?.items, `navigation category ${categoryIndex} items`);
    for (const [itemIndex, item] of items.entries()) {
      if (item?.draft === true) continue;
      guideSlugs.push(
        requireIdentifier(
          item?.slug,
          `navigation category ${categoryIndex} item ${itemIndex} slug`,
          /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        ),
      );
    }
  }

  const faqIds = [];
  for (const [categoryIndex, category] of faqCategories.entries()) {
    const entries = requireArray(category?.entries, `FAQ category ${categoryIndex} entries`);
    for (const [entryIndex, entry] of entries.entries()) {
      faqIds.push(
        requireIdentifier(entry?.id, `FAQ category ${categoryIndex} entry ${entryIndex} id`, /^[a-z]{2}-\d+$/),
      );
    }
  }

  return {
    guideCategoryCount: navCategories.length,
    faqCategoryCount: faqCategories.length,
    guideSlugs: sortedUnique(guideSlugs, "guide list"),
    faqIds: sortedUnique(faqIds, "FAQ list"),
  };
}

export function collectPublicContentFingerprints(guideSlugs, guideArticles, faqPayload) {
  const articles = requireRecord(guideArticles, "guide articles");
  const articleSlugs = sortedUnique(Object.keys(articles), "guide article identifiers");
  const missingArticles = setDifference(guideSlugs, articleSlugs);
  const staleArticles = setDifference(articleSlugs, guideSlugs);
  if (missingArticles.length > 0 || staleArticles.length > 0) {
    throw new Error(
      `guide article mismatch (missing: ${missingArticles.join(", ") || "none"}; stale: ${staleArticles.join(", ") || "none"})`,
    );
  }

  const guideContentSha256 = {};
  for (const slug of guideSlugs) {
    const article = requireRecord(articles[slug], `guide article ${slug}`);
    if (article.slug !== slug) throw new Error(`guide article ${slug} returned the wrong slug`);
    if (article.draft !== false) throw new Error(`guide article ${slug} is not public`);
    guideContentSha256[slug] = sha256(
      JSON.stringify({
        slug,
        title: normalizePublicText(article.title, `guide article ${slug} title`, 500),
        category: normalizePublicText(article.category, `guide article ${slug} category`, 500),
        summary: normalizePublicText(article.summary, `guide article ${slug} summary`, 2_000),
        body: normalizePublicText(article.body, `guide article ${slug} body`),
      }),
    );
  }

  const faqCategories = requireArray(faqPayload?.categories, "FAQ categories");
  const faqContentSha256 = {};
  for (const [categoryIndex, category] of faqCategories.entries()) {
    const entries = requireArray(category?.entries, `FAQ category ${categoryIndex} entries`);
    for (const [entryIndex, entry] of entries.entries()) {
      const id = requireIdentifier(
        entry?.id,
        `FAQ category ${categoryIndex} entry ${entryIndex} id`,
        /^[a-z]{2}-\d+$/,
      );
      if (faqContentSha256[id]) throw new Error("FAQ fingerprint list contains duplicate identifiers");
      const answers = requireRecord(entry?.answers, `FAQ ${id} answers`);
      const normalizedAnswers = {};
      for (const key of Object.keys(answers).sort((left, right) => left.localeCompare(right))) {
        requireIdentifier(key, `FAQ ${id} answer key`, /^[a-z][A-Za-z0-9]{0,63}$/);
        normalizedAnswers[key] = normalizePublicText(answers[key], `FAQ ${id} answer ${key}`, 16_000);
      }
      if (Object.keys(normalizedAnswers).length === 0) throw new Error(`FAQ ${id} has no answers`);
      faqContentSha256[id] = sha256(
        JSON.stringify({
          id,
          question: normalizePublicText(entry.question, `FAQ ${id} question`, 2_000),
          answers: normalizedAnswers,
        }),
      );
    }
  }

  return { guideContentSha256, faqContentSha256 };
}

function setDifference(left, right) {
  const rightSet = new Set(right);
  return left.filter((value) => !rightSet.has(value));
}

export function comparePublicSurface(baseline, current) {
  const baselineGuideFingerprints = requireFingerprintMap(
    baseline.guideContentSha256,
    baseline.guideSlugs,
    "baseline guide",
  );
  const currentGuideFingerprints = requireFingerprintMap(
    current.guideContentSha256,
    current.guideSlugs,
    "current guide",
  );
  const baselineFaqFingerprints = requireFingerprintMap(
    baseline.faqContentSha256,
    baseline.faqIds,
    "baseline FAQ",
  );
  const currentFaqFingerprints = requireFingerprintMap(
    current.faqContentSha256,
    current.faqIds,
    "current FAQ",
  );
  const addedGuideSlugs = setDifference(current.guideSlugs, baseline.guideSlugs);
  const removedGuideSlugs = setDifference(baseline.guideSlugs, current.guideSlugs);
  const addedFaqIds = setDifference(current.faqIds, baseline.faqIds);
  const removedFaqIds = setDifference(baseline.faqIds, current.faqIds);
  const changedGuideSlugs = baseline.guideSlugs.filter(
    (slug) => currentGuideFingerprints[slug] && baselineGuideFingerprints[slug] !== currentGuideFingerprints[slug],
  );
  const changedFaqIds = baseline.faqIds.filter(
    (id) => currentFaqFingerprints[id] && baselineFaqFingerprints[id] !== currentFaqFingerprints[id],
  );
  const guideCategoryCountChanged = current.guideCategoryCount !== baseline.guideCategoryCount;
  const faqCategoryCountChanged = current.faqCategoryCount !== baseline.faqCategoryCount;
  const drift =
    guideCategoryCountChanged ||
    faqCategoryCountChanged ||
    addedGuideSlugs.length > 0 ||
    removedGuideSlugs.length > 0 ||
    addedFaqIds.length > 0 ||
    removedFaqIds.length > 0 ||
    changedGuideSlugs.length > 0 ||
    changedFaqIds.length > 0;

  return {
    status: drift ? "drift" : "match",
    baselineVerifiedAt: baseline.verifiedAt,
    guideCategories: current.guideCategoryCount,
    guides: current.guideSlugs.length,
    faqCategories: current.faqCategoryCount,
    faqEntries: current.faqIds.length,
    changes: {
      guideCategoryCountChanged,
      faqCategoryCountChanged,
      addedGuideSlugs,
      removedGuideSlugs,
      addedFaqIds,
      removedFaqIds,
      changedGuideSlugs,
      changedFaqIds,
    },
    fingerprints: {
      guides: Object.keys(currentGuideFingerprints).length,
      faqEntries: Object.keys(currentFaqFingerprints).length,
    },
  };
}

export function collectParityOutcomes(markdown) {
  if (typeof markdown !== "string") throw new Error("FEATURE-PARITY.md must be text");
  const statuses = new Set(["match", "partial", "missing", "not relevant", "blocked by evidence"]);
  const outcomes = [];
  let inCapabilityMap = false;

  for (const line of markdown.split(/\r?\n/)) {
    if (line === "## Capability map") {
      inCapabilityMap = true;
      continue;
    }
    if (line === "## Current verdict") break;
    if (!inCapabilityMap || !line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 2 || !statuses.has(cells[1])) continue;
    outcomes.push(cells[0]);
  }

  if (outcomes.length === 0) throw new Error("FEATURE-PARITY.md has no capability outcomes");
  return sortedUnique(outcomes, "parity outcome list");
}

function validateOutcomeCoverageMap(expectedIds, rawCoverageMap, parityOutcomeSet, label) {
  const coverageMap = requireRecord(rawCoverageMap, `${label} coverage`);
  const coverageIds = sortedUnique(Object.keys(coverageMap), `${label} coverage identifiers`);
  const missing = setDifference(expectedIds, coverageIds);
  const stale = setDifference(coverageIds, expectedIds);
  if (missing.length > 0 || stale.length > 0) {
    throw new Error(
      `${label} coverage mismatch (missing: ${missing.join(", ") || "none"}; stale: ${stale.join(", ") || "none"})`,
    );
  }

  for (const id of coverageIds) {
    const outcomes = requireArray(coverageMap[id], `${label} ${id} outcomes`);
    if (outcomes.length === 0) throw new Error(`${label} ${id} must map to at least one parity outcome`);
    const normalized = outcomes.map((outcome, index) =>
      requireIdentifier(outcome, `${label} ${id} outcome ${index}`, /^.{3,160}$/),
    );
    sortedUnique(normalized, `${label} ${id} outcome list`);
    for (const outcome of normalized) {
      if (!parityOutcomeSet.has(outcome)) {
        throw new Error(`${label} ${id} references unknown parity outcome: ${outcome}`);
      }
    }
  }

  return coverageIds.length;
}

export function validatePublicSurfaceCoverage(baseline, coverage, parityOutcomes) {
  const parsed = requireRecord(coverage, "public surface coverage");
  if (parsed.schemaVersion !== 1) throw new Error("public surface coverage schemaVersion must be 1");
  const parityOutcomeSet = new Set(parityOutcomes);
  const mappedGuides = validateOutcomeCoverageMap(
    baseline.guideSlugs,
    parsed.guideOutcomes,
    parityOutcomeSet,
    "guide",
  );
  const mappedFaqEntries = validateOutcomeCoverageMap(
    baseline.faqIds,
    parsed.faqOutcomes,
    parityOutcomeSet,
    "FAQ",
  );
  return {
    verifiedAt: parsed.verifiedAt,
    mappedGuides,
    mappedFaqEntries,
    parityOutcomes: parityOutcomes.length,
  };
}

async function fetchJson(url, maxResponseBytes = MAX_RESPONSE_BYTES) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "summon-company-public-parity-audit/1.0",
      },
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
    if (new URL(response.url).origin !== HELP_ORIGIN) throw new Error(`${url} left the approved public origin`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      throw new Error(`${url} did not return JSON`);
    }
    const body = await response.text();
    if (Buffer.byteLength(body, "utf8") > maxResponseBytes) {
      throw new Error(`${url} exceeded ${maxResponseBytes} bytes`);
    }
    return JSON.parse(body);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchGuideArticles(guideSlugs) {
  const articles = {};
  for (let index = 0; index < guideSlugs.length; index += ARTICLE_FETCH_CONCURRENCY) {
    const slugs = guideSlugs.slice(index, index + ARTICLE_FETCH_CONCURRENCY);
    const batch = await Promise.all(
      slugs.map(async (slug) => ({
        slug,
        article: await fetchJson(
          `${HELP_ORIGIN}/api/v2/help-center/articles/${encodeURIComponent(slug)}`,
          MAX_ARTICLE_RESPONSE_BYTES,
        ),
      })),
    );
    for (const { slug, article } of batch) articles[slug] = article;
  }
  return articles;
}

export async function runPublicParityAudit() {
  const [baselineText, coverageText, featureParityMarkdown, navPayload, faqPayload] = await Promise.all([
    readFile(BASELINE_URL, "utf8"),
    readFile(COVERAGE_URL, "utf8"),
    readFile(FEATURE_PARITY_URL, "utf8"),
    fetchJson(NAV_URL),
    fetchJson(FAQ_URL),
  ]);
  const baseline = JSON.parse(baselineText);
  const coverage = JSON.parse(coverageText);
  const parityOutcomes = collectParityOutcomes(featureParityMarkdown);
  const coverageResult = validatePublicSurfaceCoverage(baseline, coverage, parityOutcomes);
  const currentIdentifiers = collectPublicSurface(navPayload, faqPayload);
  const guideArticles = await fetchGuideArticles(currentIdentifiers.guideSlugs);
  const fingerprints = collectPublicContentFingerprints(
    currentIdentifiers.guideSlugs,
    guideArticles,
    faqPayload,
  );
  const current = { ...currentIdentifiers, ...fingerprints };
  return {
    ...comparePublicSurface(baseline, current),
    coverage: coverageResult,
  };
}

async function main() {
  try {
    const result = await runPublicParityAudit();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.status !== "match") process.exitCode = 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Polsia public parity audit failed: ${message}\n`);
    process.exitCode = 2;
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) await main();
