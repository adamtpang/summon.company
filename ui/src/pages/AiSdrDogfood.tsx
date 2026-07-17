import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  LockKeyhole,
  Send,
  ShieldAlert,
} from "lucide-react";
import type { VitalsAiSdrDogfoodBundle } from "@paperclipai/shared/vitals-ai-sdr";
import { useLocation } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { vitalsAiSdrApi, type VitalsAiSdrLocalDogfoodResponse } from "../api/vitalsAiSdr";

type AiSdrFormState = {
  issueId: string;
  companyUrl: string;
  icp: string;
  senderIdentity: string;
  objective: string;
  bannedClaims: string;
  geography: string;
  maxDraftCount: string;
  notes: string;
};

const DEFAULT_FORM: AiSdrFormState = {
  issueId: "",
  companyUrl: "https://vitals.run",
  icp: "Founder-led B2B software companies preparing their first outbound workflow",
  senderIdentity: "Adam from vitals.run",
  objective: "book a short diagnosis call around a board-approved AI SDR loop",
  bannedClaims: "guaranteed meetings\ninbox placement",
  geography: "United States",
  maxDraftCount: "1",
  notes: "Dogfood inside Summon only.",
};

export function parseBannedClaims(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((claim) => claim.trim())
    .filter(Boolean);
}

function resultSummary(bundle: VitalsAiSdrDogfoodBundle) {
  return [
    { label: "Dossiers", value: String(bundle.dossiers.length) },
    { label: "Drafts", value: String(bundle.drafts.length) },
    { label: "Events", value: String(bundle.measurementEvents.length) },
    { label: "Blocked stages", value: String(bundle.downstreamBlocks.length) },
  ];
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function DownstreamBlocks({
  blocks,
  loading,
}: {
  blocks: VitalsAiSdrDogfoodBundle["downstreamBlocks"] | undefined;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-16" />)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {(blocks ?? []).map((block) => (
        <article key={block.stageKey} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <LockKeyhole className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <h3 className="truncate text-sm font-semibold">{block.label}</h3>
              </div>
              <p className="text-sm text-muted-foreground">{block.reason}</p>
            </div>
            <StatusBadge status={block.status} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{block.requiredApproval}</p>
        </article>
      ))}
    </div>
  );
}

function GeneratedResult({ result }: { result: VitalsAiSdrLocalDogfoodResponse }) {
  const { bundle } = result;
  const firstDossier = bundle.dossiers[0] ?? null;
  const firstDraft = bundle.drafts[0] ?? null;

  return (
    <section className="space-y-5" aria-labelledby="ai-sdr-result-title">
      <div className="flex flex-col gap-3 border-y border-border py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium text-primary">Generated</p>
          <h2 id="ai-sdr-result-title" className="text-xl font-semibold">Local AI SDR batch</h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            Campaign {bundle.campaign.id} is held behind board approval.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium">
            <ClipboardCheck className="size-3.5" aria-hidden="true" />
            {result.interaction.status}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium">
            <FileText className="size-3.5" aria-hidden="true" />
            {result.workProducts.length} work products
          </span>
        </div>
      </div>

      <dl className="grid grid-cols-2 border-y border-border lg:grid-cols-4">
        {resultSummary(bundle).map((metric) => (
          <div key={metric.label} className="py-3 pr-4 lg:border-r lg:border-border lg:px-4 lg:first:pl-0 lg:last:border-r-0">
            <dt className="text-xs text-muted-foreground">{metric.label}</dt>
            <dd className="mt-1 font-mono text-base font-semibold tabular-nums">{metric.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          {firstDossier ? (
            <article className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-4 text-muted-foreground" aria-hidden="true" />
                <h3 className="text-base font-semibold">Cited dossier</h3>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <p className="font-medium">{firstDossier.targetCompany}</p>
                <p className="text-muted-foreground">{firstDossier.fitReason}</p>
                <ul className="space-y-2 pt-2">
                  {firstDossier.citations.map((citation) => (
                    <li key={citation.id} className="rounded-md border border-border bg-background p-3">
                      <span className="font-mono text-xs text-primary">[{citation.id}]</span>{" "}
                      <span>{citation.text}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{citation.source}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ) : null}

          {firstDraft ? (
            <article className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <Send className="size-4 text-muted-foreground" aria-hidden="true" />
                <h3 className="text-base font-semibold">Personalized draft</h3>
              </div>
              <p className="mt-3 text-sm font-medium">{firstDraft.subject}</p>
              <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg border border-border bg-muted p-3 text-sm text-foreground">
                {firstDraft.body}
              </pre>
              <p className="mt-3 text-xs text-muted-foreground">
                Approval status: {firstDraft.approvalStatus.replace(/_/g, " ")}
              </p>
            </article>
          ) : null}
        </div>

        <aside className="space-y-4 lg:col-span-5 lg:border-l lg:border-border lg:pl-6">
          <div>
            <h3 className="text-base font-semibold">Measurement events</h3>
            <p className="mt-1 text-sm text-muted-foreground">Stored as internal AI SDR measurement activity.</p>
          </div>
          <ol className="space-y-2">
            {bundle.measurementEvents.map((event) => (
              <li key={event.id} className="flex items-start gap-2 rounded-md border border-border p-3 text-sm">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block font-medium">{event.eventName.replace(/_/g, " ")}</span>
                  <span className="block truncate text-xs text-muted-foreground">{event.stageKey}</span>
                </span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </section>
  );
}

export function AiSdrDogfood() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const location = useLocation();
  const [form, setForm] = useState<AiSdrFormState>(DEFAULT_FORM);
  const [result, setResult] = useState<VitalsAiSdrLocalDogfoodResponse | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "AI SDR" }]);
  }, [setBreadcrumbs]);

  useEffect(() => {
    const issueId = new URLSearchParams(location.search).get("issueId");
    if (!issueId) return;
    setForm((current) => current.issueId ? current : { ...current, issueId });
  }, [location.search]);

  const fixturesQuery = useQuery({
    queryKey: selectedCompanyId ? queryKeys.vitalsAiSdr.localFixtures(selectedCompanyId) : ["vitals-ai-sdr", "no-company"],
    queryFn: () => vitalsAiSdrApi.localFixtures(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const mutation = useMutation({
    mutationFn: () => {
      if (!selectedCompanyId) throw new Error("No company selected");
      return vitalsAiSdrApi.runLocalDogfood(selectedCompanyId, {
        issueId: form.issueId.trim(),
        intake: {
          companyUrl: form.companyUrl.trim(),
          icp: form.icp.trim(),
          senderIdentity: form.senderIdentity.trim(),
          objective: form.objective.trim(),
          bannedClaims: parseBannedClaims(form.bannedClaims),
          geography: form.geography.trim(),
          maxDraftCount: Number.parseInt(form.maxDraftCount, 10),
          notes: form.notes.trim() || null,
          leadSourceKind: "local_fixture",
        },
      });
    },
    onSuccess: (data) => setResult(data),
  });

  const downstreamBlocks = useMemo(
    () => result?.bundle.downstreamBlocks ?? fixturesQuery.data?.downstreamBlocks,
    [fixturesQuery.data?.downstreamBlocks, result?.bundle.downstreamBlocks],
  );

  if (!selectedCompanyId) {
    return <EmptyState icon={Send} title="No company selected" message="Select a company to run the local AI SDR loop." />;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">AI SDR dogfood</h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            Local fixture intake, cited dossiers, draft generation, approval request, and blocked downstream stages.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
          <LockKeyhole className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>Local fixture only</span>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-12">
        <section className="space-y-4 lg:col-span-7" aria-labelledby="ai-sdr-intake-title">
          <div>
            <h2 id="ai-sdr-intake-title" className="text-base font-semibold">Intake</h2>
            <p className="mt-1 text-sm text-muted-foreground">Issue-backed intake stored as Summon documents.</p>
          </div>

          <form
            className="space-y-4 rounded-lg border border-border bg-card p-4"
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate();
            }}
          >
            <Field id="ai-sdr-issue-id" label="Issue UUID">
              <Input
                id="ai-sdr-issue-id"
                value={form.issueId}
                onChange={(event) => setForm((current) => ({ ...current, issueId: event.target.value }))}
                placeholder="32815432-3f37-4a09-b05c-d929e5670cba"
                required
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="ai-sdr-company-url" label="Company URL">
                <Input
                  id="ai-sdr-company-url"
                  type="url"
                  value={form.companyUrl}
                  onChange={(event) => setForm((current) => ({ ...current, companyUrl: event.target.value }))}
                  required
                />
              </Field>
              <Field id="ai-sdr-geography" label="Geography">
                <Input
                  id="ai-sdr-geography"
                  value={form.geography}
                  onChange={(event) => setForm((current) => ({ ...current, geography: event.target.value }))}
                  required
                />
              </Field>
            </div>

            <Field id="ai-sdr-icp" label="One-sentence ICP">
              <Textarea
                id="ai-sdr-icp"
                value={form.icp}
                onChange={(event) => setForm((current) => ({ ...current, icp: event.target.value }))}
                required
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="ai-sdr-sender" label="Sender identity">
                <Input
                  id="ai-sdr-sender"
                  value={form.senderIdentity}
                  onChange={(event) => setForm((current) => ({ ...current, senderIdentity: event.target.value }))}
                  required
                />
              </Field>
              <Field id="ai-sdr-max-drafts" label="Max drafts">
                <select
                  id="ai-sdr-max-drafts"
                  value={form.maxDraftCount}
                  onChange={(event) => setForm((current) => ({ ...current, maxDraftCount: event.target.value }))}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-(length:--rad-3) focus-visible:ring-ring/50"
                >
                  {[1, 2, 3, 4, 5].map((count) => (
                    <option key={count} value={String(count)}>{count}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field id="ai-sdr-objective" label="Objective">
              <Textarea
                id="ai-sdr-objective"
                value={form.objective}
                onChange={(event) => setForm((current) => ({ ...current, objective: event.target.value }))}
                required
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="ai-sdr-banned-claims" label="Banned claims">
                <Textarea
                  id="ai-sdr-banned-claims"
                  value={form.bannedClaims}
                  onChange={(event) => setForm((current) => ({ ...current, bannedClaims: event.target.value }))}
                />
              </Field>
              <Field id="ai-sdr-notes" label="Notes">
                <Textarea
                  id="ai-sdr-notes"
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                />
              </Field>
            </div>

            {mutation.isError ? (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{mutation.error instanceof Error ? mutation.error.message : "AI SDR dogfood run failed"}</span>
              </div>
            ) : null}

            <Button type="submit" disabled={mutation.isPending}>
              <Send aria-hidden="true" />
              {mutation.isPending ? "Generating" : "Generate local batch"}
            </Button>
          </form>
        </section>

        <aside className="space-y-4 lg:col-span-5 lg:border-l lg:border-border lg:pl-6" aria-labelledby="ai-sdr-blocked-title">
          <div>
            <h2 id="ai-sdr-blocked-title" className="text-base font-semibold">Blocked downstream</h2>
            <p className="mt-1 text-sm text-muted-foreground">No outbound, deliverability, CRM, calendar, or external-source stage is active.</p>
          </div>
          <DownstreamBlocks blocks={downstreamBlocks} loading={fixturesQuery.isLoading} />
        </aside>
      </div>

      {result ? <GeneratedResult result={result} /> : null}
    </div>
  );
}
