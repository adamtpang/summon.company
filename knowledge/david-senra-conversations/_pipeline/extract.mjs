// Founders Podcast transcript extractor — pulls transcripts THROUGH youchop.app/api/transcripts
// (dogfooding the user's own app). Sequential, polite, idempotent, stops on failure.
// Usage: node extract.mjs [fromRank] [toRank]   (defaults 1 20)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const DIR = "C:/Users/adamp/AppData/Local/Temp/claude/C--Users-adamp-OneDrive-Aether-youchop-app/6872292e-96bf-4063-8032-455d4cbc4ff3/scratchpad";
const STAGING = process.env.STAGING_DIR || DIR + "/_staging";
mkdirSync(STAGING, { recursive: true });
const ENDPOINT = "https://youchop.app/api/transcripts";
const PAUSE_MS = 3500;

const meta = JSON.parse(readFileSync(process.env.METADATA_PATH || DIR + "/metadata.json", "utf8"));
const from = Number(process.argv[2] || 1), to = Number(process.argv[3] || 20);
const batch = meta.filter((m) => m.rank >= from && m.rank <= to);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0, skipped = 0, failed = 0;

console.log(`Extracting ranks ${from}-${to} (${batch.length} episodes) via youchop.app…\n`);

for (const m of batch) {
  const out = `${STAGING}/${String(m.rank).padStart(3, "0")}.json`;
  if (existsSync(out)) { console.log(`  [${m.rank}] SKIP (already staged) — ${m.title}`); skipped++; continue; }
  try {
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [m.id], lang: "en" }),
    });
    if (r.status === 429 || r.status === 402 || r.status === 403) {
      const b = await r.json().catch(() => ({}));
      console.log(`\n  ⛔ [${m.rank}] provider limit hit (HTTP ${r.status}: ${b.error || ""}). Stopping to be polite.`);
      console.log(`  → ${ok} extracted this run before the cap. Re-run 'node extract.mjs ${m.rank} ${to}' after the quota resets.`);
      break;
    }
    const d = await r.json().catch(() => null);
    const t = d && d.transcripts && d.transcripts[0];
    if (!r.ok || !t || !t.ok || !t.text) {
      console.log(`  ✗ [${m.rank}] no transcript (HTTP ${r.status}) — ${m.title}`);
      failed++;
      if (failed >= 3) { console.log(`\n  ⛔ 3 consecutive-ish failures — stopping and reporting rather than hammering.`); break; }
      await sleep(PAUSE_MS); continue;
    }
    failed = 0;
    writeFileSync(out, JSON.stringify({
      rank: m.rank, id: m.id, title: t.title || m.title, author: t.author || "Founders Podcast",
      url: "https://www.youtube.com/watch?v=" + m.id, published: m.published, views: m.views,
      duration_s: m.duration_s, language: t.language || "en", provider: d.provider,
      description: m.description, words: (t.text.trim().match(/\S+/g) || []).length, text: t.text,
    }, null, 1), "utf8");
    ok++;
    console.log(`  ✓ [${m.rank}] ${(t.text.length / 1024 | 0)}KB, ${(t.text.trim().match(/\S+/g) || []).length} words — ${t.title || m.title}`);
    await sleep(PAUSE_MS);
  } catch (e) {
    console.log(`  ✗ [${m.rank}] error: ${String(e.message || e).slice(0, 80)}`);
    failed++;
    if (failed >= 3) { console.log(`\n  ⛔ repeated errors — stopping.`); break; }
    await sleep(PAUSE_MS);
  }
}
console.log(`\nDone: ${ok} extracted, ${skipped} skipped, ${failed} failed this run.`);
