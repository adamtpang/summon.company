# Corpus register

What each corpus is, where it came from, and which Summon surface should consume it.
Canonical store: **this folder**. Other repos (summon.guide) import only the processed
episode files they need for grounding — never the multi-MB raw corpora.

## How these were built

All via `youchop.app/tools/corpus.mjs` in `--local` mode: yt-dlp pulls YouTube's own
captions from a residential IP, so there is **no API key, no provider quota, and no cost**.
Verified byte-identical to the paid transcript API on a control video (18,894 words both ways).

```bash
node tools/corpus.mjs @handle --top all --local --min-minutes 3 --out ".../knowledge"
```
Each corpus folder holds `corpus.md` (concatenated, `====`-delimited), `_raw/` (per-episode
text), and `manifest.json` (rank, id, title, url, published, views, duration, word count).

## Which surface consumes what

The two products have different jobs, so the corpora split along that line:

- **summon.guide is chat and advice.** It needs a *person*: a named individual with a voice
  and a documented record, so a question gets a grounded, cited answer in that person's own
  words. Corpora of individuals talking belong here.
- **summon.company is about companies.** It needs *operating knowledge*: how businesses get
  bought, priced, sold, staffed and scaled. Corpora organised around deals, playbooks and
  case studies belong here.

Several corpora serve both, so the table marks a primary home rather than an exclusive one.
A useful rule: if the value is *who said it*, it is guide material; if the value is *what to
do on Monday*, it is company material.

## The corpora

| Corpus | Source | Episodes | Words | Primary home and why |
|---|---|---|---|---|
| `greg-isenberg/` | @GregIsenberg | 367 | 3,246,351 | **company** - idea generation, GTM, agent-design patterns |
| `alex-hormozi/` | @AlexHormozi | 493 | 2,820,134 | **company** - offers, pricing, sales, scaling |
| `founders-podcast/` | @founderspodcast1 | 163 | 2,045,329 | **guide** - core grounding for figures; 20 curated files carry `principle` + Key lessons |
| `david-senra-conversations/` | @DavidSenra | 28 | 595,699 | **guide** - living-founder figures (Lütke, Dyson, Ek, Spiegel, Mackey) |
| `starter-story/` | @StarterStory | 169 | 542,520 | **company** - concrete "how a small business actually made $X" evidence |
| `naval/` | @navalr | 66 | 307,118 | **guide** - leverage, judgment, wealth vs status; a voice, not a playbook |
| `chris-williamson/` | @ChrisWillx | 198 | 3,988,025 | **guide** - Modern Wisdom; psychology, discipline, relationships. A voice, and the single largest corpus here |
| `y-combinator/` | @ycombinator | 545 | 3,687,638 | **company** - the canonical startup playbook: Startup School, office hours, YC talks |
| `bigdeal-codie-sanchez/` | @PodcastBigDeal | 159 | 1,820,995 | **company** - buying and running small businesses, deal mechanics |
| `invest-like-the-best/` | @ILTB_Podcast | 64 | 1,047,491 | **guide** - long-form investor and operator interviews, strong named voices |
| `school-of-hard-knocks-podcast/` | @TheSchoolofHardKnocksPodcast | 69 | 908,888 | **company** - long-form version of the street-interview channel |
| `instantly/` | @InstantlyAI | 230 | 867,232 | **company** - cold email and outbound: deliverability, sequences, lead sourcing |
| `school-of-hard-knocks/` | @theschoolofhardknocks | 179 | 699,993 | **company** - street interviews on income and work; unusually concrete numbers |
| `ryan-serhant/` | @RyanSerhant | 164 | 402,777 | **company** - sales, brand building, closing; the sales-department corpus |
| `brett-hall/` | @bretthall9080 | (partial) | - | **company** - the *reasoning* layer: how agents should think, not what to think |

Counts are episodes that actually yielded a transcript, which is what `brain/pages/` holds
and what is searchable. Manifests list a few more rows per corpus: videos whose captions
were disabled. `ryan-serhant` previously read 271 here, which was its queued URL count
rather than its result.

`brett-hall` is the odd one out and the most interesting: it is not business content at all.
It is epistemology (Deutsch and Popper): how knowledge grows, why explanations matter,
error-correction. That is the natural grounding for how agents *reason and disagree well*,
which is orthogonal to every other corpus here supplying domain tactics. Only partially
extracted so far.

### Notes on the newer channels
- **"Sell It" is not a separate channel.** It is *Sell It Like Serhant*, Ryan Serhant's book
  and TV brand; only two videos on his channel carry that title. His main channel is the
  corpus that actually holds the sales material.
- **Codie Sanchez has two channels.** `@PodcastBigDeal` is the BigDeal interview show (used
  here). `@CodieSanchezCT` is her main channel, 176 videos and about 60 hours, not yet
  extracted; it is more solo-advice than interview and would lean **guide**.
- **Chris Williamson is capped on purpose.** The channel holds 2,230 videos, but most are
  short clips cut from the episodes, so the corpus takes the 200 most-viewed videos over
  20 minutes. Pulling everything would multiply near-duplicate text without adding ideas.
- **Y Combinator spans a decade.** The oldest videos are Startup School talks from 2012
  (including Zuckerberg's), so this corpus carries dated advice alongside current advice.
  Worth weighting by date for anything about present-day fundraising or AI startups.

### Coverage notes
A small number of videos have no captions published on YouTube at all and are therefore
unfetchable by any method (the manifest records them, with `words` absent):
greg-isenberg 1, starter-story 1, alex-hormozi 7, naval 12, y-combinator 8, ryan-serhant 9,
chris-williamson 2, instantly 1. Everything else is complete.
Naval's channel is mostly short clips, so its per-episode word counts are small by nature.

## Provenance and use

Every `corpus.md` carries a header stating the source is the creator's copyrighted work and
that the corpus is **private input for research and synthesis, not for republication**.

- ✅ Private grounding, synthesis, original essays with short attributed quotes + source links.
- ❌ Republishing transcripts verbatim (infringement, and these creators are youchop's customers).
- ⚠️ Public agents impersonating a **living** creator require that creator's consent —
  see `docs/HORIZON_youchop-summon-synergy.md`. Historical/public-domain figures first.

## Refreshing

Re-run the same command; already-staged episodes are skipped, so it only fetches new uploads.
Rank prefixes are derived from view counts, so a re-run after view counts shift can leave a
few orphan `_raw` files under old prefixes — harmless duplicates, `manifest.json` and
`corpus.md` remain authoritative.
