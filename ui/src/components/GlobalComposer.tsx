import { useMemo, useState } from "react";
import { Building2, CornerDownLeft } from "lucide-react";
import { ChatComposer } from "./ChatComposer";
import {
  findActiveMention,
  matchMentions,
  resolveRouting,
  routingEcho,
  type ComposerRoster,
  type MentionCandidate,
  type RoutingDecision,
} from "../lib/globalComposer";
import { cn } from "../lib/utils";

/**
 * Global composer (VIT-57) — Claude-Code-parity prompting.
 *
 * One always-available prompt box that can address ANY company or agent. You
 * type, hit enter, and the right employee picks it up — **the CEO routes when
 * the target is ambiguous**. `@`-mention re-scopes across the whole roster
 * ("@Quantus-Dealmaker status?"); with no mention it lands on the scoped
 * company's CEO, exactly like talking to the company front door.
 *
 * This is the presentational half (pure props, owns only its draft/caret state)
 * so the visual and unit suites can drive it with a fixture roster — no company
 * context or network. The live container wires `roster`/`scoped*` from the
 * company + agent queries and turns `onDispatch(decision)` into a filed issue or
 * a CEO-thread message (VIT-57 backend wiring).
 *
 * All routing lives in `../lib/globalComposer` (framework-free, unit-tested);
 * this component is a thin shell over that brain.
 */

export interface GlobalComposerProps {
  roster: ComposerRoster;
  scopedCompanyId: string | null;
  scopedAgentId?: string | null;
  /** Fired when a mention selection re-scopes the composer to a company/agent. */
  onScopeChange?: (companyId: string, agentId: string | null) => void;
  /** Fired on submit with the resolved routing decision. */
  onDispatch: (decision: RoutingDecision) => boolean | void | Promise<boolean | void>;
  submitting?: boolean;
  error?: string | null;
  className?: string;
}

export function GlobalComposer({
  roster,
  scopedCompanyId,
  scopedAgentId = null,
  onScopeChange,
  onDispatch,
  submitting = false,
  error = null,
  className,
}: GlobalComposerProps) {
  const [value, setValue] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  // Live preview of where "enter" would land — the routing brain, evaluated on
  // every keystroke so the target chip and echo stay honest.
  const decision = useMemo(
    () => resolveRouting({ text: value, roster, scopedCompanyId, scopedAgentId }),
    [value, roster, scopedCompanyId, scopedAgentId],
  );

  // Autocomplete: the active `@`-token is taken from the end of the draft (the
  // common "typing at the caret" case for this quick box).
  const active = useMemo(() => findActiveMention(value, value.length), [value]);
  const suggestions = useMemo<MentionCandidate[]>(
    () => (active ? matchMentions(roster, active.query) : []),
    [active, roster],
  );

  function applyMention(candidate: MentionCandidate) {
    if (!active) return;
    const before = value.slice(0, active.start);
    const after = value.slice(active.end);
    setValue(`${before}@${candidate.handle} ${after.replace(/^\s+/, "")}`);
    onScopeChange?.(candidate.companyId, candidate.agent?.id ?? null);
  }

  async function handleSubmit() {
    const text = value.trim();
    if (!text) return;
    const resolved = resolveRouting({ text: value, roster, scopedCompanyId, scopedAgentId });
    if (!resolved.message.trim()) {
      setValidationError("Add a request after the @mention.");
      return;
    }
    setValidationError(null);
    const dispatched = await onDispatch(resolved);
    if (dispatched !== false) setValue("");
  }

  const targetLabel = decision.ambiguous
    ? `${decision.companyName ?? "Company"} CEO`
    : decision.targetKind === "agent" && decision.agent
      ? `${decision.agent.name} · ${decision.companyName}`
      : `${decision.companyName ?? "Company"} CEO`;

  return (
    <div data-testid="global-composer" className={cn("relative flex flex-col gap-1.5", className)}>
      {/* Mention autocomplete */}
      {active && suggestions.length > 0 ? (
        <ul
          data-testid="global-composer-suggestions"
          role="listbox"
          aria-label="Address a company or employee"
          className="absolute bottom-full left-0 z-30 mb-1.5 max-h-64 w-full max-w-md overflow-y-auto rounded-lg border border-border bg-popover p-1"
        >
          {suggestions.map((candidate) => (
            <li key={`${candidate.kind}:${candidate.companyId}:${candidate.agent?.id ?? "ceo"}`}>
              <button
                type="button"
                onMouseDown={(event) => {
                  // mousedown (not click) so the textarea doesn't lose focus first.
                  event.preventDefault();
                  applyMention(candidate);
                }}
                className="flex min-h-10 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span className="grid size-6 shrink-0 place-items-center rounded-md bg-accent text-muted-foreground">
                  {candidate.kind === "company" ? (
                    <Building2 className="size-3.5" aria-hidden="true" />
                  ) : (
                    <span className="text-(length:--text-micro) font-semibold">
                      {candidate.companyName.slice(0, 1)}
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate">{candidate.label}</span>
                <span className="shrink-0 text-(length:--text-micro) text-muted-foreground">
                  @{candidate.handle}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Target chip — who "enter" reaches right now. */}
      <div className="flex items-center gap-2 px-0.5 text-xs text-muted-foreground">
        <span
          data-testid="global-composer-target"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium",
            decision.ambiguous
              ? "border-(--status-agent-paused) text-foreground"
              : "border-border text-foreground",
          )}
        >
          <span className="inline-block size-1.5 rounded-full bg-primary" aria-hidden="true" />
          {targetLabel}
        </span>
        <span className="truncate" data-testid="global-composer-echo">
          {routingEcho(decision)}
        </span>
        <span className="ml-auto hidden items-center gap-1 sm:inline-flex">
          <CornerDownLeft className="size-3" aria-hidden="true" /> to send · @ to address anyone
        </span>
      </div>

      <ChatComposer
        value={value}
        onChange={setValue}
        onSubmit={handleSubmit}
        submitKey="enter"
        submitting={submitting}
        placeholder={`Message ${targetLabel}…  (@ to address anyone)`}
        sendLabel={`Send to ${targetLabel}`}
      />
      {validationError || error ? (
        <p role="alert" className="px-0.5 text-xs text-destructive">
          {validationError ?? error}
        </p>
      ) : null}
    </div>
  );
}
