import { useState } from "react";
import type { Issue } from "@paperclipai/shared";
import { AlertTriangle, Check, ChevronRight, Circle, CircleDashed, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "../lib/utils";
import { taskStatusIconVar } from "../lib/status-colors";
import {
  currentGateIndex,
  deriveAlgorithmGates,
  type AlgorithmGate,
  type RequirementOwner,
} from "../lib/algorithm-gates";
import { deriveIssueAge } from "../lib/issue-age";

interface AlgorithmStripProps {
  issue: Pick<
    Issue,
    "status" | "createdByAgentId" | "createdByUserId" | "startedAt" | "createdAt" | "updatedAt"
  >;
  requirementOwner: RequirementOwner;
  /** Posts the deletion proposal (a board-approvable comment). */
  onProposeDeletion?: (reason: string) => void;
  proposeDeletionPending?: boolean;
  /** Injectable clock for tests. */
  nowMs?: number;
  className?: string;
}

/**
 * The Algorithm as the task spine (ELON-OPERATING-MODEL §3.1): question
 * requirements → delete → simplify → accelerate → automate, in order. Gate 1
 * names the requirement owner (a person or agent, never a department); gate 2
 * makes "propose deletion" a first-class action the board approves.
 */
export function AlgorithmStrip({
  issue,
  requirementOwner,
  onProposeDeletion,
  proposeDeletionPending = false,
  nowMs,
  className,
}: AlgorithmStripProps) {
  const age = deriveIssueAge(issue, nowMs);
  const gates = deriveAlgorithmGates(issue, requirementOwner, age);
  const activeIndex = currentGateIndex(gates);
  const terminal = issue.status === "done" || issue.status === "cancelled";

  return (
    <div
      data-testid="algorithm-strip"
      role="group"
      aria-label="The Algorithm, five gates in order"
      className={cn("overflow-x-auto rounded-lg border border-border", className)}
    >
      <ol className="flex min-w-max items-stretch">
        {gates.map((gate, index) => (
          <li key={gate.key} className="flex items-stretch">
            {index > 0 ? (
              <span className="flex items-center px-0.5 text-muted-foreground/40" aria-hidden="true">
                <ChevronRight className="h-3 w-3" />
              </span>
            ) : null}
            <div
              data-testid={`algorithm-gate-${gate.key}`}
              data-gate-state={gate.state}
              title={`${gate.question} ${gate.detail}`}
              className={cn(
                "flex w-36 flex-col gap-0.5 px-3 py-2",
                index === activeIndex && !terminal && "bg-accent/50",
              )}
            >
              <span className="flex items-center gap-1.5">
                <GateGlyph state={gate.state} />
                <span
                  className={cn(
                    "text-xs font-medium",
                    gate.state === "pending" ? "text-muted-foreground" : "text-foreground",
                  )}
                >
                  {gate.label}
                </span>
              </span>
              <span
                className={cn(
                  "truncate text-(length:--text-nano)",
                  gate.state === "attention"
                    ? "font-medium text-red-700 dark:text-red-300"
                    : "text-muted-foreground",
                )}
              >
                {gate.detail}
              </span>
              {gate.key === "delete" && gate.state === "active" && onProposeDeletion ? (
                <ProposeDeletionAction
                  onPropose={onProposeDeletion}
                  pending={proposeDeletionPending}
                />
              ) : null}
              {gate.key === "requirements" && gate.state === "passed" ? (
                <Badge
                  variant="outline"
                  className="w-fit border-border px-1.5 text-(length:--text-nano) text-muted-foreground"
                  title="Requirements come from a person, not a department."
                >
                  {requirementOwner.kind === "agent" ? "agent" : "board"}
                </Badge>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function GateGlyph({ state }: { state: AlgorithmGate["state"] }) {
  switch (state) {
    case "passed":
      return <Check className="h-3 w-3 shrink-0" style={{ color: `var(${taskStatusIconVar.done})` }} aria-hidden />;
    case "active":
      return <Circle className="h-3 w-3 shrink-0" style={{ color: `var(${taskStatusIconVar.in_progress})` }} aria-hidden />;
    case "attention":
      return <AlertTriangle className="h-3 w-3 shrink-0 text-red-600 dark:text-red-400" aria-hidden />;
    default:
      return <CircleDashed className="h-3 w-3 shrink-0 text-muted-foreground/60" aria-hidden />;
  }
}

function ProposeDeletionAction({
  onPropose,
  pending,
}: {
  onPropose: (reason: string) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          data-testid="propose-deletion-trigger"
          className="mt-1 h-6 w-fit gap-1 px-1.5 text-(length:--text-nano)"
        >
          <Trash2 className="h-2.5 w-2.5" aria-hidden />
          Propose deletion
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-2 p-3">
        <p className="text-xs text-muted-foreground">
          Why should this task not exist? The board approves by cancelling it.
        </p>
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="This shouldn't exist because…"
          rows={3}
          data-testid="propose-deletion-reason"
          className="text-sm"
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Keep it
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={reason.trim().length === 0 || pending}
            data-testid="propose-deletion-submit"
            onClick={() => {
              onPropose(reason.trim());
              setReason("");
              setOpen(false);
            }}
          >
            Propose to board
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Comment body for a gate-2 deletion proposal — the board approves by cancelling. */
export function buildDeletionProposalComment(reason: string): string {
  return [
    "**Proposes deletion (Algorithm gate 2: should this exist?)**",
    "",
    reason,
    "",
    "Board: approve by cancelling this task, or reply with the named requirement that keeps it alive.",
  ].join("\n");
}
