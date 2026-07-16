// @vitest-environment jsdom

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompanyModelPitStop } from "./CompanyModelPitStop";

const mockAgentsApi = vi.hoisted(() => ({
  modelPitStopStatus: vi.fn(),
  switchModelPitStop: vi.fn(),
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

async function flushReact() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

function findButton(label: string) {
  return Array.from(document.body.querySelectorAll("button")).find(
    (button) => button.textContent?.trim() === label,
  );
}

const openStatus = {
  currentAdapterType: "claude_local" as const,
  eligibleAgentCount: 8,
  excludedAgentCount: 0,
  activeRuns: { total: 0, queued: 0, running: 0 },
  canSwitch: true,
  blockingReason: null,
  providers: [
    {
      adapterType: "claude_local" as const,
      label: "Claude Code",
      primaryModel: "claude-opus-4-8",
      cheapModel: "claude-sonnet-4-6",
    },
    {
      adapterType: "codex_local" as const,
      label: "Codex",
      primaryModel: "gpt-5.6",
      cheapModel: "gpt-5.5",
    },
  ],
};

describe("CompanyModelPitStop", () => {
  let container: HTMLDivElement;
  let queryClient: QueryClient;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockAgentsApi.modelPitStopStatus.mockResolvedValue(openStatus);
    mockAgentsApi.switchModelPitStop.mockResolvedValue({
      adapterType: "codex_local",
      changedAgentCount: 8,
      primaryModel: "gpt-5.6",
      cheapModel: "gpt-5.5",
      status: { ...openStatus, currentAdapterType: "codex_local" },
    });
  });

  afterEach(() => {
    queryClient.clear();
    container.remove();
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("defaults to the other provider and confirms a fleet refit", async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <CompanyModelPitStop companyId="company-1" />
        </QueryClientProvider>,
      );
    });
    await flushReact();
    await flushReact();

    expect(container.textContent).toContain("Current fleet: Claude Code · 8 agents");
    expect(container.textContent).toContain("Pit lane open");
    const fitButton = findButton("Fit Codex");
    expect(fitButton).toBeTruthy();

    await act(async () => {
      fitButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    await flushReact();
    const confirmButton = findButton("Confirm pit stop");
    expect(confirmButton).toBeTruthy();

    await act(async () => {
      confirmButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    await flushReact();
    await flushReact();

    expect(mockAgentsApi.switchModelPitStop).toHaveBeenCalledWith("company-1", "codex_local");
    expect(document.body.textContent).toContain("Codex fitted across 8 agents");

    await act(async () => root.unmount());
  });

  it("keeps the action visible but disabled while work is active", async () => {
    mockAgentsApi.modelPitStopStatus.mockResolvedValue({
      ...openStatus,
      activeRuns: { total: 2, queued: 1, running: 1 },
      canSwitch: false,
      blockingReason: "Pit lane closed: 2 queued or running runs must finish first.",
    });
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <CompanyModelPitStop companyId="company-1" />
        </QueryClientProvider>,
      );
    });
    await flushReact();
    await flushReact();

    const fitButton = findButton("Fit Codex");
    expect(fitButton).toBeTruthy();
    expect(fitButton?.disabled).toBe(true);
    expect(container.textContent).toContain("Pit lane closed: 2 queued or running runs must finish first.");

    await act(async () => root.unmount());
  });
});
