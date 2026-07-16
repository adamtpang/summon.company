// @vitest-environment jsdom

import { act as reactAct, forwardRef } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type { Issue, IssueStatus } from "@paperclipai/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentLanesBoard, buildAgentLanes, collectDependencyEdges } from "./AgentLanesBoard";

vi.mock("@/lib/router", () => ({
  Link: forwardRef<HTMLAnchorElement, React.ComponentProps<"a"> & {
    to: string;
    disableIssueQuicklook?: boolean;
    issuePrefetch?: unknown;
    state?: unknown;
  }>(({ children, to, disableIssueQuicklook: _q, issuePrefetch: _p, state: _s, ...props }, ref) => (
    <a href={to} ref={ref} {...props}>{children}</a>
  )),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function act(callback: () => void) {
  if (typeof reactAct === "function") {
    reactAct(callback);
    return;
  }
  flushSync(callback);
}

let issueCounter = 0;

function createIssue(overrides: Partial<Issue> & { status?: IssueStatus } = {}): Issue {
  issueCounter += 1;
  return {
    id: `issue-${issueCounter}`,
    identifier: `VIT-${issueCounter}`,
    companyId: "company-1",
    projectId: null,
    projectWorkspaceId: null,
    goalId: null,
    parentId: null,
    title: `Task ${issueCounter}`,
    description: null,
    status: "todo",
    workMode: "standard",
    priority: "medium",
    assigneeAgentId: null,
    assigneeUserId: null,
    responsibleUserId: null,
    createdByAgentId: null,
    createdByUserId: null,
    issueNumber: issueCounter,
    requestDepth: 0,
    billingCode: null,
    assigneeAdapterOverrides: null,
    executionWorkspaceId: null,
    executionWorkspacePreference: null,
    executionWorkspaceSettings: null,
    checkoutRunId: null,
    executionRunId: null,
    executionAgentNameKey: null,
    executionLockedAt: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    hiddenAt: null,
    createdAt: new Date("2026-07-10T00:00:00.000Z"),
    updatedAt: new Date("2026-07-15T00:00:00.000Z"),
    labels: [],
    labelIds: [],
    myLastTouchAt: null,
    lastExternalCommentAt: null,
    isUnreadForMe: false,
    ...overrides,
  } as Issue;
}

const AGENTS = [
  { id: "agent-1", name: "Vitals CTO" },
  { id: "agent-2", name: "Vitals Design Director" },
];

describe("buildAgentLanes", () => {
  it("gives every agent a lane, including idle agents, and excludes terminal work", () => {
    const issues = [
      createIssue({ assigneeAgentId: "agent-1", status: "in_progress" }),
      createIssue({ assigneeAgentId: "agent-1", status: "done" }),
      createIssue({ status: "todo" }),
    ];
    const lanes = buildAgentLanes(issues, AGENTS);
    const byKey = new Map(lanes.map((lane) => [lane.key, lane]));
    expect(byKey.get("agent:agent-1")?.issues).toHaveLength(1);
    expect(byKey.get("agent:agent-2")?.issues).toHaveLength(0);
    expect(byKey.get("unassigned")?.issues).toHaveLength(1);
  });

  it("keeps the unassigned lane last and sorts busy lanes first", () => {
    const issues = [
      createIssue({ status: "todo" }),
      createIssue({ assigneeAgentId: "agent-2", status: "in_progress" }),
      createIssue({ assigneeAgentId: "agent-2", status: "todo" }),
    ];
    const lanes = buildAgentLanes(issues, AGENTS);
    expect(lanes[0].key).toBe("agent:agent-2");
    expect(lanes[lanes.length - 1].key).toBe("unassigned");
  });

  it("lanes working tasks before waiting ones", () => {
    const waiting = createIssue({ assigneeAgentId: "agent-1", status: "todo" });
    const working = createIssue({ assigneeAgentId: "agent-1", status: "in_progress", startedAt: new Date() });
    const lanes = buildAgentLanes([waiting, working], AGENTS);
    const lane = lanes.find((entry) => entry.key === "agent:agent-1");
    expect(lane?.issues.map((issue) => issue.id)).toEqual([working.id, waiting.id]);
  });
});

describe("collectDependencyEdges", () => {
  it("collects edges only between visible open tasks and marks open blockers active", () => {
    const blocker = createIssue({ assigneeAgentId: "agent-1", status: "in_progress" });
    const blocked = createIssue({
      assigneeAgentId: "agent-2",
      status: "todo",
      blockedBy: [
        { id: blocker.id, identifier: blocker.identifier, title: blocker.title, status: blocker.status, priority: blocker.priority, assigneeAgentId: blocker.assigneeAgentId, assigneeUserId: null },
        { id: "not-visible", identifier: "VIT-999", title: "elsewhere", status: "todo", priority: "medium", assigneeAgentId: null, assigneeUserId: null },
      ] as Issue["blockedBy"],
    });
    const lanes = buildAgentLanes([blocker, blocked], AGENTS);
    const edges = collectDependencyEdges(lanes);
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ fromId: blocker.id, toId: blocked.id, active: true });
    expect(edges[0].label).toContain("kill it if the dependency isn't real");
  });
});

describe("AgentLanesBoard", () => {
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

  it("renders a lane per agent with chips, ages, and the serialization note", () => {
    const blocker = createIssue({ assigneeAgentId: "agent-1", status: "in_progress", startedAt: new Date() });
    const blocked = createIssue({
      assigneeAgentId: "agent-2",
      status: "todo",
      blockedBy: [
        { id: blocker.id, identifier: blocker.identifier, title: blocker.title, status: blocker.status, priority: blocker.priority, assigneeAgentId: blocker.assigneeAgentId, assigneeUserId: null },
      ] as Issue["blockedBy"],
    });

    act(() => {
      root.render(<AgentLanesBoard issues={[blocker, blocked]} agents={AGENTS} />);
    });

    expect(container.querySelector("[data-testid='agent-lane-agent:agent-1']")).not.toBeNull();
    expect(container.querySelector("[data-testid='agent-lane-agent:agent-2']")).not.toBeNull();
    expect(container.querySelector(`[data-testid='lane-chip-${blocker.id}']`)).not.toBeNull();
    expect(container.querySelectorAll("[data-testid='issue-age-chip']").length).toBeGreaterThan(0);

    const note = container.querySelector("[data-testid='agent-lanes-serialization-note']");
    expect(note?.textContent).toContain("1 active dependency");

    const paths = container.querySelectorAll("[data-testid='agent-lanes-edges'] path");
    expect(paths).toHaveLength(1);
    expect(paths[0].querySelector("title")?.textContent).toContain("blocks");
  });

  it("announces parallel gestation when there are no dependencies", () => {
    act(() => {
      root.render(
        <AgentLanesBoard
          issues={[createIssue({ assigneeAgentId: "agent-1" })]}
          agents={AGENTS}
        />,
      );
    });
    const note = container.querySelector("[data-testid='agent-lanes-serialization-note']");
    expect(note?.textContent).toContain("everything gestates in parallel");
  });
});
