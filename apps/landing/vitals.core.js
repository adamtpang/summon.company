/* vitals.core.js — the framework-agnostic Vitals renderer.
 *
 * UMD: loads as a plain <script> (sets window.Vitals), and imports as a
 * module in bundlers (Vite/Next/etc).
 *
 *   Vitals.render(data)        -> HTML string (inner content for a .vitals element)
 *   Vitals.mount(el, data)     -> sets el.innerHTML and adds the .vitals class
 *
 * The data shape is documented in schema.md. Every field is optional; the
 * renderer degrades gracefully, so old and new data files both work.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Vitals = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var DEFAULT_LEVELS = [[0, "Day 1"], [1, "Founder"], [6, "Builder"], [13, "Operator"], [21, "Captain"], [30, "CEO"]];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c];
    });
  }
  function fmt(n) { return "$" + Math.round(Number(n) || 0).toLocaleString("en-US"); }
  function tone(s) { return s === "Live" ? "var(--green)" : (s === "Building" || s === "Next") ? "var(--amber)" : "var(--mut)"; }

  function spark(arr, color) {
    arr = (arr || []).filter(function (v) { return typeof v === "number"; });
    if (arr.length < 2) return '<div class="muted small" style="height:60px;display:grid;place-items:center">Log two or more weeks to see the trend.</div>';
    var w = 260, h = 60, max = Math.max.apply(null, arr), min = Math.min.apply(null, arr), rng = (max - min) || 1;
    var pts = arr.map(function (v, i) {
      var x = (i / (arr.length - 1)) * w, y = h - ((v - min) / rng) * (h - 8) - 4;
      return x.toFixed(1) + "," + y.toFixed(1);
    }).join(" ");
    return '<svg width="100%" viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="none" style="height:60px"><polyline fill="none" stroke="' + color + '" stroke-width="2" points="' + pts + '"/></svg>';
  }

  function checkbox(on) {
    return '<span class="ck" style="border-color:' + (on ? "var(--green)" : "var(--line)") + ";background:" + (on ? "var(--green)" : "transparent") + '">' + (on ? "&#10003;" : "") + "</span>";
  }

  function render(d) {
    d = d || {};
    var TIERS = d.levels || DEFAULT_LEVELS;
    var roadmap = d.roadmap || [];
    var html = "";

    // level / xp
    var total = 0, done = 0;
    roadmap.forEach(function (st) { (st.items || []).forEach(function (it) { total++; if (it.done) done++; }); });
    var tier = TIERS.slice().reverse().find(function (t) { return done >= t[0]; }) || TIERS[0];
    var nextT = TIERS.find(function (t) { return t[0] > done; });
    var xp = total ? Math.min(100, ((done - tier[0]) / Math.max(1, (nextT ? nextT[0] : total) - tier[0])) * 100) : 0;

    // money
    var f = d.finances || { income: 0, expenses: 0, savings: 0 };
    var burn = (f.expenses || 0) - (f.income || 0), prof = burn <= 0;
    var runway = prof ? Infinity : (f.savings || 0) / burn;
    var rc = prof || runway >= 12 ? "var(--green)" : runway >= 6 ? "var(--amber)" : "var(--danger)";
    var rp = prof ? 100 : Math.min(100, (runway / 18) * 100);

    html += '<div class="wrap">';

    // header
    html += '<div class="card flex between" style="padding:20px;flex-wrap:wrap;gap:14px">'
      + '<div><div class="mono small muted" style="letter-spacing:.1em;text-transform:uppercase">' + esc(d.company || "Company") + " &middot; founder level</div>"
      + '<div class="disp" style="font-size:26px;font-weight:800">' + esc(tier[1]) + "</div>"
      + '<div class="muted small">' + esc(d.tagline || "") + "</div></div>"
      + '<div class="flex" style="gap:8px;border:1px solid var(--line);border-radius:12px;padding:10px 16px;background:var(--panel2)">'
      + '<span style="font-size:20px">&#128293;</span><span class="disp tnum" style="font-size:22px;font-weight:800">' + (d.streak || 0) + '</span><span class="muted small">day streak</span></div>'
      + "</div>";
    html += '<div style="margin-top:12px"><div class="flex between small muted" style="margin-bottom:5px"><span>' + done + " of " + total + " milestones</span><span>" + (nextT ? "next: " + esc(nextT[1]) : "max level") + '</span></div><div class="bar"><div class="barfill" style="width:' + xp + '%;background:var(--amber)"></div></div></div>';

    // money
    html += '<div class="h">Money</div><div class="row c3">';
    [["Income / mo", f.income], ["Expenses / mo", f.expenses], ["Savings", f.savings]].forEach(function (p) {
      html += '<div class="card"><div class="muted small" style="margin-bottom:6px">' + p[0] + '</div><div class="disp tnum" style="font-size:22px;font-weight:800">' + fmt(p[1]) + "</div></div>";
    });
    html += '</div><div class="row c2" style="margin-top:12px">'
      + '<div class="card flex between"><span class="muted small">Net burn / mo</span><span class="disp tnum" style="font-size:18px;font-weight:800;color:' + (prof ? "var(--green)" : "var(--ink)") + '">' + (prof ? "profitable" : fmt(burn)) + "</span></div>"
      + '<div class="card"><div class="flex between" style="margin-bottom:8px"><span class="muted small">Runway</span><span class="disp tnum" style="font-size:18px;font-weight:800;color:' + rc + '">' + (prof ? "infinite" : runway.toFixed(1) + " mo") + '</span></div><div class="bar"><div class="barfill" style="width:' + rp + '%;background:' + rc + '"></div></div><div class="muted small" style="margin-top:6px">target: 18 months</div></div>'
      + "</div>";

    // trends
    var hist = d.history || [];
    var charts = d.charts || [{ label: "Cash on hand", key: "savings", color: "var(--green)" }];
    html += '<div class="h">Trends</div><div class="row c2">';
    charts.forEach(function (c) {
      var series = hist.map(function (x) { return x[c.key]; });
      html += '<div class="card"><div class="muted small" style="margin-bottom:8px">' + esc(c.label) + "</div>" + spark(series, c.color || "var(--amber)") + "</div>";
    });
    html += "</div>";

    // metrics (north star + weekly inputs); supports value/target/next
    if (d.metrics && d.metrics.length) {
      html += '<div class="h">North star and weekly inputs</div><div class="row c3">';
      d.metrics.forEach(function (m) {
        var val = '<span class="disp tnum" style="font-size:22px;font-weight:800">' + (m.value != null ? m.value : 0) + "</span>";
        if (m.target != null && m.target !== "") val += '<span class="muted" style="font-size:14px"> / ' + esc(m.target) + "</span>";
        html += '<div class="card"><div class="flex between" style="margin-bottom:6px"><span class="muted small">' + esc(m.label) + '</span><span class="mono small muted">' + esc(m.hint || "") + "</span></div><div>" + val + "</div>"
          + (m.next ? '<div class="next">&rarr; ' + esc(m.next) + "</div>" : "") + "</div>";
      });
      html += "</div>";
    }

    // quarterly goals
    if (d.goals && d.goals.length) {
      html += '<div class="h">Quarterly goals</div><div class="card">';
      d.goals.forEach(function (g) {
        html += '<div class="flex" style="gap:10px;margin-bottom:9px">' + checkbox(g.done) + '<span style="' + (g.done ? "color:var(--mut);text-decoration:line-through" : "") + '">' + esc(g.text) + "</span></div>";
      });
      html += "</div>";
    }

    // problem + products
    html += '<div class="row c2" style="margin-top:8px"><div><div class="h">The problem</div><div class="card">' + esc(d.problem || "") + "</div></div>"
      + '<div><div class="h">Products</div><div class="card">';
    (d.products || []).forEach(function (p) {
      html += '<div class="flex between" style="margin-bottom:9px"><span style="font-weight:600;font-size:13.5px">' + esc(p.name) + '</span><span class="chip" style="color:' + tone(p.status) + ";border-color:" + tone(p.status) + '">' + esc(p.status) + "</span></div>";
    });
    html += "</div></div></div>";

    // roadmap
    if (roadmap.length) {
      html += '<div class="h">The roadmap</div><div class="row">';
      roadmap.forEach(function (st) {
        var items = st.items || [], sd = items.filter(function (i) { return i.done; }).length, pct = items.length ? Math.round((sd / items.length) * 100) : 0;
        html += '<div class="card"><div class="flex between" style="margin-bottom:10px"><span class="disp" style="font-size:15px;font-weight:700">' + esc(st.stage) + '</span><span class="mono tnum small" style="color:' + (pct === 100 ? "var(--green)" : "var(--mut)") + '">' + sd + "/" + items.length + "</span></div>"
          + '<div class="bar" style="height:6px;margin-bottom:12px"><div class="barfill" style="width:' + pct + "%;background:" + (pct === 100 ? "var(--green)" : "var(--amber)") + '"></div></div>';
        items.forEach(function (it) {
          html += '<div class="flex" style="gap:9px;margin-bottom:7px">' + checkbox(it.done) + '<span class="small" style="' + (it.done ? "color:var(--mut);text-decoration:line-through" : "") + '">' + esc(it.label) + "</span></div>";
        });
        html += "</div>";
      });
      html += "</div>";
    }

    // org
    if (d.org && d.org.length) {
      html += '<div class="h">Org chart</div><div class="row c3">';
      d.org.forEach(function (o) {
        html += '<div class="card"><div class="disp" style="font-size:14.5px;font-weight:700;margin-bottom:6px">' + esc(o.fn) + '</div><div class="muted small">Now: <span style="color:var(--ink)">' + esc(o.now) + '</span></div><div class="muted small" style="margin-top:2px">Next hire: ' + esc(o.next || "") + "</div></div>";
      });
      html += "</div>";
    }

    // decision log
    if (d.decisions && d.decisions.length) {
      html += '<div class="h">Decision log</div><div class="row">';
      d.decisions.forEach(function (dec) {
        html += '<div class="card"><div class="flex between" style="margin-bottom:5px;gap:10px"><span class="disp" style="font-weight:700;font-size:14.5px">' + esc(dec.decision) + '</span><span class="mono small muted" style="flex:0 0 auto">' + esc(dec.date || "") + "</span></div>"
          + '<div class="muted small">' + esc(dec.why || "") + "</div>"
          + (dec.revisit ? '<div class="small" style="color:var(--amber);margin-top:5px">Revisit: ' + esc(dec.revisit) + "</div>" : "") + "</div>";
      });
      html += "</div>";
    }

    // knowledge base
    if (d.knowledgeBase && d.knowledgeBase.length) {
      html += '<div class="h">Knowledge base (this codebase)</div><div class="card">';
      html += '<div class="muted small" style="margin-bottom:10px">Vitals is tied to the repo. These context files are the source of truth that Claude reads and updates.</div>';
      d.knowledgeBase.forEach(function (k) {
        html += '<a class="kb" href="../' + esc(k.file) + '"><span class="mono" style="color:var(--amber)">' + esc(k.file) + '</span> <span class="muted small">' + esc(k.desc || "") + "</span></a>";
      });
      html += "</div>";
    }

    html += '<div class="muted small" style="margin-top:20px;padding-top:16px;border-top:1px solid var(--line)">Read-only view. Source of truth is <span class="mono">vitals.data.js</span>, kept in sync with the context files. To update, edit that file or ask Claude (log a week, check off a milestone, update a metric, add a decision), then refresh.</div>';

    html += "</div>"; // .wrap
    return html;
  }

  function mount(el, data) {
    if (!el) return;
    if (el.classList) el.classList.add("vitals");
    el.innerHTML = render(data || {});
  }

  return { render: render, mount: mount, version: "1.0.0" };
});
