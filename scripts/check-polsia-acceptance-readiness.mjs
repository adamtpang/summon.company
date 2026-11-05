import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ACCEPTANCE_STATUS = "blocked by evidence";
const ALLOWED_AUTHORITIES = new Set(["board_explicit", "operator_explicit"]);
const ALLOWED_ENVIRONMENTS = new Set(["test", "production"]);
const ALLOWED_EVIDENCE_KINDS = new Set([
  "authorization",
  "before",
  "provider_identity",
  "request",
  "provider_response",
  "readback",
  "after",
  "business_outcome",
  "cost",
  "redaction",
  "cleanup",
  "physical_device",
  "store_receipt",
  "workspace_linkage",
  "private_checkout",
  "task_outcome",
  "commit_readback"
]);
const FORBIDDEN_KEY = /(^|_)(token|password|secret|api_key|key_hash|credential_value|cookie)(_|$)/i;
const FORBIDDEN_VALUE = /(sk_(?:live|test)_[A-Za-z0-9]+|ghp_[A-Za-z0-9]+|github_pat_[A-Za-z0-9_]+|xoxb-[A-Za-z0-9-]+|Bearer\s+[A-Za-z0-9._~-]+|postgres(?:ql)?:\/\/[^\s"']+)/i;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function uniqueStrings(value, label, { allowEmpty = false } = {}) {
  assert(Array.isArray(value), `${label} must be an array`);
  assert(allowEmpty || value.length > 0, `${label} must not be empty`);
  assert(value.every((item) => typeof item === "string" && item.trim() === item && item.length > 0), `${label} must contain trimmed non-empty strings`);
  assert(new Set(value).size === value.length, `${label} must not contain duplicates`);
  return value;
}

function parseIso(value, label) {
  assert(typeof value === "string" && !Number.isNaN(Date.parse(value)), `${label} must be an ISO timestamp`);
  return value;
}

export function parseParityRows(markdown) {
  const rows = [];
  for (const line of markdown.split(/\r?\n/)) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 4 || cells[1] !== ACCEPTANCE_STATUS) continue;
    rows.push({ outcome: cells[0], evidence: cells[2], remaining: cells[3] });
  }
  return rows;
}

export function validateAcceptanceManifest(manifest, blockedRows) {
  assert(isPlainObject(manifest), "Acceptance manifest must be an object");
  assert(manifest.schemaVersion === 1, "Acceptance manifest schemaVersion must be 1");
  parseIso(`${manifest.verifiedAt}T00:00:00.000Z`, "Acceptance manifest verifiedAt");
  assert(typeof manifest.receiptDirectory === "string" && manifest.receiptDirectory.length > 0, "receiptDirectory is required");
  assert(Array.isArray(manifest.outcomes), "Acceptance manifest outcomes must be an array");

  const blockedNames = blockedRows.map((row) => row.outcome);
  assert(new Set(blockedNames).size === blockedNames.length, "Parity ledger contains duplicate blocked outcomes");
  const ids = new Set();
  const names = new Set();
  for (const [index, entry] of manifest.outcomes.entries()) {
    const label = `outcomes[${index}]`;
    assert(isPlainObject(entry), `${label} must be an object`);
    assert(typeof entry.id === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id), `${label}.id must be kebab-case`);
    assert(!ids.has(entry.id), `Duplicate acceptance id: ${entry.id}`);
    ids.add(entry.id);
    assert(typeof entry.outcome === "string" && entry.outcome.length > 0, `${label}.outcome is required`);
    assert(!names.has(entry.outcome), `Duplicate acceptance outcome: ${entry.outcome}`);
    names.add(entry.outcome);
    assert(ALLOWED_AUTHORITIES.has(entry.authority), `${entry.id}: invalid authority`);
    uniqueStrings(entry.providers, `${entry.id}.providers`);
    uniqueStrings(entry.allowedEnvironments, `${entry.id}.allowedEnvironments`);
    assert(entry.allowedEnvironments.every((value) => ALLOWED_ENVIRONMENTS.has(value)), `${entry.id}: invalid environment`);
    uniqueStrings(entry.disposableResourceTypes, `${entry.id}.disposableResourceTypes`);
    uniqueStrings(entry.requiredEvidence, `${entry.id}.requiredEvidence`);
    assert(entry.requiredEvidence.every((value) => ALLOWED_EVIDENCE_KINDS.has(value)), `${entry.id}: invalid evidence kind`);
    uniqueStrings(entry.allowedMutations, `${entry.id}.allowedMutations`, { allowEmpty: true });
    assert(typeof entry.cleanupRequired === "boolean", `${entry.id}.cleanupRequired must be boolean`);
    assert(typeof entry.boundary === "string" && entry.boundary.length >= 20, `${entry.id}.boundary is required`);
  }

  const missing = blockedNames.filter((outcome) => !names.has(outcome));
  const extra = [...names].filter((outcome) => !blockedNames.includes(outcome));
  assert(missing.length === 0, `Acceptance manifest is missing blocked outcomes: ${missing.join("; ")}`);
  assert(extra.length === 0, `Acceptance manifest includes non-blocked outcomes: ${extra.join("; ")}`);
  assert(manifest.outcomes.length === blockedRows.length, `Expected ${blockedRows.length} acceptance entries, found ${manifest.outcomes.length}`);
  return manifest;
}

function assertNoSecrets(value, location = "receipt") {
  if (typeof value === "string") {
    assert(!FORBIDDEN_VALUE.test(value), `${location} contains a credential-like value`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSecrets(item, `${location}[${index}]`));
    return;
  }
  if (!isPlainObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    assert(!FORBIDDEN_KEY.test(key), `${location}.${key} is a forbidden credential field`);
    assertNoSecrets(child, `${location}.${key}`);
  }
}

function artifactSha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

export function validateAcceptanceReceipt(receipt, entry, receiptRoot, { verifyArtifacts = true } = {}) {
  assert(isPlainObject(receipt), `${entry.id}: receipt must be an object`);
  assertNoSecrets(receipt, entry.id);
  assert(receipt.schemaVersion === 1, `${entry.id}: receipt schemaVersion must be 1`);
  assert(receipt.acceptanceId === entry.id, `${entry.id}: acceptanceId mismatch`);
  assert(receipt.outcome === entry.outcome, `${entry.id}: outcome mismatch`);
  assert(["pass", "fail", "blocked"].includes(receipt.result), `${entry.id}: invalid result`);
  parseIso(receipt.executedAt, `${entry.id}.executedAt`);
  assert(entry.allowedEnvironments.includes(receipt.environment), `${entry.id}: environment ${receipt.environment} is not allowed`);
  assert(isPlainObject(receipt.authorization), `${entry.id}: authorization is required`);
  parseIso(receipt.authorization.grantedAt, `${entry.id}.authorization.grantedAt`);
  assert(typeof receipt.authorization.grantedBy === "string" && receipt.authorization.grantedBy.length > 0, `${entry.id}: authorization.grantedBy is required`);
  assert(typeof receipt.authorization.scope === "string" && receipt.authorization.scope.length > 0, `${entry.id}: authorization.scope is required`);
  assert(typeof receipt.authorization.reference === "string" && receipt.authorization.reference.length > 0, `${entry.id}: authorization.reference is required`);

  assert(Array.isArray(receipt.disposableResources), `${entry.id}: disposableResources must be an array`);
  const resourceTypes = new Set();
  for (const [index, resource] of receipt.disposableResources.entries()) {
    assert(isPlainObject(resource), `${entry.id}.disposableResources[${index}] must be an object`);
    assert(typeof resource.type === "string" && resource.type.length > 0, `${entry.id}: resource type is required`);
    assert(typeof resource.id === "string" && resource.id.length > 0, `${entry.id}: resource id is required`);
    assert(entry.disposableResourceTypes.includes(resource.type), `${entry.id}: undeclared disposable resource type ${resource.type}`);
    resourceTypes.add(resource.type);
  }
  if (receipt.result === "pass") {
    for (const type of entry.disposableResourceTypes) {
      assert(resourceTypes.has(type), `${entry.id}: missing disposable resource type ${type}`);
    }
  }

  const mutations = uniqueStrings(receipt.mutations, `${entry.id}.mutations`, { allowEmpty: true });
  const undeclaredMutations = mutations.filter((mutation) => !entry.allowedMutations.includes(mutation));
  assert(undeclaredMutations.length === 0, `${entry.id}: undeclared mutations: ${undeclaredMutations.join(", ")}`);

  assert(Array.isArray(receipt.evidence), `${entry.id}: evidence must be an array`);
  assert(receipt.evidence.length > 0, `${entry.id}: evidence must not be empty`);
  const evidenceKinds = new Set();
  for (const [index, evidence] of receipt.evidence.entries()) {
    const label = `${entry.id}.evidence[${index}]`;
    assert(isPlainObject(evidence), `${label} must be an object`);
    assert(ALLOWED_EVIDENCE_KINDS.has(evidence.kind), `${label}.kind is invalid`);
    evidenceKinds.add(evidence.kind);
    parseIso(evidence.observedAt, `${label}.observedAt`);
    assert(typeof evidence.summary === "string" && evidence.summary.length > 0, `${label}.summary is required`);
    assert(typeof evidence.artifactPath === "string" && evidence.artifactPath.length > 0, `${label}.artifactPath is required`);
    assert(typeof evidence.sha256 === "string" && /^[a-f0-9]{64}$/.test(evidence.sha256), `${label}.sha256 is invalid`);
    if (verifyArtifacts) {
      const resolvedRoot = path.resolve(receiptRoot);
      const artifactPath = path.resolve(resolvedRoot, evidence.artifactPath);
      assert(artifactPath.startsWith(`${resolvedRoot}${path.sep}`), `${label}.artifactPath escapes the receipt directory`);
      assert(existsSync(artifactPath) && statSync(artifactPath).isFile(), `${label}.artifactPath does not exist`);
      assert(artifactSha256(artifactPath) === evidence.sha256, `${label}.sha256 does not match the artifact`);
    }
  }
  if (receipt.result === "pass") {
    for (const kind of entry.requiredEvidence) {
      assert(evidenceKinds.has(kind), `${entry.id}: missing required evidence kind ${kind}`);
    }
  }
  assert(receipt.redactionsVerified === true, `${entry.id}: redactionsVerified must be true`);
  assert(isPlainObject(receipt.cleanup), `${entry.id}: cleanup is required`);
  assert(["complete", "not_applicable", "pending"].includes(receipt.cleanup.status), `${entry.id}: invalid cleanup status`);
  assert(typeof receipt.cleanup.summary === "string" && receipt.cleanup.summary.length > 0, `${entry.id}: cleanup.summary is required`);
  if (entry.cleanupRequired && receipt.result === "pass") {
    assert(receipt.cleanup.status === "complete", `${entry.id}: cleanup must be complete before pass`);
    parseIso(receipt.cleanup.completedAt, `${entry.id}.cleanup.completedAt`);
  }
  if (!entry.cleanupRequired && receipt.result === "pass") {
    assert(["complete", "not_applicable"].includes(receipt.cleanup.status), `${entry.id}: cleanup cannot be pending on pass`);
  }
  return receipt;
}

export function inspectAcceptanceReadiness({ manifest, blockedRows, receiptRoot, verifyArtifacts = true }) {
  validateAcceptanceManifest(manifest, blockedRows);
  const byId = new Map(manifest.outcomes.map((entry) => [entry.id, entry]));
  const foundFiles = existsSync(receiptRoot)
    ? readdirSync(receiptRoot).filter((name) => name.endsWith(".json")).sort()
    : [];
  const unexpectedFiles = foundFiles.filter((name) => !byId.has(name.slice(0, -5)));
  assert(unexpectedFiles.length === 0, `Unexpected acceptance receipt files: ${unexpectedFiles.join(", ")}`);

  const outcomes = manifest.outcomes.map((entry) => {
    const receiptPath = path.join(receiptRoot, `${entry.id}.json`);
    if (!existsSync(receiptPath)) {
      return { id: entry.id, outcome: entry.outcome, status: "awaiting_authorization", receiptPath };
    }
    const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
    validateAcceptanceReceipt(receipt, entry, receiptRoot, { verifyArtifacts });
    return {
      id: entry.id,
      outcome: entry.outcome,
      status: receipt.result === "pass" ? "accepted" : receipt.result,
      receiptPath,
      executedAt: receipt.executedAt
    };
  });
  const counts = outcomes.reduce((result, outcome) => {
    result[outcome.status] = (result[outcome.status] ?? 0) + 1;
    return result;
  }, {});
  return { outcomes, counts };
}

function parseArgs(argv) {
  const args = { requireComplete: false, json: false, receiptDirectory: null };
  for (const arg of argv) {
    if (arg === "--require-complete") args.requireComplete = true;
    else if (arg === "--json") args.json = true;
    else if (arg.startsWith("--receipts=")) args.receiptDirectory = arg.slice("--receipts=".length);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

export function runAcceptanceReadiness({ rootDir, args }) {
  const ledgerPath = path.join(rootDir, "FEATURE-PARITY.md");
  const manifestPath = path.join(rootDir, "doc", "research", "polsia-acceptance-manifest.json");
  const blockedRows = parseParityRows(readFileSync(ledgerPath, "utf8"));
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const receiptRoot = path.resolve(rootDir, args.receiptDirectory ?? manifest.receiptDirectory);
  const result = inspectAcceptanceReadiness({ manifest, blockedRows, receiptRoot });
  const summary = {
    status: result.counts.accepted === blockedRows.length ? "complete" : "awaiting_evidence",
    blockedParityOutcomes: blockedRows.length,
    receiptDirectory: path.relative(rootDir, receiptRoot).replaceAll("\\", "/"),
    counts: result.counts,
    outcomes: result.outcomes.map(({ receiptPath, ...outcome }) => ({
      ...outcome,
      receiptPath: path.relative(rootDir, receiptPath).replaceAll("\\", "/")
    }))
  };
  if (args.json) process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  else {
    console.log(`Polsia parity acceptance readiness: ${summary.status}`);
    console.log(`  Blocked outcomes: ${summary.blockedParityOutcomes}`);
    console.log(`  Accepted: ${summary.counts.accepted ?? 0}`);
    console.log(`  Awaiting authorization/evidence: ${(summary.counts.awaiting_authorization ?? 0) + (summary.counts.blocked ?? 0) + (summary.counts.fail ?? 0)}`);
    console.log(`  Receipt directory: ${summary.receiptDirectory}`);
    for (const outcome of summary.outcomes) console.log(`  - ${outcome.status}: ${outcome.id}`);
  }
  if (args.requireComplete && summary.status !== "complete") process.exitCode = 1;
  return summary;
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentFile)) {
  const rootDir = path.resolve(path.dirname(currentFile), "..");
  runAcceptanceReadiness({ rootDir, args: parseArgs(process.argv.slice(2)) });
}
