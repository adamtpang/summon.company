# Claude Code prompt: perfect Summon's "improve my business" front door

Paste below the line into a Claude Code session opened IN the summon.company repo.
First read `NORTH_STAR.md`, `ROADMAP.md`, `VITALS_FORMATION_ROADMAP.md`, and `CLAUDE.md`.

---

You are perfecting **summon.company** for its one purpose: **help a founder improve their
business.** Today the product can run a company of AI employees, but the front door that
proves the value to a stranger, "paste your business, get a real diagnosis and a staffed
fix", is not sharp yet. Build that front door and make it undeniable. This is the FEED and
DIAGNOSE half of the NORTH_STAR loop, productized as the acquisition surface.

## Hard constraints (read before touching anything)
- **Never point source at the live packaged database, and never restart or migrate the
  live control plane** (the VIT-14 / S0 blocker). Build this as an additive surface that a
  stranger can use WITHOUT installing the runtime: a public `/diagnose` experience.
- Additive only. Do not rename `@paperclipai/*`, `PAPERCLIP_*`, protocol, or DB names.
- No em dashes (house style). Exactly 8 departments (Product is not a 9th).
- Human-in-the-loop is the product: nothing that spends money, sends, or touches the
  founder's name happens without an explicit approve step.

## What to build

1. **The diagnosis front door (`/diagnose`).** A founder pastes a URL or describes their
   business in a sentence. Return, in under a minute:
   - **Stage**: where they are on the 8-stage roadmap (from VITALS_FORMATION_ROADMAP.md).
   - **The ONE binding constraint**: theory-of-constraints, /cofounder-style. Not a list,
     the single thing most limiting saved time, saved money, or grown revenue right now.
   - **The formation that fixes it**: which of the 8 departments to summon first, what its
     first three tasks are, and the expected vitals movement. Concrete, not generic.

2. **Ground the diagnosis in the Founders corpus.** `knowledge/` holds 48 David
   Senra / Founders episodes (810k words) plus Isenberg and Starter Story. When the
   diagnosis names a constraint, have it cite the founder precedent from the corpus
   ("Todd Graves kept Raising Cane's to one product for a decade; your constraint is focus,
   not features"). Build `lib/diagnosis/precedent.ts` that maps a diagnosed constraint to
   the most relevant corpus principle. This is the moat: no competitor's diagnosis is
   grounded in 48 real founder case studies.

3. **Make the fix startable, not just readable.** End the diagnosis with one button:
   "Summon the {department} to fix this." For a stranger with no runtime, that starts a
   guided path (email capture + the first task queued) rather than requiring an install.
   For Company Zero and installed users, it assigns the real agent. Keep the two paths
   behind one interface.

4. **Prove it on real businesses.** Run the finished `/diagnose` against 5 real inputs:
   Adam's own idiguam.com, a stranger SaaS URL, a local-SMB description, an idea-stage
   sentence, and summon.company itself. Paste the 5 diagnoses. Each must name a plausible
   single constraint and a specific first move, or fix the prompt until it does.

## Constraints on scope
Do NOT try to fix VIT-14 or the packaged runtime here. Do NOT rebuild the whole engine.
This is the front door and the diagnosis quality, the thing that makes a founder say "yes,
that is my actual problem." Everything else in the loop already exists.

## Definition of done
`/diagnose` takes any business input and returns a stage, a single named constraint with a
founder-precedent citation from the corpus, and a specific first formation with its first
three tasks, plus one button to start the fix. Typecheck and build pass. Five real
diagnoses pasted as evidence, each credible enough that a founder would pay to continue.
