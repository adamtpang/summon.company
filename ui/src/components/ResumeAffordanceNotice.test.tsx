// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ResumeAffordanceNotice } from "./ResumeAffordanceNotice";
import type { ResumeAffordance } from "@/lib/resume-affordance";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  container.remove();
  vi.restoreAllMocks();
});

function render(affordance: ResumeAffordance) {
  act(() => {
    root.render(<ResumeAffordanceNotice affordance={affordance} />);
  });
}

describe("ResumeAffordanceNotice", () => {
  it("renders the resume label for a resumed run", () => {
    render({
      runId: "run-b",
      resumed: true,
      priorMessageCount: 3,
      label: "Resumed · 3 earlier messages in this conversation",
    });
    const notice = container.querySelector('[data-testid="resume-affordance-notice"]');
    expect(notice).not.toBeNull();
    expect(notice?.textContent).toContain(
      "Resumed · 3 earlier messages in this conversation",
    );
    expect(notice?.getAttribute("aria-label")).toContain("Resumed · 3");
  });

  it("renders nothing when the run was not resumed", () => {
    render({ runId: "run-a", resumed: false, priorMessageCount: 0, label: "" });
    expect(
      container.querySelector('[data-testid="resume-affordance-notice"]'),
    ).toBeNull();
  });

  it("renders nothing when the label is empty even if flagged resumed", () => {
    render({ runId: "run-a", resumed: true, priorMessageCount: 0, label: "" });
    expect(
      container.querySelector('[data-testid="resume-affordance-notice"]'),
    ).toBeNull();
  });
});
