# vitals.run cross-agent handoff

Last updated: 2026-07-14 by Codex.

## Product

vitals.run is an AI-agent company platform: hire AI employees by department while
the human remains the board. High-risk work requires approval and agent spending
stops at configured caps. The company dogfoods the platform on itself.

## Repository

The engine and public landing now live in one GitHub repository:

- GitHub: `adamtpang/vitals.run`
- Engine: repository root, tracking `paperclipai/paperclip`
- Product UI: additive routes and components under `ui/`
- Landing and portable dashboard: `apps/landing/`
- Portable installer compatibility: the `installer` branch
- Installer command: `npx github:adamtpang/vitals.run#installer`

The consolidation preserves both Git histories. Commit `fbe7c6d95` is descended
from the former `vitals.run` landing master and current Paperclip upstream, so the
public repository was updated with a normal fast-forward. Do not force-push.

## Fork rules

1. Prefer additive files, routes, and components.
2. Do not rename `@paperclipai/*`, `PAPERCLIP_*`, database, API, or protocol surfaces.
3. Keep `upstream` pointed at `paperclipai/paperclip` and merge upstream regularly.
4. Keep customer-facing Vitals language out of shared protocol names.
5. Read `DESIGN.md` before UI work. Use the token layer in `ui/src/index.css`.

## Current progress

- Consolidated engine and landing: `fbe7c6d95`
- VIT-12 company formation view: `6595e93e4`
- Route: `/:companyPrefix/formation`
- Sidebar: Company -> Formation
- Eight canonical departments map additively onto existing agents by metadata,
  title, name, capabilities, and existing Paperclip roles.
- The page ranks one constraint from unstaffed positions, runtime health, and
  monthly budget pressure. It includes loading, error, empty-company, desktop,
  and mobile states.
- Canonical department and stage definitions: `VITALS_FORMATION_ROADMAP.md`

## Verification on 2026-07-14

- Full 29-package TypeScript check passed.
- Formation tests passed: 4 of 4.
- Production UI build passed.
- Local browser verification passed at 1280x900 and 375x812 with eight positions
  and no horizontal overflow.
- Published GitHub installer branch installed all six expected dashboard files.
- Root `pnpm build` reaches `packages/db` and then fails on Windows because the
  upstream package script uses POSIX `cp -r`; the UI production build passes.
- `check-token-gates` still reports pre-existing upstream violations, with none in
  `Formation.tsx` or `Formation.test.tsx`.

## Deployment state

The existing Vercel project is still `vitals.run` and the landing deploy root is
`apps/landing/`. A preview deployment was not performed because external upload
requires Adam's explicit approval in Codex. Do not create another Vercel project.
When approved, deploy from `apps/landing/`, verify the preview, then promote the
same project to production and check `https://vitals.run` directly.

## Next work

1. Build VIT-13 Roadmap / Critical Path from the eight canonical stages.
2. Connect each roadmap step to a real task and department owner.
3. Highlight the least-complete stage as the company constraint.
4. Add hard approval gates for legal, banking, and outbound actions.
5. Continue VIT-14 through VIT-20 only after VIT-13 is coherent and verified.

## Commands

```bash
pnpm install
pnpm dev
pnpm --filter @paperclipai/ui typecheck
pnpm --filter @paperclipai/ui exec vitest run src/pages/Formation.test.tsx
pnpm --filter @paperclipai/ui build
node scripts/smoke-vitals-installer.mjs
```
