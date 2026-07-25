import { AGENT_DEFAULT_MAX_CONCURRENT_RUNS } from "@paperclipai/shared";
import { defaultCreateValues } from "../components/agent-config-defaults";

export function buildNewAgentRuntimeConfig(input?: {
  heartbeatEnabled?: boolean;
  intervalSec?: number;
  phaseOffsetSec?: number;
  cheapModel?: string;
  cheapModelEnabled?: boolean;
}): Record<string, unknown> {
  const heartbeat: Record<string, unknown> = {
    enabled: input?.heartbeatEnabled ?? defaultCreateValues.heartbeatEnabled,
    intervalSec: input?.intervalSec ?? defaultCreateValues.intervalSec,
    wakeOnDemand: true,
    skipTimerWhenNoActionableWork: true,
    cooldownSec: 10,
    maxConcurrentRuns: AGENT_DEFAULT_MAX_CONCURRENT_RUNS,
  };
  // Deterministic staggered wakes: only set when provided so the default stays drift-based.
  if (input?.phaseOffsetSec !== undefined && input.phaseOffsetSec !== null) {
    heartbeat.phaseOffsetSec = Math.max(0, Math.floor(input.phaseOffsetSec));
  }
  const config: Record<string, unknown> = { heartbeat };

  const cheapModel = input?.cheapModel?.trim() ?? "";
  const cheapEnabled = input?.cheapModelEnabled ?? false;
  if (cheapModel && cheapEnabled) {
    config.modelProfiles = {
      cheap: {
        enabled: true,
        adapterConfig: { model: cheapModel },
      },
    };
  }

  return config;
}
