import type { Agent } from "@paperclipai/shared";

// Static fallback cost per run (cents) when ledger spend is zero.
const FALLBACK_COST_PER_RUN: Record<string, number> = {
  haiku: 0.5,
  sonnet: 3,
  opus: 15,
};

export function fallbackCostPerRun(modelTier: string): number {
  const key = Object.keys(FALLBACK_COST_PER_RUN).find((k) =>
    modelTier.toLowerCase().includes(k),
  );
  return key ? FALLBACK_COST_PER_RUN[key]! : FALLBACK_COST_PER_RUN.sonnet!;
}

/** Estimated monthly runs for a new agent that starts automation at the given interval. */
export function automationRunsPerMonth(intervalMinutes: number): number {
  return Math.round((60 / intervalMinutes) * 24 * 30);
}

/** Default estimated runs/month for a freshly hired agent (≈5 runs/day). */
export const DEFAULT_NEW_AGENT_RUNS_PER_MONTH = 150;

export interface FleetBudgetStats {
  companyBudgetMonthlyCents: number;
  totalFleetSpentCents: number;
  totalFleetRuns: number;
}

export function computeFleetBudgetStats(
  companyBudgetMonthlyCents: number,
  agents: Agent[],
): FleetBudgetStats {
  const totalFleetSpentCents = agents.reduce((sum, a) => sum + a.spentMonthlyCents, 0);
  const totalFleetRuns = agents.reduce((sum, a) => sum + (a.runCount30d ?? 0), 0);
  return { companyBudgetMonthlyCents, totalFleetSpentCents, totalFleetRuns };
}
