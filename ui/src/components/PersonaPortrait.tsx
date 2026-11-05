import { cn } from "@/lib/utils";
import { personaMonogram } from "../lib/personas";

/**
 * Illustrated monochrome persona portrait (SUM-196 v2).
 * Never a real photo — abstract mark + monogram in the brand primary register.
 * Motif keys come from personas.portraitMotif (generated).
 */
export function PersonaPortrait({
  archetype,
  motif,
  locked = false,
  className,
}: {
  archetype: string;
  motif: string;
  locked?: boolean;
  className?: string;
}) {
  const monogram = personaMonogram(archetype);
  return (
    <div
      aria-hidden
      data-motif={motif}
      className={cn(
        "relative flex h-full w-full items-center justify-center overflow-hidden",
        "bg-linear-to-b from-primary/[0.09] to-transparent",
        locked && "opacity-55 grayscale",
        className,
      )}
    >
      <svg viewBox="0 0 96 96" className="absolute inset-0 h-full w-full text-primary/25" fill="none">
        <MotifPaths motif={motif} />
      </svg>
      <span className="relative z-10 font-semibold tracking-tight text-primary/90 text-4xl leading-none select-none">
        {monogram}
      </span>
    </div>
  );
}

function MotifPaths({ motif }: { motif: string }) {
  // Distinct geometric frames so cards read as a collectible set without photos.
  switch (motif) {
    case "day-one":
    case "compound":
    case "ledger":
      return (
        <>
          <circle cx="48" cy="48" r="34" stroke="currentColor" strokeWidth="1.5" />
          <path d="M48 18v60M18 48h60" stroke="currentColor" strokeWidth="1" />
        </>
      );
    case "floor":
    case "kernel":
    case "grid":
      return (
        <>
          <path d="M16 28h64M16 48h64M16 68h64M28 16v64M48 16v64M68 16v64" stroke="currentColor" strokeWidth="1" />
        </>
      );
    case "less":
    case "resolve":
      return (
        <>
          <rect x="22" y="22" width="52" height="52" rx="4" stroke="currentColor" strokeWidth="1.5" />
          <path d="M34 62h28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </>
      );
    case "wow":
    case "delight":
    case "service":
      return (
        <>
          <path d="M48 16c14 10 22 22 22 36 0 14-10 24-22 28-12-4-22-14-22-28 0-14 8-26 22-36z" stroke="currentColor" strokeWidth="1.5" />
        </>
      );
    case "first-principles":
    case "compiler":
    case "lattice":
      return (
        <>
          <path d="M48 14l30 52H18L48 14z" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="48" cy="52" r="6" stroke="currentColor" strokeWidth="1.5" />
        </>
      );
    case "craft":
    case "purple-cow":
    case "jab":
      return (
        <>
          <path d="M24 70c8-24 16-40 24-54 8 14 16 30 24 54" stroke="currentColor" strokeWidth="1.5" />
          <path d="M30 58h36" stroke="currentColor" strokeWidth="1" />
        </>
      );
    case "sunlight":
    case "dissent":
    case "precedent":
      return (
        <>
          <circle cx="48" cy="40" r="16" stroke="currentColor" strokeWidth="1.5" />
          <path d="M48 56v18M34 74h28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      );
    case "follow-up":
    case "close":
    case "scale-ops":
      return (
        <>
          <path d="M20 66l14-36 14 22 14-30 14 44" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </>
      );
    default:
      return (
        <>
          <circle cx="48" cy="48" r="30" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="48" cy="48" r="18" stroke="currentColor" strokeWidth="1" />
        </>
      );
  }
}
