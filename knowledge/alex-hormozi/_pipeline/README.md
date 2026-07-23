# Alex Hormozi KB — pipeline (ready, not yet run)

Mirrors `../../founders-podcast/_pipeline/` exactly. Nothing here has been
imported yet; this runbook is the import-ready slot.

## Source & method
- Channel: **@AlexHormozi** on YouTube (long-form business talks and breakdowns; prefer >20 min episodes, skip shorts).
- Rank by view count into `channel-episodes.json` (rank 1 = most viewed), same as the Founders corpus.
- Transcripts through **youchop.app/api/transcripts** (Adam's own tool; Supadata backend, English-preferred, auto-fallback across providers).

## Run it (same three steps as Founders batch 1)
1. **Catalog + metadata:** build the ranked `channel-episodes.json` for @AlexHormozi via yt-dlp (`--dump-json` over the channel uploads, filter >20 min, sort by views), then copy `extract.mjs` from `../../founders-podcast/_pipeline/` (point it at this folder) and run `node extract.mjs 1 20` — sequential, ~3.5s pauses, idempotent, stops and reports on any provider cap. Raw pulls land in `../_raw/`.
2. **Clean + principles:** fan out subagents (4 episodes each) with the batch-1 spec: strip sponsor reads, paragraph the transcript verbatim, extract one <=140-char principle per episode, write `NNN-slug.md` with the standard frontmatter (`rank, title, youtube_url, youtube_id, published, duration_min, word_count, views, date_extracted, principle, tags`).
3. **Rebuild the index:** copy and run `build-index.mjs` (frontmatter -> `../INDEX.md`).

## Quota reality
Supadata free tier is about 100 transcripts/month, shared with the Founders
pipeline. A 20-episode Hormozi batch fits alongside a 20-episode Founders
batch in one month; sequence them or add a paid provider key.

## File contract
Identical to the Founders corpus: `# title` -> `> principle` callout ->
`## Key lessons` -> `## Transcript` (cleaned, verbatim).
