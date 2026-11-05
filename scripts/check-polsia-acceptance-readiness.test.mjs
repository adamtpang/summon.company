import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  inspectAcceptanceReadiness,
  parseParityRows,
  validateAcceptanceManifest,
  validateAcceptanceReceipt
} from "./check-polsia-acceptance-readiness.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function sampleEntry(overrides = {}) {
  return {
    id: "sample-acceptance",
    outcome: "Sample provider outcome",
    authority: "board_explicit",
    providers: ["sample_provider"],
    allowedEnvironments: ["test"],
    disposableResourceTypes: ["company"],
    requiredEvidence: ["authorization", "readback", "cleanup"],
    allowedMutations: ["create_disposable_company"],
    cleanupRequired: true,
    boundary: "Only the named disposable company may be changed during this acceptance.",
    ...overrides
  };
}

function sampleReceipt(entry, artifactName, sha256, overrides = {}) {
  const observedAt = "2026-08-30T12:00:00.000Z";
  return {
    schemaVersion: 1,
    acceptanceId: entry.id,
    outcome: entry.outcome,
    result: "pass",
    executedAt: observedAt,
    environment: "test",
    authorization: {
      grantedBy: "Adam",
      grantedAt: observedAt,
      scope: "Disposable acceptance only",
      reference: "local-approval-1"
    },
    disposableResources: [{ type: "company", id: "company-disposable-1" }],
    mutations: ["create_disposable_company"],
    evidence: entry.requiredEvidence.map((kind) => ({
      kind,
      observedAt,
      summary: `${kind} verified`,
      artifactPath: artifactName,
      sha256
    })),
    redactionsVerified: true,
    cleanup: {
      status: "complete",
      summary: "Disposable resources removed",
      completedAt: observedAt
    },
    ...overrides
  };
}

test("the real manifest covers every blocked parity outcome exactly once", () => {
  const ledger = readFileSync(path.join(rootDir, "FEATURE-PARITY.md"), "utf8");
  const manifest = JSON.parse(readFileSync(path.join(rootDir, "doc", "research", "polsia-acceptance-manifest.json"), "utf8"));
  const blockedRows = parseParityRows(ledger);
  assert.equal(blockedRows.length, 22);
  assert.doesNotThrow(() => validateAcceptanceManifest(manifest, blockedRows));
  assert.equal(manifest.outcomes.length, 22);
});

test("missing receipts remain visibly awaiting authorization without fabricating failure", () => {
  const receiptRoot = mkdtempSync(path.join(tmpdir(), "summon-polsia-acceptance-empty-"));
  try {
    const entry = sampleEntry();
    const manifest = {
      schemaVersion: 1,
      verifiedAt: "2026-08-30",
      receiptDirectory: receiptRoot,
      outcomes: [entry]
    };
    const result = inspectAcceptanceReadiness({
      manifest,
      blockedRows: [{ outcome: entry.outcome }],
      receiptRoot
    });
    assert.deepEqual(result.counts, { awaiting_authorization: 1 });
    assert.equal(result.outcomes[0].status, "awaiting_authorization");
  } finally {
    rmSync(receiptRoot, { recursive: true, force: true });
  }
});

test("a passing receipt requires exact artifacts, declared mutations, redaction, and cleanup", () => {
  const receiptRoot = mkdtempSync(path.join(tmpdir(), "summon-polsia-acceptance-pass-"));
  try {
    const artifactName = "receipt.txt";
    const artifact = Buffer.from("safe provider evidence\n");
    writeFileSync(path.join(receiptRoot, artifactName), artifact);
    const sha256 = createHash("sha256").update(artifact).digest("hex");
    const entry = sampleEntry();
    const receipt = sampleReceipt(entry, artifactName, sha256);
    assert.doesNotThrow(() => validateAcceptanceReceipt(receipt, entry, receiptRoot));
  } finally {
    rmSync(receiptRoot, { recursive: true, force: true });
  }
});

test("a receipt cannot smuggle a credential field or credential-like value", () => {
  const entry = sampleEntry();
  const receipt = sampleReceipt(entry, "receipt.txt", "a".repeat(64), {
    provider_token: "sk_test_should_never_be_here"
  });
  assert.throws(
    () => validateAcceptanceReceipt(receipt, entry, ".", { verifyArtifacts: false }),
    /forbidden credential field/
  );
});

test("undeclared mutations and incomplete cleanup cannot produce a pass", () => {
  const entry = sampleEntry();
  const base = sampleReceipt(entry, "receipt.txt", "a".repeat(64));
  assert.throws(
    () => validateAcceptanceReceipt({ ...base, mutations: ["touch_real_customer"] }, entry, ".", { verifyArtifacts: false }),
    /undeclared mutations/
  );
  assert.throws(
    () => validateAcceptanceReceipt({ ...base, cleanup: { status: "pending", summary: "Not finished" } }, entry, ".", { verifyArtifacts: false }),
    /cleanup must be complete/
  );
});

test("a failed authorized acceptance may retain partial evidence without becoming accepted", () => {
  const entry = sampleEntry();
  const base = sampleReceipt(entry, "receipt.txt", "a".repeat(64));
  const partial = {
    ...base,
    result: "fail",
    disposableResources: [],
    mutations: [],
    evidence: [base.evidence[0]],
    cleanup: { status: "pending", summary: "No provider resource was created" }
  };
  assert.doesNotThrow(() => validateAcceptanceReceipt(partial, entry, ".", { verifyArtifacts: false }));
});
