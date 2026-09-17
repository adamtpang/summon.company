import { ShieldX, UserX } from"lucide-react";
import {
 describeResponsibleUserDenial,
 type ResponsibleUserDenialCode,
} from"@paperclipai/shared";
import { cn } from"../lib/utils";

/**
 * Renders actionable copy for a responsible-user ("on behalf of") authorization
 * denial. Distinct from a plain agent-lacks-permission failure: here the agent
 * may be allowed, but the human the run acts for is not (or is unavailable).
 *
 * Copy comes from the shared `describeResponsibleUserDenial` contract so every
 * surface stays consistent. Callers should only render this when the failure
 * code is one of the responsible-user denial codes; other denials keep their
 * existing generic error copy.
 */
export function ResponsibleUserDenialNotice({
 code,
 userName,
 className,
}: {
 code: ResponsibleUserDenialCode;
 userName?: string | null;
 className?: string;
}) {
 const copy = describeResponsibleUserDenial(code, { userName });
 const isUnavailable = copy.tone ==="unavailable";
 const Icon = isUnavailable ? UserX : ShieldX;

 const tone = isUnavailable
 ?"border-(--status-task-todo)/70 bg-(--status-task-todo)/90 text-(--status-task-todo) dark:border-(--status-task-todo)/40 dark:bg-(--status-task-todo)/10 dark:text-(--status-task-todo)"
 :"border-(--destructive)/70 bg-(--destructive)/90 text-(--destructive) dark:border-(--destructive)/40 dark:bg-(--status-task-blocked)/10 dark:text-(--destructive)";
 const iconTone = isUnavailable
 ?"text-(--status-task-todo) dark:text-(--status-task-todo)"
 :"text-(--destructive) dark:text-(--destructive)";
 const actionTone = isUnavailable
 ?"text-(--status-task-todo) dark:text-(--status-task-todo)"
 :"text-(--destructive) dark:text-(--destructive)";

 return (
 <div
 role="status"
 data-testid="responsible-user-denial-notice"
 data-denial-code={code}
 data-denial-tone={copy.tone}
 className={cn("rounded-md border px-3 py-2.5 text-sm shadow-sm", tone, className)}
 >
 <div className="flex items-start gap-2">
 <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", iconTone)} aria-hidden="true"/>
 <div className="min-w-0 space-y-1">
 <p className="font-medium leading-5">{copy.title}</p>
 <p className="leading-5">{copy.description}</p>
 <p className={cn("text-xs leading-5", actionTone)}>{copy.recommendedAction}</p>
 </div>
 </div>
 </div>
 );
}
