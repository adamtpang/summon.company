import { AlertTriangle, ExternalLink, Loader2, Lock, RefreshCw } from "lucide-react";
import type { PipelineCaseLiveness } from "@paperclipai/shared";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/router";
import { cn } from "../lib/utils";
import { createIssueDetailPath } from "../lib/issueDetailBreadcrumb";
import {
 derivePipelineLivenessBanner,
 type LivenessBannerLink,
 type LivenessBannerTone,
 type LivenessRetryKind,
} from "../lib/pipeline-liveness";

interface TonePalette {
 section: string;
 icon: string;
 pulse: string;
 link: string;
 button: string;
 Icon: typeof AlertTriangle;
}

const TONE_PALETTES: Record<LivenessBannerTone, TonePalette> = {
 blocked: {
 section:
 "border-(--status-task-todo)/30 bg-(--status-task-todo)/10 text-(--status-task-todo) dark:border-(--status-task-todo)/70 dark:text-(--status-task-todo)",
 icon: "text-(--status-task-todo) dark:text-(--status-task-todo)",
 pulse: "bg-(--status-task-todo)",
 link: "text-(--status-task-todo) dark:text-(--status-task-todo)",
 button:
 "border-(--status-task-todo)/30 bg-transparent hover:bg-(--status-task-todo)/10 dark:border-(--status-task-todo)/70 ",
 Icon: AlertTriangle,
 },
 permission: {
 section:
 "border-(--status-task-in_review)/30 bg-(--status-task-in_review)/10 text-(--status-task-in_review) dark:border-(--status-task-in_review)/70 dark:text-(--status-task-in_review)",
 icon: "text-(--status-task-in_review) dark:text-(--status-task-in_review)",
 pulse: "bg-(--status-task-in_review)",
 link: "text-(--status-task-in_review) dark:text-(--status-task-in_review)",
 button:
 "border-(--status-task-in_review)/30 bg-transparent hover:bg-(--status-task-in_review)/10 dark:border-(--status-task-in_review)/70 ",
 Icon: Lock,
 },
 retry: {
 section:
 "border-(--status-task-in_progress)/30 bg-(--status-task-in_progress)/10 text-(--status-task-in_progress) dark:border-(--status-task-in_progress)/70 dark:text-(--status-task-in_progress)",
 icon: "text-(--status-task-in_progress) dark:text-(--status-task-in_progress)",
 pulse: "bg-(--status-task-in_progress)",
 link: "text-(--status-task-in_progress) dark:text-(--status-task-in_progress)",
 button:
 "border-(--status-task-in_progress)/30 bg-transparent hover:bg-(--status-task-in_progress)/10 dark:border-(--status-task-in_progress)/70 ",
 Icon: RefreshCw,
 },
 attention: {
 section:
 "border-(--status-task-todo)/30 bg-(--status-task-todo)/10 text-(--status-task-todo) dark:border-(--status-task-todo)/70 dark:text-(--status-task-todo)",
 icon: "text-(--status-task-todo) dark:text-(--status-task-todo)",
 pulse: "bg-(--status-task-todo)",
 link: "text-(--status-task-todo) dark:text-(--status-task-todo)",
 button:
 "border-(--status-task-todo)/30 bg-transparent hover:bg-(--status-task-todo)/10 dark:border-(--status-task-todo)/70 ",
 Icon: AlertTriangle,
 },
};

function blockerLinkLabel(link: LivenessBannerLink): string {
 if (link.identifier) return `Open ${link.identifier}`;
 return "Open blocker";
}

function automationLinkLabel(link: LivenessBannerLink): string {
 if (link.identifier) return `Open ${link.identifier}`;
 return "Open automation task";
}

export function PipelineLivenessBanner({
 liveness,
 onRetry,
 retryPending = false,
 retryError = null,
}: {
 liveness: PipelineCaseLiveness | null | undefined;
 onRetry?: (kind: LivenessRetryKind) => void;
 retryPending?: boolean;
 retryError?: string | null;
}) {
 const view = derivePipelineLivenessBanner(liveness);
 if (!view) return null;

 const palette = TONE_PALETTES[view.tone];
 const { Icon } = palette;
 const showRetry = view.showRetry && typeof onRetry === "function";

 return (
 <section
 role="status"
 aria-label={view.title}
 className={cn(
 "mb-5 flex flex-col gap-3 border-y py-4 md:flex-row md:items-start md:justify-between",
 palette.section,
 )}
 >
 <div className="flex min-w-0 gap-3">
 <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", palette.icon)} aria-hidden="true" />
 <div className="min-w-0 space-y-1">
 <h2 className="flex items-center gap-2 text-sm font-semibold">
 {view.tone === "retry" ? (
 <span
 className={cn("h-1.5 w-1.5 animate-pulse rounded-full", palette.pulse)}
 aria-hidden="true"
 />
 ) : null}
 {view.title}
 </h2>
 <p className="text-sm opacity-85">{view.body}</p>
 {view.permissionKey ? (
 <p className="text-sm opacity-85">
 Required permission:{" "}
 <code className="rounded-sm bg-black/10 px-1 py-0.5 text-xs font-medium dark:bg-white/10">
 {view.permissionKey}
 </code>{" "}
 on the target pipeline.
 </p>
 ) : null}
 {view.blockerLink || view.automationLink ? (
 <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
 {view.blockerLink ? (
 <Link
 to={createIssueDetailPath(view.blockerLink.identifier ?? view.blockerLink.issueId)}
 className={cn("inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline", palette.link)}
 >
 <ExternalLink className="h-3.5 w-3.5" />
 {blockerLinkLabel(view.blockerLink)}
 {view.blockerLink.title ? `: ${view.blockerLink.title}` : ""}
 </Link>
 ) : null}
 {view.automationLink ? (
 <Link
 to={createIssueDetailPath(view.automationLink.identifier ?? view.automationLink.issueId)}
 className={cn("inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline", palette.link)}
 >
 <ExternalLink className="h-3.5 w-3.5" />
 {automationLinkLabel(view.automationLink)}
 </Link>
 ) : null}
 </p>
 ) : null}
 {view.helperNote ? (
 <p className="text-xs italic opacity-70">{view.helperNote}</p>
 ) : null}
 {retryError ? (
 <p role="alert" className="text-sm font-medium text-destructive">
 {retryError}
 </p>
 ) : null}
 </div>
 </div>
 {showRetry ? (
 <Button
 type="button"
 size="sm"
 variant="outline"
 className={cn("shrink-0", palette.button)}
 disabled={retryPending}
 onClick={() => onRetry?.(view.retryKind)}
 >
 {retryPending ? (
 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
 ) : (
 <RefreshCw className="mr-2 h-4 w-4" />
 )}
 {retryPending ? "Retrying…" : view.retryLabel}
 </Button>
 ) : null}
 </section>
 );
}
