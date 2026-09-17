import { useEffect, useState } from"react";
import { Link } from"@/lib/router";
import { X } from"lucide-react";
import {
 useToastActions,
 useToastState,
 type ToastItem,
 type ToastTone,
} from"../context/ToastContext";
import { cn } from"../lib/utils";

const toneClasses: Record<ToastTone, string> = {
 info:"border-(--status-task-in_progress)/30 bg-(--status-task-in_progress)/10 text-(--status-task-in_progress) dark:border-(--status-task-in_progress)/25 dark:text-(--status-task-in_progress)",
 success:"border-(--status-task-done)/30 bg-(--status-task-done)/10 text-(--status-task-done) dark:border-(--status-task-done)/25 dark:text-(--status-task-done)",
 warn:"border-(--status-task-todo)/30 bg-(--status-task-todo)/10 text-(--status-task-todo) dark:border-(--status-task-todo)/25 dark:text-(--status-task-todo)",
 error:"border-(--destructive)/20 bg-(--destructive)/10 text-(--destructive) dark:border-(--destructive)/30 dark:text-(--destructive)",
};

const toneDotClasses: Record<ToastTone, string> = {
 info:"bg-(--status-task-in_progress) dark:bg-(--status-task-in_progress)",
 success:"bg-(--status-task-done) dark:bg-(--status-task-done)",
 warn:"bg-(--status-task-todo) dark:bg-(--status-task-todo)",
 error:"bg-(--status-task-blocked)",
};

function AnimatedToast({
 toast,
 onDismiss,
}: {
 toast: ToastItem;
 onDismiss: (id: string) => void;
}) {
 const [visible, setVisible] = useState(false);

 useEffect(() => {
 const frame = requestAnimationFrame(() => setVisible(true));
 return () => cancelAnimationFrame(frame);
 }, []);

 return (
 <li
 className={cn(
"pointer-events-auto rounded-sm border shadow-lg backdrop-blur-xl transition-(--tp-transform-opacity) duration-200 ease-out",
 visible
 ?"translate-y-0 opacity-100"
 :"translate-y-3 opacity-0",
 toneClasses[toast.tone],
 )}
 >
 <div className="flex items-start gap-3 px-3 py-2.5">
 <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", toneDotClasses[toast.tone])} />
 <div className="min-w-0 flex-1">
 <p className="text-sm font-semibold leading-5">{toast.title}</p>
 {toast.body && (
 <p className="mt-1 text-xs leading-4 opacity-70">
 {toast.body}
 </p>
 )}
 {toast.action &&
 (toast.action.onClick ? (
 <button
 type="button"
 onClick={() => {
 toast.action?.onClick?.();
 onDismiss(toast.id);
 }}
 className="mt-2 inline-flex text-xs font-medium underline underline-offset-4 hover:opacity-90"
 >
 {toast.action.label}
 </button>
 ) : toast.action.href ? (
 <Link
 to={toast.action.href}
 onClick={() => onDismiss(toast.id)}
 className="mt-2 inline-flex text-xs font-medium underline underline-offset-4 hover:opacity-90"
 >
 {toast.action.label}
 </Link>
 ) : null)}
 </div>
 <button
 type="button"
 aria-label="Dismiss notification"
 onClick={() => onDismiss(toast.id)}
 className="mt-0.5 shrink-0 rounded p-1 opacity-50 hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10"
 >
 <X className="h-3.5 w-3.5"/>
 </button>
 </div>
 </li>
 );
}

export function ToastViewport() {
 const toasts = useToastState();
 const { dismissToast } = useToastActions();

 if (toasts.length === 0) return null;

 return (
 <aside
 aria-live="polite"
 aria-atomic="false"
 className="pointer-events-none fixed bottom-3 left-3 z-(--z-120) w-full max-w-sm px-1"
 >
 <ol className="flex w-full flex-col-reverse gap-2">
 {toasts.map((toast) => (
 <AnimatedToast
 key={toast.id}
 toast={toast}
 onDismiss={dismissToast}
 />
 ))}
 </ol>
 </aside>
 );
}
