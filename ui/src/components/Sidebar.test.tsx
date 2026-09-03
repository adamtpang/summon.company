// @vitest-environment jsdom

import { type ReactNode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "./Sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

const mockHeartbeatsApi = vi.hoisted(() => ({ liveRunsForCompany: vi.fn() }));
const mockAttentionApi = vi.hoisted(() => ({ list: vi.fn() }));

vi.mock("@/lib/router", () => ({
  NavLink: ({ to, children, className, ...props }: {
    to: string;
    children: ReactNode;
    className?: string | ((state: { isActive: boolean }) => string);
  }) => (
    <a
      href={to}
      className={typeof className === "function" ? className({ isActive: false }) : className}
      {...props}
    >
      {children}
    </a>
  ),
}));

vi.mock("../context/DialogContext", () => ({
  useDialogActions: () => ({ openNewIssue: vi.fn() }),
}));

vi.mock("../context/CompanyContext", () => ({
  useCompany: () => ({
    selectedCompanyId: "company-1",
    selectedCompany: { id: "company-1", issuePrefix: "SUM", name: "Summon" },
  }),
}));

const mockSidebar = vi.hoisted(() => ({
  isMobile: false,
  collapsed: false,
  collapseLocked: false,
  peeking: false,
  toggleCollapsed: vi.fn(),
  setCollapsed: vi.fn(),
}));

vi.mock("../context/SidebarContext", () => ({ useSidebar: () => mockSidebar }));
vi.mock("../api/heartbeats", () => ({ heartbeatsApi: mockHeartbeatsApi }));
vi.mock("../api/attention", () => ({ attentionApi: mockAttentionApi }));

vi.mock("@/plugins/slots", () => ({
  PluginSlotOutlet: ({ slotTypes }: { slotTypes: string[] }) => (
    <div data-plugin-slot-types={slotTypes.join(",")}>Plugin slot outlet</div>
  ),
}));

vi.mock("@/plugins/launchers", () => ({
  PluginLauncherOutlet: ({ placementZones }: { placementZones: string[] }) => (
    <div data-plugin-launcher-zone={placementZones.join(",")}>Plugin launcher outlet</div>
  ),
}));

vi.mock("./SidebarCompanyMenu", () => ({
  SidebarCompanyMenu: () => <div>Company menu</div>,
}));

async function flushReact() {
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  }
  flushSync(() => {});
}

describe("Sidebar", () => {
  let container: HTMLDivElement;

  async function renderSidebar() {
    const root = createRoot(container);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    flushSync(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Sidebar />
          </TooltipProvider>
        </QueryClientProvider>,
      );
    });
    await flushReact();
    return root;
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    mockHeartbeatsApi.liveRunsForCompany.mockResolvedValue([]);
    mockAttentionApi.list.mockResolvedValue({ items: [] });
    mockSidebar.isMobile = false;
    mockSidebar.collapsed = false;
    mockSidebar.collapseLocked = false;
    mockSidebar.peeking = false;
  });

  afterEach(() => {
    container.remove();
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("renders one minimal founder navigation instead of the Paperclip feature inventory", async () => {
    const root = await renderSidebar();
    const links = [...container.querySelectorAll("nav a")].map((anchor) => ({
      label: anchor.textContent?.trim(),
      href: anchor.getAttribute("href"),
    }));

    expect(links).toEqual([
      { label: "Fleet", href: "/portfolio" },
      { label: "Mission Control", href: "/dashboard" },
      { label: "Company Office", href: "/factory-floor" },
      { label: "Diagnose Codebase", href: "/diagnose" },
      { label: "Tasks", href: "/issues" },
      { label: "Decisions", href: "/decisions" },
      { label: "Org", href: "/org" },
      { label: "Costs", href: "/costs" },
      { label: "Settings", href: "/company/settings" },
    ]);
    expect(container.textContent).toContain("New Task");

    for (const duplicate of [
      "Chat",
      "Messages",
      "Inbox",
      "Audit",
      "Watchtower",
      "Projects",
      "Agents",
      "Roadmap",
      "Activity",
      "Routines",
    ]) {
      expect(links.map((link) => link.label)).not.toContain(duplicate);
    }

    flushSync(() => root.unmount());
  });

  it("keeps search and extension discovery outside the primary link set", async () => {
    const root = await renderSidebar();

    expect(container.querySelector('a[aria-label="Open search"]')?.getAttribute("href")).toBe("/search");
    expect(container.querySelector('[data-plugin-slot-types="sidebar"]')?.textContent).toBe("Plugin slot outlet");
    expect(container.querySelector('[data-plugin-launcher-zone="sidebar"]')?.textContent).toBe("Plugin launcher outlet");

    flushSync(() => root.unmount());
  });

  it("always polls the decision queue", async () => {
    const root = await renderSidebar();

    expect(container.textContent).toContain("Decisions");
    expect(mockAttentionApi.list).toHaveBeenCalled();

    flushSync(() => root.unmount());
  });

  it("collapses an expanded desktop sidebar", async () => {
    const root = await renderSidebar();
    const toggle = container.querySelector<HTMLButtonElement>('button[aria-label="Collapse sidebar"]');

    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
    flushSync(() => toggle?.click());
    expect(mockSidebar.toggleCollapsed).toHaveBeenCalledTimes(1);

    flushSync(() => root.unmount());
  });

  it("hides the toggle while a secondary sidebar locks the rail", async () => {
    mockSidebar.collapseLocked = true;
    const root = await renderSidebar();

    expect(container.querySelector('button[aria-label="Collapse sidebar"]')).toBeNull();
    expect(container.querySelector('button[aria-label="Expand sidebar"]')).toBeNull();

    flushSync(() => root.unmount());
  });

  it("keeps the collapsed rail header unclipped", async () => {
    mockSidebar.collapsed = true;
    const root = await renderSidebar();

    expect(container.querySelector('button[aria-label="Expand sidebar"]')).toBeNull();
    expect(container.querySelector('a[aria-label="Open search"]')).toBeNull();
    expect(container.textContent).toContain("Company menu");

    flushSync(() => root.unmount());
  });

  it("pins a peeked sidebar open", async () => {
    mockSidebar.collapsed = true;
    mockSidebar.peeking = true;
    const root = await renderSidebar();
    const pin = container.querySelector<HTMLButtonElement>('button[aria-label="Keep sidebar expanded"]');

    expect(pin).not.toBeNull();
    flushSync(() => pin?.click());
    expect(mockSidebar.setCollapsed).toHaveBeenCalledWith(false);

    flushSync(() => root.unmount());
  });

  it("lets the mobile drawer own its collapse behavior", async () => {
    mockSidebar.isMobile = true;
    const root = await renderSidebar();

    expect(container.querySelector('button[aria-label="Collapse sidebar"]')).toBeNull();
    expect(container.querySelector('button[aria-label="Keep sidebar expanded"]')).toBeNull();

    flushSync(() => root.unmount());
  });
});
