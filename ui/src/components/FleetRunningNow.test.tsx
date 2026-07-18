// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "@/lib/router";
import { FleetRunningNow } from "./FleetRunningNow";
import { fleetApi } from "../api/fleet";

vi.mock("../api/fleet", () => ({
  fleetApi: {
    running: vi.fn(),
    stop: vi.fn(),
    cancelRun: vi.fn(),
  },
}));

// The router's Link resolves company prefixes through CompanyContext; the
// panel itself is company-agnostic, so a null selection is the honest mock.
vi.mock("../context/CompanyContext", () => ({
  useCompany: () => ({
    companies: [],
    selectedCompany: null,
    selectedCompanyId: null,
    setSelectedCompanyId: () => {},
    loading: false,
  }),
}));

const mockFleetApi = vi.mocked(fleetApi);

function makeRun(overrides: Partial<Parameters<typeof Object.assign>[1]> = {}) {
  return {
    runId: "run-1",
    status: "running",
    startedAt: new Date(Date.now() - 90_000).toISOString(),
    createdAt: new Date().toISOString(),
    agentId: "agent-1",
    agentName: "Chief of staff",
    agentStatus: "running",
    companyId: "company-1",
    companyName: "Summon",
    issuePrefix: "SUM",
    issueId: "issue-1",
    issueIdentifier: "SUM-1",
    ...overrides,
  };
}

async function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root: Root;
  await act(async () => {
    root = createRoot(container);
    root.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <FleetRunningNow />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
  await act(async () => {});
  return { container, cleanup: () => act(() => root.unmount()) };
}

/** Flush act() rounds until the text shows up — query settling isn't one-tick deterministic. */
async function waitForText(container: HTMLElement, text: string) {
  for (let i = 0; i < 40; i++) {
    if (container.textContent?.includes(text)) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  expect(container.textContent).toContain(text);
}

function buttonByText(container: HTMLElement, text: string) {
  return [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(text));
}

describe("FleetRunningNow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists live runs with agent, company, task, and a per-run stop", async () => {
    mockFleetApi.running.mockResolvedValue({ runs: [makeRun()], queuedWakeups: 2 });
    const { container, cleanup } = await renderPanel();

    await waitForText(container, "1 live · 2 queued");
    expect(container.textContent).toContain("Running now");
    expect(container.textContent).toContain("Chief of staff");
    expect(container.textContent).toContain("Summon");
    expect(container.textContent).toContain("SUM-1");

    mockFleetApi.cancelRun.mockResolvedValue({});
    const stopButton = [...container.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === "Stop",
    );
    expect(stopButton).toBeTruthy();
    await act(async () => stopButton!.click());
    expect(mockFleetApi.cancelRun).toHaveBeenCalledWith("run-1");
    await cleanup();
  });

  it("stop everything is exactly two interactions and reports the sweep", async () => {
    mockFleetApi.running.mockResolvedValue({ runs: [makeRun()], queuedWakeups: 3 });
    mockFleetApi.stop.mockResolvedValue({
      agentsPaused: 4,
      wakeupsCancelled: 3,
      runsCancelled: 1,
      reason: "Board kill switch",
    });
    const { container, cleanup } = await renderPanel();

    await waitForText(container, "1 live · 3 queued");
    // Interaction 1: arm.
    await act(async () => buttonByText(container, "Stop everything")!.click());
    expect(mockFleetApi.stop).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Pause every agent");

    // Interaction 2: confirm — the sweep fires once.
    await act(async () => buttonByText(container, "Confirm stop")!.click());
    expect(mockFleetApi.stop).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Stopped: 1 run, 3 queued wakes, 4 agents paused.");
    await cleanup();
  });

  it("backing out never fires the sweep", async () => {
    mockFleetApi.running.mockResolvedValue({ runs: [], queuedWakeups: 0 });
    const { container, cleanup } = await renderPanel();

    await waitForText(container, "fleet is quiet");
    await act(async () => buttonByText(container, "Stop everything")!.click());
    await act(async () => buttonByText(container, "Keep running")!.click());
    expect(mockFleetApi.stop).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("Confirm stop");
    await cleanup();
  });
});
