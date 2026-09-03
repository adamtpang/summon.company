import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Agent, DashboardOutcomes, DashboardSummary, Goal, Issue, Project } from "@paperclipai/shared";
import { ArrowRight, BadgeDollarSign, Boxes, ChevronDown, CircleDollarSign, FileText, Globe2, Image as ImageIcon, MailCheck, MessageSquareText, Megaphone, Plus, X, type LucideIcon } from "lucide-react";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FleetRunningNow } from "./FleetRunningNow";
import { CompanyLoop } from "./CompanyLoop";
import { AgentCapsule } from "./AgentCapsule";
import { BoardChat } from "../pages/BoardChat";
import { buildCompanyOfficeRooms, type CompanyOfficeRoom, type CompanyOfficeState } from "./CompanyOffice";
import { companyWebsiteApi } from "../api/companyWebsite";
import { companyPaymentsApi } from "../api/companyPayments";
import { companySocialApi } from "../api/companySocial";
import { companyOutreachApi } from "../api/companyOutreach";
import { companyAdsApi } from "../api/companyAds";
import { companyStackApi } from "../api/companyStack";
import { companyInboxApi } from "../api/companyInbox";
import { queryKeys } from "../lib/queryKeys";
import { buildRoadmapStages, selectRoadmapConstraint } from "../pages/Roadmap";
import { useMarketCapSnapshot } from "../pages/MarketCap";
import { buildScoreboard } from "../lib/scoreboard";
import { isCompanyMediaIssue } from "../lib/company-media";
import { cn, formatCents } from "../lib/utils";

interface MissionControlProps {
  companyId: string;
  companyName?: string;
  summary: DashboardSummary;
  agents: Agent[];
  issues: Issue[];
  projects: Project[];
  goals: Goal[];
  decisionCount: number;
  liveIssueIds?: ReadonlySet<string>;
  onCreateTask?: () => void;
  notice?: ReactNode;
  extensions?: ReactNode;
}

function pct(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

// Via-negativa pass (board, 2026-07-18; law 1 removals logged in the commit):
// the Roadmap 8-card grid, the "Honest fallback" caption, the header tagline,
// the eyebrow over the h1, per-section caption prose, heading + hero icons,
// the queue rank column, the "proxy score" sublabel, and the ×8 "No open task
// assigned" placeholders all failed the deletion test — none carried data or
// an affordance the remaining elements lack. The binding-constraint card IS
// the roadmap's dashboard presence; the full grid lives at /roadmap.
export function MissionControl({
  companyId,
  companyName = "Your company",
  summary,
  agents,
  issues,
  projects,
  goals,
  decisionCount,
  liveIssueIds,
  onCreateTask,
  notice,
  extensions,
}: MissionControlProps) {
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const marketCap = useMarketCapSnapshot(companyId, summary.finance);
  const roadmap = useMemo(
    () => buildRoadmapStages({ agents, issues, projects, goals }),
    [agents, goals, issues, projects],
  );
  const roadmapConstraint = useMemo(() => selectRoadmapConstraint(roadmap), [roadmap]);
  // Company lifespan at a glance (board, 2026-07-19): stage X of 8 + percent
  // through the whole roadmap — the mean of the eight stages' evidence-derived
  // progress. Same honest source as the constraint, never self-reported.
  const overallRoadmapProgress = useMemo(
    () => (roadmap.length ? Math.round(roadmap.reduce((sum, stage) => sum + stage.progress, 0) / roadmap.length) : 0),
    [roadmap],
  );
  const scoreboard = useMemo(() => buildScoreboard(issues), [issues]);
  const topWork = scoreboard.rows.slice(0, 7);
  const mediaRequests = useMemo(() => issues.filter(isCompanyMediaIssue), [issues]);
  const openMediaRequests = mediaRequests.filter((issue) => !["done", "cancelled"].includes(issue.status)).length;
  const approvedEmployees = agents.filter(
    (agent) => agent.status !== "terminated" && agent.status !== "pending_approval",
  );
  const pendingSeatCount = agents.filter((agent) => agent.status === "pending_approval").length;
  const officeRooms = useMemo(
    () => buildCompanyOfficeRooms(agents, issues, Date.now(), liveIssueIds),
    [agents, issues, liveIssueIds],
  );
  const workingRooms = officeRooms.filter((room) => room.state === "working");
  const activeRoom = workingRooms[0] ?? officeRooms.find((room) => room.state === "reviewing" || room.state === "blocked") ?? null;

  const runTotals = summary.runActivity.reduce(
    (total, day) => ({
      all: total.all + day.total,
      succeeded: total.succeeded + day.succeeded + day.recovered,
    }),
    { all: 0, succeeded: 0 },
  );
  const reliability = runTotals.all > 0 ? pct((runTotals.succeeded / runTotals.all) * 100) : null;
  const reliabilityLabel = reliability === null ? "Unproven" : `${reliability}%`;

  // The next best move (board, 2026-07-19 — the product sentence made visual):
  // ONE card, ONE action, computed from the same evidence everything else uses.
  // Priority: decisions waiting on the board → reviews parked for sign-off →
  // the top-ranked unassigned task → all clear.
  const topReview = scoreboard.rows.find((row) => row.reviewNeeded);
  const topUnassigned = scoreboard.rows.find(
    (row) => !row.assigneeAgentId && row.status !== "done" && row.status !== "in_review" && !row.reviewNeeded,
  );
  const nextMove = decisionCount > 0
    ? {
        label: `Clear ${decisionCount} decision${decisionCount === 1 ? "" : "s"}`,
        detail: "Approve, retry, or reject, one card at a time.",
        to: "/decisions",
        cta: "Open the deck",
      }
    : topReview
      ? {
          label: `Review ${topReview.identifier}`,
          detail: topReview.title,
          to: `/issues/${topReview.pathId}`,
          cta: "Review it",
        }
      : topUnassigned
        ? {
            label: `Assign ${topUnassigned.identifier}`,
            detail: `Tier ${topUnassigned.tier} · ${topUnassigned.title}`,
            to: `/issues/${topUnassigned.pathId}`,
            cta: "Assign it",
          }
        : null;

  const terminalLines = [
    nextMove ? `Your next move: ${nextMove.label}` : "Company standing by. Waiting for the next dispatch.",
    `${summary.agents.running} employees working · ${summary.tasks.open} tasks open.`,
    reliability === null
      ? "No runs observed · reliability unproven."
      : `${runTotals.all} runs observed · ${reliability}% reliable.`,
    `${summary.outcomes.receiptCount} verified outcome receipts · ${decisionCount} board decisions waiting.`,
  ];

  return (
    <div data-testid="mission-control" className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background font-editorial text-foreground">
      <div className="h-20 shrink-0 overflow-hidden bg-foreground px-3 py-2 font-console text-xs leading-4 text-background">
        {terminalLines.map((line) => <p key={line} className="truncate">&gt; {line}</p>)}
      </div>

      <nav aria-label="Mission Control" className="flex h-16 shrink-0 items-center justify-between border-b border-foreground px-5">
        <div className="min-w-0 max-sm:hidden">
          <p className="truncate text-xl">{companyName}</p>
          <p className="font-console text-xs uppercase tracking-(--tracking-eyebrow) text-muted-foreground">
            Mission Control · {summary.agents.running > 0 ? "Live" : "Standby"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onCreateTask ? (
            <Button type="button" variant="outline" size="sm" onClick={onCreateTask} className="rounded-(--rad-2) border-foreground font-console text-xs uppercase tracking-(--tracking-eyebrow) shadow-none">
              <Plus aria-hidden="true" /> New
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm" className="rounded-(--rad-2) border-foreground font-console text-xs uppercase tracking-(--tracking-eyebrow) shadow-none">
              <Link to="/issues"><Plus aria-hidden="true" /> New</Link>
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => setMobileChatOpen(true)} className="rounded-(--rad-2) border-foreground font-console text-xs uppercase tracking-(--tracking-eyebrow) shadow-none xl:hidden">
            <MessageSquareText aria-hidden="true" /> Chat
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="rounded-(--rad-2) border-foreground font-console text-xs uppercase tracking-(--tracking-eyebrow) shadow-none">
                Menu <ChevronDown aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-(--rad-2) border-foreground font-console text-xs">
              <DropdownMenuItem asChild><Link to="/portfolio">Aether portfolio</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/factory-floor">Digital office</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/issues">All tasks</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/roadmap">Company roadmap</Link></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><Link to="/costs">Costs and budgets</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/company/settings">Company settings</Link></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>

      {notice ? (
        <div className="shrink-0 border-b border-foreground bg-muted/40 px-5 py-3">
          {notice}
        </div>
      ) : null}

      <FinancialScoreboard summary={summary} marketCapLabel={marketCap.snapshot?.capProxyLabel ?? null} marketCapLoading={marketCap.loading} />

      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-y-auto p-2" aria-labelledby="mission-control-heading">
          <h1 id="mission-control-heading" className="sr-only">Mission Control</h1>
          <div className="grid items-start gap-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            <div className="space-y-5">
              <section aria-labelledby="company-office-heading">
                <LiveSectionHeading id="company-office-heading" title="Mission Control" to="/factory-floor" />
                <div className="flex items-start gap-4 py-4 max-sm:flex-col">
                  <div className="grid shrink-0 grid-cols-3 gap-2 border border-foreground p-3" aria-label="Nine-room digital office">
                    {officeRooms.map((room, index) => <OfficeCapsule key={room.id} room={room} gradient={index + 1} />)}
                  </div>
                  <div className="min-w-0 py-1">
                    <p className="text-lg font-bold">{decisionCount > 0 ? "Decision needed" : workingRooms.length > 0 ? "Working" : "Standing by"}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {decisionCount > 0
                        ? `${decisionCount} board decision${decisionCount === 1 ? "" : "s"} waiting.`
                        : activeRoom?.issue
                          ? `${activeRoom.department}: ${activeRoom.issue.title}`
                          : "No employee needs the board right now."}
                    </p>
                    <Link to={nextMove?.to ?? "/factory-floor"} className="mt-4 inline-flex items-center gap-1 font-console text-xs uppercase tracking-(--tracking-eyebrow) hover:underline">
                      {nextMove?.label ?? "Open digital office"} <ArrowRight className="size-3" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
                <p className="border-t border-foreground/20 pt-2 text-xs text-muted-foreground">{officeRooms.map((room) => room.department).join(" · ")}</p>
              </section>

              <section aria-labelledby="routines-heading">
                <LiveSectionHeading id="routines-heading" title="Routines" to="/routines" />
                <Link to="/routines" className="flex items-center justify-between border-b border-foreground/20 py-3 hover:underline">
                  <span>Company loop</span>
                  <span className="font-console text-xs uppercase tracking-(--tracking-eyebrow)">{summary.agents.running > 0 ? "Running" : "Ready"}</span>
                </Link>
                <Dialog>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      data-testid="company-controls-trigger"
                      className="flex w-full items-center justify-between border-b border-foreground/20 py-3 text-left font-console text-xs uppercase tracking-(--tracking-eyebrow) hover:underline"
                    >
                      <span>Company controls</span>
                      <span>Open</span>
                    </button>
                  </DialogTrigger>
                  <DialogContent
                    data-testid="company-controls-workspace"
                    className="max-h-(--sz-85vh) w-(--sz-calc-4) !max-w-(--sz-1280px) overflow-y-auto overscroll-contain font-sans"
                  >
                    <DialogHeader className="pr-8">
                      <DialogTitle>Company controls</DialogTitle>
                      <DialogDescription>
                        Decide the next work, bound autonomous execution, and verify the resulting evidence.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <FleetRunningNow agents={agents} className="rounded-(--rad-2) border-foreground/20 bg-transparent shadow-none" />
                      <CompanyLoop companyId={companyId} agents={agents} className="rounded-(--rad-2) border-foreground/20 bg-transparent shadow-none" />
                    </div>
                  </DialogContent>
                </Dialog>
              </section>

              <WebsiteGlance companyId={companyId} />

              <section aria-labelledby="team-heading">
                <LiveSectionHeading id="team-heading" title="Team" to="/formation" />
                <div className="divide-y divide-foreground/15">
                  {approvedEmployees.slice(0, 5).map((agent) => (
                    <Link key={agent.id} to={`/agents/${agent.id}`} className="flex items-center justify-between gap-3 py-2 hover:underline">
                      <span className="truncate font-bold">{agent.name}</span>
                      <span className="font-console text-xs uppercase tracking-(--tracking-eyebrow) text-muted-foreground">{agent.status}</span>
                    </Link>
                  ))}
                  {approvedEmployees.length === 0 ? <p className="py-3 text-sm text-muted-foreground">No approved employees yet.</p> : null}
                  {pendingSeatCount > 0 ? (
                    <Link to="/formation" className="flex items-center justify-between gap-3 py-2 text-muted-foreground hover:underline">
                      <span>{pendingSeatCount} {pendingSeatCount === 1 ? "seat" : "seats"} awaiting approval</span>
                      <ArrowRight className="size-3" aria-hidden="true" />
                    </Link>
                  ) : null}
                </div>
              </section>

              <section aria-labelledby="business-heading">
                <LiveSectionHeading id="business-heading" title="Business" />
                <dl className="space-y-1.5 py-3 text-sm">
                  <BusinessRow label="Employees" value={approvedEmployees.length} detail={`${summary.agents.running} live${pendingSeatCount > 0 ? ` · ${pendingSeatCount} pending` : ""}`} />
                  <BusinessRow label="Tasks completed" value={summary.tasks.done} detail={`${summary.tasks.open} open`} />
                  <BusinessRow label="Month spend" value={formatCents(summary.costs.monthSpendCents)} detail={summary.costs.monthBudgetCents > 0 ? `${summary.costs.monthUtilizationPercent}% of budget` : "no ceiling"} />
                  <BusinessRow label="Run reliability" value={reliabilityLabel} detail={`${runTotals.all} runs`} />
                  <BusinessRow label="One binding constraint" value={roadmapConstraint?.stage.title ?? "None"} detail={`${overallRoadmapProgress}% roadmap`} to="/roadmap" />
                </dl>
              </section>
            </div>

            <div className="space-y-5">
              <section aria-labelledby="queue-heading">
                <LiveSectionHeading id="queue-heading" title="Tasks" to="/issues" />
                <div className="space-y-1.5 pt-3">
                  {topWork.length === 0 ? <p className="py-4 text-sm text-muted-foreground">No company work is queued.</p> : topWork.map((row) => {
                    const live = row.progressLabel === "Run started";
                    return (
                      <Link key={row.id} to={`/issues/${row.pathId}`} className={cn("block rounded-(--rad-4) border border-foreground bg-muted/60 p-3 shadow-(--shadow-dashboard-task) transition-colors hover:bg-muted", live && "border-live bg-live/5")}>
                        <span className="block truncate font-bold">{row.title}</span>
                        <span className="mt-1 block truncate text-sm text-muted-foreground">{row.identifier} · {row.progressLabel}</span>
                        <span className="mt-2 flex items-center justify-between gap-3 font-console text-xs uppercase tracking-(--tracking-eyebrow)">
                          <span className={live ? "text-live" : "text-muted-foreground"}>Tier {row.tier}</span>
                          <span className={live ? "text-live" : "text-foreground"}>{live ? "Live" : "1 task"}</span>
                        </span>
                      </Link>
                    );
                  })}
                  <p className="pt-1 font-console text-xs text-muted-foreground">+ {Math.max(summary.tasks.open - topWork.length, 0)} more open tasks</p>
                </div>
              </section>

              <section aria-labelledby="documents-heading">
                <LiveSectionHeading id="documents-heading" title="Documents" to="/artifacts" />
                <div className="divide-y divide-foreground/15">
                  <DocumentRow title="Company roadmap" detail={`${overallRoadmapProgress}% complete`} to="/roadmap" />
                  <DocumentRow title="Operating formation" detail="8 departments" to="/formation" />
                  <DocumentRow title="Projects" detail={`${projects.length} linked`} to="/projects" />
                  <DocumentRow title="Goals" detail={`${goals.length} active`} to="/goals" />
                </div>
              </section>

              <StackGlance companyId={companyId} />
            </div>

            <div className="space-y-5">
              <SocialGlance companyId={companyId} />
              <InboxGlance companyId={companyId} />
              <OutreachGlance companyId={companyId} />
              <OutcomesRollup outcomes={summary.outcomes} />
            </div>

            <div className="space-y-5">
              <AdsGlance companyId={companyId} />
              <PaymentsGlance companyId={companyId} />
              <section aria-labelledby="media-heading">
                <LiveSectionHeading id="media-heading" title="Media" to="/company/media" />
                <Link to="/company/media" className="flex items-center gap-3 py-3 hover:underline">
                  <ImageIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                  <span><span className="block font-bold">Images and video</span><span className="block font-console text-xs text-muted-foreground">{openMediaRequests} active · request, review, keep the receipt</span></span>
                </Link>
              </section>
              <section aria-labelledby="board-heading">
                <LiveSectionHeading id="board-heading" title="Board" to="/decisions" />
                <Link to={nextMove?.to ?? "/decisions"} className="flex items-center justify-between gap-3 py-3 hover:underline">
                  <span><span className="block font-bold">{nextMove?.label ?? "Nothing needs you"}</span><span className="block text-sm text-muted-foreground">{nextMove?.detail ?? "The company can continue without board input."}</span></span>
                  <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
                </Link>
              </section>
            </div>
          </div>
          {extensions ? <div className="mt-5">{extensions}</div> : null}
        </main>

        <aside data-testid="board-chat-rail" aria-label="Board chat" className="hidden w-96 shrink-0 flex-col border-l border-foreground xl:flex">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-foreground px-3">
            <span className="font-bold">Board chat</span>
            <Link to="/chat" className="font-console text-xs uppercase tracking-(--tracking-eyebrow) hover:underline">Open</Link>
          </div>
          <div className="shrink-0 border-b border-foreground px-3 py-3">
            <p className="font-bold">Ask your company anything.</p>
            <p className="mt-1 text-sm text-muted-foreground">Questions are free. When conversation becomes work, Summon creates an accountable task.</p>
          </div>
          <div className="min-h-0 flex-1 font-sans"><BoardChat zenMode manageBreadcrumbs={false} /></div>
        </aside>
      </div>

      {mobileChatOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-background xl:hidden">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-foreground px-4">
            <span className="font-bold">Board chat</span>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => setMobileChatOpen(false)} aria-label="Close board chat"><X aria-hidden="true" /></Button>
          </div>
          <div className="shrink-0 border-b border-foreground px-4 py-3">
            <p className="font-bold">Ask your company anything.</p>
            <p className="mt-1 text-sm text-muted-foreground">Questions are free. Work becomes an accountable task.</p>
          </div>
          <div className="min-h-0 flex-1 font-sans"><BoardChat zenMode manageBreadcrumbs={false} /></div>
        </div>
      ) : null}
    </div>
  );
}

function DocumentRow({ title, detail, to }: { title: string; detail: string; to: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 py-2 hover:underline">
      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate font-bold">{title}</span>
      <span className="font-console text-xs uppercase tracking-(--tracking-eyebrow) text-muted-foreground">{detail}</span>
    </Link>
  );
}

function FinancialScoreboard({
  summary,
  marketCapLabel,
  marketCapLoading,
}: {
  summary: DashboardSummary;
  marketCapLabel: string | null;
  marketCapLoading: boolean;
}) {
  const { finance } = summary;
  const profitValue = finance.profitStatus === "test_mode"
    ? "Test mode"
    : finance.profitStatus === "currency_mismatch"
      ? "Currency mismatch"
    : finance.profitCents === null
      ? "Unproven"
      : formatFinanceMoney(finance.profitCents, finance.currency);
  const runwayValue = finance.runwayStatus === "test_mode"
    ? "Test mode"
    : finance.runwayStatus === "currency_mismatch"
      ? "Currency mismatch"
    : finance.runwayStatus === "profitable"
      ? "Profitable"
      : finance.runwayMonths === null
        ? "Unproven"
        : `${finance.runwayMonths} mo`;
  const baseExpenseEvidenceDetail = finance.expenseEvidenceSource === "statement_import"
    ? `AI + ${finance.statementOperatingExpenseEvents} statement transactions`
    : finance.expenseEvidenceSource === "mixed"
      ? `AI + ${finance.statementOperatingExpenseEvents} imported + ${finance.boardRecordedOperatingExpenseEvents} board`
      : finance.expenseEvidenceSource === "board_recorded"
        ? `AI + ${finance.boardRecordedOperatingExpenseEvents} board-recorded`
        : "Tracked AI costs only";
  const expenseEvidenceDetail = finance.transcriptionExpenseEvents > 0
    ? `${baseExpenseEvidenceDetail} + ${finance.transcriptionExpenseEvents} voice estimate${finance.transcriptionExpenseEvents === 1 ? "" : "s"}`
    : baseExpenseEvidenceDetail;
  const revenueNeedsRefresh = finance.revenueFreshness === "stale" || finance.revenueFreshness === "error";
  const revenueFreshnessDetail = finance.revenueFreshness === "fresh"
    ? "Automatic Stripe evidence · current"
    : finance.revenueFreshness === "stale"
      ? "Automatic Stripe refresh overdue"
      : finance.revenueFreshness === "error"
        ? "Automatic Stripe refresh needs attention"
        : finance.revenueFreshness === "test_mode"
          ? "Stripe test mode"
          : "Connect Stripe revenue evidence";
  const runwayEvidenceDetail = finance.expenseEvidenceSource === "bank_sync"
    ? "Bank cash / continuous operating burn"
    : finance.expenseEvidenceSource === "bank_and_board"
      ? "Bank cash / continuous + board-recorded burn"
      : finance.expenseEvidenceSource === "statement_import"
        ? "Available cash / statement-backed burn"
        : finance.expenseEvidenceSource === "mixed"
          ? "Available cash / mixed-evidence burn"
          : finance.expenseEvidenceSource === "board_recorded"
            ? "Available cash / board-recorded burn"
            : "Based on tracked AI costs only";

  return (
    <section data-testid="financial-scoreboard" aria-label="Company financial scoreboard" className="shrink-0 border-b border-foreground">
      <div className="grid grid-cols-2 divide-x divide-y divide-foreground md:grid-cols-3 xl:grid-cols-6 xl:divide-y-0">
        <FinancialMetric
          label="Market cap"
          value={marketCapLoading ? "Reading" : marketCapLabel ?? "Unproven"}
          detail={revenueNeedsRefresh ? "Refresh Stripe evidence before pricing" : "Revenue-backed proxy"}
          to="/market-cap"
        />
        <FinancialMetric
          label="Profitability"
          value={profitValue}
          detail={finance.profitStatus === "measured_proxy"
            ? revenueNeedsRefresh ? "Refresh Stripe before trusting this proxy" : "Stripe revenue minus recorded expenses"
            : finance.profitStatus === "currency_mismatch"
              ? "Revenue and expenses use different currencies"
              : "Needs live USD revenue + recorded expenses"}
          to="/company/payments"
        />
        <FinancialMetric
          label="Revenue · month"
          value={finance.revenueCents === null ? "Unproven" : formatFinanceMoney(finance.revenueCents, finance.currency)}
          detail={finance.revenueCoverage === "bounded_latest_100"
            ? `Bounded provider scan · ${revenueFreshnessDetail}`
            : revenueFreshnessDetail}
          to="/company/payments"
        />
        <FinancialMetric
          label="Expenses · month"
          value={formatFinanceMoney(finance.expenseCents, finance.expenseCurrency)}
          detail={expenseEvidenceDetail}
          to="/costs"
        />
        <FinancialMetric
          label="Available cash"
          value={finance.availableCashCents === null ? "Unavailable" : formatFinanceMoney(finance.availableCashCents, finance.cashCurrency ?? finance.currency)}
          detail={finance.cashSource === "bank"
            ? finance.expenseFreshness === "fresh" ? "Read-only bank balance" : `Bank evidence ${(finance.expenseFreshness ?? "unavailable").replaceAll("_", " ")}`
            : revenueNeedsRefresh
              ? revenueFreshnessDetail
              : finance.pendingCashCents === null ? "Available balance" : `${formatFinanceMoney(finance.pendingCashCents, finance.currency)} pending`}
          to={finance.cashSource === "bank" ? "/costs" : "/company/payments"}
        />
        <FinancialMetric
          label="Runway"
          value={runwayValue}
          detail={revenueNeedsRefresh ? revenueFreshnessDetail : runwayEvidenceDetail}
          to="/costs"
        />
      </div>
    </section>
  );
}

function FinancialMetric({ label, value, detail, to }: { label: string; value: string; detail: string; to: string }) {
  return (
    <Link to={to} className="group min-w-0 px-4 py-3 hover:bg-muted/50">
      <span className="block font-console text-xs uppercase tracking-(--tracking-eyebrow) text-muted-foreground">{label}</span>
      <span className="mt-1 block truncate text-xl font-bold tabular-nums group-hover:underline">{value}</span>
      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{detail}</span>
    </Link>
  );
}

function LiveSectionHeading({ id, title, to }: { id: string; title: string; to?: string }) {
  return (
    <div className="flex items-end justify-between gap-3 border-b border-foreground pb-1.5">
      <h2 id={id} className="text-base font-bold max-sm:text-sm">{title}</h2>
      {to ? (
        <Link to={to} className="font-console text-xs uppercase tracking-(--tracking-eyebrow) text-muted-foreground hover:text-foreground">
          Open
        </Link>
      ) : null}
    </div>
  );
}

function officeRoomTarget(room: CompanyOfficeRoom) {
  if (room.issue) return `/issues/${room.issue.identifier ?? room.issue.id}`;
  if (room.agent) return `/agents/${room.agent.id}`;
  return "/formation";
}

function officeCapsuleState(room: CompanyOfficeRoom): "slot" | "configured" | "online" {
  if (!room.agent) return "slot";
  if (room.state === "pending" || room.state === "paused" || room.state === "blocked") return "configured";
  return "online";
}

function OfficeCapsule({ room, gradient }: { room: CompanyOfficeRoom; gradient: number }) {
  const stateLabel: Record<CompanyOfficeState, string> = {
    working: "working now",
    reviewing: "awaiting review",
    blocked: "blocked",
    waiting: "between runs",
    queued: "queued",
    shipped: "shipped today",
    available: "available",
    pending: "pending approval",
    paused: "paused",
    unstaffed: "open position",
  };
  return (
    <Link
      to={officeRoomTarget(room)}
      className={cn(
        "relative flex min-h-16 min-w-10 items-center justify-center rounded-(--rad-2) outline-none focus-visible:ring-2 focus-visible:ring-ring",
        room.state === "working" && "bg-live/10",
      )}
      aria-label={`${room.department}, ${room.agent?.name ?? "open position"}, ${stateLabel[room.state]}`}
      title={`${room.department}: ${room.agent?.name ?? "open position"}`}
    >
      <AgentCapsule
        state={officeCapsuleState(room)}
        size="sm"
        gradient={gradient}
        glow={room.state === "working" ? "blue" : "green"}
        className="mx-0 scale-75"
      />
      <span className={cn("absolute right-1 top-1 size-1.5 rounded-full bg-muted-foreground/40", room.state === "working" && "bg-live motion-safe:animate-pulse")} aria-hidden="true" />
    </Link>
  );
}

function BusinessRow({
  label,
  value,
  detail,
  to,
}: {
  label: string;
  value: string | number;
  detail: string;
  to?: string;
}) {
  const content = (
    <>
      <span><span className="font-bold">{label}:</span> {value}</span>
      <span className="font-console text-xs uppercase tracking-(--tracking-eyebrow) text-muted-foreground">({detail})</span>
    </>
  );
  return to ? (
    <Link to={to} className="flex flex-wrap items-baseline justify-between gap-x-2 hover:underline">{content}</Link>
  ) : (
    <div className="flex flex-wrap items-baseline justify-between gap-x-2">{content}</div>
  );
}

function SystemRow({
  testId,
  icon: Icon,
  label,
  value,
  detail,
  to,
}: {
  testId: string;
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  to: string;
}) {
  return (
    <section data-testid={testId} aria-labelledby={`${testId}-heading`}>
      <LiveSectionHeading id={`${testId}-heading`} title={label} to={to} />
      <Link to={to} className="group flex items-start gap-2 py-3">
        <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">{value}</span>
          <span className="block truncate font-console text-xs text-muted-foreground">{detail}</span>
        </span>
        <ArrowRight className="mt-2 size-3 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </Link>
    </section>
  );
}

function WebsiteGlance({ companyId }: { companyId: string }) {
  const websitesQuery = useQuery({
    queryKey: queryKeys.companyWebsite.list(companyId),
    queryFn: () => companyWebsiteApi.list(companyId),
  });
  const websites = websitesQuery.data ?? [];
  const website = websites.find((item) => item.connectionStatus !== "revoked") ?? websites[0] ?? null;

  return (
    <SystemRow
      testId="website-glance"
      icon={Globe2}
      label="Website"
      value={websitesQuery.isLoading ? "Reading receipts" : websitesQuery.isError ? "State unavailable" : website?.displayName ?? "No website connected"}
      detail={website ? `${website.deploymentStatus} · ${website.healthStatus}` : "Connect provider, domain, and owner"}
      to="/company/website"
    />
  );
}

function PaymentsGlance({ companyId }: { companyId: string }) {
  const accountsQuery = useQuery({
    queryKey: queryKeys.companyPayments.accounts(companyId),
    queryFn: () => companyPaymentsApi.listAccounts(companyId),
  });
  const accounts = accountsQuery.data ?? [];
  const account = accounts.find((item) => item.connectionStatus !== "revoked") ?? accounts[0] ?? null;
  const offersQuery = useQuery({
    queryKey: queryKeys.companyPayments.offers(companyId, account?.id ?? "none"),
    queryFn: () => companyPaymentsApi.listOffers(companyId, account!.id),
    enabled: !!account,
  });
  const activeOffers = (offersQuery.data ?? []).filter((offer) => offer.status === "active").length;
  const readiness = !account
    ? null
    : account.connectionStatus === "revoked"
      ? "revoked"
      : account.detailsSubmitted && account.chargesEnabled && account.payoutsEnabled
        ? "ready"
        : "restricted";

  return (
    <SystemRow
      testId="payments-glance"
      icon={CircleDollarSign}
      label="Payments"
      value={accountsQuery.isLoading ? "Reading receipts" : accountsQuery.isError ? "State unavailable" : account?.displayName ?? "No Stripe account connected"}
      detail={account
        ? `${readiness} · ${formatPaymentMoney(account.recentGrossCents, account.recentCurrency ?? account.defaultCurrency ?? "usd")} gross · ${offersQuery.isLoading ? "…" : activeOffers} links`
        : "Company custody with a restricted key"}
      to="/company/payments"
    />
  );
}

function SocialGlance({ companyId }: { companyId: string }) {
  const connectionsQuery = useQuery({
    queryKey: queryKeys.companySocial.connections(companyId),
    queryFn: () => companySocialApi.listConnections(companyId),
  });
  const connections = connectionsQuery.data ?? [];
  const connection = connections.find((item) => item.connectionStatus !== "revoked") ?? connections[0] ?? null;
  const channelsQuery = useQuery({
    queryKey: queryKeys.companySocial.channels(companyId, connection?.id ?? "none"),
    queryFn: () => companySocialApi.listChannels(companyId, connection!.id),
    enabled: !!connection,
  });
  const postsQuery = useQuery({
    queryKey: queryKeys.companySocial.posts(companyId, connection?.id ?? "none"),
    queryFn: () => companySocialApi.listPosts(companyId, connection!.id),
    enabled: !!connection,
  });
  const channels = channelsQuery.data ?? [];
  const posts = postsQuery.data ?? [];
  const connectedChannels = channels.filter((channel) => channel.status === "connected").length;
  const scheduled = posts.filter((post) => ["submitted", "scheduled"].includes(post.status)).length;
  const published = posts.filter((post) => post.status === "published").length;

  return (
    <SystemRow
      testId="social-glance"
      icon={Megaphone}
      label="Social"
      value={connectionsQuery.isLoading ? "Reading receipts" : connectionsQuery.isError ? "State unavailable" : connection?.displayName ?? "No social workspace connected"}
      detail={connection
        ? `${channelsQuery.isLoading ? "…" : connectedChannels} channels · ${postsQuery.isLoading ? "…" : scheduled} scheduled · ${published} published`
        : "Connect company-owned identities"}
      to="/company/social"
    />
  );
}

function OutreachGlance({ companyId }: { companyId: string }) {
  const connectionsQuery = useQuery({ queryKey: queryKeys.companyOutreach.connections(companyId), queryFn: () => companyOutreachApi.listConnections(companyId) });
  const connection = (connectionsQuery.data ?? []).find((item) => item.status !== "revoked") ?? connectionsQuery.data?.[0] ?? null;
  const campaignsQuery = useQuery({ queryKey: queryKeys.companyOutreach.campaigns(companyId, connection?.id), queryFn: () => companyOutreachApi.listCampaigns(companyId, connection!.id), enabled: !!connection });
  const leadsQuery = useQuery({ queryKey: queryKeys.companyOutreach.leads(companyId), queryFn: () => companyOutreachApi.listLeads(companyId) });
  const suppressionsQuery = useQuery({ queryKey: queryKeys.companyOutreach.suppressions(companyId), queryFn: () => companyOutreachApi.listSuppressions(companyId) });
  const leads = leadsQuery.data ?? [];
  return (
    <SystemRow
      testId="outreach-glance"
      icon={MailCheck}
      label="Outreach"
      value={connectionsQuery.isLoading ? "Reading receipts" : connectionsQuery.isError ? "State unavailable" : connection?.displayName ?? "No sender connected"}
      detail={connection
        ? `${campaignsQuery.isLoading ? "…" : (campaignsQuery.data ?? []).filter((item) => item.status === "active").length} campaigns · ${leadsQuery.isLoading ? "…" : leads.filter((item) => item.status === "eligible").length} eligible · ${suppressionsQuery.isLoading ? "…" : suppressionsQuery.data?.length ?? 0} suppressed`
        : "Bind an owner, Inbox, and provider"}
      to="/company/outreach"
    />
  );
}

function InboxGlance({ companyId }: { companyId: string }) {
  const connectorsQuery = useQuery({
    queryKey: queryKeys.companyInbox.connectors(companyId),
    queryFn: () => companyInboxApi.listConnectors(companyId),
  });
  const messagesQuery = useQuery({
    queryKey: queryKeys.companyInbox.messages(companyId),
    queryFn: () => companyInboxApi.listMessages(companyId, { limit: 200 }),
  });
  const notificationsQuery = useQuery({
    queryKey: queryKeys.companyInbox.notificationStatus(companyId),
    queryFn: () => companyInboxApi.notificationStatus(companyId),
  });
  const active = (connectorsQuery.data ?? []).filter((connector) => connector.status !== "revoked");
  const slack = active.find((connector) => connector.providerKey === "slack") ?? null;
  const unread = (messagesQuery.data ?? []).filter((message) => message.direction === "inbound" && message.status === "unread").length;
  const openCustomerWork = (messagesQuery.data ?? []).filter((message) =>
    message.direction === "inbound"
    && message.workIssue
    && !["done", "cancelled"].includes(message.workIssue.status),
  ).length;
  const hasError = active.some((connector) => connector.status === "error");

  return (
    <SystemRow
      testId="inbox-glance"
      icon={MessageSquareText}
      label="Customer channels"
      value={connectorsQuery.isLoading || messagesQuery.isLoading
        ? "Reading receipts"
        : connectorsQuery.isError || messagesQuery.isError
          ? "State unavailable"
          : active.length > 0
            ? `${active.length} governed source${active.length === 1 ? "" : "s"}`
            : "No customer channel connected"}
      detail={active.length > 0
        ? `${hasError ? "error" : "connected"} · ${unread} unread · ${openCustomerWork} customer task${openCustomerWork === 1 ? "" : "s"} open · Board alerts: ${notificationsQuery.data?.pending ?? 0} pending · ${(notificationsQuery.data?.failed ?? 0) + (notificationsQuery.data?.outcomeUnknown ?? 0)} need attention${slack ? ` · ${slack.accountLabel ?? "Slack"}` : ""}`
        : "Connect Gmail or one exact Slack channel"}
      to="/inbox/customers"
    />
  );
}

function AdsGlance({ companyId }: { companyId: string }) {
  const connectionsQuery = useQuery({
    queryKey: queryKeys.companyAds.connections(companyId),
    queryFn: () => companyAdsApi.listConnections(companyId),
  });
  const connection = (connectionsQuery.data ?? []).find((item) => item.connectionStatus !== "revoked")
    ?? connectionsQuery.data?.[0]
    ?? null;
  const campaignsQuery = useQuery({
    queryKey: queryKeys.companyAds.campaigns(companyId, connection?.id ?? "none"),
    queryFn: () => companyAdsApi.listCampaigns(companyId, connection!.id),
    enabled: !!connection,
  });
  const campaigns = campaignsQuery.data ?? [];
  const active = campaigns.filter((campaign) => campaign.status === "active");
  const spendCents = campaigns.reduce((total, campaign) => total + campaign.spentCents, 0);
  const clicks = campaigns.reduce((total, campaign) => total + campaign.clicks, 0);

  return (
    <SystemRow
      testId="ads-glance"
      icon={BadgeDollarSign}
      label="Ads"
      value={connectionsQuery.isLoading ? "Reading receipts" : connectionsQuery.isError ? "State unavailable" : connection?.displayName ?? "No ad account connected"}
      detail={connection
        ? `${campaignsQuery.isLoading ? "…" : active.length} running · ${campaignsQuery.isLoading ? "…" : formatCents(spendCents)} spend · ${clicks} clicks`
        : "Bind company account, token, and owner"}
      to="/company/ads"
    />
  );
}

function StackGlance({ companyId }: { companyId: string }) {
  const stacksQuery = useQuery({
    queryKey: queryKeys.companyStack.list(companyId),
    queryFn: () => companyStackApi.list(companyId),
  });
  const stacks = stacksQuery.data ?? [];
  const stack = stacks.find((item) => item.status !== "revoked") ?? stacks[0] ?? null;
  const resourceCount = stack
    ? [stack.githubRepositoryId, stack.neonProjectId, stack.vercelProjectId].filter(Boolean).length
    : 0;
  return (
    <SystemRow
      testId="stack-glance"
      icon={Boxes}
      label="Stack"
      value={stacksQuery.isLoading ? "Reading receipts" : stacksQuery.isError ? "State unavailable" : stack?.name ?? "No portable stack"}
      detail={stack ? `${stack.status} · ${resourceCount}/3 resources · ${stack.neonDatabaseSecretId ? "database encrypted" : "database pending"}` : "Provision into owner-controlled accounts"}
      to="/company/stack"
    />
  );
}

function formatPaymentMoney(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `${currency.toUpperCase()} ${(cents / 100).toFixed(2)}`;
  }
}

function formatFinanceMoney(cents: number, currency: string | null) {
  return formatPaymentMoney(cents, currency ?? "usd");
}

/** Format whole/near-whole hours cleanly: "12 h", "1.5 h", "0.5 h". */
function formatHours(minutes: number): string {
  const hours = minutes / 60;
  const label = Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
  return `${label} h`;
}

// Outcomes (30d) rollup line — OUTCOME-RECEIPTS.md §3. Four levers stay in
// separate figures; the $ @ $60/h is a parenthetical on hours, never folded
// into cash saved. The "from k receipts · u unmeasurable" tail is the honest
// denominator that makes the totals trustworthy; zero receipts reads "No
// receipts yet" rather than a fabricated $0.
function OutcomesRollup({ outcomes }: { outcomes: DashboardOutcomes }) {
  const totalReceipts = outcomes.receiptCount + outcomes.unmeasurableCount;
  return (
    <section aria-labelledby="outcomes-heading">
      <LiveSectionHeading id="outcomes-heading" title="Outcomes (30d)" />
      {totalReceipts === 0 ? (
        <p className="py-3 text-sm text-muted-foreground">No receipts yet</p>
      ) : (
        <>
          <div className="space-y-2 py-3 text-sm">
            <span>
              <span className="font-bold">{formatCents(outcomes.moneySavedCents)}</span> saved
            </span>
            <span className="block">
              <span className="font-bold">{formatHours(outcomes.timeSavedMinutes)}</span> saved{" "}
              <span className="text-muted-foreground">(≈ {formatCents(outcomes.timeValueCents)} @ $60/h)</span>
            </span>
            <span className="block">
              <span className="font-bold">{formatCents(outcomes.revenueMovedCents)}</span> revenue moved
            </span>
            <span className="block">
              <span className="font-bold">{outcomes.risksAvoided}</span>{" "}
              {outcomes.risksAvoided === 1 ? "risk avoided" : "risks avoided"}
            </span>
          </div>
          <p className="font-console text-xs text-muted-foreground">
            from {outcomes.receiptCount} {outcomes.receiptCount === 1 ? "receipt" : "receipts"} ·{" "}
            {outcomes.unmeasurableCount} marked unmeasurable
          </p>
        </>
      )}
    </section>
  );
}
