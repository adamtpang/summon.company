// vitals.data.js — the live demo dataset for vitals.run.
// This is vitals.run running its own vitals on itself. It powers index.html and /dashboard.html.
// Want your own? `npx github:adamtpang/vitals.run`, then ask Claude "interview me".

window.VITALS = {
  company: "vitals.run",
  tagline: "The operating dashboard for founders.",
  mission: "Give every founder one screen that tells the truth about their company.",
  problem:
    "The real state of a company is scattered across a spreadsheet, three docs, a notebook, and the founder's head. By the time it's assembled, it's already stale.",
  northStar: "Weekly active founders — people who logged their vitals this week.",

  // The knowledge base IS the codebase.
  knowledgeBase: [
    { file: "README.md", desc: "What it is and the three ways to use it" },
    { file: "schema.md", desc: "Every field the dashboard reads" },
    { file: "SKILL.md", desc: "How Claude runs the interview and the commands" },
  ],

  finances: { income: 0, expenses: 40, savings: 1850 },

  metrics: [
    { label: "Weekly active founders", value: 17, target: 50, hint: "north star", key: "northstar", next: "Ship the landing page, then post the demo in 3 founder communities" },
    { label: "Repos with vitals installed", value: 41, hint: "all-time", key: "installs" },
    { label: "Dashboards logged this week", value: 12, hint: "per week", key: "logs" },
  ],

  charts: [
    { label: "Weekly active founders", key: "northstar", color: "var(--amber)" },
    { label: "Repos installed", key: "installs", color: "var(--green)" },
  ],

  streak: 6,
  history: [
    { t: "May 12", northstar: 2, installs: 3, logs: 2, savings: 2000 },
    { t: "May 19", northstar: 5, installs: 9, logs: 4, savings: 1980 },
    { t: "May 26", northstar: 8, installs: 17, logs: 6, savings: 1955 },
    { t: "Jun 2", northstar: 11, installs: 26, logs: 8, savings: 1920 },
    { t: "Jun 9", northstar: 14, installs: 34, logs: 10, savings: 1890 },
    { t: "Jun 16", northstar: 17, installs: 41, logs: 12, savings: 1850 },
  ],

  goals: [
    { text: "Landing page live on vitals.run", done: true },
    { text: "10 founders logging weekly", done: true },
    { text: "50 weekly active founders", done: false },
    { text: "First founder asks 'can I pay for this'", done: false },
  ],

  products: [
    { name: "Core renderer + config", status: "Live" },
    { name: "npx one-line install", status: "Live" },
    { name: "React / Next wrapper", status: "Live" },
    { name: "Hosted sync (optional)", status: "Later" },
  ],

  roadmap: [
    { stage: "0 · Foundation", items: [
      { label: "Zero-dependency renderer", done: true },
      { label: "Portable config schema", done: true },
      { label: "Claude skill for the interview", done: true },
    ] },
    { stage: "1 · Dogfood", items: [
      { label: "Run it on my own companies", done: true },
      { label: "Landing page + live demo", done: true },
      { label: "Hold a 6-week logging streak", done: false },
    ] },
    { stage: "2 · Spin out", items: [
      { label: "Another founder asks to use it", done: false },
      { label: "One-command install in any stack", done: false },
      { label: "Decide: product, or stays internal", done: false },
    ] },
  ],

  org: [
    { fn: "Product & code", now: "Adam", next: "—" },
    { fn: "Distribution", now: "Adam", next: "First teammate" },
  ],

  decisions: [
    { date: "2026-06-16", decision: "Renamed Company OS to vitals.run", why: "\"The vital signs of your company\" is the one-line pitch; the .run domain says it's a living dashboard, not a doc.", revisit: "If the name tests worse than 'Company OS' with real founders." },
    { date: "2026-06-09", decision: "Stay zero-dependency and file-based", why: "Founders should own their data and drop it into any repo with no build step. Claude edits a plain JS file.", revisit: "If cross-device sync becomes the #1 request." },
  ],
};
