// Per-adapter "thinking effort" is stored under a different adapterConfig key for
// every executor (Codex calls it modelReasoningEffort, Cursor overloads mode,
// OpenCode uses variant, everything else uses effort). The quick switch and the
// long-form AgentConfigForm must agree on that mapping, so it lives here.

export interface EffortOption {
  id: string;
  label: string;
}

const CODEX_EFFORT_OPTIONS: readonly EffortOption[] = [
  { id: "", label: "Auto" },
  { id: "minimal", label: "Minimal" },
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "xhigh", label: "X-High" },
];

const OPENCODE_EFFORT_OPTIONS: readonly EffortOption[] = [
  ...CODEX_EFFORT_OPTIONS,
  { id: "max", label: "Max" },
];

const CURSOR_MODE_OPTIONS: readonly EffortOption[] = [
  { id: "", label: "Auto" },
  { id: "plan", label: "Plan" },
  { id: "ask", label: "Ask" },
];

const CLAUDE_EFFORT_OPTIONS: readonly EffortOption[] = [
  { id: "", label: "Auto" },
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
];

/** adapterConfig key that carries thinking effort for this adapter. */
export function effortKeyForAdapter(adapterType: string): string {
  if (adapterType === "codex_local") return "modelReasoningEffort";
  if (adapterType === "cursor") return "mode";
  if (adapterType === "opencode_local") return "variant";
  return "effort";
}

export function effortOptionsForAdapter(adapterType: string): readonly EffortOption[] {
  if (adapterType === "codex_local") return CODEX_EFFORT_OPTIONS;
  if (adapterType === "cursor") return CURSOR_MODE_OPTIONS;
  if (adapterType === "opencode_local") return OPENCODE_EFFORT_OPTIONS;
  return CLAUDE_EFFORT_OPTIONS;
}

/** Adapters that expose no effort control at all. */
export function adapterSupportsEffort(adapterType: string): boolean {
  return adapterType !== "gemini_local" && adapterType !== "cursor_cloud";
}

/**
 * Current effort for an agent. Codex historically wrote `reasoningEffort` before
 * settling on `modelReasoningEffort`; read both so old agents show the truth.
 */
export function readEffort(adapterType: string, adapterConfig: Record<string, unknown>): string {
  const key = effortKeyForAdapter(adapterType);
  const raw = adapterConfig[key] ?? (key === "modelReasoningEffort" ? adapterConfig.reasoningEffort : undefined);
  return typeof raw === "string" ? raw : "";
}

export function readModel(adapterConfig: Record<string, unknown>): string {
  return typeof adapterConfig.model === "string" ? adapterConfig.model : "";
}

export function effortLabel(adapterType: string, effortId: string): string {
  return effortOptionsForAdapter(adapterType).find((option) => option.id === effortId)?.label ?? "Auto";
}

/**
 * Next adapterConfig for a quick-switch selection. Everything the board already
 * configured on the agent survives; only the touched field moves. Setting Codex
 * effort also clears the legacy `reasoningEffort` key, otherwise the stale value
 * would win on read for agents created before the rename.
 */
export function buildAdapterConfigPatch(
  adapterType: string,
  adapterConfig: Record<string, unknown>,
  next: { model?: string; effort?: string },
): Record<string, unknown> {
  const patched: Record<string, unknown> = { ...adapterConfig };
  if (next.model !== undefined) patched.model = next.model;
  if (next.effort !== undefined) {
    const key = effortKeyForAdapter(adapterType);
    patched[key] = next.effort;
    if (key === "modelReasoningEffort") delete patched.reasoningEffort;
  }
  return patched;
}
