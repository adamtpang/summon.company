import { cn } from"@/lib/utils";
import { getOutputFileGlyph, type OutputFileTone } from"@/lib/issue-output";

const TONE_CLASSES: Record<OutputFileTone, string> = {
 video:"bg-(--status-task-in_progress)/15 text-(--status-task-in_progress)",
 pdf:"bg-(--status-task-blocked)/15 text-(--destructive) dark:text-(--destructive)",
 zip:"bg-(--status-task-todo)/15 text-(--status-task-todo) dark:text-(--status-task-todo)",
 image:"bg-(--status-task-done)/15 text-(--status-task-done) dark:text-(--status-task-done)",
 bin:"bg-muted text-muted-foreground",
};

interface OutputFileTileProps {
 contentType: string | null | undefined;
 className?: string;
 /** Tailwind size classes for the square tile. Defaults to a 32×32 tile. */
 sizeClassName?: string;
}

/** Square file-type tile showing a short MIME-derived label, colorised by tone. */
export function OutputFileTile({ contentType, className, sizeClassName ="h-8 w-8"}: OutputFileTileProps) {
 const glyph = getOutputFileGlyph(contentType);
 return (
 <span
 className={cn(
"flex shrink-0 items-center justify-center rounded-md text-(length:--text-nano) font-semibold tabular-nums",
 sizeClassName,
 TONE_CLASSES[glyph.tone],
 className,
 )}
 aria-hidden="true"
 >
 {glyph.label}
 </span>
 );
}
