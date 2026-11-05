import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Visual QA screenshot capture.
 *
 * Boots a throwaway local_trusted instance (see playwright.config.ts webServer)
 * and captures screenshots of the current onboarding wizard (board ruling
 * VIT-128, 2026-07-17 — a flat 3-step flow: name the company, connect fuel,
 * pair a repo) plus the Conference Room surfaces gated behind the
 * `enableConferenceRoomChat` experimental flag:
 *   - Onboarding wizard steps 1–3
 *   - Conference Room (BoardChat) shell + composer + activity feed
 *   - Artifacts page
 *
 * These are structural/rendering checks. Screenshots land in
 * ./nux-phase4-shots for upload as evidence.
 */

// Write under the gitignored test-results dir so re-runs leave no untracked
// noise; screenshots are uploaded to the issue as QA evidence, not committed.
const SHOT_DIR = path.join(__dirname, "test-results", "nux-phase4-shots");

function shot(name: string) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  return path.join(SHOT_DIR, name);
}

test.describe("Visual QA", () => {
  test("captures the onboarding wizard and Conference Room surfaces", async ({ page }) => {
    // Conference Room surfaces are flag-gated default-OFF: turn the
    // experimental flag on for this throwaway instance before driving them.
    const flagRes = await page.request.patch("/api/instance/settings/experimental", {
      data: { enableConferenceRoomChat: true },
    });
    expect(flagRes.ok()).toBe(true);

    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push("PAGEERROR: " + err.message));

    const baseUrl =
      "http://127.0.0.1:" + (process.env.PAPERCLIP_E2E_PORT ?? "3199");

    // ── Section A: onboarding wizard (name → fuel → repo) ──────────────────
    await page.goto("/onboarding");
    await expect(
      page.getByRole("heading", { name: "Name the company" }),
    ).toBeVisible({ timeout: 15_000 });
    await page.getByPlaceholder("Acme Corp").fill("QA Robotics");
    await page.screenshot({ path: shot("01-name-company.png") });

    await page.getByRole("button", { name: "Create company" }).click();
    await expect(
      page.getByRole("heading", { name: "Connect your fuel" }),
    ).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: shot("02-connect-fuel.png") });

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(
      page.getByRole("heading", { name: "Pair the work" }),
    ).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: shot("03-pair-the-work.png") });

    // "Finish without a repo" still creates the company (name is the only
    // required input); it anchors the route-scoped sections below.
    await page.getByRole("button", { name: "Finish without a repo" }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });

    const companiesRes = await page.request.get(`${baseUrl}/api/companies`);
    expect(companiesRes.ok()).toBe(true);
    const companies = await companiesRes.json();
    const qaCompany = (Array.isArray(companies) ? companies : []).find(
      (c: { name: string }) => c.name === "QA Robotics",
    );
    expect(qaCompany, "wizard should have created QA Robotics").toBeTruthy();
    const prefix: string = qaCompany.issuePrefix;

    // ── Section B: Conference Room (BoardChat) ─────────────────────────────
    // Visit the company dashboard first so CompanyContext selects the company
    // from the route before we land on the board-chat surface.
    await page.goto(`/${prefix}/dashboard`);
    await page.waitForLoadState("networkidle");
    await page.goto(`/${prefix}/board-chat`);
    await expect(page).toHaveURL(new RegExp(`/${prefix}/board-chat`));
    // Composer renders once a company is selected. (Regression guard for the
    // Rules-of-Hooks crash that previously blanked this page — see PAP-50.)
    await expect(
      page.getByPlaceholder("Ask anything about your company..."),
    ).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(2_000); // let welcome bubble + suggestion chips stage in
    await page.screenshot({ path: shot("04-board-chat.png") });

    // ── Section C: Artifacts ────────────────────────────────────────────────
    await page.goto(`/${prefix}/artifacts`);
    await expect(page).toHaveURL(new RegExp(`/${prefix}/artifacts`));
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1_000);
    await page.screenshot({ path: shot("05-artifacts.png") });

    for (const f of [
      "01-name-company.png",
      "02-connect-fuel.png",
      "03-pair-the-work.png",
      "04-board-chat.png",
      "05-artifacts.png",
    ]) {
      const p = shot(f);
      expect(fs.existsSync(p), `missing ${f}`).toBe(true);
      expect(fs.statSync(p).size, `empty ${f}`).toBeGreaterThan(1_000);
    }

    // No React Rules-of-Hooks / render crashes on any surface we visited.
    const hookErrors = consoleErrors.filter(
      (e) => /Rendered more hooks|change in the order of Hooks/i.test(e),
    );
    expect(hookErrors, hookErrors.join("\n")).toHaveLength(0);
  });
});
