// @vitest-environment jsdom
// SUM-190: on a CUSTOMER instance (VITE_FEEDBACK_ENDPOINT set) the widget POSTs
// the survey to the hosted vendor intake instead of the local board.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createIssue = vi.fn().mockResolvedValue({ id: "fb-1" });
const pushToast = vi.fn();

vi.mock("../api/issues", () => ({
  issuesApi: { create: (...args: unknown[]) => createIssue(...args) },
}));
vi.mock("../api/companies", () => ({
  companiesApi: {
    list: vi.fn().mockResolvedValue([{ id: "co-other", issuePrefix: "ACM", name: "Acme" }]),
  },
}));
vi.mock("../context/CompanyContext", () => ({
  useCompany: () => ({ selectedCompanyId: "co-other", selectedCompany: null }),
}));
vi.mock("../context/ToastContext", () => ({
  useToastActions: () => ({ pushToast }),
}));

describe("FeedbackWidget (customer instance)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.clear();
    createIssue.mockClear();
    vi.stubEnv("VITE_FEEDBACK_ENDPOINT", "https://feedback.summon.company/api/feedback");
    vi.stubEnv("VITE_FEEDBACK_INSTANCE_ID", "acme-inc");
    vi.resetModules();
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ status: "created" }) });
    vi.stubGlobal("fetch", fetchMock);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.body.innerHTML = "";
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("POSTs to the hosted endpoint and never touches the local board", async () => {
    const { FeedbackWidget } = await import("./FeedbackWidget");
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <FeedbackWidget />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    const trigger = document.querySelector<HTMLButtonElement>('[data-testid="feedback-widget-trigger"]');
    await act(async () => trigger!.click());
    const stars = document.querySelectorAll<HTMLButtonElement>('[role="radiogroup"] [role="radio"]');
    await act(async () => stars[1]!.click()); // 2 stars
    const why = document.querySelector<HTMLTextAreaElement>('[data-testid="feedback-why"]');
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
      setter.call(why!, "too slow");
      why!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const send = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Send");
    await act(async () => send!.click());

    expect(createIssue).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://feedback.summon.company/api/feedback");
    const body = JSON.parse(String(opts.body));
    expect(body).toMatchObject({ instanceId: "acme-inc", rating: 2, why: "too slow" });
    expect(body.week).toMatch(/^\d{4}-W\d{2}$/);
  });
});
