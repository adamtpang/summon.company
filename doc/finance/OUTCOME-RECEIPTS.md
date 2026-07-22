# Outcome Receipts — the finance standard for what a completed task was WORTH

Owner: Vitals CFO (Ledger). Prepared for SUM-143. Status: standard v1, ready for
Engineering to wire. Rule: **the 11x rule governs every number here — no figure the logs
or a cited baseline cannot defend. "Unmeasurable" is a valid, first-class answer and must
be said plainly rather than dressed up as a fake number.**

Board ask (2026-07-18): the import works, the diagnosis works, the dispatch works. The
missing piece is the **receipt** — when a task completes, nothing states what it was
worth. Without it the transformation is invisible and the founder cannot sell it. This
document defines the receipt so the demo can point at "this company saved $X and N hours
this month" and have it be *true*.

---

## 1. The receipt schema (attached to every completed task)

Every closing/completion comment carries one structured `OUTCOME` block. It is machine-
readable (fenced ```outcome json) so Mission Control can roll it up, and human-readable so
the founder can read it in the thread.

```outcome
{
  "outcome": {
    "moneySavedCents":   0,        // costs removed/avoided that recur or were spent (int, omit if n/a)
    "timeSavedMinutes":  0,        // human minutes not spent because the agent did it (int, omit if n/a)
    "revenueMovedCents": 0,        // NEW revenue caused or advanced (int, omit if n/a)
    "riskAvoided":       null      // string describing risk removed, or null (qualitative lever)
  },
  "confidence": "measured | estimated | unmeasurable",
  "method": "one honest sentence stating HOW each number was derived, incl. the baseline and arithmetic"
}
```

Rules that make it honest:

- **At least one lever must be populated OR `confidence` = `"unmeasurable"`.** A receipt
  that claims nothing and does not say why is not a valid receipt.
- **`method` is mandatory and specific.** "Estimated from a 30-min industry SDR
  research-and-draft baseline × 2 prospects" is valid. "Saved a lot of time" is not.
- **Never populate a numeric lever you cannot defend.** If revenue was not moved, set
  `revenueMovedCents` to 0 or omit it and say so in `method` — do not invent a pipeline
  number. Unmeasured ≠ zero-value, but an *un-derivable* number is `unmeasurable`, stated.
- **One lever per task is normal.** Most tasks move exactly one of the four. Forcing all
  four produces slop.

### The three confidence tiers (this operationalizes the 11x rule)

| Tier | Meaning | Bar |
|---|---|---|
| `measured` | Number reads directly off an artifact/log | An invoice that dropped, a payment received, a plan downgraded, a bill removed. Cite the artifact. |
| `estimated` | Defensible estimate from a **stated formula + cited baseline** | Show the arithmetic. Industry-standard time, a real rate card, a documented manual process. A reviewer can reproduce it. |
| `unmeasurable` | No honest basis exists | Say so plainly. This is a *feature* of the standard, not a failure. It protects the credibility of every `measured` and `estimated` number next to it. |

---

## 2. Valuation method (CFO-owned — this is where the numbers come from)

The four levers and how to price each:

**moneySavedCents** — direct cost removed or avoided.
- *measured*: a real bill/subscription/fee that went down or away. Cite it.
- *estimated*: a documented recurring cost the task eliminated (e.g. a $X/mo tool the
  agent replaced). State the monthly figure and the horizon you are counting (default:
  count the **first month only** unless the saving is contractually locked; do not
  capitalize 12 months of "savings" from one task — that is how estimates become lies).

**timeSavedMinutes** — human minutes not spent because the agent did the work.
- Baseline = the honest manual time for the *same output*, from a stated source (industry
  norm, a timed manual run, or the founder's own estimate). Multiply by the count of units
  produced. Count **only work actually produced and logged**, not hypothetical future runs.

**revenueMovedCents** — new revenue caused or advanced.
- *measured*: a payment received, a signed order, a booked paid meeting. Cite it.
- Nothing sent / no reply / no booking ⇒ revenue is `0` or `unmeasurable`. Say it. A draft
  that was written but not sent moved **zero** revenue, however good the draft.

**riskAvoided** (qualitative) — a concrete downside removed.
- A string, e.g. "un-gated outbound send blocked by approval queue" or "provider-outage
  downtime removed by fallback chain". Not summed into money unless a defensible expected-
  loss figure exists; if it does, also populate `moneySavedCents` and show the expected-
  value arithmetic in `method`.

### Time → money conversion (single documented rate)

When a rollup or a decision card needs to express time saved *as dollars*, use one
standard, conservative, documented rate so numbers are comparable across the company:

- **Default labor value = $60.00/hour = 100¢/minute** (loaded knowledge-worker rate).
  Derivation: anchored to the product's own doctrine — a $99/mo employee stands in for a
  ~$70K/yr salary (`doc/MARKET-CAP-MODEL.md`); $70K base + ~25% overhead ≈ $87.5K ÷ 2,080h
  ≈ $42/h fully-loaded. We round **up** to $60/h as the display rate only where a role-
  specific rate is unknown, and label it "@ $60/h" so it is never mistaken for measured
  cash. Money saved and time saved are reported as **separate lines** in the rollup; the
  dollar-ized time is shown only as a parenthetical, never added into `moneySavedCents`.
- Role-specific rates may override the default when known (e.g. an offshore VA at $12/h);
  when overridden, `method` must name the rate used.

Guardrail: **time-value dollars are never merged into the moneySaved total.** Mixing
"cash we didn't spend" with "labor-hours valued at a notional rate" is the single fastest
way to produce an indefensible headline number. Keep them in separate columns.

---

## 3. Rollup — Mission Control "Outcomes (30d)"

Per company, sourced **only** from receipts on tasks with `completedAt` within the last 30
days:

```
Outcomes (30d): $<moneySaved> saved · <hours> h saved (≈ $<timeValue> @ $60/h) · $<revenueMoved> revenue moved · <n> risks avoided
                from <k> receipts · <u> tasks marked unmeasurable
```

Computation:
- `moneySaved` = Σ `moneySavedCents` over qualifying receipts (measured + estimated).
- `hours` = Σ `timeSavedMinutes` ÷ 60; `timeValue` = hours × $60 (parenthetical only).
- `revenueMoved` = Σ `revenueMovedCents`.
- `risks avoided` = count of receipts with non-null `riskAvoided`.
- Always show `u` = count of completed tasks whose receipt is `unmeasurable`. **Showing the
  unmeasured count is what makes the measured total trustworthy.** A rollup that hides the
  denominator is vibes; this one shows its work.
- If zero qualifying receipts: show `Outcomes (30d): no receipts yet` — never a fabricated
  number, never $0-as-success.

---

## 4. Decision cards — expected outcome BEFORE dispatch

A decision card is an investment proposal: it should read **cost X, expect Y**. Today the
card carries an ETA line. It gains an expected-outcome line using the *same schema* as a
forecast (same four levers, same `confidence`, same mandatory `method`), so the completed
receipt can later be compared against the promise.

Card line format:

```
ETA <duration> · Expect: <lever summary>  (<confidence>)
  e.g.  ETA ~40 min · Expect: ~1 h founder time saved (estimated: 2 outreach drafts @ 30 min each)
  e.g.  ETA ~2 h · Expect: revenue impact unmeasurable pre-send — this de-risks, not sells (unmeasurable)
```

The forecast is bound by the same 11x rule: an honest "expected: unmeasurable, this is a
de-risking investment" is required over an invented ROI. On completion, the receipt's
actual outcome should be readable next to the card's expected outcome (promise vs. result)
— that comparison is the long-term credibility engine and the seed of outcome metering
(`doc/MARKET-CAP-MODEL.md` §pricing).

---

## 5. Worked example — a real receipt (VIT-62, the quantus.com AI SDR loop)

Applied to a genuinely completed task, `VIT-62` (completed 2026-07-18): the local AI SDR
loop produced, for summon.company **and quantus.com**, a cited public-source research
dossier + one personalized 1:1 outbound draft each, and hardened the approval-queue so
nothing sends without board approval. See the receipt posted to VIT-62 for the live form.

```outcome
{
  "outcome": {
    "timeSavedMinutes": 60,
    "revenueMovedCents": 0,
    "riskAvoided": "un-gated outbound send prevented — every draft held in pending_board_approval; no live sender wired"
  },
  "confidence": "estimated",
  "method": "Time: industry-standard 1:1 SDR research+personalized-draft baseline of ~30 min/prospect × 2 real prospects (summon.company, quantus.com) = 60 min, first-party public sources only. Revenue: 0 — nothing was sent, no reply/meeting exists to count (revenue impact is unmeasurable pre-send, stated honestly). Risk: qualitative — the governance layer removed the risk of an ungated send. Time value ≈ $60 @ $60/h, shown separately, not added to a cash total."
}
```

This is deliberately a *small, honest* number sitting next to an honest "revenue: 0". That
juxtaposition is the point: a founder can trust the $60/1-hour figure precisely because the
receipt refused to invent a revenue number it could not defend.

---

## 6. Acceptance mapping (SUM-143)

1. Receipt schema + method + 11x tiering — **§1–2 (this doc)**; live proof posted on VIT-62.
2. Mission Control "Outcomes (30d)" rollup — **§3** (Engineering wires the aggregation + line).
3. Decision cards quote expected outcome pre-dispatch — **§4** (Engineering wires the card line).

Engineering child issues carry the wiring; this standard is the spec they build to.
