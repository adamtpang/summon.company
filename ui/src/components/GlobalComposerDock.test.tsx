// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Agent, Company, Issue } from "@paperclipai/shared";

const mocks = vi.hoisted(() => ({
  listAgents: vi.fn(),
  createIssue: vi.fn(),
  navigate: vi.fn(),
  setSelectedCompanyId: vi.fn(),
  pushToast: vi.fn(),
  openNewAgent: vi.fn(),
}));

vi.mock("../api/agents", () => ({ agentsApi: { list: mocks.listAgents } }));
vi.mock("../api/issues", () => ({ issuesApi: { create: mocks.createIssue } }));
vi.mock("../context/CompanyContext", () => ({
  useCompany: () => ({
    companies: [{ id: "summon", name: "Summon", issuePrefix: "VIT", status: "active" }] as Company[],
    loading: false,
    selectedCompanyId: "summon",
    setSelectedCompanyId: mocks.setSelectedCompanyId,
  }),
}));
vi.mock("../context/DialogContext", () => ({
  useDialogActions: () => ({ openNewAgent: mocks.openNewAgent }),
}));
vi.mock("../context/ToastContext", () => ({
  useOptionalToastActions: () => ({ pushToast: mocks.pushToast }),
}));
vi.mock("../lib/router", () => ({ useNavigate: () => mocks.navigate }));

import { GlobalComposerDock } from "./GlobalComposerDock";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function ceo(status: Agent["status"] = "active"): Agent {
  return {
    id: "ceo-1",
    companyId: "summon",
    name: "Summon CEO",
    urlKey: "ceo",
    role: "ceo",
    title: "CEO",
    status,
    reportsTo: null,
  } as Agent;
}

async function settle() {
  await Promise.resolve();
  await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
}

async function waitForTextarea(): Promise<HTMLTextAreaElement> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const textarea = container.querySelector<HTMLTextAreaElement>(
      '[data-testid="chat-composer-input"]',
    );
    if (textarea) return textarea;
    await act(async () => settle());
  }
  throw new Error(`Composer did not render: ${container.innerHTML}`);
}

function setTextareaValue(el: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let queryClient: QueryClient;

beforeEach(() => {
  mocks.listAgents.mockResolvedValue([ceo()]);
  mocks.createIssue.mockResolvedValue({ id: "issue-1", identifier: "VIT-200" } as Issue);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  queryClient.clear();
  container.remove();
  vi.clearAllMocks();
});

describe("GlobalComposerDock", () => {
  it("files an assigned issue and opens the real issue thread", async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <GlobalComposerDock />
        </QueryClientProvider>,
      );
    });
    const textarea = await waitForTextarea();

    await act(async () => {
      setTextareaValue(textarea, "Close the prompt loop");
      await settle();
      textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await settle();
    });

    expect(mocks.createIssue).toHaveBeenCalledWith("summon", {
      title: "Close the prompt loop",
      description: "Close the prompt loop",
      assigneeAgentId: "ceo-1",
    });
    expect(mocks.setSelectedCompanyId).toHaveBeenCalledWith("summon", { source: "manual" });
    expect(mocks.navigate).toHaveBeenCalledWith("/VIT/issues/VIT-200");
    expect(mocks.pushToast).toHaveBeenCalledWith(expect.objectContaining({
      title: "VIT-200 assigned to Summon CEO",
      tone: "success",
    }));
  });

  it("preserves the prompt and shows an inline recovery error when filing fails", async () => {
    mocks.createIssue.mockRejectedValueOnce(new Error("Assignment service unavailable"));
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <GlobalComposerDock />
        </QueryClientProvider>,
      );
    });
    const textarea = await waitForTextarea();

    await act(async () => {
      setTextareaValue(textarea, "Keep this draft");
      await settle();
      textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await settle();
    });

    expect(textarea.value).toBe("Keep this draft");
    expect(container.querySelector('[role="alert"]')?.textContent)
      .toContain("Assignment service unavailable");
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});
