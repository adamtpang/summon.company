# Summon market cap: how it's measured, the levers, and the limit

Board ask (2026-07-15): "as CEO of AI agents, I need to know my market cap... and all
the levers to get market cap and profitability from where I am now to the in-the-limit
platonic ideal." Method borrowed from companiesmarketcap.com + the board's own
countriesmarketcap/8marketcap lineage; discipline borrowed from Tobi ("the stock market
is a betting market on future value; I work on the REAL market value") and Buffett via
Senra ("short term a voting machine, long term a weighing machine — build a heavy-ass
company").

## 1. How market cap is measured

- **Public company (companiesmarketcap.com method):** market cap = live share price ×
  shares outstanding. The site simply ranks that number, refreshed continuously —
  it is a *betting market's* current bet, not intrinsic value.
- **Private recurring-revenue company:** there is no ticker, so market cap is a bounded
  PROXY: live annual recurring revenue × an evidence-earned multiple. The first model
  uses 5-10× ARR and labels it as a proxy, never a financing valuation or market quote.
- **No live company-owned Stripe ARR means the number is unproven.** Summon may say
  "option value only," but it does not turn a disconnected account, test-mode data,
  a foreign currency, a website score, or catalog pricing into dollars. The fastest
  way to move the number is a real recurring customer, not narrative.

## 2. The equation and the levers

MARKET CAP PROXY ≈ ARR × MULTIPLE. MONTHLY PROFIT = CURRENT-MONTH REVENUE − CURRENT-MONTH EXPENSES.
Decomposed into every lever
the board can actually pull:

1. **Live ARR** — normalized from priced active Stripe subscription items in the
   company's declared currency. Lever owner: Finance.
2. **Paying customers** — distinct customers behind those priced subscriptions.
   Customer identities remain in Stripe. Lever owner: Marketing/Sales.
3. **Recurring revenue per customer** — observed ARR divided by the paying cohort.
   It comes from receipts, never a hardcoded offer or price card. Lever owner: Finance.
4. **Retention (the moat)** — accumulated company context + configured employees +
   memory files = switching cost. Churn kills the multiple twice (ARR and multiple).
   Lever owner: Support/Success + memory architecture (VIT-47).
5. **Gross margin** — the fuel doctrine: subscription-powered adapters ≈ near-zero
   marginal model cost today; cost-of-revenue attribution keeps
   COGS < 20% at scale. SaaS-grade margins are what earn SaaS-grade multiples.
6. **The multiple itself** — growth rate (the dominant term), category leadership
   ("the AI-agent company OS" — own the category name), verified-usefulness proof
   (public logs beat decks), founder-dogfood story. Multiple is earned by evidence.
7. **Profitability** — live current-month Stripe revenue minus tracked AI costs and
   recorded operating expenses. Missing accounting coverage stays explicit. Available
   Stripe cash divided by measured monthly burn gives runway; profitable companies are
   labeled profitable instead of given a fictional runway.

## 3. The ladder from here to the limit

| Stage | Proof | ARR | Honest cap proxy |
|---|---|---|---|
| NOW | live recurring revenue is not proven | unproven | option value only |
| S1 | first live recurring revenue | >$0 | first real datapoint |
| S2 | 10 paying customers with recurring revenue | measured | 5-10× live ARR proxy |
| S3 | 100 paying customers with recurring revenue | measured | 5-10× live ARR proxy |
| S4 | 1,000 paying customers with recurring revenue | measured | multiple must be earned by retention, margin, and growth |
| S5 | $100M+ live ARR | $100M+ | $1B+ only when the multiple is earned |
| LIMIT | NORTH_STAR: #1 by market cap via verified usefulness — every company runs its formation on Summon; cap = the weighing machine agreeing the usefulness is real | — | — |

Each stage transition is a phase gate (Tobi mechanic): evidence in, board review,
then the next box. The scoreboard shows the CURRENT stage and the ONE lever most
binding. Before revenue that lever is live ARR; after revenue, a broken retention or
margin signal outranks distribution.

## 4. What we sell and to whom (CEO to pressure-test, board to ratify)

- **The wave-1 offer:** $500 setup + $99/month for the company, locked for the two
  founding slots; $199/month public after them. The 48-hour diagnosis occurs before
  payment, and the first plated deliverable is due within seven days or the setup fee
  is returned.
- **Valuation discipline:** the model does not multiply the price card by hoped-for
  customers. Only live Stripe subscriptions enter ARR.
- **The asset (the moat, never sold):** the company's accumulated config + context +
  memory — the desired-state file that makes leaving expensive and staying compounding.
- **ICP (sharpest first):** (1) the solo technical-ish founder running 1-5 real
  projects with revenue intent and zero staff — the board is the archetype; reachable
  in founder communities, buys in minutes, expands per project. (2) The existing SMB
  owner-operator (idiguam/Guam pattern) — higher touch, higher LTV, needs the service
  wedge first. Strangers only (NS rule): sell to founder communities and SMB
  counterparties, never friends-and-family.

## 5. Scoreboard integration

Market cap goes on Mission Control and the Aether portfolio as a computed, honest
metric: current stage, ARR from the company-owned restricted Stripe connection, the
5-10× proxy range, coverage bounds, and the single binding lever. The same Stripe sync
also supplies current-month revenue and available cash; Summon's cost and finance-event
ledgers supply expenses, profit, burn, and runway. No global Stripe secret or manually
published issue document is required for the UI. The optional snapshot script reads
this same dashboard contract and can preserve a dated audit document.
