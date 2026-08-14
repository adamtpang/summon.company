import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildPersonaOverlaySection,
  resolvePersonaOverlay,
} from "@paperclipai/shared";
import { agentInstructionsService } from "../services/agent-instructions.js";

/**
 * SUM-253 acceptance, exercised against the REAL runtime path:
 * agentInstructionsService().reconcilePersonaOverlay recovers the managed
 * instruction bundle from disk (the exact file the next run reads via
 * --append-system-prompt-file) and rewrites its `## Your persona:` overlay.
 *
 * We seed a Finance (Ledger) bundle wearing the default Rockefeller persona,
 * flip metadata.persona to warren-buffett, and prove the on-disk register
 * shifts to Buffett's moats/hold-forever doctrine while governance survives.
 */

const COMPANY_ID = "sum253-company";
const AGENT_ID = "sum253-ledger";

let homeDir: string;
let entryPath: string;
const priorHome = process.env.PAPERCLIP_HOME;

function financeBundle(personaSlug: string): string {
  const overlay = buildPersonaOverlaySection(resolvePersonaOverlay(personaSlug)!);
  return [
    "# Vitals CFO",
    "",
    "You own Finance leadership for vitals.run.",
    "",
    "Operating rules:",
    "",
    "- Never move money or send outbound without board approval.",
    "",
    overlay,
    "",
  ].join("\n");
}

beforeAll(async () => {
  homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "sum253-"));
  process.env.PAPERCLIP_HOME = homeDir;
  const instructionsDir = path.join(
    homeDir,
    "instances",
    "default",
    "companies",
    COMPANY_ID,
    "agents",
    AGENT_ID,
    "instructions",
  );
  await fs.mkdir(instructionsDir, { recursive: true });
  entryPath = path.join(instructionsDir, "AGENTS.md");
  // Seed the managed bundle wearing the default Finance persona (Rockefeller).
  await fs.writeFile(entryPath, financeBundle("john-d-rockefeller"), "utf8");
});

afterAll(async () => {
  if (priorHome === undefined) delete process.env.PAPERCLIP_HOME;
  else process.env.PAPERCLIP_HOME = priorHome;
  await fs.rm(homeDir, { recursive: true, force: true }).catch(() => {});
});

describe("reconcilePersonaOverlay — real managed bundle", () => {
  const agent = {
    id: AGENT_ID,
    companyId: COMPANY_ID,
    name: "Ledger",
    adapterConfig: {}, // no explicit bundle keys — recovered from disk, like a live agent
  };

  it("shifts the Finance register from Rockefeller to Buffett on disk", async () => {
    const service = agentInstructionsService();

    // Precondition: the seeded file carries Rockefeller's cost-accounting doctrine.
    const before = await fs.readFile(entryPath, "utf8");
    expect(before).toContain("respect the smallest figure");
    expect(before).toContain("John D. Rockefeller");
    expect(before).not.toContain("wonderful businesses");

    const result = await service.reconcilePersonaOverlay(agent, "warren-buffett");

    expect(result.changed).toBe(true);
    expect(result.appliedSlug).toBe("warren-buffett");
    expect(result.entryPath).toBe(entryPath);

    const after = await fs.readFile(entryPath, "utf8");
    // Register shifted to Buffett...
    expect(after).toContain("Warren Buffett");
    expect(after).toContain("wonderful businesses at fair prices");
    // ...Rockefeller doctrine gone...
    expect(after).not.toContain("respect the smallest figure");
    expect(after).not.toContain("John D. Rockefeller");
    // ...governance + body preserved verbatim outside the overlay.
    expect(after).toContain("# Vitals CFO");
    expect(after).toContain("- Never move money or send outbound without board approval.");
    expect(after.match(/## Your persona:/g)?.length).toBe(1);
  });

  it("is idempotent and reports no change on the second reconcile", async () => {
    const service = agentInstructionsService();
    const result = await service.reconcilePersonaOverlay(agent, "warren-buffett");
    expect(result.changed).toBe(false);
  });

  it("no-ops for an unknown slug (default agents untouched)", async () => {
    const service = agentInstructionsService();
    const snapshot = await fs.readFile(entryPath, "utf8");
    const result = await service.reconcilePersonaOverlay(agent, "napoleon-bonaparte");
    expect(result.changed).toBe(false);
    expect(await fs.readFile(entryPath, "utf8")).toBe(snapshot);
  });
});
