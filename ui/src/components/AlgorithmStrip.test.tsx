// @vitest-environment jsdom

import { act as reactAct } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { AlgorithmStrip, buildDeletionProposalComment } from "./AlgorithmStrip";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function act(callback: () => void) {
  if (typeof reactAct === "function") {
    reactAct(callback);
    return;
  }
  flushSync(callback);
}

const NOW = new Date("2026-07-16T12:00:00Z").getTime();

function stripIssue(overrides: Partial<{
  status: "backlog" | "todo" | "in_progress" | "in_review" | "blocked" | "done" | "cancelled";
  createdByAgentId: string | null;
  createdByUserId: string | null;
  startedAt: string | null;
  createdAt: string;
  updatedAt: string;
}> = {}) {
  return {
    status: overrides.status ?? "todo",
    createdByAgentId: overrides.createdByAgentId ?? null,
    createdByUserId: overrides.createdByUserId !== undefined ? overrides.createdByUserId : "user-1",
    startedAt: overrides.startedAt ?? null,
    createdAt: overrides.createdAt ?? "2026-07-16T09:00:00Z",
    updatedAt: overrides.updatedAt ?? "2026-07-16T09:00:00Z",
  // The strip only reads these fields; the full Issue shape isn't needed.
  } as never;
}

describe("AlgorithmStrip", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("renders the five gates in Algorithm order", () => {
    act(() => {
      root.render(
        <AlgorithmStrip
          issue={stripIssue()}
          requirementOwner={{ kind: "user", name: "Board" }}
          nowMs={NOW}
        />,
      );
    });
    const gates = container.querySelectorAll("[data-testid^='algorithm-gate-']");
    expect([...gates].map((gate) => gate.getAttribute("data-testid"))).toEqual([
      "algorithm-gate-requirements",
      "algorithm-gate-delete",
      "algorithm-gate-simplify",
      "algorithm-gate-accelerate",
      "algorithm-gate-automate",
    ]);
  });

  it("names the requirement owner on gate 1", () => {
    act(() => {
      root.render(
        <AlgorithmStrip
          issue={stripIssue({ createdByAgentId: "agent-1", createdByUserId: null })}
          requirementOwner={{ kind: "agent", name: "Vitals CTO" }}
          nowMs={NOW}
        />,
      );
    });
    const gate = container.querySelector("[data-testid='algorithm-gate-requirements']");
    expect(gate?.getAttribute("data-gate-state")).toBe("passed");
    expect(gate?.textContent).toContain("Vitals CTO");
  });

  it("flags a missing requirement owner", () => {
    act(() => {
      root.render(
        <AlgorithmStrip
          issue={stripIssue({ createdByUserId: null })}
          requirementOwner={{ kind: "unknown", name: null }}
          nowMs={NOW}
        />,
      );
    });
    const gate = container.querySelector("[data-testid='algorithm-gate-requirements']");
    expect(gate?.getAttribute("data-gate-state")).toBe("attention");
  });

  it("offers propose deletion while the task is still waiting", () => {
    act(() => {
      root.render(
        <AlgorithmStrip
          issue={stripIssue({ status: "todo" })}
          requirementOwner={{ kind: "user", name: "Board" }}
          onProposeDeletion={vi.fn()}
          nowMs={NOW}
        />,
      );
    });
    expect(container.querySelector("[data-testid='propose-deletion-trigger']")).not.toBeNull();
  });

  it("hides propose deletion once work has started", () => {
    act(() => {
      root.render(
        <AlgorithmStrip
          issue={stripIssue({ status: "in_progress", startedAt: "2026-07-16T10:00:00Z" })}
          requirementOwner={{ kind: "user", name: "Board" }}
          onProposeDeletion={vi.fn()}
          nowMs={NOW}
        />,
      );
    });
    expect(container.querySelector("[data-testid='propose-deletion-trigger']")).toBeNull();
    const deleteGate = container.querySelector("[data-testid='algorithm-gate-delete']");
    expect(deleteGate?.getAttribute("data-gate-state")).toBe("passed");
  });

  it("escalates the accelerate gate when the timeline is long", () => {
    act(() => {
      root.render(
        <AlgorithmStrip
          issue={stripIssue({
            status: "in_progress",
            startedAt: "2026-07-10T12:00:00Z",
            createdAt: "2026-07-10T12:00:00Z",
            updatedAt: "2026-07-10T12:00:00Z",
          })}
          requirementOwner={{ kind: "user", name: "Board" }}
          nowMs={NOW}
        />,
      );
    });
    const gate = container.querySelector("[data-testid='algorithm-gate-accelerate']");
    expect(gate?.getAttribute("data-gate-state")).toBe("attention");
    expect(gate?.getAttribute("title")).toContain("if a timeline is long, it's wrong");
  });
});

describe("buildDeletionProposalComment", () => {
  it("frames the proposal as a board-approvable gate-2 action", () => {
    const body = buildDeletionProposalComment("Duplicate of VIT-12.");
    expect(body).toContain("Algorithm gate 2");
    expect(body).toContain("Duplicate of VIT-12.");
    expect(body).toContain("cancelling this task");
  });
});
