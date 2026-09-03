// VIT-101: the market-cap model (doc/MARKET-CAP-MODEL.md) as one pure module.
// Market cap ~= ARR x multiple. Pre-revenue the honest cap is option value only.
// The 11x rule applies throughout: no metric the logs cannot prove; $0 shows as $0,
// unknown shows as unknown -- never a placeholder number.

export const VITALS_MARKET_CAP_DOCUMENT_KEY = "market-cap-snapshot";

export type MarketCapStageId = "NOW" | "S1" | "S2" | "S3" | "S4" | "S5";

export type MarketCapStage = {
  id: MarketCapStageId;
  proof: string;
  capProxyLabel: string;
};

// doc/MARKET-CAP-MODEL.md section 3 -- the ladder from here to the limit.
export const VITALS_MARKET_CAP_LADDER: readonly MarketCapStage[] = [
  { id: "NOW", proof: "live recurring revenue is not yet proven", capProxyLabel: "option value only" },
  { id: "S1", proof: "first live recurring revenue", capProxyLabel: "first real datapoint" },
  { id: "S2", proof: "10 paying customers with recurring revenue", capProxyLabel: "revenue-backed proxy" },
  { id: "S3", proof: "100 paying customers with recurring revenue", capProxyLabel: "revenue-backed proxy" },
  { id: "S4", proof: "1,000 paying customers with recurring revenue", capProxyLabel: "multiple earned by evidence" },
  { id: "S5", proof: "$100M+ live ARR", capProxyLabel: "$1B+ only when the multiple is earned" },
];

export type MarketCapLeverKey =
  | "arr"
  | "payingCustomers"
  | "revenuePerCustomer"
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
    key: "arr",
    label: "Live ARR",
    ownerDepartment: "Finance",
    how: "company-owned Stripe subscriptions, normalized to annual recurring revenue",
  },
  {
    key: "payingCustomers",
    label: "Paying customers",
    ownerDepartment: "Marketing/Sales",
    how: "distinct customers with priced active subscriptions in the account currency",
  },
  {
    key: "revenuePerCustomer",
    label: "Recurring revenue per customer",
    ownerDepartment: "Finance",
    how: "observed ARR divided by paying customers; no catalog price or offer copy",
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
  /** Whether the provider-backed ARR snapshot is current enough to price. */
  revenueFreshness?: "fresh" | "stale" | "error" | "unavailable" | "test_mode";
  /** Annualized recurring revenue in cents from real Stripe subscriptions; null = no Stripe read. */
  arrCents: number | null;
  /** Currency of ARR. The valuation proxy is USD-only until FX evidence exists. */
  arrCurrency: string | null;
  /** Whether the ARR read covered all active subscriptions or only the latest 100. */
  arrCoverage: "complete" | "bounded_latest_100" | "unavailable";
  /** Count of distinct paying customers with a priced active subscription; null = no complete parse. */
  payingCustomers: number | null;
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
  const arr = inputs.arrCurrency === "usd" ? inputs.arrCents ?? 0 : 0;
  const paying = inputs.payingCustomers ?? 0;
  if (arr >= 100_000_000 * 100) return VITALS_MARKET_CAP_LADDER[5];
  if (paying >= 1000) return VITALS_MARKET_CAP_LADDER[4];
  if (paying >= 100) return VITALS_MARKET_CAP_LADDER[3];
  if (paying >= 10) return VITALS_MARKET_CAP_LADDER[2];
  if (arr > 0) return VITALS_MARKET_CAP_LADDER[1];
  return VITALS_MARKET_CAP_LADDER[0];
}

// Theory of constraints: one binding lever at a time. Before live ARR, recurring
// revenue evidence is binding. After revenue exists, a broken retention or
// margin signal outranks distribution.
export function resolveBindingLever(inputs: MarketCapInputs): MarketCapSnapshot["bindingLever"] {
  const stage = resolveMarketCapStage(inputs);
  if (stage.id === "NOW") {
    return {
      key: "arr",
      statement: "live recurring revenue — the first externally paid subscription moves the number, not narrative",
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
      key: "payingCustomers",
      statement: "paying customers — distribution stays binding until the recurring cohort is durable",
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
  const usdArr = inputs.arrCurrency === "usd" ? inputs.arrCents : null;
  const arr = usdArr ?? 0;
  const revenueCurrent = inputs.revenueFreshness === undefined || inputs.revenueFreshness === "fresh";
  const revenuePriceable = revenueCurrent && !inputs.stripeTestMode && inputs.arrCoverage === "complete";
  const priceableInputs = revenuePriceable
    ? inputs
    : { ...inputs, arrCents: null, payingCustomers: null };
  const stage = resolveMarketCapStage(priceableInputs);

  const evidenceGaps: string[] = [];
  if (!inputs.stripeConnected) evidenceGaps.push("Stripe not connected — ARR is unproven");
  if (inputs.stripeTestMode) evidenceGaps.push("Stripe data is TEST MODE — demo, not external revenue");
  if (inputs.revenueFreshness === "stale") evidenceGaps.push("Stripe revenue evidence is stale — automatic refresh is overdue");
  if (inputs.revenueFreshness === "error") evidenceGaps.push("Stripe revenue refresh needs attention — current ARR is unproven");
  if (inputs.stripeConnected && inputs.arrCents === null) evidenceGaps.push("active subscriptions could not be priced into ARR");
  if (inputs.arrCents !== null && inputs.arrCurrency !== "usd") evidenceGaps.push(`ARR is ${inputs.arrCurrency ?? "unknown currency"} — the USD proxy is unavailable`);
  if (inputs.arrCoverage === "bounded_latest_100") evidenceGaps.push("ARR is a minimum from the latest 100 active subscriptions");
  if (inputs.retentionRate === null) evidenceGaps.push("retention: no data yet (no paying cohort)");
  if (inputs.grossMarginPct === null) evidenceGaps.push("gross margin: no data yet (cost-of-revenue attribution pending)");
  if (inputs.arrGrowth30dPct === null) evidenceGaps.push("growth: no trailing ARR series yet");

  const arrLabel = !inputs.stripeConnected || inputs.arrCents === null
    ? "Unproven"
    : !revenueCurrent
      ? `${formatUsdFromCents(arr)} · ${inputs.revenueFreshness === "stale" ? "stale" : "refresh required"}`
    : inputs.arrCurrency !== "usd"
      ? `${inputs.arrCurrency?.toUpperCase() ?? "Unknown currency"} · not converted`
      : `${formatUsdFromCents(arr)}${inputs.stripeTestMode ? " (test mode)" : ""}${inputs.arrCoverage === "bounded_latest_100" ? " minimum" : ""}`;

  // Multiple is earned by evidence; pre-revenue there is no multiple to price.
  const multipleLabel =
    arr > 0 && revenuePriceable
      ? "5-10x ARR (ordinary growth; elite multiples must be earned)"
      : arr > 0
        ? "no multiple — revenue evidence is not priceable"
        : "no multiple — pre-revenue";

  const capProxyLabel =
    arr > 0 && revenuePriceable
      ? `${formatUsdFromCents(arr * 5)}-${formatUsdFromCents(arr * 10)} (5-10x ARR)${inputs.stripeTestMode ? " — test-mode demo" : ""}`
      : arr > 0
        ? inputs.stripeTestMode
          ? "test mode — no valuation proxy"
          : inputs.arrCoverage !== "complete"
            ? "complete ARR required before pricing"
            : "refresh required before pricing"
        : stage.capProxyLabel;

  const paying = inputs.payingCustomers;
  const monthlyRevenuePerCustomerCents = usdArr !== null && paying !== null && paying > 0
    ? Math.round(usdArr / 12 / paying)
    : null;

  const values: Record<MarketCapLeverKey, { currentValue: string; proven: boolean }> = {
    arr: {
      currentValue: arrLabel,
      proven: usdArr !== null && revenuePriceable,
    },
    payingCustomers: {
      currentValue: paying === null ? "no data yet" : String(paying),
      proven: paying !== null && revenuePriceable,
    },
    revenuePerCustomer: {
      currentValue: monthlyRevenuePerCustomerCents === null
        ? "no data yet"
        : `${formatUsdFromCents(monthlyRevenuePerCustomerCents)}/mo`,
      proven: monthlyRevenuePerCustomerCents !== null && revenuePriceable,
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
    arrCents: inputs.stripeConnected && inputs.arrCurrency === "usd" && revenuePriceable ? inputs.arrCents : null,
    arrLabel,
    capProxyLabel,
    multipleLabel,
    evidenceGaps,
    bindingLever: resolveBindingLever(priceableInputs),
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

  // Churn event: a paying customer left, or measured retention fell below 90%.
  const paidDropped =
    prevIn?.payingCustomers != null &&
    currIn.payingCustomers != null &&
    currIn.payingCustomers < prevIn.payingCustomers;
  const retentionBroke = currIn.retentionRate !== null && currIn.retentionRate < 0.9;
  if (paidDropped || retentionBroke) {
    regressions.push({
      kind: "churn_event",
      leverKey: "retention",
      title: "A paying customer churned — retention lever regressed",
      why: "Churn kills the multiple twice: ARR now and the multiple forever.",
      evidence: paidDropped
        ? `paying customers ${prevIn?.payingCustomers} -> ${currIn.payingCustomers}`
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
  // Pre-revenue the binding lever already says live ARR is missing; do not double-file.
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
