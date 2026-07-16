// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildVitalsAiSdrDogfoodBundle } from "@paperclipai/shared/vitals-ai-sdr";
import { AiSdrDogfood, parseBannedClaims } from "./AiSdrDogfood";

const localFixturesMock = vi.fn();
const runLocalDogfoodMock = vi.fn();

vi.mock("@/lib/router", () => ({
  useLocation: () => ({ search: "?issueId=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
}));

vi.mock("../context/CompanyContext", () => ({
  useCompany: () => ({ selectedCompanyId: "company-1" }),
}));

vi.mock("../context/BreadcrumbContext", () => ({
  useBreadcrumbs: () => ({ setBreadcrumbs: vi.fn() }),
}));

vi.mock("../api/vitalsAiSdr", () => ({
  vitalsAiSdrApi: {
    localFixtures: () => localFixturesMock(),
    runLocalDogfood: (companyId: string, input: unknown) => runLocalDogfoodMock(companyId, input),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const bundle = buildVitalsAiSdrDogfoodBundle({
  companyUrl: "https://vitals.run",
  icp: "Founder-led B2B software companies preparing their first outbound workflow",
  senderIdentity: "Adam from vitals.run",
  objective: "book a short diagnosis call around a board-approved AI SDR loop",
  bannedClaims: ["guaranteed meetings", "inbox placement"],
  geography: "United States",
  maxDraftCount: 1,
  notes: "Dogfood inside Paperclip only.",
}, { now: "2026-07-15T00:00:00.000Z" });

function dogfoodResponse() {
  return {
    bundle,
    documents: {
      intake: { key: "ai-sdr-intake", body: "intake" },
      dossiers: { key: "ai-sdr-dossiers", body: "dossiers" },
      drafts: { key: "ai-sdr-drafts", body: "drafts" },
      measurements: { key: "ai-sdr-measurements", body: "measurements" },
    },
    workProducts: [{ id: "work-product-1" }, { id: "work-product-2" }],
    interaction: {
      id: "interaction-1",
      kind: "request_item_verdicts",
      status: "pending",
    },
  };
}

async function flushReact() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

describe("AI SDR dogfood page", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    localFixturesMock.mockResolvedValue({
      leadSourceKind: "local_fixture",
      fixtures: [],
      downstreamBlocks: bundle.downstreamBlocks,
    });
    runLocalDogfoodMock.mockResolvedValue(dogfoodResponse());
  });

  afterEach(async () => {
    if (root) await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it("parses comma and newline separated banned claims", () => {
    expect(parseBannedClaims("guaranteed meetings\n inbox placement, revenue promise ")).toEqual([
      "guaranteed meetings",
      "inbox placement",
      "revenue promise",
    ]);
  });

  it("renders blocked stages and generated dossier, draft, and measurement events", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    root = createRoot(container);
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <AiSdrDogfood />
        </QueryClientProvider>,
      );
    });
    await flushReact();
    await flushReact();

    expect(container.textContent).toContain("AI SDR dogfood");
    expect(container.textContent).toContain("Blocked downstream");
    expect(container.textContent).toContain("Outbound send");

    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flushReact();
    await flushReact();

    expect(runLocalDogfoodMock).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        issueId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        intake: expect.objectContaining({
          companyUrl: "https://vitals.run",
          leadSourceKind: "local_fixture",
        }),
      }),
    );
    expect(container.textContent).toContain("Cited dossier");
    expect(container.textContent).toContain("Personalized draft");
    expect(container.textContent).toContain("intake submitted");
    expect(container.textContent).toContain("Local sample fixture");
  });
});
