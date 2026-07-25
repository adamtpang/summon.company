# Knowledge Base — David Senra / Founders

Founder principles distilled from **David Senra's two shows**, as clean markdown for Summon's AI agents to draw on when advising CEOs. All transcripts extracted via [youchop.app/extract](https://youchop.app/extract).

**48 episodes · ~810,000 words** across two shows:

| Show | What | Episodes | Words | Index |
|---|---|---|---|---|
| **Founders Podcast** | David's solo episodes — one founder per episode, read from a biography | 20 (of 162) | 246k | [`founders-podcast/INDEX.md`](founders-podcast/INDEX.md) |
| **David Senra — Interview Show** | Long-form conversations with living founders | 28 (complete) | 564k | [`david-senra-conversations/INDEX.md`](david-senra-conversations/INDEX.md) |

Episodes are numbered by **popularity rank** (view count) — the YouTube channels don't carry canonical podcast numbers. The Founders Podcast set is batch 1 (top 20 by views); the remaining ~142 episodes can be added in batches (see `founders-podcast/_pipeline/`).

## How each episode file is structured
Frontmatter → `# title` → a one-line **principle** callout → **Key lessons** (synthesis, traceable to the transcript) → the full cleaned **Transcript** (sponsor ad reads removed, David's/the guest's words verbatim).
- Solo episodes carry `subject` + `source_book`; interviews carry `guest` + `host` + `company` + `format: interview`.
- Every file's `principle` (≤140 chars) is the one lesson that episode teaches — useful as a quick retrieval key.

## Overlap worth knowing
A few founders appear in **both** shows from different angles — e.g. **Elon** ("How Elon Thinks", solo book-reading vs. interview) and **James Dyson** (solo "Stubborn Genius" vs. the "5,127 Prototypes" interview). These are distinct episodes, not duplicates: the solo ones distill a biography, the interviews are the founder in their own words. Both are valuable context.

## Folders
- `founders-podcast/` — solo episodes, `INDEX.md`, `_raw/` (raw transcripts), `_pipeline/` (runbook + catalog + scripts).
- `david-senra-conversations/` — interview episodes, same layout.

## Books (distilled frameworks)
Book PDFs stay out of git (summon.guide convention); distillations live in [`books/`](books/README.md):
- **$100M Offers** (Alex Hormozi) - value equation, Grand Slam Offer construction, premium pricing. [`books/100m-offers.md`](books/100m-offers.md)
- **$100M Leads** (Alex Hormozi) - core four advertising, Rule of 100, lead getters. [`books/100m-leads.md`](books/100m-leads.md)
- **How to Make a Few Billion Dollars** (Brad Jacobs) - big trends, disciplined M&A, electric meetings. [`books/how-to-make-a-few-billion-dollars.md`](books/how-to-make-a-few-billion-dollars.md)
- **The Book of Elon** (Eric Jorgenson) - The Algorithm, first principles, effectiveness before efficiency. [`books/the-book-of-elon.md`](books/the-book-of-elon.md)

## Channel slots ready for import (youchop.app)
- **Alex Hormozi** (@AlexHormozi) - slot scaffolded at [`alex-hormozi/`](alex-hormozi/INDEX.md), runbook in its `_pipeline/`. Not yet imported.
