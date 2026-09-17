import { AlertTriangle, Clock, Pause, User, Wrench } from"lucide-react";
import type { ComponentType } from"react";
import type { IssueBlockedInboxSeverity } from"@paperclipai/shared";
import { cn } from"../lib/utils";
import {
 blockedReasonVariant,
 blockedVariantLabel,
 type BlockedReasonVariant,
} from"../lib/blockedInbox";
import type { IssueBlockedInboxReason } from"@paperclipai/shared";

interface BlockedReasonChipProps {
 reason: IssueBlockedInboxReason;
 severity: IssueBlockedInboxSeverity;
 compact?: boolean;
 className?: string;
}

type IconComponent = ComponentType<{ className?: string;"aria-hidden"?: boolean |"true"|"false"}>;

const VARIANT_STYLES: Record<BlockedReasonVariant, string> = {
 needs_decision:
"border-(--status-task-in_review)/70 bg-(--status-task-in_review)/10 text-(--status-task-in_review) dark:border-(--status-task-in_review)/30 dark:bg-(--status-task-in_review)/10 dark:text-(--status-task-in_review)",
 recovery_required:
"border-(--status-task-in_progress)/30 bg-(--status-task-in_progress)/10 text-(--status-task-in_progress) dark:border-(--status-task-in_progress)/30 dark:bg-(--status-task-in_progress)/10 dark:text-(--status-task-in_progress)",
 stalled:
"border-(--status-task-todo)/70 bg-(--status-task-todo)/10 text-(--status-task-todo) dark:border-(--status-task-todo)/40 dark:bg-(--status-task-todo)/15 dark:text-(--status-task-todo)",
 needs_attention:
"border-(--status-task-todo)/70 bg-(--status-task-todo)/10 text-(--status-task-todo) dark:border-(--status-task-todo)/40 dark:bg-(--status-task-todo)/10 dark:text-(--status-task-todo)",
 external_wait:
"border-(--border) bg-(--muted) text-(--muted-foreground) dark:border-(--border) dark:bg-(--muted-foreground)/15 dark:text-(--muted-foreground)",
 owner_paused:
"border-(--destructive)/70 bg-(--destructive)/10 text-(--destructive) dark:border-(--destructive)/30 dark:bg-(--status-task-blocked)/10 dark:text-(--destructive)",
};

const VARIANT_ICONS: Record<BlockedReasonVariant, IconComponent> = {
 needs_decision: Clock,
 recovery_required: Wrench,
 stalled: AlertTriangle,
 needs_attention: AlertTriangle,
 external_wait: User,
 owner_paused: Pause,
};

const SEVERITY_DOT: Partial<Record<IssueBlockedInboxSeverity, string>> = {
 critical:"bg-(--status-task-blocked)",
 high:"bg-(--status-task-todo)",
};

export function BlockedReasonChip({
 reason,
 severity,
 compact = false,
 className,
}: BlockedReasonChipProps) {
 const variant = blockedReasonVariant(reason);
 const label = blockedVariantLabel(variant);
 const Icon = VARIANT_ICONS[variant];
 const dotClass = SEVERITY_DOT[severity];
 return (
 <span
 data-testid="blocked-reason-chip"
 data-variant={variant}
 data-severity={severity}
 aria-label={`Reason: ${label}, severity ${severity}`}
 className={cn(
"inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-(length:--text-nano) font-medium leading-tight sm:text-(length:--text-micro)",
 VARIANT_STYLES[variant],
 className,
 )}
 >
 {dotClass ? (
 <span
 aria-hidden="true"
 className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", dotClass)}
 />
 ) : null}
 {compact ? null : <Icon className="h-3 w-3 shrink-0"aria-hidden="true"/>}
 <span className="truncate">{label}</span>
 </span>
 );
}
