import { describe, expect, it } from "vitest";
import {
  adapterSupportsEffort,
  buildAdapterConfigPatch,
  effortKeyForAdapter,
  effortLabel,
  effortOptionsForAdapter,
  readEffort,
  readModel,
} from "./adapter-effort";

describe("effortKeyForAdapter", () => {
  it("maps each executor to the adapterConfig key it actually persists", () => {
    expect(effortKeyForAdapter("codex_local")).toBe("modelReasoningEffort");
    expect(effortKeyForAdapter("cursor")).toBe("mode");
    expect(effortKeyForAdapter("opencode_local")).toBe("variant");
    expect(effortKeyForAdapter("claude_local")).toBe("effort");
  });
});

describe("effortOptionsForAdapter", () => {
  it("offers Claude low/medium/high but not Codex-only tiers", () => {
    const ids = effortOptionsForAdapter("claude_local").map((option) => option.id);
    expect(ids).toEqual(["", "low", "medium", "high"]);
    expect(ids).not.toContain("xhigh");
  });

  it("offers OpenCode a max tier above Codex's", () => {
    expect(effortOptionsForAdapter("opencode_local").map((o) => o.id)).toContain("max");
    expect(effortOptionsForAdapter("codex_local").map((o) => o.id)).not.toContain("max");
  });
});

describe("adapterSupportsEffort", () => {
  it("hides the control for executors with no effort concept", () => {
    expect(adapterSupportsEffort("gemini_local")).toBe(false);
    expect(adapterSupportsEffort("cursor_cloud")).toBe(false);
    expect(adapterSupportsEffort("claude_local")).toBe(true);
  });
});

describe("readEffort", () => {
  it("reads the adapter's own key", () => {
    expect(readEffort("claude_local", { effort: "high" })).toBe("high");
    expect(readEffort("codex_local", { modelReasoningEffort: "xhigh" })).toBe("xhigh");
    expect(readEffort("opencode_local", { variant: "max" })).toBe("max");
  });

  it("falls back to Codex's legacy reasoningEffort key", () => {
    expect(readEffort("codex_local", { reasoningEffort: "low" })).toBe("low");
  });

  it("prefers the current key when both are present", () => {
    expect(readEffort("codex_local", { modelReasoningEffort: "high", reasoningEffort: "low" })).toBe("high");
  });

  it("returns empty (Auto) when unset or non-string", () => {
    expect(readEffort("claude_local", {})).toBe("");
    expect(readEffort("claude_local", { effort: 3 })).toBe("");
  });

  it("does not leak Codex's legacy key into other adapters", () => {
    expect(readEffort("claude_local", { reasoningEffort: "low" })).toBe("");
  });
});

describe("readModel", () => {
  it("reads a string model and ignores anything else", () => {
    expect(readModel({ model: "claude-opus-4-8" })).toBe("claude-opus-4-8");
    expect(readModel({})).toBe("");
    expect(readModel({ model: null })).toBe("");
  });
});

describe("effortLabel", () => {
  it("labels a known tier and falls back to Auto", () => {
    expect(effortLabel("codex_local", "xhigh")).toBe("X-High");
    expect(effortLabel("claude_local", "")).toBe("Auto");
    expect(effortLabel("claude_local", "bogus")).toBe("Auto");
  });
});

describe("buildAdapterConfigPatch", () => {
  const base = {
    model: "claude-sonnet-4-6",
    effort: "low",
    workspaceDir: "/work",
    permissionMode: "acceptEdits",
  };

  it("changes only the model and preserves every other configured field", () => {
    expect(buildAdapterConfigPatch("claude_local", base, { model: "claude-opus-4-8" })).toEqual({
      ...base,
      model: "claude-opus-4-8",
    });
  });

  it("changes only the effort and leaves the model alone", () => {
    expect(buildAdapterConfigPatch("claude_local", base, { effort: "high" })).toEqual({
      ...base,
      effort: "high",
    });
  });

  it("writes effort to the adapter's own key", () => {
    const codexConfig = { model: "gpt-5.6" };
    expect(buildAdapterConfigPatch("codex_local", codexConfig, { effort: "high" })).toEqual({
      model: "gpt-5.6",
      modelReasoningEffort: "high",
    });
  });

  it("clears Codex's legacy key so the stale value cannot win on read", () => {
    const patched = buildAdapterConfigPatch(
      "codex_local",
      { model: "gpt-5.6", reasoningEffort: "low" },
      { effort: "high" },
    );
    expect(patched).not.toHaveProperty("reasoningEffort");
    expect(readEffort("codex_local", patched)).toBe("high");
  });

  it("supports selecting Auto (empty effort)", () => {
    expect(buildAdapterConfigPatch("claude_local", base, { effort: "" }).effort).toBe("");
  });

  it("does not mutate the caller's config", () => {
    const original = { ...base };
    buildAdapterConfigPatch("claude_local", original, { model: "claude-opus-4-8" });
    expect(original).toEqual(base);
  });
});
