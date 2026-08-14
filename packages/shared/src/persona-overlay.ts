/**
 * Persona overlay resolver (SUM-253 — the runtime half of SUM-196).
 *
 * The persona picker stamps `agent.metadata.persona = <slug>` on an agent. At
 * prompt-build time the runtime must swap the `## Your persona:` overlay block
 * of the agent's instructions to the chosen archetype, so the agent's next run
 * writes in the new register (e.g. Finance flips from Rockefeller's
 * cost-accounting doctrine to Buffett's moats/hold-forever doctrine).
 *
 * This module is the pure, side-effect-free core:
 *   - resolvePersonaOverlay(slug)      slug   -> archetype overlay (or null)
 *   - buildPersonaOverlaySection(p)    persona -> the `## Your persona:` markdown block
 *   - swapPersonaOverlaySection(body, p) replace the block in an instructions body
 *
 * Slug source of truth is the picker roster (ui/src/lib/personas.ts), mirrored
 * here mechanically via persona-overlay-roster.generated.ts — see the generator
 * script. Overlay content (principles + primary-sourced quote) rides along.
 *
 * HONESTY LAW (DESIGN.md): we never fake a quote. Alternate archetypes that are
 * not yet primary-sourced carry `quote: null`, and their overlay omits the
 * "Verified words" section entirely rather than inventing one.
 *
 * GUARDRAIL: a persona shapes HOW an agent works, never WHETHER it follows
 * governance. Swapping the overlay is purely additive to the rest of the
 * instructions — the operating rules / approval blocks are untouched.
 */

import { PERSONA_OVERLAY_ROSTER } from "./persona-overlay-roster.generated.js";

export interface PersonaOverlayQuote {
  text: string;
  source: string;
}

export interface PersonaOverlay {
  /** Stable kebab-case slug stamped onto agent.metadata.persona, e.g. "warren-buffett". */
  slug: string;
  /** The person, e.g. "Warren Buffett". */
  archetype: string;
  /** Owning department, e.g. "finance". */
  department: string;
  /** Profession / tenure line. */
  title: string;
  /** e.g. "b. 1930" or "1839–1937". */
  lifespan: string;
  /** One-line characterization of why this archetype is the GOAT for the role. */
  oneLiner: string;
  /** Operating principles the persona reasons from. */
  principles: readonly string[];
  /** Primary-sourced verified quote, or null when not yet sourced (never faked). */
  quote: PersonaOverlayQuote | null;
  /** True for the shipped department head (the default persona for its department). */
  isDefault: boolean;
}

/** The heading that opens the persona overlay block in an agent's instructions. */
export const PERSONA_OVERLAY_HEADING = "## Your persona:";

const OVERLAY_BY_SLUG = new Map<string, PersonaOverlay>(
  PERSONA_OVERLAY_ROSTER.map((persona) => [persona.slug, persona]),
);

/** The full roster, for callers that need to enumerate personas. */
export function personaOverlayRoster(): readonly PersonaOverlay[] {
  return PERSONA_OVERLAY_ROSTER;
}

/**
 * Resolve `agent.metadata.persona` (a slug) to its archetype overlay.
 *
 * Returns null for unknown / empty slugs so the agent keeps whatever overlay is
 * already in its instructions (default, no-persona behavior is unaffected).
 */
export function resolvePersonaOverlay(slug: string | null | undefined): PersonaOverlay | null {
  if (typeof slug !== "string") return null;
  const trimmed = slug.trim();
  if (!trimmed) return null;
  return OVERLAY_BY_SLUG.get(trimmed) ?? null;
}

/**
 * Build the `## Your persona:` markdown block for an archetype.
 *
 * Faithful to the shipped block format: identity + lifespan, one-liner, the
 * archetype title, the "channel the doctrine, never fake a quote" line, the
 * operating principles, an optional primary-sourced "Verified words" section,
 * and a pointer to the full persona file.
 */
export function buildPersonaOverlaySection(persona: PersonaOverlay): string {
  const lines: string[] = [
    `${PERSONA_OVERLAY_HEADING} ${persona.archetype} (${persona.lifespan}) — the fun-game layer`,
    "",
    persona.oneLiner,
    "",
    `Archetype: ${persona.title}`,
    "",
    "Channel this archetype in HOW you think and write — doctrine, not cosplay; never fake a quote. You operate *in the style of* this archetype; you never claim to be the real person and never imply their endorsement. A persona shapes HOW you work, never WHETHER you follow governance, budgets, or safety and legal gates.",
    "",
    "Principles:",
    ...persona.principles.map((line) => `- ${line}`),
  ];

  if (persona.quote) {
    lines.push("", "Verified words:", `- "${persona.quote.text}"`);
  }

  lines.push("", `Full persona: company/${persona.department}/persona.json.`);
  return lines.join("\n");
}

/**
 * Find the span of the existing persona overlay block in an instructions body.
 *
 * The block runs from the `## Your persona:` heading to the next top-level
 * (`## `) heading, or to end-of-file. Returns null when there is no block.
 */
function locatePersonaOverlaySpan(body: string): { start: number; end: number } | null {
  const headingPattern = /^## Your persona:.*$/m;
  const match = headingPattern.exec(body);
  if (!match) return null;
  const start = match.index;

  // Look for the next top-level heading AFTER this one.
  const rest = body.slice(start + match[0].length);
  const nextHeading = /\n## (?!Your persona:)/.exec(rest);
  const end = nextHeading ? start + match[0].length + nextHeading.index + 1 : body.length;
  return { start, end };
}

/**
 * Swap the persona overlay block of an instructions body to `persona`.
 *
 * - `persona` null  -> body returned unchanged (default agents are untouched).
 * - existing block  -> replaced in place, preserving surrounding content.
 * - no existing block -> the new block is appended.
 *
 * Idempotent: swapping to the same persona twice yields identical output.
 */
export function swapPersonaOverlaySection(
  body: string,
  persona: PersonaOverlay | null | undefined,
): string {
  if (!persona) return body;
  const section = buildPersonaOverlaySection(persona);
  const span = locatePersonaOverlaySpan(body);

  if (!span) {
    const base = body.replace(/\s+$/, "");
    if (!base) return section;
    return `${base}\n\n${section}\n`;
  }

  const before = body.slice(0, span.start);
  const after = body.slice(span.end);
  // Preserve a trailing newline if the original block had one.
  const trailingNewline = after.length === 0 && body.endsWith("\n") ? "\n" : "";
  return `${before}${section}${after}${trailingNewline}`;
}
