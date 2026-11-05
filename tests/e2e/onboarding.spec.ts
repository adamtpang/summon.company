import { test, expect } from "@playwright/test";

/**
 * E2E: Onboarding wizard flow.
 *
 * The wizard is a flat 3-step flow (board ruling VIT-128, 2026-07-17 — see
 * OnboardingWizard.tsx): name the company, connect fuel (the customer's own
 * Claude/Codex subscription), pair a repo. Company name is the only
 * required input; nothing else gates the company existing.
 *
 * This test covers the deterministic, LLM-free core: it drives the wizard
 * through company naming, skips fuel (no CLI installed in CI) and repo
 * pairing, and verifies the company is created and the wizard hands off to
 * the dashboard without crashing.
 */

const COMPANY_NAME = `E2E-Test-${Date.now()}`;

test.describe("Onboarding wizard", () => {
  test("name-only path: creates the company and reaches the dashboard", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto("/onboarding");

    // Step 1 — Name the company.
    await expect(
      page.getByRole("heading", { name: "Name the company" }),
    ).toBeVisible({ timeout: 15_000 });
    await page.getByPlaceholder("Acme Corp").fill(COMPANY_NAME);
    await page.getByRole("button", { name: "Create company" }).click();

    // Step 2 — Connect your fuel. No CLI is installed in CI, so both
    // providers stay unconnected; "Continue" doesn't require fuel.
    await expect(
      page.getByRole("heading", { name: "Connect your fuel" }),
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 3 — Pair the work. Skip the repo to keep the run deterministic.
    await expect(
      page.getByRole("heading", { name: "Pair the work" }),
    ).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Finish without a repo" }).click();

    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });

    // Verify the company was persisted.
    const baseUrl = page.url().split("/").slice(0, 3).join("/");
    const companiesRes = await page.request.get(`${baseUrl}/api/companies`);
    expect(companiesRes.ok()).toBe(true);
    const companies = await companiesRes.json();
    const company = companies.find(
      (c: { name: string }) => c.name === COMPANY_NAME,
    );
    expect(company, `company ${COMPANY_NAME} should exist`).toBeTruthy();

    // The wizard must not crash the app.
    expect(pageErrors, pageErrors.join("\n")).toHaveLength(0);
  });
});
