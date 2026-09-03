import test from "node:test";
import assert from "node:assert/strict";

import {
  collectParityOutcomes,
  collectPublicContentFingerprints,
  collectPublicSurface,
  comparePublicSurface,
  validatePublicSurfaceCoverage,
} from "./check-polsia-parity-drift.mjs";

const baseline = {
  verifiedAt: "2026-08-30",
  guideCategoryCount: 1,
  faqCategoryCount: 1,
  guideSlugs: ["getting-started", "run-a-task-now"],
  faqIds: ["ct-1", "gs-1"],
  guideContentSha256: {
    "getting-started": "a".repeat(64),
    "run-a-task-now": "b".repeat(64),
  },
  faqContentSha256: {
    "ct-1": "c".repeat(64),
    "gs-1": "d".repeat(64),
  },
};

function currentSurface(overrides = {}) {
  return {
    guideCategoryCount: 1,
    faqCategoryCount: 1,
    guideSlugs: ["getting-started", "run-a-task-now"],
    faqIds: ["ct-1", "gs-1"],
    guideContentSha256: { ...baseline.guideContentSha256 },
    faqContentSha256: { ...baseline.faqContentSha256 },
    ...overrides,
  };
}

test("collectPublicSurface returns sorted public identifiers and ignores drafts", () => {
  const current = collectPublicSurface(
    {
      categories: [
        {
          items: [
            { slug: "run-a-task-now", draft: false },
            { slug: "future-draft", draft: true },
            { slug: "getting-started", draft: false },
          ],
        },
      ],
    },
    {
      categories: [{ entries: [{ id: "gs-1" }, { id: "ct-1" }] }],
    },
  );

  assert.deepEqual(current, {
    guideCategoryCount: 1,
    faqCategoryCount: 1,
    guideSlugs: ["getting-started", "run-a-task-now"],
    faqIds: ["ct-1", "gs-1"],
  });
});

test("comparePublicSurface reports an exact match", () => {
  const result = comparePublicSurface(baseline, currentSurface());

  assert.equal(result.status, "match");
  assert.deepEqual(result.changes.addedGuideSlugs, []);
  assert.deepEqual(result.changes.removedFaqIds, []);
  assert.deepEqual(result.changes.changedGuideSlugs, []);
  assert.deepEqual(result.changes.changedFaqIds, []);
});

test("comparePublicSurface reports additions, removals, and category drift", () => {
  const result = comparePublicSurface(baseline, currentSurface({
    guideCategoryCount: 2,
    faqCategoryCount: 1,
    guideSlugs: ["getting-started", "new-capability"],
    faqIds: ["gs-1", "zz-1"],
    guideContentSha256: {
      "getting-started": "a".repeat(64),
      "new-capability": "e".repeat(64),
    },
    faqContentSha256: {
      "gs-1": "d".repeat(64),
      "zz-1": "f".repeat(64),
    },
  }));

  assert.equal(result.status, "drift");
  assert.equal(result.changes.guideCategoryCountChanged, true);
  assert.deepEqual(result.changes.addedGuideSlugs, ["new-capability"]);
  assert.deepEqual(result.changes.removedGuideSlugs, ["run-a-task-now"]);
  assert.deepEqual(result.changes.addedFaqIds, ["zz-1"]);
  assert.deepEqual(result.changes.removedFaqIds, ["ct-1"]);
});

test("comparePublicSurface reports changed guide and FAQ content under stable identifiers", () => {
  const result = comparePublicSurface(
    baseline,
    currentSurface({
      guideContentSha256: {
        ...baseline.guideContentSha256,
        "run-a-task-now": "e".repeat(64),
      },
      faqContentSha256: {
        ...baseline.faqContentSha256,
        "gs-1": "f".repeat(64),
      },
    }),
  );

  assert.equal(result.status, "drift");
  assert.deepEqual(result.changes.changedGuideSlugs, ["run-a-task-now"]);
  assert.deepEqual(result.changes.changedFaqIds, ["gs-1"]);
});

test("content fingerprints normalize line endings but reject mismatched article identity", () => {
  const faq = {
    categories: [
      {
        entries: [
          {
            id: "gs-1",
            question: "How do I begin?",
            answers: { noTrial: "Start now", trialEligible: "Start now" },
          },
        ],
      },
    ],
  };
  const lf = collectPublicContentFingerprints(
    ["getting-started"],
    {
      "getting-started": {
        slug: "getting-started",
        title: "Getting started",
        category: "Basics",
        summary: "A beginning",
        body: "First\nSecond",
        draft: false,
      },
    },
    faq,
  );
  const crlf = collectPublicContentFingerprints(
    ["getting-started"],
    {
      "getting-started": {
        slug: "getting-started",
        title: "Getting started",
        category: "Basics",
        summary: "A beginning",
        body: "First\r\nSecond  ",
        draft: false,
      },
    },
    faq,
  );

  assert.deepEqual(lf, crlf);
  assert.match(lf.guideContentSha256["getting-started"], /^[a-f0-9]{64}$/);
  assert.throws(
    () =>
      collectPublicContentFingerprints(
        ["getting-started"],
        {
          "getting-started": {
            slug: "wrong-guide",
            title: "Getting started",
            category: "Basics",
            summary: "A beginning",
            body: "First",
            draft: false,
          },
        },
        faq,
      ),
    /wrong slug/,
  );
});

test("collectPublicSurface rejects duplicate or malformed identifiers", () => {
  assert.throws(
    () =>
      collectPublicSurface(
        { categories: [{ items: [{ slug: "same-guide" }, { slug: "same-guide" }] }] },
        { categories: [{ entries: [{ id: "gs-1" }] }] },
      ),
    /duplicate identifiers/,
  );
  assert.throws(
    () =>
      collectPublicSurface(
        { categories: [{ items: [{ slug: "../unsafe" }] }] },
        { categories: [{ entries: [{ id: "gs-1" }] }] },
      ),
    /slug is invalid/,
  );
});

test("coverage requires every guide and FAQ to reference a real parity outcome", () => {
  const parityOutcomes = collectParityOutcomes(`
## Capability map

| Founder outcome | Summon status | Current Summon evidence | Remaining proof or implementation |
| --- | --- | --- | --- |
| Create a company | match | receipt | none |
| Run work | blocked by evidence | source | live proof |

## Current verdict
`);

  assert.deepEqual(parityOutcomes, ["Create a company", "Run work"]);
  assert.deepEqual(
    validatePublicSurfaceCoverage(
      baseline,
      {
        schemaVersion: 1,
        verifiedAt: "2026-08-30",
        guideOutcomes: {
          "getting-started": ["Create a company"],
          "run-a-task-now": ["Run work"],
        },
        faqOutcomes: {
          "ct-1": ["Run work"],
          "gs-1": ["Create a company"],
        },
      },
      parityOutcomes,
    ),
    {
      verifiedAt: "2026-08-30",
      mappedGuides: 2,
      mappedFaqEntries: 2,
      parityOutcomes: 2,
    },
  );
});

test("coverage fails on unmapped identifiers and invented outcomes", () => {
  assert.throws(
    () => validatePublicSurfaceCoverage(
      baseline,
      {
        schemaVersion: 1,
        guideOutcomes: { "getting-started": ["Create a company"] },
        faqOutcomes: { "ct-1": ["Run work"], "gs-1": ["Create a company"] },
      },
      ["Create a company", "Run work"],
    ),
    /coverage mismatch.*run-a-task-now/,
  );

  assert.throws(
    () => validatePublicSurfaceCoverage(
      baseline,
      {
        schemaVersion: 1,
        guideOutcomes: {
          "getting-started": ["Invented outcome"],
          "run-a-task-now": ["Run work"],
        },
        faqOutcomes: { "ct-1": ["Run work"], "gs-1": ["Create a company"] },
      },
      ["Create a company", "Run work"],
    ),
    /unknown parity outcome: Invented outcome/,
  );
});
