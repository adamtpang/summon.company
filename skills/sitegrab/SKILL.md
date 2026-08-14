---
name: sitegrab
description: >
  Grabs a site's homepage HTML, linked stylesheets, and sitemap, then
  extracts its design system (fonts, color palette, type scale, radii, CSS
  custom properties, page inventory) into DESIGN-NOTES.md. Studies a site's
  craft to steal the lessons, not the content. No API key needed.
---

# /sitegrab — study a website's craft and steal the lessons, not the content

Grabs a site's homepage HTML, every linked stylesheet, and its sitemap into
`~/OneDrive/Aether/site-studies/<host>/`, then extracts the design system:
fonts by use, color palette, type scale, radii, CSS custom properties, meta,
and page inventory, written to `DESIGN-NOTES.md`. No API key needed.
Script: `scripts/sitegrab.mjs` next to this file.

Trigger on: /sitegrab, "clone this site's design", "study <url>", "why is
<url> so good", "make ours as good as <url>", "grab that landing page".

## Steps

1. `node ~/.claude/skills/sitegrab/scripts/sitegrab.mjs <url>` — saves
   index.html, styles.css, sitemap.xml, DESIGN-NOTES.md.
2. READ the saved html and notes, then write the craft analysis Adam actually
   wants: what makes it feel high quality (type scale ratio, spacing rhythm,
   color restraint, hero structure, load weight, motion) and the 3 to 5
   concrete moves to apply to the target project, each mapped to a real file
   in that project.
3. When applying to summon.company, obey the standing design laws
   (doc/design/DESIGN-PRINCIPLES.md): monochrome chrome, 4/8 spacing scale,
   middot separators, hairlines over shadows, deletion first.

## Rules (hard)

- Lessons, never lifts: adopt patterns (scale, rhythm, structure, restraint);
  never copy content, copy text, brand names, logos, images, or distinctive
  phrasing. If a piece only works as a copy, it does not come over.
- Respect robots and load: one grab per run, no crawling beyond homepage,
  css, and sitemap.
- Multi-page study: rerun the script with specific URLs into the same folder.

## Firecrawl upgrade (optional)

For JS-heavy sites this static grab misses rendered DOM. The Firecrawl MCP
(firecrawl.dev) adds rendered scrapes, full-site crawls, and screenshots; it
needs an API key Adam creates himself at firecrawl.dev, then the connector
added in claude.ai settings or `claude mcp add`. Until then, the built-in
Browser pane can screenshot rendered pages as a supplement.
