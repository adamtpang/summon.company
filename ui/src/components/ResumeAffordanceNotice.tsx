import { History } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ResumeAffordance } from "@/lib/resume-affordance";

/**
 * VIT-40 — a subtle, non-blocking marker at a run boundary that resumed prior
 * conversation. Rendered once, above the first message of a resumed run, so a
 * reopened chat never silently drops context. Deliberately quiet: a centered,
 * muted divider row, not a boxed alert. Token-gated (no hardcoded colors).
 */
export function ResumeAffordanceNotice({
  affordance,
  className,
}: {
  affordance: ResumeAffordance;
  className?: string;
}) {
  if (!affordance.resumed || !affordance.label) return null;
  return (
    <div
      data-testid="resume-affordance-notice"
      className={cn("flex items-center gap-2 py-1.5 text-muted-foreground", className)}
      role="note"
      aria-label={affordance.label}
    >
      <span className="h-px flex-1 bg-border" />
      <span className="inline-flex items-center gap-1.5 text-[0.6875rem] font-medium uppercase tracking-wide">
        <History className="h-3 w-3" aria-hidden="true" />
        {affordance.label}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
