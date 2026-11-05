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
| `y-combinator/` | @ycombinator | 550 | 3,734,930 | **company** - the canonical startup playbook: Startup School, office hours, YC talks |
| `bigdeal-codie-sanchez/` | @PodcastBigDeal | 159 | 1,820,995 | **company** - buying and running small businesses, deal mechanics |
| `invest-like-the-best/` | @ILTB_Podcast | 64 | 1,047,491 | **guide** - long-form investor and operator interviews, strong named voices |
| `school-of-hard-knocks-podcast/` | @TheSchoolofHardKnocksPodcast | 69 | 908,888 | **company** - long-form version of the street-interview channel |
| `instantly/` | @InstantlyAI | 230 | 867,232 | **company** - cold email and outbound: deliverability, sequences, lead sourcing |
| `school-of-hard-knocks/` | @theschoolofhardknocks | 179 | 699,993 | **company** - street interviews on income and work; unusually concrete numbers |
| `ryan-serhant/` | @RyanSerhant | 164 | 402,777 | **company** - sales, brand building, closing; the sales-department corpus |
| `john-vervaeke/` | @johnvervaeke | 509 | 5,999,443 | **guide** - relevance realization, meaning crisis, cognitive science; the largest corpus here by 1.5x |
| `visakan-veerasamy/` | @visakanv | 403 | 1,202,657 | **guide** - sensemaking, noticing, writing/thinking out loud; a distinctive voice, not a playbook |
| `jack-friks/` | @jackfriks0 | 372 | 363,956 | **company** - indie-hacker build-in-public: shipping, marketing, solo SaaS tactics |
| `arjun-khemani/` | @arjunkhemani | 58 | 505,040 | **guide** - critical rationalism interviews; same reasoning-layer register as brett-hall |
| `marc-lou/` | @marc-lou | 68 | 209,167 | **company** - ShipFast creator; rapid solo-SaaS build/launch/monetize tactics |
| `lulie-tanett-reason-is-fun/` | @ReasonIsFun | 8 | 82,161 | **guide** - Lulie Tanett's show; critical rationalism with David Deutsch and guests |
| `mix-with-the-masters/` | @mixwiththemasters | 21 | 123,535 | **guide** - legendary mixing/production engineers on their actual craft; a new category, not business or reasoning |
| `starter-story-build/` | @StarterStoryBuild | 64 | 325,605 | **company** - Starter Story's build-focused spin-off channel; distinct from `starter-story/` |
| `sequoia-capital/` | @sequoiacapital | 173 | 1,374,751 | **company** - Training Data podcast, founder interviews; VC-perspective operating knowledge |
| `dave-ramsey/` | @DaveRamsey | 71 | 15,023 | **guide** - short clips only, thin by design; see note below before relying on this one |
| `conjecture-con/` | @conconeurope | 18 | 76,013 | **guide** - Conjecture Con talks; fourth member of the reasoning-layer cluster, includes a David Deutsch Q&A |
| `elan-lee/` | @ElanLee | 20 | 68,562 | **company** - Exploding Kittens co-creator on board game design, prototyping, publishing, marketing craft |
| `gdc-festival-of-gaming/` | @GDCFestivalofGaming | 96 | 841,725 | **company** - top 100 by views of 1,912; GDC talks and postmortems (DOOM, Diablo, Magic: the Gathering) |
| `crayon-capital/` | @Crayon_Capital | 27 | 59,114 | **company** - "explained like you're 5" business/finance history case studies (Rockefeller, Bezos, 2008 crisis) |
| `ray-dalio/` | @principlesbyraydalio | 155 | 221,794 | **guide** - Principles animated explainers; already has an ungrounded chat figure on summon.guide |
| `joe-lonsdale/` | @Joe_Lonsdale | 267 | 1,603,755 | **company** - Palantir/8VC co-founder; venture, defense tech, and American Optimist interviews |
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

- **John Vervaeke is a living creator, not contacted.** He is grounded as a public chat figure
  on summon.guide (`figureSources.ts`, slug `vervaeke`, 6 curated episodes as of 2026-08-05) as
  a deliberate exception, matching existing site practice: ~20 other living figures (Musk,
  Bezos, Buffett, Naval, Deutsch, and others) are already live there without individual consent.
  See `docs/HORIZON_youchop-summon-synergy.md`'s "living creators only by invitation" rule —
  that rule describes what the site is not actually doing today, not a constraint this corpus
  respects. Worth revisiting if the site ever moves toward enforcing it.
- **"Lulie Tanett" is the `@ReasonIsFun` channel, not a separate one.** Her show is titled
  Reason Is Fun; a video description confirms it ("Lulie Tanett and David Deutsch are joined
  again by..."). Folder is named for the channel handle, same convention as every other corpus.
- **The reasoning-layer cluster now has four members: brett-hall, arjun-khemani,
  lulie-tanett-reason-is-fun, and conjecture-con.** All are critical-rationalism (Deutsch/Popper)
  material, three featuring David Deutsch directly (a Q&A on `conjecture-con`, guest appearances
  on the other two). This is the natural set for "how should an agent reason and update," distinct
  from every domain-tactics corpus above.
- **Jack Friks and Marc Lou are both indie-hacker build-in-public channels**, extracted with a
  low 2-minute floor rather than the 15-20 minute floor used for podcast-style corpora, because
  their median video is under 5 minutes: a high floor would have gutted the actual content
  rather than filtered clips. Marc Lou is the ShipFast creator; Jack Friks does solo-SaaS
  build/ship/market logs.
- **Visakan Veerasamy skews short and wide-ranging** (21s to 2hr, median ~10min), so a 3-minute
  floor was used to drop pure Shorts while keeping his typical videos. A writer/essayist voice
  (sensemaking, noticing, thinking in public), not a business-tactics source.
- **Mix With The Masters is a new category: craft/technique, not business or reasoning.** Of
  561 videos, 536 are 2-3 minute "Trailer" clips promoting the channel's paid full masterclasses;
  only 25 are the actual substantive content (extended Q&As and live workshops with engineers
  like Andy Wallace, Steve Albini, Michael Brauer, Manny Marroquin, Jack Joseph Puig, Tchad
  Blake, and Andrew Scheps). A 20-minute floor was used specifically to isolate that set and
  skip all the trailers, which is a different reason from every other floor choice in this file
  (those exclude Shorts; this excludes marketing copy for content the corpus can't access
  anyway, since the full paid masterclasses aren't on YouTube at all).
- **`starter-story-build` is a genuinely separate channel from `starter-story`**, confirmed by
  channel ID (`UCLbKt4FZKk41HwZ2A3Mnz4Q` vs `UChhw6DlKKTQ9mYSpTfXUYqA`), not a duplicate or
  alias. All 64 videos are substantive (6-47 min, no Shorts problem), all yielded transcripts.
- **`y-combinator` was re-run and picked up 5 new episodes** (545 → 550, +47,292 words) since
  its original extraction, confirming the refresh behaviour described below actually works:
  already-staged episodes are skipped, only new uploads are fetched.
- **`ray-dalio` fills a real gap: he already has a chat persona on summon.guide with zero
  grounding**, same situation John Vervaeke was in before his figure was grounded. This corpus
  (155 episodes from `@principlesbyraydalio`, his animated Principles explainer channel) is
  ready for the same treatment: hand-pick episodes, write synthesis, wire into
  `figureSources.ts`. Not yet done, just no longer blocked on missing source material.
- **`dave-ramsey` is deliberately the thin option and knows it.** `@DaveRamsey` is his personal
  clips channel (median ~65s, max under 5min), not `@TheRamseyShowEpisodes` (357 full ~2hr
  episodes, likely 5-7M words, not yet extracted). Chosen on purpose over the full show for
  extraction time, so 15,023 words across 71 episodes is expected, not a failure. If richer
  Dave Ramsey grounding is ever needed, the full show is the known, larger option waiting.
- **`gdc-festival-of-gaming` is capped at the top 100 by views out of 1,912 total**, same
  pattern as `chris-williamson`: a 5-minute floor first drops pure announcement clips, then
  the 100 most-viewed of what remains are taken. The channel spans a decade of GDC talks;
  view count is doing the work of surfacing the ones that actually mattered.

### Coverage notes
A small number of videos have no captions published on YouTube at all and are therefore
unfetchable by any method (the manifest records them, with `words` absent):
greg-isenberg 1, starter-story 1, alex-hormozi 7, naval 12, y-combinator 8, ryan-serhant 9,
chris-williamson 2, instantly 1, john-vervaeke 7, jack-friks 1, marc-lou 1, visakan-veerasamy 12,
mix-with-the-masters 4 (of its 25-video filtered set).
Everything else is complete (arjun-khemani, lulie-tanett-reason-is-fun, starter-story-build,
and sequoia-capital all 100%).
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
