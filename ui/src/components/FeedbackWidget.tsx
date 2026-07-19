import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MessageSquarePlus, Star } from "lucide-react";
import { companiesApi } from "../api/companies";
import { issuesApi } from "../api/issues";
import { useCompany } from "../context/CompanyContext";
import { useToastActions } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";

/**
 * Always-there feedback (board, 2026-07-19; Vercel-style): a quiet pill in the
 * bottom-right that opens a two-field survey — 0–5 stars on Summon's quality,
 * and "why" whenever it isn't a 5. Submissions become support tasks on the
 * vendor company's board (the SUM flagship on this instance; the hosted
 * multi-tenant endpoint is its own ticket).
 *
 * Weekly cadence: if no submission this ISO week, the popover self-opens once
 * (one prompt per week, never more). localStorage keys carry the state.
 */
const SUBMITTED_WEEK_KEY = "summon.feedback.lastSubmittedWeek";
const PROMPTED_WEEK_KEY = "summon.feedback.lastPromptedWeek";

/** ISO-8601 week id, e.g. "2026-W29" — stable across reloads for the nag gate. */
export function isoWeekId(now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable — the widget still works, it just re-prompts.
  }
}

export function FeedbackWidget() {
  const { selectedCompanyId } = useCompany();
  const { pushToast } = useToastActions();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [why, setWhy] = useState("");

  const { data: companies } = useQuery({
    queryKey: queryKeys.companies.all,
    queryFn: () => companiesApi.list(),
  });

  // Feedback about Summon goes to the VENDOR board: the SUM flagship when this
  // instance carries it (the dogfood case), else the selected company.
  const vendorCompanyId = useMemo(() => {
    const flagship = companies?.find((c) => c.issuePrefix === "SUM");
    return flagship?.id ?? selectedCompanyId ?? null;
  }, [companies, selectedCompanyId]);

  // Weekly self-open: once per ISO week, only when nothing was submitted yet.
  useEffect(() => {
    const week = isoWeekId();
    if (readLocal(SUBMITTED_WEEK_KEY) === week) return;
    if (readLocal(PROMPTED_WEEK_KEY) === week) return;
    const timer = window.setTimeout(() => {
      writeLocal(PROMPTED_WEEK_KEY, week);
      setOpen(true);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, []);

  const submit = useMutation({
    mutationFn: async () => {
      if (vendorCompanyId == null || rating == null) throw new Error("Pick a star rating first.");
      const week = isoWeekId();
      return issuesApi.create(vendorCompanyId, {
        title: `Customer feedback: ${rating}/5 (${week})`,
        status: "todo",
        priority: rating <= 2 ? "high" : "medium",
        description:
          `Weekly quality survey (support lane — route to Haven).\n\n` +
          `Stars: ${rating}/5\n` +
          (rating < 5 ? `Why not a 5: ${why.trim() || "(no reason given)"}\n` : "Perfect score.\n") +
          `\nContext: ${window.location.pathname} · ${new Date().toISOString()} · in-app widget`,
      });
    },
    onSuccess: () => {
      writeLocal(SUBMITTED_WEEK_KEY, isoWeekId());
      setOpen(false);
      setRating(null);
      setWhy("");
      pushToast({ title: "Thanks — feedback logged", tone: "success" });
    },
    onError: (error) => {
      pushToast({
        title: "Could not send feedback",
        body: error instanceof Error ? error.message : "Please try again.",
        tone: "error",
      });
    },
  });

  const active = hovered ?? rating ?? 0;

  return (
    <div className="fixed bottom-4 right-4 z-40 print:hidden">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shadow-md"
            aria-label="Give feedback on Summon"
            data-testid="feedback-widget-trigger"
          >
            <MessageSquarePlus className="size-4" aria-hidden="true" />
            Feedback
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" side="top" className="w-80">
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (rating != null && !submit.isPending) submit.mutate();
            }}
          >
            <div>
              <p className="text-sm font-semibold">How is Summon this week?</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Two fields, ten seconds. It lands with the team as a support task.
              </p>
            </div>
            <div className="flex items-center gap-1" role="radiogroup" aria-label="Quality, 0 to 5 stars">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={rating === value}
                  aria-label={`${value} star${value === 1 ? "" : "s"}`}
                  className="rounded p-0.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  onMouseEnter={() => setHovered(value)}
                  onMouseLeave={() => setHovered(null)}
                  // Clicking the selected star again clears to 0 — the scale is 0–5.
                  onClick={() => setRating(rating === value ? 0 : value)}
                >
                  <Star
                    className={cn(
                      "size-6",
                      value <= active ? "fill-(--score-s) text-(--score-s)" : "text-muted-foreground",
                    )}
                    aria-hidden="true"
                  />
                </button>
              ))}
              <span className="ml-2 text-sm font-semibold tabular-nums">{rating ?? "–"}/5</span>
            </div>
            {rating != null && rating < 5 ? (
              <Textarea
                value={why}
                onChange={(event) => setWhy(event.target.value)}
                placeholder="What would make it a 5?"
                rows={3}
                data-testid="feedback-why"
              />
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Not now
              </Button>
              <Button type="submit" size="sm" disabled={rating == null || submit.isPending}>
                {submit.isPending ? "Sending…" : "Send"}
              </Button>
            </div>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  );
}
