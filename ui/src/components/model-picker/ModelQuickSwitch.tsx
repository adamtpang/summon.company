import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown } from "lucide-react";
import { agentsApi } from "@/api/agents";
import { queryKeys } from "@/lib/queryKeys";
import { getAdapterLabel } from "@/adapters/adapter-display-registry";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  adapterSupportsEffort,
  buildAdapterConfigPatch,
  effortLabel,
  effortOptionsForAdapter,
  readEffort,
  readModel,
} from "./adapter-effort";

export interface ModelQuickSwitchProps {
  agentId: string;
  companyId: string;
  adapterType: string;
  adapterConfig: Record<string, unknown>;
  /** Model choice is company config, not run control — restricted views hide it. */
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
}

/**
 * The /model moment: current executor as a chip, two clicks to change it.
 * Rides the existing adapterModels query and the agent PATCH endpoint; the
 * change lands in adapterConfig and applies from the agent's next run.
 */
export function ModelQuickSwitch({
  agentId,
  companyId,
  adapterType,
  adapterConfig,
  disabled = false,
  disabledReason,
  className,
}: ModelQuickSwitchProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentModel = readModel(adapterConfig);
  const currentEffort = readEffort(adapterType, adapterConfig);
  const showEffort = adapterSupportsEffort(adapterType);

  const { data: models, isLoading: modelsLoading } = useQuery({
    queryKey: queryKeys.agents.adapterModels(companyId, adapterType),
    queryFn: () => agentsApi.adapterModels(companyId, adapterType),
    enabled: open,
  });

  const switchMutation = useMutation({
    mutationFn: (next: { model?: string; effort?: string }) =>
      agentsApi.update(
        agentId,
        { adapterConfig: buildAdapterConfigPatch(adapterType, adapterConfig, next) },
        companyId,
      ),
    onSuccess: async () => {
      setError(null);
      setOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agentId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(companyId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.agents.configRevisions(agentId) }),
      ]);
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "Could not change the model");
    },
  });

  // Agents can pin a CLI alias ("opus") while the adapter reports canonical ids
  // ("claude-opus-4-8"). Without this the board opens the picker and sees nothing
  // checked, which reads as "no model set" when a model very much is set.
  const currentIsUnlisted = Boolean(currentModel) && !models?.some((model) => model.id === currentModel);

  const chipLabel = [
    getAdapterLabel(adapterType),
    currentModel || "default model",
    ...(showEffort ? [effortLabel(adapterType, currentEffort)] : []),
  ].join(" · ");

  const trigger = (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled}
      title={disabled ? disabledReason : "Change executor, model, or effort"}
      className={cn("gap-1.5 font-normal", className)}
      data-testid="model-quick-switch-chip"
    >
      <span className="truncate">{chipLabel}</span>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
    </Button>
  );

  if (disabled) return trigger;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0" data-testid="model-quick-switch-popover">
        <Command>
          <CommandList>
            {currentIsUnlisted && (
              <CommandGroup heading="Current">
                <CommandItem
                  value={currentModel}
                  disabled
                  data-testid="model-quick-switch-current-unlisted"
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                  <span className="truncate">{currentModel}</span>
                  <span className="ml-auto text-xs text-muted-foreground">pinned</span>
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading={`${getAdapterLabel(adapterType)} models`}>
              {modelsLoading && (
                <div className="px-2 py-3 text-xs text-muted-foreground">Loading models…</div>
              )}
              {!modelsLoading && (models?.length ?? 0) === 0 && (
                <CommandEmpty>No models reported by this executor.</CommandEmpty>
              )}
              {models?.map((model) => (
                <CommandItem
                  key={model.id}
                  value={model.id}
                  disabled={switchMutation.isPending}
                  onSelect={() => switchMutation.mutate({ model: model.id })}
                  data-testid={`model-quick-switch-model-${model.id}`}
                >
                  <Check
                    className={cn("h-4 w-4", model.id === currentModel ? "opacity-100" : "opacity-0")}
                    aria-hidden="true"
                  />
                  <span className="truncate">{model.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        {showEffort && (
          <div className="border-t border-border px-3 py-2.5">
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Effort</div>
            <div className="flex flex-wrap gap-1">
              {effortOptionsForAdapter(adapterType).map((option) => (
                <button
                  key={option.id || "auto"}
                  type="button"
                  disabled={switchMutation.isPending}
                  onClick={() => switchMutation.mutate({ effort: option.id })}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs transition-colors disabled:opacity-50",
                    option.id === currentEffort
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent",
                  )}
                  data-testid={`model-quick-switch-effort-${option.id || "auto"}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
          Applies from this agent&apos;s next run. Active runs are never interrupted.
        </p>
        {error && (
          <p className="border-t border-border px-3 py-2 text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
