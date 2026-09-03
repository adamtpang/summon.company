// Company-scoped market-cap proxy. ARR comes only from the same company-owned
// restricted Stripe connection that drives Mission Control profitability.
// Unknown remains unproven; test, non-USD, and bounded evidence stay labeled.

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  computeMarketCapSnapshot,
  VITALS_MARKET_CAP_LADDER,
  type MarketCapSnapshot,
} from "@paperclipai/shared/vitals-market-cap";
import type { DashboardSummary } from "@paperclipai/shared";
import { AlertCircle, Gauge, Landmark, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { dashboardApi } from "../api/dashboard";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";

export function useMarketCapSnapshot(
  companyId: string | null,
  providedFinance?: DashboardSummary["finance"],
) {
  const dashboardQuery = useQuery({
    queryKey: queryKeys.dashboard(companyId ?? "none"),
    enabled: companyId !== null && providedFinance === undefined,
    queryFn: () => dashboardApi.summary(companyId as string),
  });
  const finance = providedFinance ?? dashboardQuery.data?.finance ?? null;
  const loading = companyId !== null && finance === null && dashboardQuery.isLoading;

  const snapshot: MarketCapSnapshot | null = useMemo(() => {
    if (loading || !finance) return null;
    return computeMarketCapSnapshot(
      {
        stripeConnected: finance.stripeConnected,
        stripeTestMode: finance.stripeMode === "test",
        revenueFreshness: finance.revenueFreshness,
        arrCents: finance.arrCents,
        arrCurrency: finance.arrCurrency,
        arrCoverage: finance.arrCoverage,
        payingCustomers: finance.payingCustomerCount,
        retentionRate: null,
        grossMarginPct: null,
        arrGrowth30dPct: null,
      },
      new Date().toISOString(),
    );
  }, [finance, loading]);

  return { snapshot, loading, error: dashboardQuery.error };
}

export function MarketCapPanel({ companyId }: { companyId: string | null }) {
  const { snapshot, loading, error } = useMarketCapSnapshot(companyId);

  if (loading || !snapshot) {
    return (
      <div className="space-y-3 rounded-lg border bg-card p-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-full" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">Could not read the company financial evidence.</p>;
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

        <div className="mt-4 flex items-start gap-2 rounded-md border border-live/30 bg-live/10 p-3">
          <Gauge className="mt-0.5 h-4 w-4 shrink-0 text-live" aria-hidden />
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

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="flex items-center gap-2 border-b p-4 text-sm font-medium">
          <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden />
          The levers (market cap ≈ ARR × multiple)
        </div>
        <div className="divide-y sm:hidden">
          {snapshot.levers.map((lever) => (
            <div
              key={lever.key}
              className={cn("space-y-3 p-4", lever.key === snapshot.bindingLever.key && "bg-live/5")}
            >
              <div>
                <div className="font-medium">
                  {lever.label}
                  {lever.key === snapshot.bindingLever.key && (
                    <span className="ml-2 rounded-full border border-live/40 px-2 py-0.5 text-(length:--text-nano) font-medium uppercase tracking-wide text-live">
                      binding
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">{lever.how}</div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="uppercase tracking-wide text-muted-foreground">Current value</div>
                  <div className={cn("mt-1 text-sm", !lever.proven && "text-muted-foreground")}>
                    {lever.currentValue}
                  </div>
                </div>
                <div>
                  <div className="uppercase tracking-wide text-muted-foreground">Owner</div>
                  <div className="mt-1 text-sm text-muted-foreground">{lever.ownerDepartment}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <table className="hidden w-full text-sm sm:table">
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
                    lever.key === snapshot.bindingLever.key && "bg-live/5",
                )}
              >
                <td className="p-3">
                  <div className="font-medium">
                    {lever.label}
                    {lever.key === snapshot.bindingLever.key && (
                      <span className="ml-2 rounded-full border border-live/40 px-2 py-0.5 text-(length:--text-nano) font-medium uppercase tracking-wide text-live">
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
        Live company dashboard · {snapshot.generatedAt} · refresh the Stripe evidence from Payments
      </p>
    </div>
  );
}

export function MarketCap() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Market cap" }]);
  }, [setBreadcrumbs]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Market cap</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The company&apos;s valuation, its levers, and the one binding lever right now.
          Company-owned Stripe evidence only. Unknown remains unproven (doc/MARKET-CAP-MODEL.md).
        </p>
      </div>
      <MarketCapPanel companyId={selectedCompanyId} />
    </div>
  );
}
