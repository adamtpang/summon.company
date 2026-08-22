# Command Deck mockup: a redesign direction for the company dashboard

Compiled 2026-08-22. This documents a visual design mockup produced in a
Claude Code session, exploring what the Summon company dashboard could look
like with a sharper, more distinctive execution of the existing design
system. It answers: what does a "beautiful" evolution of the current
monochrome UI look like, applied to two real companies (Regain, Hawaii Tech
Week), and how does it compare to a design a competitor (Polsia) is already
shipping.

Published artifact: https://claude.ai/code/artifact/64a3974d-fc64-46e3-9a41-9eb9312d189e

## Why this exists

The prompt was "the uiux is so messy, i want to completely overhaul the
design and uiux and design system, and see how regain and hawaiitechweek
would look inside of summon." Before proposing a from-scratch redesign, the
session checked for an existing design system and found one: `DESIGN.md`
(v0.5, board-ruled), whose thesis is **"chrome is white and black, color is
data"**, meaning no decorative accent color anywhere; color is reserved
strictly for status/semantic signal. This mockup was built to respect that
existing law rather than override it, on the theory that the "messy" feeling
described is more likely inconsistent execution of the system (documented
elsewhere in this repo as 112 pre-existing token-gate violations) than an
absence of design intent.

## The design plan

**Color.** Warm near-black ink (`#0b0b0a`) on warm paper (`#faf9f5`) rather
than pure grey/white, a chosen neutral rather than a default one. No
decorative accent color, per the existing law. Semantic status colors only:
critical `#a5362a`, warning `#93691e`, healthy `#2f6b4d`, each paired with a
matching light background tint for chips. Interactive/active state is shown
through weight and underline, not hue.

**Type.** Fraunces (a warm, high-contrast display serif, Google Fonts) for
company identity and headlines, since under a color-as-data system,
typography has to carry the personality color otherwise would. IBM Plex Sans
for operational body text. IBM Plex Mono, set with `font-variant-numeric:
tabular-nums`, for metrics, issue IDs, and anywhere digits need to line up in
columns.

**Layout.** A company-switcher rail on the left (mirroring the real desktop
app's structure) and a "The One Thing" hero panel as the actual focal point
of the main view: the single highest-priority constraint for that company,
shown with its real business impact, rather than buried in a table row. This
was a deliberate choice to encode the product's own theory-of-constraints
thesis (diagnose one bottleneck, not run a checklist) directly into the
page's information hierarchy.

## Real data used in the mockup

Both companies are real entries already in the Summon instance (Regain) or
already diagnosed with real public data (Hawaii Tech Week, not yet
onboarded as a company).

**Regain** (id `be68ef70-6ab9-461e-9f58-634b236ed9a4`, issue prefix `REG`):

| Field | Value |
|---|---|
| Description | Anton Kim's health-tech company (salomatic.com). Second external client engagement. |
| The one thing | REG-3, "Davron demo readiness pack: the gate is open, prove it end to end" |
| Impact | **$1,000-$3,000 MRR per month of delay avoided** (a 10-clinician clinic at published pricing) |
| Status | 7 of 9 P0 blockers already closed in code |
| Agents | Cofounder (CEO, `claude_local`, model `claude-fable-5`, idle); Engineering (not yet configured) |
| Source | `server` API: `GET /api/companies/be68ef70-6ab9-461e-9f58-634b236ed9a4`, `.../agents`, `.../issues` (queried live against the running local instance, 2026-08-22) |

**Hawaii Tech Week** (prospect, not yet a company in the instance):

| Field | Value |
|---|---|
| Stage | Operate and close, with a hard date: Aug 31-Sep 6 2026, five weeks out at time of diagnosis |
| Scale | 50+ events, 25+ venues, 5,000+ people targeted |
| The one thing | Sponsor close window: unsold inventory is worth zero after Sep 7, every day of slack is unrecoverable |
| Secondary findings | A third-party site (mindlens.ai) ranks for their own branded search query; `robots.txt` disallows crawlers site-wide (a direct fetch still returns 200); 33 pages live under `/handbook`, the largest content section on the site |
| Offer already made | $1,500, due on receipt, for a ranked sponsor-prospect list, the brand-search-leak fix, and an event-listing hygiene sweep |
| Source | `outbound/diagnostic-hawaiitechweek.md` (this repo), corrected 2026-08-14 against a live systematic fetch via the company-context gatherer (`outbound/company-context-proof/hawaiitechweek-run.txt`) |

## Competitive comparison: Polsia

While reviewing this mockup, a real, currently-live competitor was found:
**polsia.com**, tagline "AI That Runs Your Company While You Sleep." Its
`/new` page presents the exact same two-path fork Summon had just committed
to leading with differently (create a new company from scratch, versus
"grow my company, already have a business"). Its computed styles, read
directly from the live page:

| Element | Finding |
|---|---|
| Page background / text | `rgb(255,255,255)` / `rgb(0,0,0)`, pure black-and-white chrome, monochrome in the same spirit as Summon's own law |
| Headline typeface | "Editorial New" / "Editorial Old" (a paid, high-contrast editorial serif), 40px, weight 700 |
| Button typeface | "Suisse Mono" (a paid Swiss-style monospace), 3px border radius |

This is a genuine structural parallel to this mockup's own choice (serif for
identity, monospace for UI/data), but Polsia's serif reads starker and more
fashion-editorial than this mockup's Fraunces, and it uses a monospace face
for button labels, which this mockup did not try. Worth studying further if
the direction is to push past "beautiful" toward this specific premium,
editorial register.

## Data-quality flags

- The Regain figures (issues, agents, description) were read live from the
  running local Summon instance on 2026-08-22 and are a real snapshot at
  that moment; issue counts or agent status may have changed since.
- The Hawaii Tech Week figures are from a diagnostic dated 2026-07-25 and
  corrected 2026-08-14; the "five weeks out" framing was accurate as of that
  correction date, not as of 2026-08-22, so the real time-to-event window
  has shrunk since this document was written.
- Polsia's design details were read via `getComputedStyle` on the live page
  in a headless browser tab, a real, verifiable technical reading, not a
  visual/screenshot review (the session's screenshot tool was unavailable at
  the time), so layout, imagery, and motion on polsia.com were not assessed,
  only color and type.
- No commit hashes or PR references exist for this mockup: it is a
  standalone visual exploration, not yet applied to the real production UI.

## Link back

Artifact: https://claude.ai/code/artifact/64a3974d-fc64-46e3-9a41-9eb9312d189e
