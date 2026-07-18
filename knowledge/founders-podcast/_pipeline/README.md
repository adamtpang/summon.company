# Founders Podcast KB — pipeline

How this knowledge base is built, and how to add the next batch of 20.

## Source & method
- Channel: **@founderspodcast1** (David Senra's solo Founders episodes) — 162 full episodes (>20 min).
- Ranked by view count in [`channel-episodes.json`](channel-episodes.json) (rank 1 = most viewed).
- Transcripts pulled through **youchop.app/api/transcripts** (the user's own app; Supadata backend, English-preferred).
- Files are numbered by **popularity rank**, not canonical podcast episode number — the YouTube channel's episodes don't carry the audio feed's #1–380 numbering.

## Reality checks
- **Supadata free tier ≈ 100 transcripts/month.** Batch 1 (20) succeeded with headroom. A full 162-episode sweep spans ~2 months on the free tier, or add another provider (Apify `APIFY_TOKEN`, or paid) — the youchop endpoint auto-falls-back across providers.
- Each episode ≈ 5k–27k words. Clean transcript ≈ raw minus sponsor reads (Ramp, Vanta, Vesto, Founders Notes).

## Add the next batch (e.g. ranks 21–40)
1. **Metadata** for the range (dates/durations/views + descriptions), then transcripts:
   - Regenerate `metadata.json` for the range via yt-dlp (`--dump-json` on the ranked URLs), then
   - `node extract.mjs 21 40` — sequential, ~3.5s pauses, idempotent (skips already-staged), stops+reports on any provider cap.
2. **Clean + principles:** fan out ~5 subagents (4 episodes each) with the batch-1 spec: strip ads, paragraph the transcript verbatim, identify subject + source_book, extract one <=140-char principle, write `NNN-slug.md` with the standard frontmatter.
3. **Rebuild the index:** `node build-index.mjs` (parses every `NNN-*.md` frontmatter → `INDEX.md`; CRLF/BOM-tolerant).

## File contract (every episode .md)
Frontmatter: `rank, title, subject, company?, source_book?, youtube_url, youtube_id, published, duration_min, word_count, views, date_extracted, principle, tags`.
Body: `# title` → `> Founder principle` callout → `## Key lessons` (synthesis) → `## Transcript` (cleaned, verbatim).

## Folders
- `NNN-*.md` — the episodes (primary knowledge).
- `INDEX.md` — generated index (principle + source per episode).
- `_raw/` — raw transcripts as pulled (insurance; re-clean without re-extracting / re-spending quota).
- `_pipeline/` — this runbook, the ranked catalog, and the scripts.
