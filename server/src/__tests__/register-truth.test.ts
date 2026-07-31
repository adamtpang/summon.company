import { describe, expect, it } from "vitest";

import { parseMarkdownRegister, parseChecklistRegister } from "../services/register-truth-parsers.js";
import { classify, measure, requiresHumanReview, type ProbeResult } from "../services/register-truth.js";

const REGISTER = `## P0 — Blocking

| #    | Finding | Evidence | Verified |
| ---- | ------- | -------- | -------- |
| P0-2 | **Nightly warehouse build is dead code.** \`scheduleBatchEtl()\` has zero call sites. | \`apps/queue/src/queues/bi-etl.ts:1936\`, no invocation in \`apps/queue/src/index.ts\` | ✓ |
| P0-8 | **RU mode leaks English.** ~53 empty \`msgstr\`. | \`apps/admin/messages/ru.po:21925-22638\` | ✓ |
`;

function probe(partial: Partial<ProbeResult>): ProbeResult {
  return {
    file: "a.ts",
    countAtRegister: 0,
    countAtHead: 0,
    verdict: "unchanged",
    ...partial,
  };
}

describe("register parsers", () => {
  it("reads finding rows out of a markdown table, skipping header and separator", () => {
    const findings = parseMarkdownRegister(REGISTER);
    expect(findings.map((f) => f.id)).toEqual(["P0-2", "P0-8"]);
  });

  it("extracts the file paths a row names", () => {
    const [first] = parseMarkdownRegister(REGISTER);
    expect(first.files).toContain("apps/queue/src/queues/bi-etl.ts");
    expect(first.files).toContain("apps/queue/src/index.ts");
  });

  it("extracts symbols but not paths as probe candidates", () => {
    const [first] = parseMarkdownRegister(REGISTER);
    expect(first.symbols).toContain("scheduleBatchEtl");
    expect(first.symbols.some((s) => s.endsWith(".ts"))).toBe(false);
  });

  it("parses checkbox registers too", () => {
    const findings = parseChecklistRegister("- [ ] SEC-1 fix the thing\n- [x] SEC-2 done thing");
    expect(findings).toHaveLength(2);
    expect(findings[0].claimedStatus).toBe("open");
    expect(findings[1].claimedStatus).toBe("done");
  });
});

describe("measure", () => {
  it("counts literal occurrences", () => {
    expect(measure("a b a b a", { file: "x", needle: "a" })).toBe(3);
  });

  it("counts regex matches inside a line range only", () => {
    const content = ['msgstr ""', 'msgstr "x"', 'msgstr ""', 'msgstr ""'].join("\n");
    expect(measure(content, { file: "x", pattern: '^msgstr ""$' })).toBe(3);
    expect(measure(content, { file: "x", pattern: '^msgstr ""$', lines: [1, 2] })).toBe(1);
  });
});

describe("marker-anchored ranges survive the file moving", () => {
  const region = ['#: surfaces/executive.tsx', 'msgid "a"', 'msgstr ""', "// END-EXEC"].join("\n");
  const probe = {
    file: "x.po",
    pattern: '^msgstr ""$',
    anchor: { start: "#: surfaces/executive.tsx", end: "// END-EXEC" },
  };

  it("measures the same region after the file GROWS above it", () => {
    const before = measure(region, probe);
    const grown = ["new".repeat(10), "padding", "lines", region].join("\n");
    expect(measure(grown, probe)).toBe(before);
    expect(before).toBe(1);
  });

  it("measures the same region after the file SHRINKS above it", () => {
    const padded = ["junk", "junk", region].join("\n");
    expect(measure(padded, probe)).toBe(measure(region, probe));
  });

  it("measures the same region after the region MOVES to the end", () => {
    const moved = ["a", "b", "c", "d", "e", region].join("\n");
    expect(measure(moved, probe)).toBe(1);
  });

  it("returns null rather than zero when the anchor is gone", () => {
    expect(measure("nothing here", probe)).toBeNull();
  });

  it("a fixed line range drifts where an anchor does not, which was the P0-8 bug", () => {
    const fixed = { file: "x.po", pattern: '^msgstr ""$', lines: [1, 4] as [number, number] };
    const grown = ["padding", "padding", region].join("\n");
    expect(measure(grown, fixed)).toBe(0); // window slid off the real content
    expect(measure(grown, probe)).toBe(1); // anchor still finds it
  });
});

describe("block scanning", () => {
  const po = [
    "#: dashboards/executive/page.tsx",
    'msgid "a"',
    'msgstr ""',
    "",
    "#: settings/other.tsx",
    'msgid "b"',
    'msgstr ""',
    "",
    "#: dashboards/executive/board-packets/page.tsx",
    'msgid "c"',
    'msgstr "готово"',
  ].join("\n");

  it("counts only blocks whose context matches", () => {
    const value = measure(po, {
      file: "ru.po",
      blockContext: "dashboards/executive",
      pattern: '^msgstr ""$',
    });
    expect(value).toBe(1);
  });

  it("ignores matching lines in blocks that are out of scope", () => {
    const value = measure(po, {
      file: "ru.po",
      blockContext: "nothing-matches-this",
      pattern: '^msgstr ""$',
    });
    expect(value).toBe(0);
  });
});

describe("classify", () => {
  it("closes when every probe is satisfied", () => {
    const result = classify("dead code, no call sites", [
      probe({ countAtRegister: 0, countAtHead: 1, verdict: "satisfied" }),
    ]);
    expect(result.status).toBe("closed");
  });

  it("reports partial when a quantity only improved", () => {
    const result = classify("53 empty translations", [
      probe({ countAtRegister: 37, countAtHead: 7, verdict: "improved" }),
    ]);
    expect(result.status).toBe("partial");
  });

  it("never auto-closes a security finding, even with satisfied evidence", () => {
    const result = classify("Route authz missing, patient PHI exposure", [
      probe({ countAtRegister: 2, countAtHead: 7, verdict: "satisfied" }),
    ]);
    expect(result.status).toBe("needs_human");
    expect(result.humanReason).toMatch(/never auto-closed/i);
  });

  it("calls a row contradicted when nothing moved but evidence is present", () => {
    const result = classify("consumer ignores the real prefix", [
      probe({ countAtRegister: 3, countAtHead: 3, verdict: "unchanged" }),
    ]);
    expect(result.status).toBe("contradicted");
  });

  it("asks for a human when no probe could be derived", () => {
    expect(classify("three disagreeing revenue numbers", []).status).toBe("needs_human");
  });
});

describe("requiresHumanReview", () => {
  it.each(["RBAC gate missing", "leaks PHI", "payment token exposed"])("flags %s", (claim) => {
    expect(requiresHumanReview(claim)).toBe(true);
  });

  it("leaves ordinary findings alone", () => {
    expect(requiresHumanReview("nightly ETL never runs")).toBe(false);
  });
});
