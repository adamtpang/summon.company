import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CompanyModelPitStopProvider,
  ModelPitStopAdapterType,
} from "@paperclipai/shared";
import { AlertCircle, CheckCircle2, Gauge, RefreshCw, Wrench } from "lucide-react";
import { agentsApi } from "@/api/agents";
import { queryKeys } from "@/lib/queryKeys";
import { Button } from "@/components/ui/button";
import { RadioCardGroup } from "@/components/ui/radio-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function providerDescription(provider: CompanyModelPitStopProvider) {
  const primary = provider.primaryModel ? `Primary ${provider.primaryModel}` : "Primary model unavailable";
  const cheap = provider.cheapModel ? `cheap ${provider.cheapModel}` : "no cheap profile";
  return `${primary} · ${cheap}`;
}

function currentFleetLabel(
  currentAdapterType: ModelPitStopAdapterType | "mixed" | null,
  providers: CompanyModelPitStopProvider[],
) {
  if (currentAdapterType === "mixed") return "Mixed Claude and Codex fleet";
  if (!currentAdapterType) return "No Claude/Codex fleet";
  return providers.find((provider) => provider.adapterType === currentAdapterType)?.label
    ?? currentAdapterType;
}

export function CompanyModelPitStop({ companyId }: { companyId: string }) {
  const queryClient = useQueryClient();
  const initializedCompanyId = useRef<string | null>(null);
  const [targetAdapterType, setTargetAdapterType] = useState<ModelPitStopAdapterType>("codex_local");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const statusQuery = useQuery({
    queryKey: queryKeys.agents.modelPitStop(companyId),
    queryFn: () => agentsApi.modelPitStopStatus(companyId),
    refetchInterval: 3_000,
  });
  const switchMutation = useMutation({
    mutationFn: (adapterType: ModelPitStopAdapterType) =>
      agentsApi.switchModelPitStop(companyId, adapterType),
    onSuccess: async (result) => {
      queryClient.setQueryData(queryKeys.agents.modelPitStop(companyId), result.status);
      await queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(companyId) });
    },
  });

  useEffect(() => {
    const status = statusQuery.data;
    if (!status || initializedCompanyId.current === companyId) return;
    initializedCompanyId.current = companyId;
    setTargetAdapterType(status.currentAdapterType === "codex_local" ? "claude_local" : "codex_local");
  }, [companyId, statusQuery.data]);

  if (statusQuery.isLoading) {
    return (
      <div className="space-y-3 rounded-md border border-border px-4 py-4" data-testid="model-pit-stop-loading">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-10 w-32" />
      </div>
    );
  }

  if (statusQuery.isError || !statusQuery.data) {
    return (
      <div className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-4">
        <div className="flex items-center gap-2 text-sm font-medium text-destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          Couldn&apos;t inspect the model fleet
        </div>
        <p className="text-xs text-muted-foreground">
          Retry before changing providers. No agent configuration has been touched.
        </p>
        <Button size="sm" variant="outline" onClick={() => void statusQuery.refetch()}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Retry
        </Button>
      </div>
    );
  }

  const status = statusQuery.data;
  const selectedProvider = status.providers.find(
    (provider) => provider.adapterType === targetAdapterType,
  );
  const targetLabel = selectedProvider?.label ?? targetAdapterType;
  const fittingCurrentProvider = status.currentAdapterType === targetAdapterType;
  const actionLabel = `${fittingCurrentProvider ? "Re-fit" : "Fit"} ${targetLabel}`;
  const optionRows = status.providers.map((provider) => ({
    value: provider.adapterType,
    title: provider.label,
    description: providerDescription(provider),
  }));
  const switchDisabled = !status.canSwitch || !selectedProvider?.primaryModel || switchMutation.isPending;

  return (
    <div className="space-y-4 rounded-md border border-border px-4 py-4" data-testid="model-pit-stop">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <h3 className="text-sm font-medium">Model pit stop</h3>
          </div>
          <p className="max-w-prose text-xs text-muted-foreground">
            Refit the whole Claude/Codex fleet while work is stopped. Workspaces, credentials,
            instructions, and schedules stay mounted; the new setup applies to future runs.
          </p>
        </div>
        <div
          className={status.canSwitch
            ? "shrink-0 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-xs font-medium"
            : "shrink-0 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs font-medium text-destructive"}
          aria-live="polite"
        >
          {status.canSwitch ? "Pit lane open" : "Pit lane closed"}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <RadioCardGroup
          value={targetAdapterType}
          onValueChange={(value) => setTargetAdapterType(value as ModelPitStopAdapterType)}
          options={optionRows}
          ariaLabel="Target model provider"
          disabled={switchMutation.isPending}
          className="flex-1 sm:grid-cols-2"
        />
        <Button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={switchDisabled}
          aria-busy={switchMutation.isPending}
        >
          <Wrench className="h-4 w-4" aria-hidden="true" />
          {switchMutation.isPending ? "Refitting..." : actionLabel}
        </Button>
      </div>

      <div className="space-y-1 text-xs text-muted-foreground" aria-live="polite">
        <p>
          Current fleet: <span className="font-medium text-foreground">
            {currentFleetLabel(status.currentAdapterType, status.providers)}
          </span>
          {` · ${status.eligibleAgentCount} ${status.eligibleAgentCount === 1 ? "agent" : "agents"}`}
        </p>
        {status.blockingReason ? <p className="text-destructive">{status.blockingReason}</p> : null}
        {status.excludedAgentCount > 0 ? (
          <p>
            {status.excludedAgentCount} non-Claude/Codex or pending {status.excludedAgentCount === 1 ? "agent is" : "agents are"} left unchanged.
          </p>
        ) : null}
      </div>

      {switchMutation.isError ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {switchMutation.error instanceof Error
              ? switchMutation.error.message
              : "The fleet could not be reconfigured. Check run state and try again."}
          </span>
        </div>
      ) : null}

      {switchMutation.isSuccess ? (
        <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs" role="status">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span>
            {switchMutation.data.changedAgentCount > 0
              ? `${targetLabel} fitted across ${switchMutation.data.changedAgentCount} ${switchMutation.data.changedAgentCount === 1 ? "agent" : "agents"}.`
              : `${targetLabel} was already fitted; the provider profiles were verified.`}
            {` Future runs use ${switchMutation.data.primaryModel}`}
            {switchMutation.data.cheapModel ? `; cheap runs use ${switchMutation.data.cheapModel}.` : "."}
          </span>
        </div>
      ) : null}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{actionLabel} across the fleet?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  This reconfigures {status.eligibleAgentCount} {status.eligibleAgentCount === 1 ? "agent" : "agents"}
                  {selectedProvider?.primaryModel ? ` to ${selectedProvider.primaryModel}` : ""}.
                </p>
                <p>
                  It does not start, stop, or wake work. The new provider and cheap profile apply when the next run begins.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current setup</AlertDialogCancel>
            <AlertDialogAction onClick={() => switchMutation.mutate(targetAdapterType)}>
              Confirm pit stop
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
