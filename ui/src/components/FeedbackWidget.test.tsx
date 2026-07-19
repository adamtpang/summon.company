// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeedbackWidget, isoWeekId } from "./FeedbackWidget";

const createIssue = vi.fn().mockResolvedValue({ id: "fb-1", identifier: "SUM-999" });
const pushToast = vi.fn();

vi.mock("../api/issues", () => ({
  issuesApi: { create: (...args: unknown[]) => createIssue(...args) },
}));
vi.mock("../api/companies", () => ({
  companiesApi: {
    list: vi.fn().mockResolvedValue([
      { id: "co-sum", issuePrefix: "SUM", name: "Summon" },
      { id: "co-other", issuePrefix: "ACM", name: "Acme" },
    ]),
  },
}));
vi.mock("../context/CompanyContext", () => ({
  useCompany: () => ({ selectedCompanyId: "co-other", selectedCompany: null }),
}));
vi.mock("../context/ToastContext", () => ({
  useToastActions: () => ({ pushToast }),
}));

describe("FeedbackWidget", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.localStorage.clear();
    createIssue.mockClear();
    pushToast.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.body.innerHTML = "";
  });

  const render = async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <FeedbackWidget />
        </QueryClientProvider>,
      );
    });
    // Let the companies query settle.
    await act(async () => {
      await Promise.resolve();
    });
  };

  const openPopover = async () => {
    const trigger = document.querySelector<HTMLButtonElement>('[data-testid="feedback-widget-trigger"]');
    expect(trigger).not.toBeNull();
    await act(async () => trigger!.click());
  };

  it("renders the always-there trigger and a 5-star form gated on rating", async () => {
    await render();
    await openPopover();

    const stars = document.querySelectorAll('[role="radiogroup"] [role="radio"]');
    expect(stars).toHaveLength(5);

    const send = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Send");
    expect(send?.disabled).toBe(true);
  });

  it("asks why below 5 stars and files the ticket to the SUM vendor company", async () => {
    await render();
    await openPopover();

    const stars = document.querySelectorAll<HTMLButtonElement>('[role="radiogroup"] [role="radio"]');
    await act(async () => stars[2]!.click()); // 3 stars

    const why = document.querySelector<HTMLTextAreaElement>('[data-testid="feedback-why"]');
    expect(why).not.toBeNull();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
      setter.call(why!, "Needs faster onboarding");
      why!.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const send = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Send");
    await act(async () => send!.click());

    expect(createIssue).toHaveBeenCalledTimes(1);
    const [companyId, payload] = createIssue.mock.calls[0] as [string, Record<string, string>];
    expect(companyId).toBe("co-sum"); // vendor board, not the selected company
    expect(payload.title).toContain("3/5");
    expect(payload.description).toContain("Needs faster onboarding");
    expect(window.localStorage.getItem("summon.feedback.lastSubmittedWeek")).toBe(isoWeekId());
  });

  it("hides the why field at 5 stars and marks the week submitted", async () => {
    await render();
    await openPopover();

    const stars = document.querySelectorAll<HTMLButtonElement>('[role="radiogroup"] [role="radio"]');
    await act(async () => stars[4]!.click()); // 5 stars
    expect(document.querySelector('[data-testid="feedback-why"]')).toBeNull();

    const send = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Send");
    await act(async () => send!.click());
    const payload = (createIssue.mock.calls[0] as [string, Record<string, string>])[1];
    expect(payload.title).toContain("5/5");
    expect(payload.description).toContain("Perfect score");
  });

  it("self-opens once per week when nothing was submitted, never when it was", async () => {
    vi.useFakeTimers();
    try {
      await render();
      expect(document.querySelector('[role="radiogroup"]')).toBeNull();
      await act(async () => {
        vi.advanceTimersByTime(4100);
      });
      expect(document.querySelector('[role="radiogroup"]')).not.toBeNull();
      expect(window.localStorage.getItem("summon.feedback.lastPromptedWeek")).toBe(isoWeekId());
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not self-open after a submission this week", async () => {
    window.localStorage.setItem("summon.feedback.lastSubmittedWeek", isoWeekId());
    vi.useFakeTimers();
    try {
      await render();
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });
      expect(document.querySelector('[role="radiogroup"]')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
