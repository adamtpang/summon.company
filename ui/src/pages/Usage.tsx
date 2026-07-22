import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CostByAgentModel, CostWindowSpendRow, ProviderQuotaResult } from "@paperclipai/shared";
import {
  evaluateQuotaAlerts,
  quotaAlertDedupKey,
  quotaProviderLabel,
  type QuotaAlert,
} from "@paperclipai/shared";
import { AlertTriangle, BellRing, Gauge } from "lucide-react";
import { costsApi } from "../api/costs";
import { EmptyState } from "../components/EmptyState";
import { Identity } from "../components/Identity";
import { PageSkeleton } from "../components/PageSkeleton";
import { QuotaBar } from "../components/QuotaBar";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { cn, formatCents, formatTokens, quotaSourceDisplayName } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const NO_COMPANY = "__none__";

/** last 7 days — matches the longest provider quota window we render */
function attributionRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 86_400_000);
  return { from: from.toISOString(), to: to.toISOString() };
}

function formatReset(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const ALERT_STYLES: Record<QuotaAlert["level"], string> = {
  exhausted: "border-(--status-task-blocked) text-(--status-task-blocked)",
  urgent: "border-(--status-task-blocked) text-(--status-task-blocked)",
  warn: "border-(--status-task-todo) text-(--status-task-todo)",
};

function AlertBanner({ alerts }: { alerts: QuotaAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <div
          key={quotaAlertDedupKey(alert)}
          className={cn(
            "flex items-start gap-2.5 border px-3.5 py-2.5 text-sm",
            ALERT_STYLES[alert.level],
          )}
        >
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="font-semibold uppercase text-(length:--text-micro) tracking-(--tracking-eyebrow) mr-2">
              {alert.level}
            </span>
            <span className="text-foreground">{alert.message}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Fires a desktop notification once per alert dedup key. Escalations (70% →
 * 90% → exhausted) produce new keys and re-notify; the same alert within the
 * same reset window stays silent after the first notification.
 */
function useDesktopQuotaNotifications(alerts: QuotaAlert[]) {
  const notifiedRef = useRef<Set<string>>(new Set());
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );

  useEffect(() => {
    if (permission !== "granted") return;
    for (const alert of alerts) {
      const key = quotaAlertDedupKey(alert);
      if (notifiedRef.current.has(key)) continue;
      notifiedRef.current.add(key);
      try {
        new Notification(
          `${quotaProviderLabel(alert.provider)} quota ${alert.level === "warn" ? "warning" : alert.level}`,
          { body: alert.message, tag: key },
        );
      } catch {
        // notification construction can throw in embedded webviews — the
        // board feed alert remains the durable channel
      }
    }
  }, [alerts, permission]);

  return {
    permission,
    request: async () => {
      if (typeof Notification === "undefined") return;
      setPermission(await Notification.requestPermission());
    },
  };
}

interface AgentBurnRow {
  agentId: string;
  agentName: string | null;
  tokens: number;
  costCents: number;
}

function agentBurnForProvider(rows: CostByAgentModel[], provider: string): AgentBurnRow[] {
  const byAgent = new Map<string, AgentBurnRow>();
  for (const row of rows) {
    if (row.provider !== provider) continue;
    const tokens = row.inputTokens + row.cachedInputTokens + row.outputTokens;
    const existing = byAgent.get(row.agentId);
    if (existing) {
      existing.tokens += tokens;
      existing.costCents += row.costCents;
    } else {
      byAgent.set(row.agentId, {
        agentId: row.agentId,
        agentName: row.agentName,
        tokens,
        costCents: row.costCents,
      });
    }
  }
  return [...byAgent.values()].sort((a, b) => b.tokens - a.tokens);
}

function ProviderUsagePanel({
  result,
  windowRows,
  agentRows,
  now,
}: {
  result: ProviderQuotaResult;
  windowRows: CostWindowSpendRow[];
  agentRows: AgentBurnRow[];
  now: Date;
}) {
  const alerts = useMemo(() => evaluateQuotaAlerts([result], now), [result, now]);
  const alertByWindow = useMemo(
    () => new Map(alerts.map((a) => [a.windowLabel, a])),
    [alerts],
  );
  const totalTokens = agentRows.reduce((sum, r) => sum + r.tokens, 0);
  const topAgents = agentRows.slice(0, 6);

  // hourly burn per rolling window — a rising rate from 7d → 24h → 5h means
  // consumption is accelerating toward the wall
  const burnRates = windowRows
    .filter((r) => r.windowHours > 0)
    .map((r) => ({
      window: r.window,
      tokensPerHour: (r.inputTokens + r.cachedInputTokens + r.outputTokens) / r.windowHours,
      costCentsPerHour: r.costCents / r.windowHours,
    }));
  const maxRate = Math.max(...burnRates.map((r) => r.tokensPerHour), 0);

  return (
    <Card>
      <CardHeader className="px-4 pt-4 pb-0 gap-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold">
              {quotaProviderLabel(result.provider)}
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              {result.source ? quotaSourceDisplayName(result.source) : "subscription quota"}
            </CardDescription>
          </div>
          {alerts.length > 0 && (
            <span
              className={cn(
                "text-(length:--text-micro) uppercase tracking-(--tracking-eyebrow) border px-1.5 py-0.5 shrink-0",
                ALERT_STYLES[alerts[0]!.level],
              )}
            >
              {alerts[0]!.level}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 pt-3 space-y-4">
        {/* live provider quota windows with reset times and forecasts */}
        {!result.ok ? (
          <p className="text-xs text-destructive">
            {result.error ?? "Quota fetch failed."}
          </p>
        ) : result.windows.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Provider reported no quota windows.
          </p>
        ) : (
          <div className="space-y-3">
            {result.windows.map((qw) => {
              const alert = alertByWindow.get(qw.label);
              return (
                <div key={qw.label} className="space-y-1">
                  {qw.usedPercent != null ? (
                    <QuotaBar
                      label={qw.label}
                      percentUsed={qw.usedPercent}
                      leftLabel={`${Math.round(qw.usedPercent)}% used`}
                      rightLabel={qw.resetsAt ? `resets ${formatReset(qw.resetsAt)}` : undefined}
                      showDeficitNotch={qw.usedPercent >= 100}
                    />
                  ) : (
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">{qw.label}</span>
                      <span className="font-medium tabular-nums">{qw.valueLabel ?? "·"}</span>
                    </div>
                  )}
                  {alert?.forecastExhaustAt && (
                    <p className="text-xs text-(--status-task-blocked)">
                      at current burn, exhausts {formatReset(alert.forecastExhaustAt)}
                    </p>
                  )}
                  {qw.detail && (
                    <p className="text-xs text-muted-foreground">{qw.detail}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* burn trend — hourly rate per rolling window */}
        {burnRates.length > 0 && (
          <>
            <div className="border-t border-border" />
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Burn rate
              </p>
              <div className="space-y-2">
                {burnRates.map((rate) => (
                  <div key={rate.window} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-mono text-muted-foreground w-8 shrink-0">
                        {rate.window}
                      </span>
                      <span className="text-muted-foreground font-mono flex-1">
                        {formatTokens(Math.round(rate.tokensPerHour))} tok/h
                      </span>
                      <span className="font-medium tabular-nums">
                        {formatCents(Math.round(rate.costCentsPerHour))}/h
                      </span>
                    </div>
                    <div className="h-2 w-full border border-border overflow-hidden">
                      <div
                        className="h-full bg-primary/60 transition-(--tp-width) duration-150"
                        style={{ width: `${maxRate > 0 ? (rate.tokensPerHour / maxRate) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* per-employee attribution — who is burning this provider's quota */}
        <div className="border-t border-border" />
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Who is burning it (7d)
          </p>
          {topAgents.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No attributed usage in the last 7 days.
            </p>
          ) : (
            <div className="space-y-2">
              {topAgents.map((agent) => {
                const sharePct = totalTokens > 0 ? (agent.tokens / totalTokens) * 100 : 0;
                return (
                  <div key={agent.agentId} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate flex items-center gap-1.5">
                        <Identity name={agent.agentName ?? agent.agentId} size="xs" />
                        <span className="truncate">{agent.agentName ?? agent.agentId}</span>
                      </span>
                      <span className="text-muted-foreground font-mono shrink-0">
                        {formatTokens(agent.tokens)} tok · {Math.round(sharePct)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full border border-border overflow-hidden">
                      <div
                        className="h-full bg-primary/60 transition-(--tp-width) duration-150"
                        style={{ width: `${sharePct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function Usage() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const companyId = selectedCompanyId ?? NO_COMPANY;

  useEffect(() => {
    setBreadcrumbs([{ label: "Usage" }]);
  }, [setBreadcrumbs]);

  const range = useMemo(attributionRange, []);

  const { data: quotaResults, isLoading: quotaLoading, dataUpdatedAt } = useQuery({
    queryKey: queryKeys.usageQuotaWindows(companyId),
    queryFn: () => costsApi.quotaWindows(companyId),
    enabled: !!selectedCompanyId,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const { data: windowSpend } = useQuery({
    queryKey: queryKeys.usageWindowSpend(companyId),
    queryFn: () => costsApi.windowSpend(companyId),
    enabled: !!selectedCompanyId,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const { data: agentModelRows } = useQuery({
    queryKey: queryKeys.usageAgentAttribution(companyId, range.from, range.to),
    queryFn: () => costsApi.byAgentModel(companyId, range.from, range.to),
    enabled: !!selectedCompanyId,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const now = useMemo(() => new Date(dataUpdatedAt || Date.now()), [dataUpdatedAt]);
  const alerts = useMemo(
    () => evaluateQuotaAlerts(quotaResults ?? [], now),
    [quotaResults, now],
  );
  const notifications = useDesktopQuotaNotifications(alerts);

  if (!selectedCompanyId) {
    return <EmptyState icon={Gauge} message="Select a company to view usage." />;
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Usage</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Live provider quota, burn rate, and who is consuming it. Warn at 70%, urgent at 90%.
          </p>
        </div>
        {notifications.permission === "default" && (
          <Button variant="outline" size="sm" onClick={notifications.request}>
            <BellRing className="h-3.5 w-3.5 mr-1.5" />
            Enable desktop alerts
          </Button>
        )}
      </div>

      <AlertBanner alerts={alerts} />

      {quotaLoading && !quotaResults ? (
        <PageSkeleton variant="costs" />
      ) : !quotaResults || quotaResults.length === 0 ? (
        <EmptyState
          icon={Gauge}
          message="No providers report subscription quota. Connect a Claude or Codex adapter."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {quotaResults.map((result) => (
            <ProviderUsagePanel
              key={result.provider}
              result={result}
              windowRows={(windowSpend ?? []).filter((r) => r.provider === result.provider)}
              agentRows={agentBurnForProvider(agentModelRows ?? [], result.provider)}
              now={now}
            />
          ))}
        </div>
      )}
    </div>
  );
}
