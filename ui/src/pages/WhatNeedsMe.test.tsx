// @vitest-environment jsdom

import { useState } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Agent, AttentionItem } from "@paperclipai/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DecisionDeck } from "./WhatNeedsMe";

vi.mock("../components/AttentionQueueRow", () => ({
  AttentionQueueRow: ({ item, expanded }: { item: AttentionItem; expanded: boolean }) => (
    <div data-testid="decision-card" data-expanded={expanded ? "true" : "false"}>
      {item.id}
    </div>
  ),
}));

const items = [
  { id: "decision-1" },
  { id: "decision-2" },
] as AttentionItem[];

function Harness() {
  const [selectedId, setSelectedId] = useState(items[0]!.id);
  const [expandedId, setExpandedId] = useState(items[0]!.id);

  return (
    <DecisionDeck
      items={items}
      companyId="company-1"
      selectedId={selectedId}
      expandedId={expandedId}
      onSelect={(item) => {
        setSelectedId(item.id);
        setExpandedId(item.id);
      }}
      onToggleExpand={() => undefined}
      onDismiss={() => undefined}
      onSnooze={() => undefined}
      agentMap={new Map<string, Agent>()}
      currentUserId={null}
    />
  );
}

describe("DecisionDeck", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(<Harness />);
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("shows one expanded card at a time and advances cyclically", async () => {
    expect(container.querySelectorAll('[data-testid="decision-card"]')).toHaveLength(1);
    expect(container.textContent).toContain("Card 1 of 2");
    expect(container.textContent).toContain("decision-1");

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Next decision"]')?.click();
    });

    expect(container.querySelectorAll('[data-testid="decision-card"]')).toHaveLength(1);
    expect(container.textContent).toContain("Card 2 of 2");
    expect(container.textContent).toContain("decision-2");
    expect(container.querySelector('[data-testid="decision-card"]')?.getAttribute("data-expanded")).toBe("true");

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Next decision"]')?.click();
    });

    expect(container.textContent).toContain("Card 1 of 2");
    expect(container.textContent).toContain("decision-1");
  });
});
