# register-truth eval suite: results

Generated 2026-08-12. Run yourself: `npx vitest run server/src/__tests__/register-truth-eval.test.ts` from `summon.company/`.

## What this is

The reconciler (`server/src/services/register-truth.ts`) already had unit
tests for its individual functions (`classify`, `measure`, the parsers —
`server/src/__tests__/register-truth.test.ts`, 25 tests). What it did not
have was an end-to-end eval: a set of findings with **known ground truth**
run through the real `reconcileRegister()` pipeline, scored against that
ground truth. That's what this suite adds
(`server/src/services/register-truth-eval-scenarios.ts` +
`server/src/__tests__/register-truth-eval.test.ts`).

12 synthetic findings, each constructed so exactly one outcome is correct:
a presence fix that landed, a quantity that improved but didn't zero out,
a claim nothing ever touched, an authz fix that landed but must still route
to a human, a claim where the code never changed but evidence contradicts
it, a probe that moved the wrong direction, an anchor that vanished after a
rewrite, a payment/token fix that landed but must still route to a human, a
narrative claim with no derivable probe, a two-probe finding where only one
side closes, and two closed-format variants (markdown table + checklist).

## Result

**12/12 correctly classified** against known ground truth, across all five
status values the reconciler can produce (`closed`, `partial`, `open`,
`contradicted`, `needs_human`).

**0/2 false auto-closes on security/payment findings** — EVAL-4 (authz gate)
and EVAL-8 (payment token) both had fully satisfied code evidence (the fix
demonstrably landed) and the reconciler still routed both to a human instead
of auto-closing, because the claim text matched the never-auto-close guard.
That guard is the one behavior that matters most to get right: a reconciler
that's slightly too eager to auto-close a security finding is worse than
having no reconciler.

## Distinct from the Regain proof run

This suite is synthetic and checks classification logic in isolation from
any real repo. The separate proof run against `regain-inc/miss`
(`outbound/regain-register/run-output.txt`) is the other kind of evidence:
a real customer register, reconciled against a real 269-commit-stale clone,
producing 7 closed / 1 partial / 1 needs-human out of 9 real P0 findings.
One shows the classifier is correct on known cases; the other shows it
produces a sane result on a real, messy input. Cite both, not one standing
in for the other.
