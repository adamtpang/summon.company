import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MessageSquarePlus, Star } from "lucide-react";
import { companiesListQueryOptions } from "../api/companies-query";
import { issuesApi } from "../api/issues";
import { useCompany } from "../context/CompanyContext";
import { useToastActions } from "../context/ToastContext";
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
 *
 * Vendor vs customer routing (SUM-190): on the vendor's own instance the
 * submission files a support task on the local SUM board. On a CUSTOMER
 * instance there is no local vendor board to reach, so when
 * VITE_FEEDBACK_ENDPOINT is configured the SAME submission POSTs to the hosted
 * intake (feedback.summon.company / apps/landing/api/feedback.mjs) instead,
 * which files the ticket on the vendor's SUM board routed to Haven.
 */
const SUBMITTED_WEEK_KEY = "summon.feedback.lastSubmittedWeek";
const PROMPTED_WEEK_KEY = "summon.feedback.lastPromptedWeek";

/**
 * When set, this instance is a customer (not the vendor): submissions go to the
 * hosted intake endpoint rather than the local board. Empty/unset = vendor.
 */
const HOSTED_FEEDBACK_ENDPOINT = import.meta.env.VITE_FEEDBACK_ENDPOINT?.trim() || "";
/** Opaque id the hosted endpoint dedupes on; host is a safe, PII-free default. */
const FEEDBACK_INSTANCE_ID =
  import.meta.env.VITE_FEEDBACK_INSTANCE_ID?.trim() ||
  (typeof window !== "undefined" ? window.location.host : "unknown");

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

  // The ["companies"] cache stores the WRAPPED shape {companies, unauthorized}
  // (see companies-query.ts) — reading it any other way corrupts the shared
  // cache and crashes boot. This widget shipped that exact bug once (the
  // board's white screen, 2026-07-19); always consume the canonical options.
  const { data: companiesResult } = useQuery(companiesListQueryOptions);

  // Feedback about Summon goes to the VENDOR board: the SUM flagship when this
  // instance carries it (the dogfood case), else the selected company.
  const vendorCompanyId = useMemo(() => {
    const flagship = companiesResult?.companies.find((c) => c.issuePrefix === "SUM");
    return flagship?.id ?? selectedCompanyId ?? null;
  }, [companiesResult, selectedCompanyId]);

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
      if (rating == null) throw new Error("Pick a star rating first.");
      const week = isoWeekId();
      const context = `${window.location.pathname} · ${new Date().toISOString()} · in-app widget`;

      // Customer instance: POST the survey to the hosted vendor intake, which
      // dedupes per instance+week and files the ticket on the SUM board.
      if (HOSTED_FEEDBACK_ENDPOINT) {
        const res = await fetch(HOSTED_FEEDBACK_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instanceId: FEEDBACK_INSTANCE_ID,
            rating,
            why: rating < 5 ? why.trim() : "",
            week,
            context,
          }),
        });
        if (!res.ok) {
          const detail = await res.json().catch(() => null);
          throw new Error(detail?.error || `Feedback intake returned ${res.status}.`);
        }
        return res.json();
      }

      // Vendor instance: file the support task directly on the local SUM board.
      if (vendorCompanyId == null) throw new Error("No board available to receive feedback.");
      return issuesApi.create(vendorCompanyId, {
        title: `Customer feedback: ${rating}/5 (${week})`,
        status: "todo",
        priority: rating <= 2 ? "high" : "medium",
        description:
          `Weekly quality survey (support lane, route to Haven).\n\n` +
          `Stars: ${rating}/5\n` +
          (rating < 5 ? `Why not a 5: ${why.trim() || "(no reason given)"}\n` : "Perfect score.\n") +
          `\nContext: ${context}`,
      });
    },
    onSuccess: () => {
      writeLocal(SUBMITTED_WEEK_KEY, isoWeekId());
      setOpen(false);
      setRating(null);
      setWhy("");
      pushToast({ title: "Thanks, feedback logged", tone: "success" });
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
              <span className="ml-2 text-sm font-semibold tabular-nums">{rating ?? "·"}/5</span>
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
