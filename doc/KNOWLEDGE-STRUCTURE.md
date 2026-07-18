# How company knowledge is stored in Summon

Board directive (2026-07-18): every company gets one predictable knowledge layout
so agents and humans always know where truth lives. The primary workspace is the
knowledge base (NORTH_STAR doctrine); this file defines its shape.

## The layout

```
<workspace root>/
  knowledge/
    INDEX.md          <- one line per file: what it is, where it came from, date
    fundraising/      <- raises, investor lists, decks, term context
    product/          <- specs, roadmaps, technical truth
    market/           <- competitors, customers, research
    people/           <- who's who: partners, hires, key relationships
    history/          <- decisions made and why; post-mortems; founder lore
```

## The rules

1. **Provenance or it doesn't go in.** Every file states where it came from
   (person, chat export, URL) and its date. Unverified claims are marked as
   claims — agents must treat them as framing, not fact (the 11x rule).
2. **INDEX.md is the front door.** One line per file. An agent reads the index
   first, then only the files its task needs.
3. **Personal content stays out.** Chat exports are cleaned before import
   (strip personal/logistical chatter, payment details, anything the source
   wouldn't want an agent quoting).
4. **Stale numbers are poison.** Files carrying figures (valuations, prices,
   dates) get a "confirm before quoting externally" flag and an as-of date.
5. **Agents cite paths.** Any claim an agent makes from knowledge/ carries the
   file path, so the board can audit the chain in one click.

First live use: Quantus fundraising context (knowledge/fundraising/
joe-quantus-clean.md — cleaned WhatsApp export from Joe Mattia, 2026-07-18).
