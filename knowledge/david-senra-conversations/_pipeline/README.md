# David Senra Interview Show — pipeline

How this show's knowledge base is built.

## Source & method
- Channel: **@DavidSenra** (long-form interviews with living founders) — 28 full episodes.
- Ranked by view count in [`channel-episodes.json`](channel-episodes.json).
- Transcripts pulled through **youchop.app/api/transcripts** (Supadata backend, English-preferred).
- Files numbered by **popularity rank**. **Complete** as of the extraction date — all 28 done.

## Format specifics (differs from the solo Founders show)
- These are **interviews** → frontmatter carries `guest`, `host: David Senra`, `company`, `format: interview` (no `source_book`).
- Source transcripts are **undiarized** (no speaker names) but carry `>>` turn markers, which the cleaner reflows into paragraphs — no fabricated "David:/Guest:" labels.
- **Ad-read caution:** several guests are founders of the show's sponsors (e.g. ep 28 = Eric Glyman of Ramp; ep 21 = AppLovin). Only the scripted host ad reads are removed; substantive discussion of those companies is kept verbatim.

## Refresh the index
`KB_DIR="…/david-senra-conversations" node build-index.mjs`
(title/subtitle come from `_index-config.json` in this folder; the builder is CRLF/BOM-tolerant and handles both `guest`/`company` and `subject`/`source_book` schemas.)

## Add new interviews as they publish
1. Re-enumerate the channel with yt-dlp, regenerate `metadata.json` for the new ranks.
2. `STAGING_DIR=… METADATA_PATH=… node extract.mjs <from> <to>` (sequential, polite, idempotent, stop-on-cap).
3. Fan out ~1 subagent per 4 episodes with the interview spec; rebuild the index.

## Folders
- `NNN-*.md` — the interviews. `INDEX.md` — generated. `_raw/` — raw transcripts (insurance). `_pipeline/` — this runbook, catalog, scripts.
