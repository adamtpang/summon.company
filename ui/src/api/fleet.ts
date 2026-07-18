import { api } from "./client";

export interface FleetRun {
  runId: string;
  status: string;
  startedAt: string | null;
  createdAt: string;
  agentId: string;
  agentName: string;
  agentStatus: string;
  companyId: string;
  companyName: string;
  issuePrefix: string;
  issueId: string | null;
  issueIdentifier: string | null;
}

export interface FleetRunningResponse {
  runs: FleetRun[];
  queuedWakeups: number;
}

export interface FleetStopResult {
  agentsPaused: number;
  wakeupsCancelled: number;
  runsCancelled: number;
  reason: string;
}

export const fleetApi = {
  running: (companyId?: string | null) =>
    api.get<FleetRunningResponse>(
      companyId ? `/fleet/running?companyId=${encodeURIComponent(companyId)}` : "/fleet/running",
    ),
  stop: (input: { companyId?: string | null; reason?: string } = {}) =>
    api.post<FleetStopResult>("/fleet/stop", input),
  cancelRun: (runId: string) =>
    api.post<unknown>(`/heartbeat-runs/${encodeURIComponent(runId)}/cancel`, {}),
};
