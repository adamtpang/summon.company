# Summon Artifact Kit

One aesthetic, everywhere a stranger meets Summon — decks, social banners, OG
images. Every artifact here is a self-contained HTML page that reads the **same
token source** the app and landing ship: [`../tokens.css`](../tokens.css) (the
Summon Blue brand system). Nothing is a hand-copied hex. Retune a token there
and every artifact in this folder re-skins.

> The app *chrome* (`ui/src/index.css`) is deliberately monochrome — colour is
> reserved for data. This kit governs the **outward brand** surfaces a stranger
> sees, which use the Summon Blue system, matching the landing and `og.png`.

## What's here

| File | Surface | Notes |
|------|---------|-------|
| `index.html` | **Brand reference page** (design.summon.company) | Live palette, type scale, mark, voice. Swatches read resolved token values — zero hand-typed hex. Links the [Claude Design project](https://claude.ai/design/p/f3f2637c-e50a-4470-8ebb-f6873a076e39). |
| `deck.html` | **Deck template** | 16:9 keyboard-navigable slides (← → / space). `pdf` button prints to PDF. Filled with the Summon pitch as a worked example. |
| `banners.html` | **Social banner set** | X header (1500×500), OG (1200×630), Discord (960×540), community cover (1920×1080). Each frame carries `--w`/`--h` and an `id`. |
| `brand.css` | **Artifact primitives** | Frames, lockup, EKG mark, type roles. Adds no values of its own — pure token composition. |
| `directory-submission-kit.md` | **Directory & MCP-registry copy** (SUM-134 lane 4) | Postable listing copy for Product Hunt, Show HN, G2/Capterra, There's An AI For That, Futurepedia, AlternativeTo, BetaList, MCP registries. Board submits one venue at a time; tracker at the bottom. |

## The rule

If a value is not a token in `tokens.css`, it does not belong in an artifact.
This is the whole point: one knob, one aesthetic. Do not paste hex codes into a
deck or a banner — reference `var(--token)`.

## Rasterising to PNG

Each banner frame renders at true pixel size. To export a PNG, size the viewport
to the frame and screenshot it. Headless Chrome/Edge:

```sh
# X header — 1500×500
msedge --headless --disable-gpu --hide-scrollbars \
  --window-size=1500,500 --default-background-color=00000000 \
  --screenshot=x-header.png \
  "banners.html#x-header"
```

Or open the page in a browser, set the device toolbar to the frame's exact
pixel size, and capture the node. The deck exports via its **pdf** button
(`@page` is set to 1280×720 landscape — one slide per page).

The OG frame (`#og`, 1200×630) is the source for `../og.png`; re-export it here
whenever the tagline or tokens change so the link preview stays in sync.

## Deploy (design.summon.company)

This folder ships with the landing Vercel project. `index.html` is the brand
page. To resolve it at `design.summon.company`, add the CNAME/alias in Vercel and
deploy from `apps/landing` (`vercel --prod`). DNS + deploy is a Marketing/founder
action — see the linked child issue.
