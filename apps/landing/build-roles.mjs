// Programmatic SEO builder for SUM-134 lane 2: one template x many pages.
// Run from apps/landing: `node build-roles.mjs`
//   -> writes roles/index.html + roles/ai-employee-for-<slug>.html for each role
//   -> rewrites the <!--ROLES--> block of sitemap.xml
// House rule: real, distinct content per page (thin doorway pages get slapped),
// grounded ONLY in verified facts: the founding offer = one founding seat at
// $500/mo that staffs all eight departments (company diagnosis + AI org chart +
// first 10 deliverables in week one); first plated deliverable within 7 days or
// your first month back; 15 minutes a week; cancel anytime.
// Approval-gating + budget caps, the core-8 departments. No em dashes in copy.
import fs from "node:fs";

const SITE = "https://summon.company";
// One purchase surface: the landing founding section owns checkout links.
const FOUNDING = "/#founding";
const TODAY = "2026-07-29";

// The core-8. Each role is a real department this company runs on.
const roles = [
  {
    slug: "marketing",
    role: "Marketing",
    search: "marketing",
    lede: "Positioning, content, and search that keep working after you close the tab. Here is what an AI marketer does inside the $500 founding seat, and what still needs your yes.",
    does: [
      "Drafts positioning and messaging from evidence in your own product and customers, not slogans.",
      "Writes SEO pages and blog posts on a set cadence, with clean headings and schema so both people and search engines can read them.",
      "Keeps a content calendar and turns every shipped win into a story worth publishing.",
      "Researches competitors and the market, then hands you a brief instead of a hunch.",
      "Writes landing-page and email copy, ready for you to approve and send.",
      "Runs the referral and community loops that compound reach over time.",
    ],
    approve: "Publishing anything public, sending outbound messages, and any ad spend. It drafts; you post.",
    faqs: [
      ["What does an AI marketing employee actually produce?", "Finished, postable drafts: SEO pages, blog posts, positioning, landing-page copy, and competitor briefs. Everything is grounded in evidence from your product and customers, and nothing goes public until you approve it."],
      ["Will it publish or run ads on its own?", "No. Public posts, outbound messages, and ad spend are approval-gated. The work is drafted freely and waits in a queue for your yes."],
    ],
  },
  {
    slug: "sales",
    role: "Sales",
    search: "sales",
    lede: "Pipeline that fills itself with research and drafts, so your daylight goes to the calls that close. Here is what an AI sales employee does, and what stays in your hands.",
    does: [
      "Builds prospect lists and researches each account before you ever open a call.",
      "Writes personalized outreach drafts, not templated spam, from real context on the buyer.",
      "Keeps follow-up sequences warm so no lead goes cold while you sleep.",
      "Cleans and updates the CRM: pipeline stages, notes, next steps.",
      "Prepares a one-page brief for every call: who they are, why now, what to say.",
      "Drafts proposals and quotes for you to review and send.",
    ],
    approve: "Hitting send on any outreach, offering a discount, and signing a contract. Nothing reaches a prospect without your yes.",
    faqs: [
      ["Does the AI send emails to prospects by itself?", "No. Outreach is drafted and queued; you approve each send. That keeps your name and your inbox reputation in your control."],
      ["How is this different from a bulk email tool?", "A blast tool sends the same message to everyone. An AI sales employee researches each account and drafts a message for that buyer, then waits for your approval to send."],
    ],
  },
  {
    slug: "engineering",
    role: "Engineering",
    search: "engineering",
    lede: "A night shift for your codebase: bugs fixed, tests written, docs kept current, all waiting for your review by morning. Here is what an AI engineer does, and where you stay in the loop.",
    does: [
      "Fixes bugs and ships small features against the tasks you write.",
      "Writes and updates tests so changes do not quietly break things.",
      "Reviews code and flags risky changes before they land.",
      "Handles the refactors and cleanups that never make the top of the list.",
      "Keeps documentation current as the code moves.",
    ],
    approve: "Merging to production and any infrastructure spend. It opens the work for review; you decide what ships.",
    faqs: [
      ["Can the AI deploy to production without me?", "No. Merges and deploys are approval-gated, and every department runs inside a budget cap. The downside is bounded by design."],
      ["What size of work is this good for?", "Well-scoped tasks: a bug, a small feature, a test suite, a refactor, a doc update. You write the task; it does the work and hands it back for review."],
    ],
  },
  {
    slug: "support",
    role: "Customer Support",
    search: "customer support",
    lede: "An inbox that never falls behind: triaged, tagged, and answered with drafts grounded in your own docs. Here is what an AI support employee does, and what you still approve.",
    does: [
      "Triages the inbox and sorts tickets by urgency and topic.",
      "Drafts replies grounded in your help docs and product facts, not guesses.",
      "Tags and routes each ticket to the right place.",
      "Spots recurring issues and flags the pattern so the same fire stops repeating.",
    ],
    approve: "Sending replies to customers and issuing refunds. It writes the answer; you approve before it reaches the customer.",
    faqs: [
      ["Does it reply to customers automatically?", "No. Replies are drafted and queued for your approval. You keep the final word on every customer-facing message."],
      ["How does it avoid making things up?", "It answers from your own docs and product facts. When it does not have a grounded answer, it flags the ticket instead of inventing one."],
    ],
  },
  {
    slug: "operations",
    role: "Operations",
    search: "operations",
    lede: "Turn recurring chaos into systems: SOPs, runbooks, and workflows written once so the same problem never costs you twice. Here is what an AI operations employee does.",
    does: [
      "Writes SOPs and runbooks for the tasks you keep redoing.",
      "Documents processes so they live in a system, not just in your head.",
      "Tracks vendors and tools and what each one costs.",
      "Sets up task and project workflows that route work automatically.",
    ],
    approve: "Signing up for paid tools and making any vendor commitment. It designs the system; you approve the spend.",
    faqs: [
      ["What does an AI operations employee hand me?", "Concrete systems: an SOP, a checklist, a runbook, or a workflow map, plus the single highest-leverage thing to systematize next."],
      ["Will it commit us to new tools or vendors?", "No. Paid signups and vendor commitments are approval-gated. It proposes; you decide."],
    ],
  },
  {
    slug: "research",
    role: "Research",
    search: "research",
    lede: "Homework done right: markets, competitors, and evidence summarized with citations you can trust. Here is what an AI research employee does inside the $500 founding seat.",
    does: [
      "Researches markets and competitors and hands you a brief, not a hunch.",
      "Summarizes long sources down to the facts that matter, with citations.",
      "Builds the evidence base your other decisions rest on.",
      "Checks claims before they go into anything public.",
    ],
    approve: "Any conclusion you plan to publish or act on with money. The research is yours to check before it leaves the building.",
    faqs: [
      ["Can I trust what the research employee reports?", "Findings come with citations so you can check the source. It is built to cite, not to assert, and to flag uncertainty instead of hiding it."],
      ["Does it work continuously?", "Yes. Research runs while you sleep, inside a budget cap, and leaves the brief waiting for you in the morning."],
    ],
  },
  {
    slug: "finance",
    role: "Finance",
    search: "finance",
    lede: "The boring numbers, kept current: invoices drafted, expenses categorized, receipts and runway math ready before you ask. Here is what an AI finance employee does.",
    does: [
      "Drafts invoices for you to review and send.",
      "Categorizes expenses so the books stay clean.",
      "Builds receipts and simple reports that show where the money went.",
      "Keeps runway and burn math current so there are no surprises.",
    ],
    approve: "Sending invoices, moving any money, and filing anything official. It prepares; you authorize.",
    faqs: [
      ["Can the AI move money or pay bills by itself?", "No. Anything that touches money, sending an invoice or making a payment, is approval-gated and waits for your yes."],
      ["Is this a replacement for an accountant?", "No. It keeps the day-to-day numbers current and drafts the routine work; a licensed accountant still handles filings and advice."],
    ],
  },
  {
    slug: "chief-of-staff",
    role: "Chief of Staff",
    search: "chief of staff",
    lede: "The one who turns a goal into tasks, routes each to the right department, and reports back to you. Here is what an AI chief of staff does across your whole company.",
    does: [
      "Breaks a goal into tasks and routes each to the right department.",
      "Keeps the whole company moving without you chasing every thread.",
      "Sends you a daily status report: what shipped, what is blocked, what is next.",
      "Flags the one bottleneck that most constrains progress this week.",
    ],
    approve: "Strategy calls, hiring, and any spend approval. It coordinates the work; the direction stays yours.",
    faqs: [
      ["Do I still make the decisions?", "Yes. The chief of staff routes and reports; you set direction and approve anything that matters. You are the board."],
      ["How does it keep the other employees on track?", "It assigns tasks, watches for blockers, and reports back daily, so the departments cover each other instead of stalling."],
    ],
  },
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const attr = (s) => esc(s).replace(/"/g, "&quot;");

const LOGO = `<svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true"><defs><mask id="sg" maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32"><rect width="32" height="32" fill="#fff"/><path d="M1.5 16 H10 L13 10.5 L16.5 22 L19 16 H30.5" fill="none" stroke="#000" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/></mask></defs><rect width="32" height="32" rx="7.5" fill="#FFFFFF" stroke="#0A0A0A" stroke-opacity="0.16"/><circle cx="16" cy="16" r="10.5" fill="none" stroke="#0A0A0A" stroke-width="3" mask="url(#sg)"/><path d="M1.5 16 H10 L13 10.5 L16.5 22 L19 16 H30.5" fill="none" stroke="#0A0A0A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const STYLE = `<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #ffffff; color: #0a0a0a; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; line-height: 1.65; font-size: 16px; }
  .page { max-width: 44rem; margin: 0 auto; padding: 2.5rem 1.25rem 5rem; }
  header.site { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 2.5rem; }
  header.site a { display: inline-flex; align-items: center; gap: 0.6rem; color: inherit; text-decoration: none; font-weight: 600; }
  h1 { font-size: 2rem; letter-spacing: -0.02em; margin: 0 0 0.5rem; line-height: 1.2; }
  .meta { color: #8a8a8a; font-size: 0.85rem; margin: 0 0 2rem; }
  .lede { font-size: 1.15rem; color: #3a3a3a; margin: 0 0 2rem; }
  h2 { font-size: 1.3rem; letter-spacing: -0.01em; margin: 2.5rem 0 0.75rem; }
  h3 { font-size: 1.05rem; margin: 1.75rem 0 0.5rem; }
  p { margin: 0 0 1rem; }
  ul, ol { margin: 0 0 1rem; padding-left: 1.25rem; }
  li { margin: 0.35rem 0; }
  a { color: #0a0a0a; }
  strong { font-weight: 600; }
  .cta { display: block; margin: 2.5rem 0; padding: 1.5rem; border: 1px solid rgba(0,0,0,0.14); border-radius: 12px; }
  .cta h2 { margin-top: 0; }
  .btn { display: inline-block; margin-top: 0.5rem; padding: 0.7rem 1.2rem; background: #0a0a0a; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; }
  .fine { color: #8a8a8a; font-size: 0.85rem; }
  .roles { list-style: none; padding: 0; margin: 1.5rem 0 0; }
  .roles li { margin: 0; }
  .roles a { display: block; text-decoration: none; color: inherit; padding: 1rem 0; border-top: 1px solid rgba(0,0,0,0.1); }
  .roles a:hover strong { text-decoration: underline; }
  footer.post { margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid rgba(0,0,0,0.1); color: #8a8a8a; font-size: 0.85rem; }
  @media (prefers-color-scheme: dark) {
    body { background: #0a0a0a; color: #f2f2f2; }
    .lede { color: #d0d0d0; }
    .meta, .fine, footer.post { color: #888; }
    .cta { border-color: rgba(255,255,255,0.16); }
    .btn { background: #f2f2f2; color: #0a0a0a; }
    a { color: #f2f2f2; }
    .roles a { border-color: rgba(255,255,255,0.14); }
  }
</style>`;

const headerHtml = (rightHref, rightText) => `  <header class="site">
    <a href="/" aria-label="Summon home">
      ${LOGO}
      Summon
    </a>
    <a href="${rightHref}" style="font-size:.9rem;">${rightText}</a>
  </header>`;

const ctaHtml = (role) => `  <div class="cta">
    <h2>Hire your AI ${esc(role)} employee</h2>
    <p>Start with the one role that is your bottleneck this month. You do not buy this employee on its own: the founding seat is $500 per month and staffs all eight departments, including a full company diagnosis, your AI org chart, and your first 10 deliverables plated in week one.</p>
    <a class="btn" href="${FOUNDING}">Claim a founding seat, $500/mo</a>
    <p class="fine">First plated deliverable within 7 days or your first month back. 15 minutes a week from you. Cancel anytime.</p>
  </div>`;

const footerHtml = `  <footer class="post">
    <p>Summon runs its own company on these employees. See the daily proof on the <a href="/changelog">build log</a>, read the full guide on the <a href="/blog">blog</a>, or start your own company at <a href="/">summon.company</a>.</p>
  </footer>`;

function rolePage(r) {
  const url = `${SITE}/roles/ai-employee-for-${r.slug}`;
  const h1 = `An AI Employee for ${r.role}`;
  const title = `AI Employee for ${r.role} · Summon`;
  const desc = `Hire an AI ${r.role.toLowerCase()} employee that works 24/7, included in the $500 a month founding seat that staffs all eight departments. What it does, what you approve, and how it plugs into your company.`;
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: r.faqs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };
  const serviceLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: `AI ${r.role} employee`,
    provider: { "@type": "Organization", name: "Summon", url: SITE },
    description: desc,
    offers: { "@type": "Offer", price: "500", priceCurrency: "USD", url },
    areaServed: "Worldwide",
  };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${attr(desc)}" />
<link rel="canonical" href="${url}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${attr(h1)}" />
<meta property="og:description" content="${attr(desc)}" />
<meta property="og:image" content="${SITE}/og.png" />
<meta property="og:url" content="${url}" />
<meta name="twitter:card" content="summary_large_image" />
${STYLE}
<script type="application/ld+json">
${JSON.stringify(serviceLd, null, 2)}
</script>
<script type="application/ld+json">
${JSON.stringify(faqLd, null, 2)}
</script>
</head>
<body>
<div class="page">
${headerHtml("/roles/", "All roles")}

  <article>
  <h1>${esc(h1)}</h1>
  <p class="meta">AI employee · ${esc(r.role)} · included in the $500 seat</p>

  <p class="lede">${esc(r.lede)}</p>

  <p>You do not need another seat on the payroll. You need a ${esc(r.role.toLowerCase())} teammate that never sleeps, never forgets, and costs less than lunch. With Summon, <strong>you are the board and your ${esc(r.role.toLowerCase())} employee is AI</strong>: it does the work around the clock, inside a budget you set, and anything that touches the outside world waits for your approval.</p>

  <h2>What an AI ${esc(r.role)} employee does</h2>
  <ul>
${r.does.map((d) => `    <li>${esc(d)}</li>`).join("\n")}
  </ul>

  <h2>What stays with you</h2>
  <p>${esc(r.approve)} Summon employees are <strong>approval-gated by default</strong>: they draft freely, but every outward action lands in a decisions queue for your yes or no. Because the whole thing runs on a budget cap, the downside is bounded.</p>

  <h2>What it costs</h2>
  <ul>
    <li><strong>Founding seat: $500 per month.</strong> All eight departments staffed, not one employee, and not one person's salary.</li>
    <li><strong>Included in the seat.</strong> A full company diagnosis, your AI org chart, and your first 10 deliverables plated in week one. First plated deliverable within 7 days or your first month back. Cancel anytime.</li>
  </ul>

${ctaHtml(r.role)}

  <h2>Frequently asked questions</h2>
${r.faqs.map(([q, a]) => `  <h3>${esc(q)}</h3>\n  <p>${esc(a)}</p>`).join("\n")}
  <h3>How is this different from ChatGPT?</h3>
  <p>ChatGPT answers one prompt at a time. Summon gives you a standing ${esc(r.role.toLowerCase())} teammate with a task board, a budget, and approvals, and the work continues after you close the tab.</p>

  </article>

${footerHtml}
</div>
</body>
</html>
`;
}

function indexPage() {
  const url = `${SITE}/roles`;
  const title = "AI Employees by Role · Summon";
  const desc = "Hire an AI employee for any role: marketing, sales, engineering, support, operations, research, finance, or chief of staff. One founding seat, $500 a month, staffs all eight departments.";
  const itemLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: roles.map((r, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `AI Employee for ${r.role}`,
      url: `${SITE}/roles/ai-employee-for-${r.slug}`,
    })),
  };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${attr(desc)}" />
<link rel="canonical" href="${url}" />
<meta property="og:title" content="${attr(title)}" />
<meta property="og:description" content="${attr(desc)}" />
<meta property="og:image" content="${SITE}/og.png" />
${STYLE}
<script type="application/ld+json">
${JSON.stringify(itemLd, null, 2)}
</script>
</head>
<body>
<div class="page">
${headerHtml("/#founding", "Become a founding member")}
  <h1>An AI employee for every role</h1>
  <p class="lede">Pick the role that is your bottleneck this month. Each is an AI employee that works 24/7, drafts the work, and waits for your approval before anything reaches the outside world. One founding seat, $500 a month, staffs all eight of them.</p>
  <ul class="roles">
${roles.map((r) => `    <li><a href="/roles/ai-employee-for-${r.slug}"><strong>AI Employee for ${esc(r.role)}</strong></a></li>`).join("\n")}
  </ul>
${footerHtml}
</div>
</body>
</html>
`;
}

// --- write files ---
fs.mkdirSync("roles", { recursive: true });
fs.writeFileSync("roles/index.html", indexPage());
for (const r of roles) {
  fs.writeFileSync(`roles/ai-employee-for-${r.slug}.html`, rolePage(r));
}

// --- rewrite the <!--ROLES--> block of sitemap.xml ---
const smPath = "sitemap.xml";
let sm = fs.readFileSync(smPath, "utf8");
const roleUrls =
  `  <url>\n    <loc>${SITE}/roles</loc>\n    <lastmod>${TODAY}</lastmod>\n    <changefreq>weekly</changefreq>\n  </url>\n` +
  roles
    .map(
      (r) =>
        `  <url>\n    <loc>${SITE}/roles/ai-employee-for-${r.slug}</loc>\n    <lastmod>${TODAY}</lastmod>\n    <changefreq>monthly</changefreq>\n  </url>`,
    )
    .join("\n");
const block = `  <!--ROLES-->\n${roleUrls}\n  <!--/ROLES-->`;
if (sm.includes("<!--ROLES-->")) {
  sm = sm.replace(/  <!--ROLES-->[\s\S]*?  <!--\/ROLES-->/, block);
} else {
  sm = sm.replace(/<\/urlset>/, `${block}\n</urlset>`);
}
fs.writeFileSync(smPath, sm);

console.log(`Wrote roles/index.html + ${roles.length} role pages; sitemap updated.`);
