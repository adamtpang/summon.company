// vitals.data.example.js — the starter template.
// Copy to `vitals.data.js` and fill in, or drop this folder into a repo and
// ask Claude "interview me" to populate it from the repo's context files.
//
// Every field is optional; the dashboard degrades gracefully. Full schema: schema.md.
// PRIVACY: if your finance numbers are real, gitignore vitals.data.js.

window.VITALS = {
  company: "Your Company",
  tagline: "One line on what you do.",
  mission: "The 25-year why.",
  problem: "The problem you solve, and exactly who has it.",
  northStar: "The one output number that means you are winning.",

  // The knowledge base IS the codebase. List the repo's context files.
  knowledgeBase: [
    { file: "README.md", desc: "Project overview" },
  ],

  finances: { income: 0, expenses: 0, savings: 0 },

  // Inputs you control. value = what is, target = what should be (optional),
  // next = the single action to close the gap (optional). key = which history field to chart.
  metrics: [
    { label: "North star metric", value: 0, target: null, hint: "", key: "northstar", next: "" },
    { label: "Weekly input 1", value: 0, hint: "per week", key: "input1" },
    { label: "Weekly input 2", value: 0, hint: "per week", key: "input2" },
  ],

  // Which history keys to chart as trends.
  charts: [
    { label: "North star growth", key: "northstar", color: "var(--amber)" },
    { label: "Cash on hand", key: "savings", color: "var(--green)" },
  ],

  streak: 0,
  history: [], // Claude appends weekly: { t: "Jun 13", northstar: 40, savings: 12000, ... }

  goals: [
    { text: "Quarterly goal 1", done: false },
    { text: "Quarterly goal 2", done: false },
    { text: "Quarterly goal 3", done: false },
  ],

  products: [
    { name: "Product or service", status: "Live" }, // Live | Building | Next | Later
  ],

  // Gated roadmap. Check items off (done: true) to level up.
  roadmap: [
    { stage: "0 · Foundation", items: [
      { label: "First milestone", done: false },
      { label: "Second milestone", done: false },
    ] },
  ],

  org: [
    { fn: "Function", now: "(owner)", next: "(first hire)" },
  ],

  // Optional: capture the WHY behind decisions so it never gets lost.
  decisions: [
    // { date: "2026-01-01", decision: "What we decided", why: "The reasoning", revisit: "What would change our mind" },
  ],

  // Optional: override the gamified level names.
  // levels: [[0,"Day 1"],[1,"Founder"],[6,"Builder"],[13,"Operator"],[21,"Captain"],[30,"CEO"]],
};
