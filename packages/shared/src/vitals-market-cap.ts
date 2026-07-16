// VIT-101: the market-cap model (doc/MARKET-CAP-MODEL.md) as one pure module.
// Market cap ~= ARR x multiple. Pre-revenue the honest cap is option value only.
// The 11x rule applies throughout: no metric the logs cannot prove; $0 shows as $0,
// unknown shows as unknown -- never a placeholder number.

export const VITALS_MARKET_CAP_DOCUMENT_KEY = "market-cap-snapshot";

export const VITALS_PRICE_ANCHOR_CENTS_PER_EMPLOYEE_MO = 9900;

export type MarketCapStageId = "NOW" | "S1" | "S2" | "S3" | "S4" | "S5";

export type MarketCapStage = {
  id: MarketCapStageId;
  proof: string;
  capProxyLabel: string;
};

// doc/MARKET-CAP-MODEL.md section 3 -- the ladder from here to the limit.
export const VITALS_MARKET_CAP_LADDER: readonly MarketCapStage[] = [
  { id: "NOW", proof: "dogfood runs itself + Quantus", capProxyLabel: "option value only" },
  { id: "S1", proof: "first external $99 (a stranger hires 1 employee)", capProxyLabel: "first real datapoint" },
  { id: "S2", proof: "10 companies x 2 employees, NRR>100%", capProxyLabel: "~$100-250K" },
  { id: "S3", proof: "100 companies x 3 employees", capProxyLabel: "~$2-5M" },
  { id: "S4", proof: "1,000 companies x 4, outcome pricing live", capProxyLabel: "~$30-100M (multiple earned)" },
  { id: "S5", proof: 'the category ("every company has a formation")', capProxyLabel: "$1B+" },
];

export type MarketCapLeverKey =
  | "companies"
  | "employeesPerCompany"
  | "price"
  | "retention"
  | "grossMargin"
  | "growth";

export type MarketCapLeverDefinition = {
  key: MarketCapLeverKey;
  label: string;
  ownerDepartment: string;
  how: string;
};

// doc/MARKET-CAP-MODEL.md section 2 -- every lever the board can actually pull.
export const VITALS_MARKET_CAP_LEVERS: readonly MarketCapLeverDefinition[] = [
  {
    key: "companies",
    label: "# companies",
    ownerDepartment: "Marketing/Sales",
    how: "dogfood-in-public, leaderboard, one-line import, client engagements",
  },
  {
    key: "employeesPerCompany",
    label: "Employees per company",
    ownerDepartment: "CEO autopilot + Product",
    how: 'land-and-expand: surface "hire your next employee" moments; NRR > 120%',
  },
  {
    key: "price",
    label: "Price per employee",
    ownerDepartment: "Finance",
    how: "$99/mo anchor vs $70K salary; outcome metering raises effective price",
  },
  {
    key: "retention",
    label: "Retention",
    ownerDepartment: "Support/Success",
    how: "accumulated context + configured employees + memory = switching cost",
  },
  {
    key: "grossMargin",
    label: "Gross margin",
    ownerDepartment: "Finance",
    how: "fuel doctrine: subscription-powered adapters; keep COGS < 20%",
  },
  {
    key: "growth",
    label: "Growth (the multiple)",
    ownerDepartment: "CEO",
    how: "growth rate dominates the multiple; category leadership + public proof",
  },
];

export type MarketCapInputs = {
  /** True only when the numbers below came from a live Stripe read. */
  stripeConnected: boolean;
  /** True when the Stripe read was test-mode data (demo, not external revenue). */
  stripeTestMode?: boolean;
  /** Annualized recurring revenue in cents from real Stripe subscriptions; null = no Stripe read. */
  arrCents: number | null;
  /** Count of distinct paying customers with an active subscription; null = no Stripe read. */
  payingCompanies: number | null;
  /** Companies on the control plane (includes Company Zero dogfood). */
  totalCompanies: number;
  /** AI employees across all companies on the control plane. */
  totalEmployees: number;
  /** Trailing retention rate 0..1; null = no data yet. */
  retentionRate: number | null;
  /** Gross margin percent 0..100; null = no data yet. */
  grossMarginPct: number | null;
  /** ARR growth over the trailing 30 days, percent; null = no data yet. */
  arrGrowth30dPct: number | null;
};

export type MarketCapLeverRow = MarketCapLeverDefinition & {
  /** Human-honest current value, e.g. "$0", "2 companies (0 paying)", "no data yet". */
  currentValue: string;
  /** True when the value is proven by a real system read rather than unknown. */
  proven: boolean;
};

export type MarketCapSnapshot = {
  generatedAt: string;
  stage: MarketCapStage;
  arrCents: number | null;
  arrLabel: string;
  capProxyLabel: string;
  multipleLabel: string;
  evidenceGaps: string[];
  bindingLever: {
    key: MarketCapLeverKey;
    statement: string;
  };
  levers: MarketCapLeverRow[];
  inputs: MarketCapInputs;
};

export function formatUsdFromCents(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 10_000) return `$${Math.round(dollars / 1000)}K`;
  return `$${dollars.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function resolveMarketCapStage(inputs: MarketCapInputs): MarketCapStage {
  const arr = inputs.arrCents ?? 0;
  const paying = inputs.payingCompanies ?? 0;
  if (arr >= 100_000_000 * 100) return VITALS_MARKET_CAP_LADDER[5];
  if (paying >= 1000) return VITALS_MARKET_CAP_LADDER[4];
  if (paying >= 100) return VITALS_MARKET_CAP_LADDER[3];
  if (paying >= 10) return VITALS_MARKET_CAP_LADDER[2];
  if (arr > 0) return VITALS_MARKET_CAP_LADDER[1];
  return VITALS_MARKET_CAP_LADDER[0];
}

// Theory of constraints: one binding lever at a time. Pre-revenue it is
// "# companies > 0"; companies stays binding until S3 unless retention or
// margin is measurably broken (doc section 3).
export function resolveBindingLever(inputs: MarketCapInputs): MarketCapSnapshot["bindingLever"] {
  const stage = resolveMarketCapStage(inputs);
  if (stage.id === "NOW") {
    return {
      key: "companies",
      statement: "# companies > 0 — the first externally paid $99 moves the number, not narrative",
    };
  }
  if (inputs.retentionRate !== null && inputs.retentionRate < 0.9) {
    return {
      key: "retention",
      statement: `retention ${(inputs.retentionRate * 100).toFixed(0)}% — churn kills ARR and the multiple twice`,
    };
  }
  if (inputs.grossMarginPct !== null && inputs.grossMarginPct < 80) {
    return {
      key: "grossMargin",
      statement: `gross margin ${inputs.grossMarginPct.toFixed(0)}% — SaaS-grade margins earn SaaS-grade multiples`,
    };
  }
  if (stage.id === "S1" || stage.id === "S2") {
    return {
      key: "companies",
      statement: "# companies — distribution stays binding until ~100 companies (S3)",
    };
  }
  return {
    key: "growth",
    statement: "growth rate — the dominant term in the multiple once distribution works",
  };
}

export function computeMarketCapSnapshot(
  inputs: MarketCapInputs,
  generatedAt: string,
): MarketCapSnapshot {
  const stage = resolveMarketCapStage(inputs);
  const arr = inputs.arrCents ?? 0;

  const evidenceGaps: string[] = [];
  if (!inputs.stripeConnected) evidenceGaps.push("Stripe not connected — ARR unproven, shown as $0");
  if (inputs.stripeTestMode) evidenceGaps.push("Stripe data is TEST MODE — demo, not external revenue");
  if (inputs.retentionRate === null) evidenceGaps.push("retention: no data yet (no paying cohort)");
  if (inputs.grossMarginPct === null) evidenceGaps.push("gross margin: no data yet (per-employee ledger pending)");
  if (inputs.arrGrowth30dPct === null) evidenceGaps.push("growth: no trailing ARR series yet");

  const arrLabel = inputs.stripeConnected
    ? `${formatUsdFromCents(arr)}${inputs.stripeTestMode ? " (test mode)" : ""}`
    : "$0";

  // Multiple is earned by evidence; pre-revenue there is no multiple to price.
  const multipleLabel =
    arr > 0 ? "5-10x ARR (ordinary growth; elite multiples must be earned)" : "no multiple — pre-revenue";

  const capProxyLabel =
    arr > 0
      ? `${formatUsdFromCents(arr * 5)}-${formatUsdFromCents(arr * 10)} (5-10x ARR)${inputs.stripeTestMode ? " — test-mode demo" : ""}`
      : stage.capProxyLabel;

  const paying = inputs.payingCompanies;
  const employeesPerCompany =
    inputs.totalCompanies > 0 ? inputs.totalEmployees / inputs.totalCompanies : 0;

  const values: Record<MarketCapLeverKey, { currentValue: string; proven: boolean }> = {
    companies: {
      currentValue: `${inputs.totalCompanies} on plane (${paying ?? 0} paying)`,
      proven: true,
    },
    employeesPerCompany: {
      currentValue: `${employeesPerCompany.toFixed(1)} avg (${inputs.totalEmployees} employees / ${inputs.totalCompanies} companies)`,
      proven: true,
    },
    price: {
      currentValue: `$${(VITALS_PRICE_ANCHOR_CENTS_PER_EMPLOYEE_MO / 100).toFixed(0)}/employee/mo anchor (0 sold at anchor)`,
      proven: true,
    },
    retention: {
      currentValue:
        inputs.retentionRate === null ? "no data yet" : `${(inputs.retentionRate * 100).toFixed(0)}%`,
      proven: inputs.retentionRate !== null,
    },
    grossMargin: {
      currentValue:
        inputs.grossMarginPct === null ? "no data yet" : `${inputs.grossMarginPct.toFixed(0)}%`,
      proven: inputs.grossMarginPct !== null,
    },
    growth: {
      currentValue:
        inputs.arrGrowth30dPct === null ? "no data yet" : `${inputs.arrGrowth30dPct.toFixed(0)}% (30d)`,
      proven: inputs.arrGrowth30dPct !== null,
    },
  };

  return {
    generatedAt,
    stage,
    arrCents: inputs.stripeConnected ? arr : null,
    arrLabel,
    capProxyLabel,
    multipleLabel,
    evidenceGaps,
    bindingLever: resolveBindingLever(inputs),
    levers: VITALS_MARKET_CAP_LEVERS.map((lever) => ({ ...lever, ...values[lever.key] })),
    inputs,
  };
}

// --- Lever regressions -> CEO autopilot (VIT-71) ------------------------------
// Dumb + legible rules first (VIT-71 doctrine). Each regression is a filable,
// starred, evidenced problem assigned to the lever's owner department.

export type MarketCapLeverRegressionKind = "churn_event" | "margin_drift" | "growth_stall";

export type MarketCapLeverRegression = {
  kind: MarketCapLeverRegressionKind;
  leverKey: MarketCapLeverKey;
  title: string;
  why: string;
  evidence: string;
  ownerDepartment: string;
  importanceStars: number;
  urgencyStars: number;
};

export function detectLeverRegressions(
  prev: MarketCapSnapshot | null,
  curr: MarketCapSnapshot,
): MarketCapLeverRegression[] {
  const regressions: MarketCapLeverRegression[] = [];
  const prevIn = prev?.inputs ?? null;
  const currIn = curr.inputs;

  // Churn event: a paying company left, or measured retention fell below 90%.
  const paidDropped =
    prevIn?.payingCompanies != null &&
    currIn.payingCompanies != null &&
    currIn.payingCompanies < prevIn.payingCompanies;
  const retentionBroke = currIn.retentionRate !== null && currIn.retentionRate < 0.9;
  if (paidDropped || retentionBroke) {
    regressions.push({
      kind: "churn_event",
      leverKey: "retention",
      title: "A paying company churned — retention lever regressed",
      why: "Churn kills the multiple twice: ARR now and the multiple forever.",
      evidence: paidDropped
        ? `paying companies ${prevIn?.payingCompanies} -> ${currIn.payingCompanies}`
        : `retention ${(currIn.retentionRate! * 100).toFixed(0)}% < 90% floor`,
      ownerDepartment: "Support/Success",
      importanceStars: 5,
      urgencyStars: 4,
    });
  }

  // Margin drift: measured gross margin under the 80% SaaS floor, or a >5pt drop.
  const marginUnderFloor = currIn.grossMarginPct !== null && currIn.grossMarginPct < 80;
  const marginDropped =
    prevIn?.grossMarginPct != null &&
    currIn.grossMarginPct !== null &&
    prevIn.grossMarginPct - currIn.grossMarginPct > 5;
  if (marginUnderFloor || marginDropped) {
    regressions.push({
      kind: "margin_drift",
      leverKey: "grossMargin",
      title: "Gross margin drifted under the SaaS floor",
      why: "SaaS-grade margins are what earn SaaS-grade multiples; COGS must stay < 20%.",
      evidence: marginDropped
        ? `gross margin ${prevIn!.grossMarginPct!.toFixed(0)}% -> ${currIn.grossMarginPct!.toFixed(0)}%`
        : `gross margin ${currIn.grossMarginPct!.toFixed(0)}% < 80% floor`,
      ownerDepartment: "Finance",
      importanceStars: 4,
      urgencyStars: 3,
    });
  }

  // Growth stall: post-revenue only — ARR flat or down versus the prior snapshot.
  // Pre-revenue the binding lever already says "# companies > 0"; do not double-file.
  const prevArr = prev?.arrCents ?? null;
  const currArr = curr.arrCents;
  if (prevArr !== null && currArr !== null && prevArr > 0 && currArr <= prevArr) {
    regressions.push({
      kind: "growth_stall",
      leverKey: "growth",
      title: "ARR growth stalled — the multiple's dominant term is flat",
      why: "Growth rate is the dominant term in the multiple; flat ARR compresses the cap proxy.",
      evidence: `ARR ${formatUsdFromCents(prevArr)} -> ${formatUsdFromCents(currArr)} between snapshots`,
      ownerDepartment: "Marketing/Sales",
      importanceStars: 4,
      urgencyStars: 3,
    });
  }

  return regressions;
}

// --- Snapshot document (markdown with an embedded JSON block) -----------------
// Issue documents are markdown-only; the panel parses the fenced JSON back out.

const SNAPSHOT_FENCE_OPEN = "```json market-cap-snapshot";

export function renderMarketCapSnapshotDocument(snapshot: MarketCapSnapshot): string {
  const gaps = snapshot.evidenceGaps.length
    ? snapshot.evidenceGaps.map((g) => `- ${g}`).join("\n")
    : "- none";
  const levers = snapshot.levers
    .map((l) => `| ${l.label} | ${l.currentValue} | ${l.ownerDepartment} |`)
    .join("\n");
  return [
    `# Market cap snapshot — ${snapshot.generatedAt}`,
    "",
    `- **Stage:** ${snapshot.stage.id} (${snapshot.stage.proof})`,
    `- **ARR (real Stripe only):** ${snapshot.arrLabel}`,
    `- **Honest cap proxy:** ${snapshot.capProxyLabel}`,
    `- **Multiple:** ${snapshot.multipleLabel}`,
    `- **Binding lever:** ${snapshot.bindingLever.statement}`,
    "",
    "## Evidence gaps",
    gaps,
    "",
    "## Levers",
    "| Lever | Current (real) value | Owner |",
    "|---|---|---|",
    levers,
    "",
    SNAPSHOT_FENCE_OPEN,
    JSON.stringify(snapshot, null, 2),
    "```",
    "",
  ].join("\n");
}

export function parseMarketCapSnapshotDocument(body: string): MarketCapSnapshot | null {
  const start = body.indexOf(SNAPSHOT_FENCE_OPEN);
  if (start === -1) return null;
  const jsonStart = start + SNAPSHOT_FENCE_OPEN.length;
  const end = body.indexOf("```", jsonStart);
  if (end === -1) return null;
  try {
    const parsed = JSON.parse(body.slice(jsonStart, end));
    if (!parsed || typeof parsed !== "object" || !parsed.stage || !parsed.bindingLever) return null;
    return parsed as MarketCapSnapshot;
  } catch {
    return null;
  }
}
