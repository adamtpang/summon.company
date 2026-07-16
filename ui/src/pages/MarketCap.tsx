// VIT-101: the Market Cap panel -- current ladder stage, honest cap proxy, ARR
// from real Stripe data only, the one binding lever, and the levers table.
// Additive Vitals surface; designed to be embedded by the VIT-70 scoreboard.
// Data: live control-plane reads (companies, employees) plus the published
// `market-cap-snapshot` issue document (Stripe read, published by
// scripts/vitals-market-cap-snapshot.mjs --publish). No snapshot => honest
// "Stripe not connected" state computed client-side. 11x rule throughout.

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  computeMarketCapSnapshot,
  parseMarketCapSnapshotDocument,
  VITALS_MARKET_CAP_DOCUMENT_KEY,
  VITALS_MARKET_CAP_LADDER,
  type MarketCapSnapshot,
} from "@paperclipai/shared/vitals-market-cap";
import { AlertCircle, Gauge, Landmark, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { agentsApi } from "../api/agents";
import { companiesApi } from "../api/companies";
import { issuesApi } from "../api/issues";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { cn } from "../lib/utils";

export function useMarketCapSnapshot(companyId: string | null) {
  const companiesQuery = useQuery({
    queryKey: ["vitals-market-cap", "companies"],
    queryFn: () => companiesApi.list(),
  });

  const companies = companiesQuery.data ?? null;

  const employeesQuery = useQuery({
    queryKey: ["vitals-market-cap", "employees", companies?.map((c) => c.id) ?? []],
    enabled: companies !== null,
    queryFn: async () => {
      const lists = await Promise.all(
        (companies ?? []).map((c) => agentsApi.list(c.id).catch(() => [])),
      );
      return lists.reduce((n, list) => n + list.length, 0);
    },
  });

  const issuesQuery = useQuery({
    queryKey: ["vitals-market-cap", "issues", companyId],
    enabled: companyId !== null,
    queryFn: () => issuesApi.list(companyId as string),
  });

  const marketCapIssue = useMemo(
    () => (issuesQuery.data ?? []).find((i) => /market cap on the scoreboard/i.test(i.title)) ?? null,
    [issuesQuery.data],
  );

  const documentQuery = useQuery({
    queryKey: ["vitals-market-cap", "document", marketCapIssue?.id],
    enabled: marketCapIssue !== null,
    retry: false,
    queryFn: () => issuesApi.getDocument(marketCapIssue!.id, VITALS_MARKET_CAP_DOCUMENT_KEY),
  });

  const loading =
    companiesQuery.isLoading ||
    employeesQuery.isLoading ||
    issuesQuery.isLoading ||
    (marketCapIssue !== null && documentQuery.isLoading);

  const snapshot: MarketCapSnapshot | null = useMemo(() => {
    if (loading) return null;
    const published = documentQuery.data?.body
      ? parseMarketCapSnapshotDocument(documentQuery.data.body)
      : null;
    if (published) return published;
    if (companies === null || employeesQuery.data === undefined) return null;
    // No published snapshot: compute the honest disconnected state live.
    return computeMarketCapSnapshot(
      {
        stripeConnected: false,
        arrCents: null,
        payingCompanies: null,
        totalCompanies: companies.length,
        totalEmployees: employeesQuery.data,
        retentionRate: null,
        grossMarginPct: null,
        arrGrowth30dPct: null,
      },
      new Date().toISOString(),
    );
  }, [loading, documentQuery.data, companies, employeesQuery.data]);

  return { snapshot, loading, published: Boolean(documentQuery.data?.body) };
}

export function MarketCapPanel({ companyId }: { companyId: string | null }) {
  const { snapshot, loading, published } = useMarketCapSnapshot(companyId);

  if (loading || !snapshot) {
    return (
      <div className="space-y-3 rounded-lg border bg-card p-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-full" />
      </div>
    );
  }

  const stageIndex = VITALS_MARKET_CAP_LADDER.findIndex((s) => s.id === snapshot.stage.id);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Landmark className="h-4 w-4" aria-hidden />
          Market cap (honest proxy)
        </div>
        <div className="mt-2 text-3xl font-semibold tracking-tight">{snapshot.capProxyLabel}</div>
        <div className="mt-1 text-sm text-muted-foreground">
          ARR (real Stripe only): <span className="font-medium text-foreground">{snapshot.arrLabel}</span>
          {" · "}
          {snapshot.multipleLabel}
        </div>

        <div className="mt-5">
          <div className="flex items-center gap-1.5" role="list" aria-label="Market cap ladder">
            {VITALS_MARKET_CAP_LADDER.map((stage, i) => (
              <div key={stage.id} role="listitem" className="flex flex-1 flex-col gap-1">
                <div
                  className={cn(
                    "h-1.5 rounded-full",
                    i < stageIndex && "bg-primary/40",
                    i === stageIndex && "bg-primary",
                    i > stageIndex && "bg-muted",
                  )}
                />
                <span
                  className={cn(
                    "text-(length:--text-nano) font-medium uppercase tracking-wide",
                    i === stageIndex ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {stage.id}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Stage {snapshot.stage.id}:</span>{" "}
            {snapshot.stage.proof}
          </p>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
          <Gauge className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <div className="text-sm">
            <span className="font-medium">Binding lever:</span> {snapshot.bindingLever.statement}
          </div>
        </div>

        {snapshot.evidenceGaps.length > 0 && (
          <div className="mt-4 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5" aria-hidden />
              Evidence gaps capping the multiple
            </div>
            <ul className="list-inside list-disc text-sm text-muted-foreground">
              {snapshot.evidenceGaps.map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex items-center gap-2 border-b p-4 text-sm font-medium">
          <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden />
          The levers (market cap ≈ ARR × multiple)
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="p-3 font-medium">Lever</th>
              <th className="p-3 font-medium">Current (real) value</th>
              <th className="p-3 font-medium">Owner</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.levers.map((lever) => (
              <tr
                key={lever.key}
                className={cn(
                  "border-b last:border-b-0",
                  lever.key === snapshot.bindingLever.key && "bg-amber-500/5",
                )}
              >
                <td className="p-3">
                  <div className="font-medium">
                    {lever.label}
                    {lever.key === snapshot.bindingLever.key && (
                      <span className="ml-2 rounded-full border border-amber-500/40 px-2 py-0.5 text-(length:--text-nano) font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
                        binding
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{lever.how}</div>
                </td>
                <td className={cn("p-3", !lever.proven && "text-muted-foreground")}>
                  {lever.currentValue}
                </td>
                <td className="p-3 text-muted-foreground">{lever.ownerDepartment}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Snapshot {published ? "published" : "computed live (no published snapshot)"} ·{" "}
        {snapshot.generatedAt} · refresh: node scripts/vitals-market-cap-snapshot.mjs --publish
      </p>
    </div>
  );
}

export function MarketCap() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: selectedCompany?.name ?? "Company" }, { label: "Market cap" }]);
  }, [setBreadcrumbs, selectedCompany?.name]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Market cap</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The company&apos;s valuation, its levers, and the one binding lever right now.
          Real data only — $0 shows as $0 (doc/MARKET-CAP-MODEL.md).
        </p>
      </div>
      <MarketCapPanel companyId={selectedCompanyId} />
    </div>
  );
}
