import type { AdapterManifestInput } from "./policy-ledger.js";

/**
 * Default adapter manifests (VIT-46) — providers/adapters declared as DATA.
 *
 * @see doc/finance/POLICY-LEDGER.md
 *
 * This is the whole point of the manifest model: onboarding a new provider is a
 * new entry in this array (plus its adapter module), and the policy engine never
 * changes. `reserveUnits` is the UPPER-BOUND cost of one call on that route, in
 * the manifest's `unit` — normalized usage units for subscription adapters
 * today, microdollars when API adapters land.
 *
 * v1 adapters run on the founder's own subscriptions, so cost is metered in
 * normalized units (a coarse "one heartbeat turn" proxy), not real dollars. The
 * numbers below are deliberately conservative upper bounds; a real settlement
 * refunds the unused reservation, so over-reserving is safe, under-pricing is not.
 */
export const DEFAULT_ADAPTER_MANIFESTS: AdapterManifestInput[] = [
  {
    key: "claude_local",
    displayName: "Claude (local subscription)",
    billingModel: "subscription",
    unit: "normalized_units",
    capabilities: ["code", "chat", "plan"],
    routes: [
      { model: "claude-opus-4-8", reserveUnits: 10 },
      { model: "claude-sonnet-4-6", reserveUnits: 5 },
      { model: "claude-haiku-4-5", reserveUnits: 2 },
    ],
  },
  {
    key: "codex_local",
    displayName: "Codex (local subscription)",
    billingModel: "subscription",
    unit: "normalized_units",
    capabilities: ["code", "chat"],
    routes: [
      { model: "gpt-5-codex", reserveUnits: 8 },
      { model: "o4-mini", reserveUnits: 3 },
    ],
  },
];
