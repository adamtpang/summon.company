// @vitest-environment jsdom

import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ModelQuickSwitch } from "./ModelQuickSwitch";

// Radix + cmdk need pointer capture and ResizeObserver, which jsdom lacks.
// Same shim as EnvironmentVariablesEditor.test.tsx.
beforeAll(() => {
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.scrollIntoView ??= () => {};
  if (!globalThis.ResizeObserver) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  }
});

const mockAgentsApi = vi.hoisted(() => ({
  adapterModels: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/api/agents", () => ({ agentsApi: mockAgentsApi }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

async function act(callback: () => void | Promise<void>) {
  let result: void | Promise<void> = undefined;
  flushSync(() => {
    result = callback();
  });
  await result;
}

let container: HTMLDivElement;
let root: Root;

/** Let the adapterModels query resolve and cmdk paint the list. */
async function flushQuery() {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  });
}

function chip() {
  return document.body.querySelector<HTMLButtonElement>('[data-testid="model-quick-switch-chip"]');
}

async function render(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(() => {
    root.render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mockAgentsApi.adapterModels.mockReset();
  mockAgentsApi.update.mockReset();
  mockAgentsApi.adapterModels.mockResolvedValue([
    { id: "claude-opus-4-8", label: "Opus 4.8" },
    { id: "claude-sonnet-4-6", label: "Sonnet 4.6" },
  ]);
});

afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
});

describe("ModelQuickSwitch chip", () => {
  it("shows executor · model · effort so the current config is readable at a glance", async () => {
    await render(
      <ModelQuickSwitch
        agentId="agent-1"
        companyId="company-1"
        adapterType="claude_local"
        adapterConfig={{ model: "claude-opus-4-8", effort: "high" }}
      />,
    );
    expect(chip()?.textContent).toContain("Claude Code · claude-opus-4-8 · High");
  });

  it("reports Auto effort rather than blank when effort is unset", async () => {
    await render(
      <ModelQuickSwitch
        agentId="agent-1"
        companyId="company-1"
        adapterType="claude_local"
        adapterConfig={{ model: "claude-opus-4-8" }}
      />,
    );
    expect(chip()?.textContent).toContain("Claude Code · claude-opus-4-8 · Auto");
  });

  it("omits the effort segment for executors without an effort control", async () => {
    await render(
      <ModelQuickSwitch
        agentId="agent-1"
        companyId="company-1"
        adapterType="gemini_local"
        adapterConfig={{ model: "gemini-3-pro" }}
      />,
    );
    expect(chip()?.textContent).toContain("gemini-3-pro");
    expect(chip()?.textContent).not.toContain("Auto");
  });

  it("names the Codex executor and its own effort key", async () => {
    await render(
      <ModelQuickSwitch
        agentId="agent-1"
        companyId="company-1"
        adapterType="codex_local"
        adapterConfig={{ model: "gpt-5.6", modelReasoningEffort: "xhigh" }}
      />,
    );
    expect(chip()?.textContent).toContain("Codex · gpt-5.6 · X-High");
  });

  it("falls back to 'default model' when no model is pinned", async () => {
    await render(
      <ModelQuickSwitch
        agentId="agent-1"
        companyId="company-1"
        adapterType="claude_local"
        adapterConfig={{}}
      />,
    );
    expect(chip()?.textContent).toContain("default model");
  });

  it("renders a non-interactive chip with a reason when disabled", async () => {
    await render(
      <ModelQuickSwitch
        agentId="agent-1"
        companyId="company-1"
        adapterType="claude_local"
        adapterConfig={{ model: "claude-opus-4-8" }}
        disabled
        disabledReason="You cannot configure this agent"
      />,
    );
    expect(chip()?.disabled).toBe(true);
    expect(chip()?.getAttribute("title")).toBe("You cannot configure this agent");
  });

  it("does not fetch models until the picker is opened", async () => {
    await render(
      <ModelQuickSwitch
        agentId="agent-1"
        companyId="company-1"
        adapterType="claude_local"
        adapterConfig={{ model: "claude-opus-4-8" }}
      />,
    );
    expect(mockAgentsApi.adapterModels).not.toHaveBeenCalled();
  });

  it("shows a pinned CLI alias as the current model when the adapter reports canonical ids", async () => {
    // Live VIT agents pin "opus" while claude_local reports "claude-opus-4-8";
    // the picker must still show what is actually set.
    await render(
      <ModelQuickSwitch
        agentId="agent-1"
        companyId="company-1"
        adapterType="claude_local"
        adapterConfig={{ model: "opus" }}
      />,
    );
    await act(() => chip()!.click());
    await flushQuery();

    const pinned = document.body.querySelector('[data-testid="model-quick-switch-current-unlisted"]');
    expect(pinned?.textContent).toContain("opus");
    expect(pinned?.textContent).toContain("pinned");
  });

  it("does not show a pinned row when the current model is one the adapter lists", async () => {
    await render(
      <ModelQuickSwitch
        agentId="agent-1"
        companyId="company-1"
        adapterType="claude_local"
        adapterConfig={{ model: "claude-opus-4-8" }}
      />,
    );
    await act(() => chip()!.click());
    await flushQuery();

    expect(document.body.querySelector('[data-testid="model-quick-switch-current-unlisted"]')).toBeNull();
  });

  it("never writes config just by rendering", async () => {
    await render(
      <ModelQuickSwitch
        agentId="agent-1"
        companyId="company-1"
        adapterType="claude_local"
        adapterConfig={{ model: "claude-opus-4-8" }}
      />,
    );
    expect(mockAgentsApi.update).not.toHaveBeenCalled();
  });
});
