# Vitals data schema

`window.VITALS` is one object. Every field is optional; the renderer degrades
gracefully, so old and new data files both work. Universal fundamentals are the
same for every company; the founder fills in the specifics.

| Field | Type | Notes |
|---|---|---|
| `company` | string | Company name (header). |
| `tagline` | string | One line under the name. |
| `mission` | string | The 25-year why. |
| `problem` | string | The problem and who has it (rendered in "The problem"). |
| `northStar` | string | The one output metric that means winning. |
| `knowledgeBase` | `[{ file, desc }]` | The repo's context files. Linked as `../<file>`. |
| `finances` | `{ income, expenses, savings }` | Monthly income, monthly expenses, cash. Runway is computed. |
| `metrics` | `[{ label, value, target?, hint?, key?, next? }]` | Inputs you control. `value` = what is, `target` = what should be (shown as `value / target`), `next` = the single action to close the gap, `key` = which `history` field this charts. |
| `charts` | `[{ label, key, color? }]` | Which `history` keys to draw as trend sparklines. |
| `history` | `[{ t, ...keys }]` | Weekly snapshots. `t` is a short date; other fields match metric/chart `key`s. |
| `streak` | number | Days in a row you did a real input action. |
| `goals` | `[{ text, done }]` | Quarterly goals (the rocks). |
| `products` | `[{ name, status }]` | Status is `Live` / `Building` / `Next` / `Later` (colored). |
| `roadmap` | `[{ stage, items:[{ label, done }] }]` | Gated stages. Checked items level you up. |
| `org` | `[{ fn, now, next? }]` | Function, who owns it now, the next hire. |
| `decisions` | `[{ date, decision, why, revisit? }]` | A decision log: capture the WHY so it is never lost. |
| `levels` | `[[threshold, name], ...]` | Optional override of the gamified level names. |

## Gamification
The founder level is derived from how many `roadmap` items are `done`, against the
`levels` thresholds. The XP bar shows progress to the next level. The streak counts
input actions. No leaderboards, no trivial badges (they backfire).
