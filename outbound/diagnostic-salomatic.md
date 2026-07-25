# Salomatic: a proactive diagnostic

Prepared by Adam Pangelinan / summon.company, 2026-07-25. Sources: salomatic.com as it renders today, plus the Regain org repos you shared.

## Where you are on the road

Stage: Build, with the Launch exit unproven. The product exists (checkups, labs, Copilot, scheduling). What does not exist anywhere in public: a price, a conversion path, or a reason to trust a medical product (no team, no credentials on the site).

## Top problems, ranked by important times urgent

1. **Your own production-readiness register.** Your repos carry a production-readiness issue register and tracker with the exact blockers between you and shipping. This is the S-tier pile: it blocks everything downstream, including revenue.
2. **No price in writing, anywhere.** The site's only actions are Login and Learn More. Nobody can buy, so nothing else on the site can pay for itself.
3. **No trust layer.** A health-records product with no named team, no credentials, no security story. For medical software this is a conversion killer, not a cosmetic gap.

## Named night-one targets (from your own docs, found by the scan)

- `production-readiness/01-issue-register.md`: every P0 from your 2026-07-07 architecture review, deduplicated. This is the work list; the tracker beside it shows which rows are still open.
- The raw ZodError leak via throwing helpers (phase 9 handoff, flagged P0: internal errors leaking to clients).
- The dead batch BI ETL job: `scheduleBatchEtl` is defined for 01:00 and never runs, so tenant onboarding and history backfill are silently broken.
- The LIS tabs fed empty arrays: Variants, QC, and Reports render nothing because the endpoints behind them do not exist yet.
- The teleconsult auto-join-on-mount: a geneticist clicking Join is instantly live to a patient with no framing check. For a medical product this is a trust incident waiting to happen.
- The external pentest remediation tracker: open critical and high rows.

## The offer

$1,500, due on receipt. Night one: the top open rows above, fixed as pull requests you can inspect by morning. You do nothing: your repos are already set up on my side. If the morning's PRs are not worth merging, do not pay.

Then, only if you want the loop running every night: $990 a month, founding rate (market for AI automation retainers runs $1,000 to $5,000+ a month). Cancel with one message.

Market check: a senior contractor averages $101 an hour; the same output runs $4,000 to $6,000 before you find, vet, and manage anyone. First AI projects at agencies run $3,000 to $10,000.

**Reply yes and the first PRs land by morning.**
