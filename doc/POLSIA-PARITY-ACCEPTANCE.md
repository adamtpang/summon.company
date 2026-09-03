# Polsia parity acceptance

The source implementation has no `missing` or `partial` Polsia outcomes. The remaining rows are `blocked by evidence`, which means their customer path exists but the required live provider, public deployment, physical-device/store, or board-authorized company receipt does not.

`doc/research/polsia-acceptance-manifest.json` is the canonical acceptance contract for those rows. It must cover every `blocked by evidence` row in `FEATURE-PARITY.md` exactly once. Each entry names:

- who must explicitly authorize the acceptance;
- the exact providers and allowed environment;
- every disposable resource type that must be identified;
- the evidence kinds required for a pass;
- the only external mutations permitted by that acceptance;
- whether cleanup must finish before a pass; and
- the boundary that must not be crossed.

## Commands

```powershell
pnpm check:polsia-acceptance
pnpm test:polsia-acceptance
pnpm verify:polsia-acceptance
```

`check:polsia-acceptance` is the safe default. Missing receipts are reported as `awaiting_authorization`; they are not treated as failures and never cause a provider call. `verify:polsia-acceptance` is the completion gate and intentionally exits nonzero until every currently blocked row has one valid passing receipt.

Receipts live outside the product source under `work/polsia-acceptance/receipts/<acceptance-id>.json`. Referenced artifacts must remain inside that directory, exist, and match their recorded SHA-256. The verifier rejects:

- a receipt without an explicit authorization reference and scope;
- a production acceptance where only test is allowed;
- an undeclared provider mutation or disposable resource type;
- a pass missing any required evidence kind;
- a pass whose cleanup is pending;
- an artifact path that escapes the receipt directory;
- an artifact whose hash does not match; and
- credential fields or recognizable credential values in the receipt.

A failed authorized attempt may retain partial evidence and pending cleanup, but it remains `fail`; it cannot promote the parity row. Missing evidence remains `awaiting_authorization`. Only a complete passing receipt may support changing a row from `blocked by evidence` to `match`.

## Receipt shape

Every receipt uses schema version 1 and contains:

- `acceptanceId`, exact `outcome`, `result`, `executedAt`, and allowed `environment`;
- `authorization` with `grantedBy`, `grantedAt`, bounded `scope`, and durable `reference`;
- the exact disposable resource types and safe provider IDs;
- only mutations listed by the manifest entry;
- evidence records with kind, observation time, safe summary, relative artifact path, and SHA-256;
- `redactionsVerified: true`; and
- cleanup status, summary, and completion time when cleanup is required.

Never store passwords, access tokens, refresh tokens, cookies, API keys, connection strings, raw customer data, or provider payloads in a receipt or its evidence artifacts. Provider evidence must be reduced to the smallest allowlisted facts needed to prove the outcome.

## Current state

As of 2026-08-31, the manifest covers all 22 blocked outcomes exactly once, zero acceptance receipts are present, and all 22 are correctly reported as `awaiting_authorization`. No live acceptance was attempted.
