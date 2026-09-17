import { useId, useState, type ReactNode } from"react";
import {
 ChevronDown,
 CircleAlert,
 CircleCheck,
 Info,
 OctagonAlert,
 TriangleAlert,
 type LucideIcon,
} from"lucide-react";
import { cn } from"@/lib/utils";

export type SystemNoticeTone ="neutral"|"info"|"success"|"warning"|"danger";

export type SystemNoticeMetadataRow =
 | { kind:"text"; label: string; value: string }
 | { kind:"code"; label: string; value: string }
 | { kind:"issue"; label: string; identifier: string; href?: string; title?: string }
 | { kind:"agent"; label: string; name: string; href?: string }
 | { kind:"run"; label: string; runId: string; href?: string; status?: string };

export type SystemNoticeMetadataSection = {
 title?: string;
 rows: SystemNoticeMetadataRow[];
};

export type SystemNoticeProps = {
 tone?: SystemNoticeTone;
 /** Short label that names the system actor + tone, e.g."System warning". Required so tone is not color-only. */
 label?: string;
 /** Short visible body — one or two sentences from the system perspective. */
 body: ReactNode;
 /** Optional small chip for the originating run link. */
 source?: { label: string; href?: string };
 /** Hidden-by-default metadata. Renders the Details affordance only when present. */
 metadata?: SystemNoticeMetadataSection[];
 /** Force the details panel open initially. Defaults to false (collapsed). */
 detailsDefaultOpen?: boolean;
 /** Optional ISO timestamp shown next to the label. */
 timestamp?: string;
 className?: string;
};

type ToneTokens = {
 container: string;
 iconWrap: string;
 icon: LucideIcon;
 iconClass: string;
 label: string;
 divider: string;
};

const TONE_TOKENS: Record<SystemNoticeTone, ToneTokens> = {
 neutral: {
 container:
"border-border bg-muted/35 dark:bg-muted/20",
 iconWrap:"bg-muted text-foreground/70",
 icon: Info,
 iconClass:"text-muted-foreground",
 label:"text-muted-foreground",
 divider:"border-border/70",
 },
 info: {
 container:
"border-(--status-task-in_progress)/70 bg-(--status-task-in_progress)/70 dark:border-(--status-task-in_progress)/30 dark:bg-(--status-task-in_progress)/10",
 iconWrap:"bg-(--status-task-in_progress)/10 text-(--status-task-in_progress) dark:bg-(--status-task-in_progress)/20 dark:text-(--status-task-in_progress)",
 icon: Info,
 iconClass:"text-(--status-task-in_progress) dark:text-(--status-task-in_progress)",
 label:"text-(--status-task-in_progress) dark:text-(--status-task-in_progress)",
 divider:"border-(--status-task-in_progress)/50 dark:border-(--status-task-in_progress)/30",
 },
 success: {
 container:
"border-(--status-task-done)/70 bg-(--status-task-done)/70 dark:border-(--status-task-done)/30 dark:bg-(--status-task-done)/10",
 iconWrap:"bg-(--status-task-done)/10 text-(--status-task-done) dark:bg-(--status-task-done)/20 dark:text-(--status-task-done)",
 icon: CircleCheck,
 iconClass:"text-(--status-task-done) dark:text-(--status-task-done)",
 label:"text-(--status-task-done) dark:text-(--status-task-done)",
 divider:"border-(--status-task-done)/50 dark:border-(--status-task-done)/30",
 },
 warning: {
 container:
"border-(--status-task-todo)/70 bg-(--status-task-todo)/80 dark:border-(--status-task-todo)/30 dark:bg-(--status-task-todo)/10",
 iconWrap:"bg-(--status-task-todo)/10 text-(--status-task-todo) dark:bg-(--status-task-todo)/20 dark:text-(--status-task-todo)",
 icon: TriangleAlert,
 iconClass:"text-(--status-task-todo) dark:text-(--status-task-todo)",
 label:"text-(--status-task-todo) dark:text-(--status-task-todo)",
 divider:"border-(--status-task-todo)/60 dark:border-(--status-task-todo)/30",
 },
 danger: {
 container:
"border-(--destructive)/25 bg-(--destructive)/80 dark:border-(--destructive)/35 dark:bg-(--status-task-blocked)/10",
 iconWrap:"bg-(--destructive)/10 text-(--destructive) dark:bg-(--status-task-blocked)/20 dark:text-(--destructive)",
 icon: OctagonAlert,
 iconClass:"text-(--destructive) dark:text-(--destructive)",
 label:"text-(--destructive) dark:text-(--destructive)",
 divider:"border-(--destructive)/25 dark:border-(--destructive)/30",
 },
};

function formatTimestamp(ts: string) {
 try {
 return new Date(ts).toLocaleString(undefined, {
 month:"short",
 day:"numeric",
 hour:"numeric",
 minute:"2-digit",
 });
 } catch {
 return ts;
 }
}

function MetadataRow({ row, tone }: { row: SystemNoticeMetadataRow; tone: ToneTokens }) {
 return (
 <div className="grid grid-cols-(--gtc-8) gap-x-3 gap-y-0.5 px-3 py-1.5 text-xs">
 <div className="truncate text-(length:--text-micro) font-medium uppercase tracking-(--tracking-label) text-muted-foreground">
 {row.label}
 </div>
 <div className="min-w-0 break-words text-foreground/90">
 {(() => {
 switch (row.kind) {
 case"text":
 return <span>{row.value}</span>;
 case"code":
 return (
 <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-(length:--text-micro) text-foreground/80">
 {row.value}
 </code>
 );
 case"issue": {
 const issueLabel = (
 <>
 <span>{row.identifier}</span>
 {row.title ? (
 <span className="text-muted-foreground">· {row.title}</span>
 ) : null}
 </>
 );
 if (row.href) {
 return (
 <a
 href={row.href}
 className={cn(
"inline-flex items-center gap-1 rounded-sm font-medium underline-offset-2 hover:underline",
 tone.label,
 )}
 >
 {issueLabel}
 </a>
 );
 }
 return (
 <span className={cn("inline-flex items-center gap-1 font-medium", tone.label)}>
 {issueLabel}
 </span>
 );
 }
 case"agent":
 if (row.href) {
 return (
 <a
 href={row.href}
 className={cn(
"inline-flex items-center gap-1 rounded-sm font-medium underline-offset-2 hover:underline",
 tone.label,
 )}
 >
 {row.name}
 </a>
 );
 }
 return (
 <span className={cn("font-medium", tone.label)}>{row.name}</span>
 );
 case"run": {
 const runShort = row.runId.length > 12 ? `${row.runId.slice(0, 8)}…` : row.runId;
 const inner = (
 <>
 <code className="rounded bg-muted px-1.5 py-0.5 text-foreground/80">{runShort}</code>
 {row.status ? (
 <span className={cn("font-sans", tone.label)}>{row.status}</span>
 ) : null}
 </>
 );
 if (row.href) {
 return (
 <a
 href={row.href}
 className="inline-flex items-center gap-2 rounded-sm font-mono text-(length:--text-micro) underline-offset-2 hover:underline"
 >
 {inner}
 </a>
 );
 }
 return (
 <span className="inline-flex items-center gap-2 font-mono text-(length:--text-micro)">
 {inner}
 </span>
 );
 }
 }
 })()}
 </div>
 </div>
 );
}

export function SystemNotice({
 tone ="neutral",
 label,
 body,
 source,
 metadata,
 detailsDefaultOpen = false,
 timestamp,
 className,
}: SystemNoticeProps) {
 const tokens = TONE_TOKENS[tone];
 const ToneIcon = tokens.icon;
 const [open, setOpen] = useState(detailsDefaultOpen);
 const detailsId = useId();
 const hasDetails = Boolean(metadata && metadata.length > 0);
 const resolvedLabel =
 label ??
 {
 neutral:"System notice",
 info:"System notice",
 success:"System notice",
 warning:"System warning",
 danger:"System alert",
 }[tone];

 return (
 <section
 role="status"
 aria-label={resolvedLabel}
 className={cn(
"relative w-full overflow-hidden rounded-lg border text-sm shadow-(--shadow-extract-8)",
 tokens.container,
 className,
 )}
 >
 <header className="flex items-start gap-3 px-3 py-2.5 sm:px-4">
 <span
 className={cn(
"mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
 tokens.iconWrap,
 )}
 aria-hidden
 >
 <ToneIcon className={cn("h-4 w-4", tokens.iconClass)} />
 </span>
 <div className="min-w-0 flex-1">
 <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-(length:--text-micro) font-semibold uppercase tracking-(--tracking-eyebrow)">
 <span className={tokens.label}>{resolvedLabel}</span>
 {source ? (
 <>
 <span className="text-muted-foreground/60"aria-hidden>·</span>
 {source.href ? (
 <a
 href={source.href}
 className="rounded-sm font-medium normal-case tracking-normal text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
 >
 {source.label}
 </a>
 ) : (
 <span className="font-medium normal-case tracking-normal text-muted-foreground">
 {source.label}
 </span>
 )}
 </>
 ) : null}
 {timestamp ? (
 <>
 <span className="text-muted-foreground/60"aria-hidden>·</span>
 <span className="font-medium normal-case tracking-normal text-muted-foreground">
 {formatTimestamp(timestamp)}
 </span>
 </>
 ) : null}
 </div>
 <div className="mt-1 break-words text-sm leading-6 text-foreground">{body}</div>
 </div>
 {hasDetails ? (
 <button
 type="button"
 onClick={() => setOpen((v) => !v)}
 aria-expanded={open}
 aria-controls={detailsId}
 className={cn(
"ml-1 inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-transparent px-2 text-(length:--text-micro) font-medium uppercase tracking-(--tracking-eyebrow) text-muted-foreground transition-(--tp-background-color-border-color-color)",
"hover:border-border/70 hover:bg-background/70 hover:text-foreground",
"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
 )}
 >
 <span>{open ?"Hide details":"Details"}</span>
 <ChevronDown
 className={cn(
"h-3.5 w-3.5 transition-transform duration-150",
 open &&"rotate-180",
 )}
 />
 </button>
 ) : null}
 </header>
 {hasDetails && open ? (
 <div
 id={detailsId}
 className={cn(
"border-t bg-background/50 dark:bg-background/30",
 tokens.divider,
 )}
 >
 <div className="divide-y divide-border/50 px-1 py-1">
 {metadata!.map((section, sectionIdx) => (
 <div key={sectionIdx} className="py-1.5 first:pt-2 last:pb-2">
 {section.title ? (
 <div className="px-3 pb-1 pt-0.5 text-(length:--text-nano) font-semibold uppercase tracking-(--tracking-caps) text-muted-foreground">
 {section.title}
 </div>
 ) : null}
 <div>
 {section.rows.map((row, rowIdx) => (
 <MetadataRow key={rowIdx} row={row} tone={tokens} />
 ))}
 </div>
 </div>
 ))}
 </div>
 </div>
 ) : null}
 </section>
 );
}

export default SystemNotice;
