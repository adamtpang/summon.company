# Summon design principles: what the best interfaces of all time teach, baked into our tokens

Board ask, 2026-07-22: "do some research on the best uis of all time and their design principles and lets bake those into our apps." This is the distillation and the enforcement map. It complements the existing surface docs (TOKEN-AUDIT.md, COMPONENT-INVENTORY.md, CHANGING-THE-UI.md) and the standing laws (monochrome chrome, glass on elevation only, no em dashes).

## Where the principles come from

- **Dieter Rams (Braun)**: good design is as little design as possible. Every element must earn its place.
- **Apple Human Interface Guidelines**: deference (chrome recedes, content leads), clarity, depth used sparingly to signal hierarchy.
- **Edward Tufte**: maximize data-ink. Every pixel that is not information is a candidate for deletion.
- **Swiss typographic grid (Muller-Brockmann)**: alignment to an invisible grid is what makes a page feel calm before anyone reads a word.
- **Fitts and Hick (interaction laws)**: bigger and closer targets are faster; fewer choices are faster. The next best action should be the biggest, nearest thing on screen.
- **Linear, Stripe, Vercel (the modern canon)**: one accent at a time, dense but rhythmic spacing on an 8px base, hairline borders over shadows, motion under 200ms only to explain causality.
- **The 8pt grid literature**: spacing in multiples of 8 (4 for fine rhythm) is the industry baseline because screens divide evenly by it and the eye reads the repetition as calm.

## The ten laws, mapped to enforcement

1. **One next action per screen.** Every surface answers "what should I do now" with exactly one visually dominant element. Dashboard: the Next-move card. Chat: the composer plus priority chips. If two things compete, demote one.
2. **Chrome is monochrome, color is data.** White and near-black chrome; color only for status, scores, and destructive actions. Tokens: the score spectrum (`--score-s` to `--score-f`), status hues. Never decorate with color.
3. **The 4/8 spacing scale is law.** All padding, margins, and gaps are Tailwind steps on the 4px base (p-1, p-2, p-3, p-4, p-6, p-8). No arbitrary values like `p-[13px]`. If a layout needs a new size, it takes the nearest step, not a custom number.
4. **One separator glyph.** Inline metadata separates with the middot (`·`). Not em dashes (banned house-wide), not pipes, not slashes.
5. **Hairlines over shadows.** Elevation inside the app is a `border-border` hairline or law-13 glass, never a drop shadow. Shadows are reserved for true overlays (menus, dialogs, toasts).
6. **Text sizes come from the type scale.** `--text-nano` eyebrows, xs metadata, sm body, base titles. A surface introduces no new sizes.
7. **Every ticket reference carries its one-liner.** An identifier alone (SUM-115) is jargon; identifier plus short title is language. Applies to chips, cards, briefs, agent messages.
8. **Empty states teach the next move.** No dead ends: an empty list says what will fill it and offers the action that does.
9. **Motion explains, never entertains.** 150ms ease transitions on hover and reveal, staged reveals only where causality matters (typing, then message, then chips). Nothing loops, nothing bounces.
10. **Deletion is the default improvement.** When a surface feels wrong, remove elements before adding any. Via negativa passes are scheduled work, not emergencies.

## The audit ritual

Any new surface or redesign PR answers five questions in the description:
1. What is the one next action, and is it visually dominant?
2. Are all spacings on the 4/8 scale?
3. Does any color appear that is not data?
4. What was deleted?
5. Does it read correctly at 360px wide and in dark mode?

Sources: the 8pt grid canon ([wpdean](https://wpdean.com/what-is-the-8-point-grid-system/), [rejuvenate.digital](https://www.rejuvenate.digital/news/designing-rhythm-power-8pt-grid-ui-design)), Apple HIG, Rams' ten principles, Tufte's data-ink ratio, and the visible practice of Linear, Stripe, and Vercel.
