import type { SecretStatus, UserSecretCoverageSummary } from "@paperclipai/shared";
import { UserRound } from "lucide-react";
import { cn } from "../../lib/utils";
import { Badge } from "@/components/ui/badge";

/**
 * User secrets are visually distinct from company secrets via a violet accent
 * (company secrets use neutral/emerald tones). This keeps the two Secrets tabs
 * unmistakable at a glance, per the Phase 2 UX direction.
 */
export const USER_SECRET_ACCENT_TEXT = "text-(--status-task-in_review) dark:text-(--status-task-in_review)";
export const USER_SECRET_ACCENT_BORDER = "border-(--status-task-in_review)/30";
export const USER_SECRET_ACCENT_BG = "bg-(--status-task-in_review)/10";

/** Small pill used to mark user-scoped rows and headers. */
export function UserSecretChip({ className, label = "User secret" }: { className?: string; label?: string }) {
 return (
 <Badge variant="outline"
 className={cn(
 "text-(length:--text-micro)",
 USER_SECRET_ACCENT_BORDER,
 USER_SECRET_ACCENT_BG,
 USER_SECRET_ACCENT_TEXT,
 className,
 )}
 >
 <UserRound className="h-3 w-3" />
 {label}
 </Badge>
 );
}

/** Tone for a secret/definition status badge. */
export function secretStatusTone(status: SecretStatus): string {
 switch (status) {
 case "active":
 return "border-(--status-task-done)/30 bg-(--status-task-done)/10 text-(--status-task-done) dark:text-(--status-task-done)";
 case "disabled":
 return "border-muted bg-muted text-muted-foreground";
 case "archived":
 return "border-border bg-muted/60 text-muted-foreground";
 default:
 return "border-border bg-muted text-muted-foreground";
 }
}

/** Tone for "my value" state: set (emerald), not set (amber), inactive (muted). */
export type MyValueState = "set" | "not_set" | "inactive";

export function myValueTone(state: MyValueState): string {
 switch (state) {
 case "set":
 return "border-(--status-task-done)/30 bg-(--status-task-done)/10 text-(--status-task-done) dark:text-(--status-task-done)";
 case "not_set":
 return "border-(--status-task-todo)/30 bg-(--status-task-todo)/10 text-(--status-task-todo) dark:text-(--status-task-todo)";
 case "inactive":
 return "border-muted bg-muted text-muted-foreground";
 }
}

export function myValueLabel(state: MyValueState): string {
 switch (state) {
 case "set":
 return "Value set";
 case "not_set":
 return "Not set";
 case "inactive":
 return "Disabled";
 }
}

/**
 * Coverage is surfaced as counts only, never values, per the UX terminology
 * decisions. E.g. "5 of 7 members set".
 */
export function coverageSummaryLabel(summary: UserSecretCoverageSummary | undefined): string {
 if (!summary) return "·";
 const total = summary.configuredCount + summary.missingCount + summary.inactiveCount;
 return `${summary.configuredCount} of ${total} set`;
}
