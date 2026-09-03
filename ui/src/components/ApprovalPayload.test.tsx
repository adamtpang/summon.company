// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApprovalPayloadRenderer, approvalLabel } from "./ApprovalPayload";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("approvalLabel", () => {
  it("uses payload titles for generic board approvals", () => {
    expect(
      approvalLabel("request_board_approval", {
        title: "Reply with an ASCII frog",
      }),
    ).toBe("Board Approval: Reply with an ASCII frog");
  });

  it("names the Core-8 decision in board language", () => {
    expect(
      approvalLabel("staff_formation", { summary: "8 employees, $80/mo total cap" }),
    ).toBe("Core-8 formation: 8 employees, $80/mo total cap");
  });
});

describe("ApprovalPayloadRenderer", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it("renders request_board_approval payload fields without falling back to raw JSON", () => {
    const root = createRoot(container);

    act(() => {
      root.render(
        <ApprovalPayloadRenderer
          type="request_board_approval"
          payload={{
            title: "Reply with an ASCII frog",
            summary: "Board asked for approval before posting the frog.",
            recommendedAction: "Approve the frog reply.",
            nextActionOnApproval: "Post the frog comment on the issue.",
            risks: ["The frog might be too powerful."],
            proposedComment: "(o)<",
          }}
        />,
      );
    });

    expect(container.textContent).toContain("Reply with an ASCII frog");
    expect(container.textContent).toContain("Board asked for approval before posting the frog.");
    expect(container.textContent).toContain("Approve the frog reply.");
    expect(container.textContent).toContain("Post the frog comment on the issue.");
    expect(container.textContent).toContain("The frog might be too powerful.");
    expect(container.textContent).toContain("(o)<");
    expect(container.textContent).not.toContain("\"recommendedAction\"");

    act(() => {
      root.unmount();
    });
  });

  it("can hide the repeated title when the card header already shows it", () => {
    const root = createRoot(container);

    act(() => {
      root.render(
        <ApprovalPayloadRenderer
          type="request_board_approval"
          hidePrimaryTitle
          payload={{
            title: "Reply with an ASCII frog",
            summary: "Board asked for approval before posting the frog.",
          }}
        />,
      );
    });

    expect(container.textContent).toContain("Board asked for approval before posting the frog.");
    expect(container.textContent).not.toContain("TitleReply with an ASCII frog");

    act(() => {
      root.unmount();
    });
  });

  it("renders a board-readable Core-8 formation instead of raw seat JSON", () => {
    const root = createRoot(container);

    act(() => {
      root.render(
        <ApprovalPayloadRenderer
          type="staff_formation"
          payload={{
            question: "Staff the formation?",
            totalBudgetMonthlyCents: 8_000,
            companyBudgetMonthlyCents: 8_000,
            seats: [
              { department: "engineering", name: "Engineering", title: "Head of Engineering", budgetMonthlyCents: 1_000 },
              { department: "design", name: "Design", title: "Head of Design", budgetMonthlyCents: 1_000 },
            ],
          }}
        />,
      );
    });

    expect(container.textContent).toContain("Staff the formation?");
    expect(container.textContent).toContain("$80.00 / month total");
    expect(container.textContent).toContain("Company hard stop");
    expect(container.textContent).toContain("At least $80.00 / month");
    expect(container.textContent).toContain("Engineering");
    expect(container.textContent).toContain("Head of Design");
    expect(container.textContent).toContain("$10.00/mo");
    expect(container.textContent).toContain("enforces the company hard stop before activating");
    expect(container.textContent).not.toContain("$0 company budget");
    expect(container.textContent).not.toContain("\"department\"");

    act(() => {
      root.unmount();
    });
  });
});
