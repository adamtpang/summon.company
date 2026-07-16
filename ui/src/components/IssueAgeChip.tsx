import type { Issue } from "@paperclipai/shared";
import { TimerIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "../lib/utils";
import { deriveIssueAge } from "../lib/issue-age";

interface IssueAgeChipProps {
  issue: Pick<Issue, "status" | "startedAt" | "createdAt" | "updatedAt">;
  className?: string;
  /** Injectable clock for tests. */
  nowMs?: number;
}

/**
 * Time-in-state on every task chip (ELON-OPERATING-MODEL §3.3). Calm ages are
 * quiet machine text; aging turns amber; "wrong" (timeline is long) turns red.
 */
export function IssueAgeChip({ issue, className, nowMs }: IssueAgeChipProps) {
  const age = deriveIssueAge(issue, nowMs);
  if (!age) return null;

  const title = `${capitalize(age.stateLabel)} for ${age.compact}${
    age.tier === "wrong" ? " — if a timeline is long, it's wrong" : ""
  }`;

  if (age.tier === "calm") {
    return (
      <span
        data-testid="issue-age-chip"
        data-age-tier="calm"
        title={title}
        className={cn("shrink-0 font-mono text-(length:--text-nano) tabular-nums text-muted-foreground", className)}
      >
        {age.compact}
      </span>
    );
  }

  return (
    <Badge
      variant="outline"
      data-testid="issue-age-chip"
      data-age-tier={age.tier}
      title={title}
      className={cn(
        "shrink-0 gap-0.5 font-mono text-(length:--text-nano) tabular-nums",
        age.tier === "aging"
          ? "border-amber-500/60 bg-amber-500/15 text-amber-700 dark:text-amber-300"
          : "border-red-500/60 bg-red-500/15 text-red-700 dark:text-red-300",
        className,
      )}
    >
      <TimerIcon className="h-2.5 w-2.5" aria-hidden />
      {age.compact}
    </Badge>
  );
}

function capitalize(value: string): string {
  return value.length > 0 ? value[0].toUpperCase() + value.slice(1) : value;
}
