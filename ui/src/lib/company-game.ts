// The Company screen's game model. Every number here comes from evidence the
// control plane already holds: roadmap stages built from tasks and projects,
// issue completions, agent state, and the real-Stripe market-cap snapshot.
// Nothing is self-reported and nothing is earned by activity alone.

import type { Agent, Issue } from "@paperclipai/shared";
import type { MarketCapSnapshot } from "@paperclipai/shared/vitals-market-cap";
import type { RoadmapStageAssignment } from "../pages/Roadmap";

export type CompanyGameBoss = {
  stageSequence: number;
  stageTitle: string;
  ownerName: string;
  progress: number;
  openQuests: number;
  blockedQuests: number;
};

export type CompanyGameQuest = {
  id: string;
  identifier: string;
  title: string;
  href: string;
};

export type CompanyGame = {
  /** Stages fully complete, plus one: the stage the company is playing now. 1 to 8. */
  level: number;
  totalLevels: number;
  /** Average stage progress, 0 to 100. */
  progress: number;
  boss: CompanyGameBoss | null;
  gold: {
    label: string;
    verified: boolean;
  };
  today: {
    completed: CompanyGameQuest[];
    completedCount: number;
    partyRunning: number;
    partyErrored: number;
  };
  yourTurn: {
    decisions: number;
    blocked: number;
    unassigned: number;
  };
};

const OPEN_STATUSES = new Set(["todo", "backlog", "in_progress", "in_review"]);

function toTime(value: Date | string | null | undefined): number {
  if (!value) return 0;
  const d = value instanceof Date ? value : new Date(value);
  const t = d.getTime();
  return Number.isNaN(t) ? 0 : t;
}

// "Today" is the board's local day, the same day the browser shows.
function sameDay(value: Date | string | null | undefined, now: Date): boolean {
  const t = toTime(value);
  if (!t) return false;
  const d = new Date(t);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export function computeCompanyGame(input: {
  companyPrefix: string;
  agents: Agent[];
  issues: Issue[];
  stages: RoadmapStageAssignment[];
  constraint: RoadmapStageAssignment | null;
  snapshot: MarketCapSnapshot | null;
  decisions: number;
  now?: Date;
}): CompanyGame {
  const now = input.now ?? new Date();
  const totalLevels = Math.max(input.stages.length, 1);
  const completedStages = input.stages.filter((stage) => stage.progress >= 100).length;
  const level = Math.min(completedStages + 1, totalLevels);
  const progress = input.stages.length
    ? Math.round(input.stages.reduce((sum, stage) => sum + stage.progress, 0) / input.stages.length)
    : 0;

  const boss: CompanyGameBoss | null = input.constraint
    ? {
        stageSequence: input.constraint.stage.sequence,
        stageTitle: input.constraint.stage.title,
        // A paused agent leads nothing: name the department instead.
        ownerName:
          input.constraint.ownerAgent && input.constraint.ownerAgent.status !== "paused"
            ? input.constraint.ownerAgent.name
            : input.constraint.ownerDepartment.name,
        progress: input.constraint.progress,
        openQuests: input.constraint.evidence.filter((e) => e.progress < 100 && !e.blocked).length,
        blockedQuests: input.constraint.blockedEvidenceCount,
      }
    : null;

  const verified = Boolean(input.snapshot?.inputs.stripeConnected) && input.snapshot?.arrCents != null;
  const gold = {
    label: verified ? input.snapshot!.arrLabel : "$0 verified",
    verified,
  };

  const completedToday = input.issues
    .filter((issue) => issue.status === "done" && sameDay(issue.completedAt ?? issue.updatedAt, now))
    .sort((a, b) => toTime(b.completedAt ?? b.updatedAt) - toTime(a.completedAt ?? a.updatedAt));
  const today = {
    completed: completedToday.slice(0, 5).map((issue) => ({
      id: issue.id,
      identifier: issue.identifier ?? issue.id,
      title: issue.title,
      href: `/${input.companyPrefix}/issues/${issue.identifier}`,
    })),
    completedCount: completedToday.length,
    partyRunning: input.agents.filter((agent) => agent.status === "running").length,
    partyErrored: input.agents.filter((agent) => agent.status === "error").length,
  };

  const yourTurn = {
    decisions: input.decisions,
    blocked: input.issues.filter((issue) => issue.status === "blocked").length,
    unassigned: input.issues.filter((issue) => OPEN_STATUSES.has(issue.status) && !issue.assigneeAgentId).length,
  };

  return { level, totalLevels, progress, boss, gold, today, yourTurn };
}
