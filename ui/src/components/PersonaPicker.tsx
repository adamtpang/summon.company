import { useState } from "react";
import { Check, Lock, Quote as QuoteIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  DEPARTMENTS,
  type DepartmentKey,
  type Persona,
  personaMonogram,
  personasForDepartment,
} from "../lib/personas";
import { isPersonaUnlocked, personaUnlockLabel } from "../lib/persona-unlock";
import { PersonaPortrait } from "./PersonaPortrait";

export { personaMonogram };

/**
 * A single collectible-style persona card. Monochrome by law (chrome is white/black;
 * color is data only): illustrated portrait mark + primary ink, never a photo hue.
 * Locked cards stay visible but cannot be selected until the roadmap stage unlocks.
 */
export function PersonaCard({
  persona,
  selected,
  locked = false,
  onSelect,
  className,
}: {
  persona: Persona;
  selected: boolean;
  locked?: boolean;
  onSelect?: (persona: Persona) => void;
  className?: string;
}) {
  const interactive = typeof onSelect === "function" && !locked;
  const unlockLabel = personaUnlockLabel(persona);
  return (
    <button
      type="button"
      role={interactive || locked ? "radio" : undefined}
      aria-checked={interactive || locked ? selected : undefined}
      aria-disabled={locked || undefined}
      aria-label={
        locked
          ? `${persona.archetype} — locked until ${unlockLabel ?? "a later roadmap stage"}`
          : `${persona.archetype} — ${persona.title}`
      }
      data-state={selected ? "checked" : locked ? "locked" : "unchecked"}
      disabled={!interactive}
      onClick={interactive ? () => onSelect?.(persona) : undefined}
      className={cn(
        "group relative flex w-full flex-col overflow-hidden rounded-lg border text-left",
        "motion-safe:transition-(--tp-transform-border-color-box-shadow) motion-safe:duration-150",
        interactive && "hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        selected
          ? "border-primary ring-1 ring-primary shadow-sm"
          : locked
            ? "border-border/70 bg-muted/20"
            : "border-border hover:border-primary/40",
        (!interactive || locked) && "cursor-default",
        className,
      )}
    >
      <div className="relative h-24 border-b border-border/70">
        <PersonaPortrait
          archetype={persona.archetype}
          motif={persona.portraitMotif}
          locked={locked}
        />
        {persona.isDefault ? (
          <span className="absolute top-2 right-2 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-primary">
            Default
          </span>
        ) : null}
        {locked ? (
          <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full border border-border bg-background/90 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
            <Lock className="h-2.5 w-2.5" aria-hidden />
            Locked
          </span>
        ) : selected ? (
          <span className="absolute top-2 left-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-3 w-3" />
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div>
          <div className="text-sm font-semibold leading-tight">{persona.archetype}</div>
          <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            {persona.title}
            <span className="text-muted-foreground/60"> · {persona.lifespan}</span>
          </div>
        </div>

        {locked && unlockLabel ? (
          <p className="text-xs leading-snug text-muted-foreground">
            Unlocks at <span className="font-medium text-foreground">{unlockLabel}</span> on the company roadmap.
          </p>
        ) : (
          <p className="text-xs leading-snug text-muted-foreground line-clamp-3">
            {persona.oneLiner}
          </p>
        )}

        {!locked && persona.principles.length > 0 ? (
          <ul className="mt-auto space-y-1 pt-1">
            {persona.principles.slice(0, 3).map((p, i) => (
              <li key={i} className="flex gap-1.5 text-[11px] leading-snug text-foreground/75">
                <span aria-hidden className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                <span className="line-clamp-1">{p}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {!locked && persona.quote ? (
          <figure className="mt-1 border-t border-border/60 pt-2">
            <blockquote className="flex gap-1.5 text-[11px] italic leading-snug text-foreground/80">
              <QuoteIcon aria-hidden className="mt-0.5 h-3 w-3 shrink-0 text-primary/50" />
              <span className="line-clamp-3">{persona.quote.text}</span>
            </blockquote>
          </figure>
        ) : null}
      </div>
    </button>
  );
}

/**
 * PersonaPicker — the "fun-game" roster (SUM-196). A glass modal deck (DESIGN.md
 * law 13) that lets the board choose or swap the hero archetype a department's AI
 * employee embodies. Alternates unlock as roadmap stages complete.
 *
 * Two clicks from rest when unlocked: open the deck, click a card.
 */
export function PersonaPicker({
  value,
  onChange,
  department,
  agentName,
  reachedStageSequence = 0,
  children,
}: {
  /** Currently selected persona slug, if any. */
  value?: string | null;
  onChange: (persona: Persona) => void;
  /** The department this seat belongs to — its set opens first. */
  department?: DepartmentKey;
  /** The AI employee that holds the seat, e.g. "Ledger". */
  agentName?: string;
  /** Highest completed roadmap stage sequence (0 = only defaults unlocked). */
  reachedStageSequence?: number;
  /** The trigger (e.g. the current-persona chip / an "Choose persona" button). */
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [activeDept, setActiveDept] = useState<DepartmentKey>(department ?? "engineering");

  const handleOpenChange = (next: boolean) => {
    if (next) setActiveDept(department ?? activeDept);
    setOpen(next);
  };

  const seat = DEPARTMENTS.find((d) => d.key === activeDept);
  const roster = personasForDepartment(activeDept);

  const handleSelect = (persona: Persona) => {
    if (!isPersonaUnlocked(persona, reachedStageSequence)) return;
    onChange(persona);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Choose {seat ? `${seat.label}'s` : "a"} persona
          </DialogTitle>
          <DialogDescription>
            {agentName ? (
              <>
                Swap the archetype <span className="font-medium text-foreground">{agentName}</span> embodies —
                same job, new register. Alternates unlock as the company clears roadmap stages.
              </>
            ) : (
              <>Pick a hero archetype. Alternates unlock as the company clears roadmap stages.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div
          role="tablist"
          aria-label="Department"
          className="-mx-1 flex flex-wrap gap-1 border-b border-border/60 px-1 pb-3"
        >
          {DEPARTMENTS.map((d) => {
            const active = d.key === activeDept;
            return (
              <button
                key={d.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveDept(d.key)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                {d.label}
              </button>
            );
          })}
        </div>

        <div
          role="radiogroup"
          aria-label={`${seat?.label ?? ""} personas`}
          className="grid max-h-[60vh] grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3"
        >
          {roster.map((persona) => {
            const unlocked = isPersonaUnlocked(persona, reachedStageSequence);
            return (
              <PersonaCard
                key={persona.slug}
                persona={persona}
                selected={persona.slug === value}
                locked={!unlocked}
                onSelect={unlocked ? handleSelect : undefined}
              />
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
