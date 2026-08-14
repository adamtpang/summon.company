# The public face: decided 2026-08-01

Read this before "fixing" `.vercel/project.json`. It is not broken.

## The decision

**The summon.company landing lives in this repo at `apps/landing/`, and it is
deployed by the Vercel project named `vitals.run`.** No separate Vercel project
is created. The local `.vercel` link is correct as it stands.

## Why the link looks wrong but is not

`.vercel/project.json` says `"projectName":"vitals.run"`, which reads like a
stale pointer at a different product. It is not. Verified 2026-08-01 with
`vercel domains inspect summon.company`:

```
Projects
  Project      Domains
  vitals.run   design.summon.company, summon.company
```

The Vercel **project** is named `vitals.run` because it predates the
2026-07-14 rename to Summon (see NORTH_STAR.md, where "vitals" survives only as
the name of the EKG scoreboard inside the product). The domain, the deploy, and
the landing source are all correct. Only the project's display name is stale.

## What was actually broken

Not the link. The **content**. As of 2026-08-01 the live page:

- advertised $99/mo per employee, an offer superseded by the $500/mo founding
  seat
- carried **8 Stripe buy buttons, every single one of them dead**. All 8 payment
  links inactive, all 8 underlying prices archived. The site could not take a
  single dollar.
- shipped JSON-LD structured data quoting `"price":"99.00"` to search engines

All three are fixed. The page now sells the founding seat at $500/mo through
`https://buy.stripe.com/8x2eVd1ACfJb5kc1q9aMU19`, the only live public rail.

## If you want the name cleaned up

Optional, board decision, not done here because it is not required and it
touches deploy URLs:

Renaming the Vercel project `vitals.run` to `summon-company` would remove the
confusion permanently. Custom domains (summon.company, design.summon.company)
follow the project and keep working. What changes is the generated
`*.vercel.app` preview URL, so anything that hardcodes the old one breaks.
Nothing in this repo appears to, but check before doing it.

## Deploy

Deploys are Adam's. This repo is committed and handed off; nothing here has been
deployed. The landing changes above are live in git only, not on summon.company,
until he ships them.
