// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Agent } from "@paperclipai/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Messages,
  agentPresence,
  buildEmployeeReply,
  buildInitialGreeting,
  formatDayDivider,
  groupMessagesByDay,
  previewText,
  type ChatMessage,
} from "./Messages";

const agentsListMock = vi.fn();

vi.mock("../context/CompanyContext", () => ({
  useCompany: () => ({ selectedCompanyId: "company-1", selectedCompany: { name: "Company Zero" } }),
}));

vi.mock("../context/BreadcrumbContext", () => ({
  useBreadcrumbs: () => ({ setBreadcrumbs: vi.fn() }),
}));

vi.mock("../api/agents", () => ({
  agentsApi: { list: () => agentsListMock() },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = new Date("2026-07-15T10:00:00.000Z");

function agent(overrides: Partial<Agent>): Agent {
  return {
    id: "agent-1",
    companyId: "company-1",
    name: "Engineer",
    urlKey: "engineer",
    role: "engineer",
    title: "Engineering lead",
    icon: null,
    status: "running",
    reportsTo: null,
    capabilities: "Builds the application",
    adapterType: "codex_local",
    adapterConfig: {},
    runtimeConfig: {},
    budgetMonthlyCents: 10_000,
    spentMonthlyCents: 2_500,
    pauseReason: null,
    pausedAt: null,
    permissions: { canCreateAgents: false },
    lastHeartbeatAt: null,
    metadata: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as Agent;
}

function message(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: "m-1",
    author: "employee",
    text: "Hello",
    at: NOW,
    ...overrides,
  };
}

async function flushReact() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

describe("Messages helpers", () => {
  it("maps agent status to a presence label, dot, and busy flag", () => {
    expect(agentPresence({ status: "running" })).toMatchObject({ label: "Working", isBusy: true });
    expect(agentPresence({ status: "paused" })).toMatchObject({ label: "Paused", isBusy: false });
    expect(agentPresence({ status: "error" })).toMatchObject({ label: "Needs attention" });
    expect(agentPresence({ status: "idle" }).dotClass).toBeTruthy();
  });

  it("builds a presence-aware status reply", () => {
    expect(buildEmployeeReply(agent({ status: "running" }), "status?")).toContain("Mid-run");
    expect(buildEmployeeReply(agent({ status: "paused", pauseReason: "budget" }), "status?")).toContain(
      "budget",
    );
    expect(buildEmployeeReply(agent({ status: "error", errorReason: "boom" }), "any update?")).toContain(
      "boom",
    );
    expect(buildEmployeeReply(agent({ status: "idle" }), "status?")).toContain("All clear");
    // Non-status prompts get a short acknowledgement, not a status report.
    expect(buildEmployeeReply(agent({ status: "idle" }), "please ship the login page")).toContain("On it");
  });

  it("seeds a greeting that names the employee and their role", () => {
    const greeting = buildInitialGreeting(agent({ name: "Ada", title: "engineer", status: "idle" }));
    expect(greeting).toContain("Ada");
    expect(greeting).toContain("engineer");
  });

  it("groups messages by day with friendly dividers", () => {
    const groups = groupMessagesByDay(
      [
        message({ id: "a", at: new Date("2026-07-14T09:00:00.000Z") }),
        message({ id: "b", at: new Date("2026-07-15T09:00:00.000Z") }),
        message({ id: "c", at: new Date("2026-07-15T09:05:00.000Z") }),
      ],
      NOW,
    );
    expect(groups).toHaveLength(2);
    expect(groups[1]!.label).toBe("Today");
    expect(groups[1]!.messages).toHaveLength(2);
  });

  it("labels today and yesterday", () => {
    expect(formatDayDivider(new Date("2026-07-15T01:00:00.000Z"), NOW)).toBe("Today");
    expect(formatDayDivider(new Date("2026-07-14T01:00:00.000Z"), NOW)).toBe("Yesterday");
  });

  it("prefixes your own last message in the preview", () => {
    expect(previewText([message({ author: "you", text: "status?" })])).toBe("You: status?");
    expect(previewText([message({ author: "employee", text: "hi" })])).toBe("hi");
  });
});

describe("Messages surface", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    agentsListMock.mockResolvedValue([
      agent({ id: "eng", name: "Engineer", title: "Engineering lead", status: "running", urlKey: "engineer" }),
      agent({ id: "design", name: "Designer", title: "Design", status: "idle", urlKey: "designer" }),
    ]);
  });

  afterEach(async () => {
    if (root) await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  async function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    root = createRoot(container);
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Messages />
        </QueryClientProvider>,
      );
    });
    await flushReact();
    await flushReact();
  }

  it("lists employees and opens the first thread with its greeting", async () => {
    await renderPage();
    expect(container.textContent).toContain("Messages");
    expect(container.textContent).toContain("Engineer");
    expect(container.textContent).toContain("Designer");
    // First employee's seeded greeting shows in the transcript.
    const transcript = container.querySelector('[data-testid="messages-transcript"]');
    expect(transcript?.textContent).toContain("Engineer here");
  });

  it("sends a message and gets a presence-aware reply with a read receipt", async () => {
    await renderPage();

    const input = container.querySelector<HTMLTextAreaElement>('[data-testid="chat-composer-input"]');
    expect(input).toBeTruthy();
    const setValue = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value",
    )!.set!;
    await act(async () => {
      setValue.call(input, "status?");
      input!.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const sendButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Send message to Engineer"]',
    );
    expect(sendButton).toBeTruthy();
    await act(async () => {
      sendButton!.click();
    });
    await flushReact();

    // Outgoing message is in the transcript.
    const transcript = container.querySelector('[data-testid="messages-transcript"]');
    expect(transcript?.textContent).toContain("status?");

    // Wait out the simulated reply delay.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    });
    await flushReact();

    expect(transcript?.textContent).toContain("Mid-run");
    // The outgoing message flips to a read receipt once the reply lands.
    expect(container.querySelector('[aria-label="Read"]')).toBeTruthy();
  });
});
