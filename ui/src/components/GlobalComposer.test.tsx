// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Agent, Company } from "@paperclipai/shared";
import { GlobalComposer } from "./GlobalComposer";
import { buildRoster, type ComposerRoster, type RoutingDecision } from "../lib/globalComposer";

// ---- Fixtures ---------------------------------------------------------------

function agent(p: Partial<Agent> & Pick<Agent, "id" | "name" | "urlKey" | "role">): Agent {
  return {
    companyId: "c",
    title: null,
    icon: null,
    status: "active",
    reportsTo: null,
    capabilities: null,
    adapterType: "claude_local",
    adapterConfig: {},
    runtimeConfig: {},
    budgetMonthlyCents: 0,
    spentMonthlyCents: 0,
    pauseReason: null,
    pausedAt: null,
    permissions: { canCreateAgents: false },
    lastHeartbeatAt: null,
    metadata: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...p,
  } as Agent;
}

const ROSTER: ComposerRoster = buildRoster(
  [
    { id: "summon", name: "Summon", issuePrefix: "VIT" } as Company,
    { id: "quantus", name: "Quantus", issuePrefix: "QNT" } as Company,
  ],
  {
    summon: [
      agent({ id: "s-ceo", companyId: "summon", name: "Summon CEO", urlKey: "ceo", role: "ceo" }),
      agent({ id: "s-eng", companyId: "summon", name: "Vitals Engineer", urlKey: "engineer", role: "engineer" }),
    ],
    quantus: [
      agent({ id: "q-ceo", companyId: "quantus", name: "Quantus CEO", urlKey: "ceo", role: "ceo" }),
      agent({ id: "q-deal", companyId: "quantus", name: "Dealmaker", urlKey: "dealmaker", role: "general" }),
    ],
  },
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function setTextareaValue(el: HTMLTextAreaElement, value: string) {
  // React installs a value tracker on the instance; assigning through it and
  // firing `input` makes onChange read the new target.value (jsdom 28 rejects
  // the prototype-setter trick with a brand-check error).
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("GlobalComposer", () => {
  it("defaults the target to the scoped company's CEO", async () => {
    await act(() =>
      root.render(
        <GlobalComposer roster={ROSTER} scopedCompanyId="summon" onDispatch={vi.fn()} />,
      ),
    );
    const target = container.querySelector('[data-testid="global-composer-target"]');
    const echo = container.querySelector('[data-testid="global-composer-echo"]');
    expect(target?.textContent).toContain("Summon CEO");
    expect(echo?.textContent).toContain("routing");
  });

  it("shows @-mention suggestions and re-scopes on selection", async () => {
    const onScopeChange = vi.fn();
    await act(() =>
      root.render(
        <GlobalComposer
          roster={ROSTER}
          scopedCompanyId="summon"
          onScopeChange={onScopeChange}
          onDispatch={vi.fn()}
        />,
      ),
    );
    const textarea = container.querySelector<HTMLTextAreaElement>(
      '[data-testid="chat-composer-input"]',
    )!;
    await act(() => setTextareaValue(textarea, "@deal"));

    const list = container.querySelector('[data-testid="global-composer-suggestions"]');
    expect(list).not.toBeNull();
    const buttons = Array.from(list!.querySelectorAll("button"));
    const dealmaker = buttons.find((b) => b.textContent?.includes("Dealmaker"))!;
    expect(dealmaker).toBeDefined();

    await act(() => dealmaker.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })));
    expect(onScopeChange).toHaveBeenCalledWith("quantus", "q-deal");
    expect(textarea.value).toBe("@QNT-dealmaker ");
  });

  it("dispatches a routing decision to the addressed employee on submit", async () => {
    const onDispatch = vi.fn<(d: RoutingDecision) => void>();
    await act(() =>
      root.render(
        <GlobalComposer roster={ROSTER} scopedCompanyId="summon" onDispatch={onDispatch} />,
      ),
    );
    const textarea = container.querySelector<HTMLTextAreaElement>(
      '[data-testid="chat-composer-input"]',
    )!;
    await act(() => setTextareaValue(textarea, "@dealmaker how's the pipeline?"));
    await act(() =>
      textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })),
    );

    expect(onDispatch).toHaveBeenCalledTimes(1);
    const decision = onDispatch.mock.calls[0]![0];
    expect(decision.targetKind).toBe("agent");
    expect(decision.agent?.id).toBe("q-deal");
    expect(decision.companyId).toBe("quantus");
    expect(decision.message).toBe("how's the pipeline?");
    // Draft clears after send.
    expect(textarea.value).toBe("");
  });

  it("routes a plain message to the CEO (ambiguity → front door)", async () => {
    const onDispatch = vi.fn<(d: RoutingDecision) => void>();
    await act(() =>
      root.render(
        <GlobalComposer roster={ROSTER} scopedCompanyId="quantus" onDispatch={onDispatch} />,
      ),
    );
    const textarea = container.querySelector<HTMLTextAreaElement>(
      '[data-testid="chat-composer-input"]',
    )!;
    await act(() => setTextareaValue(textarea, "what's our constraint right now?"));
    await act(() =>
      textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })),
    );
    const decision = onDispatch.mock.calls[0]![0];
    expect(decision.targetKind).toBe("ceo");
    expect(decision.ceo?.id).toBe("q-ceo");
    expect(decision.companyId).toBe("quantus");
  });
});
