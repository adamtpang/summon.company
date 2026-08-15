import { test, expect } from "@playwright/test";

/**
 * E2E: post-wizard onboarding launch.
 *
 * Completing the onboarding wizard hires a CEO agent (when fuel is
 * connected), creates the first assigned task, and lands the user on the
 * company dashboard. The chat intro still has unit coverage in BoardChat
 * tests; the wizard handoff no longer routes there.
 */

const COMPANY_NAME = `E2E-TypingIntro-${Date.now()}`;
const FIRST_TASK_TITLE = "Hire your first AI employee and create the operating plan";

test.describe("Dashboard launch after onboarding wizard", () => {
  test("creates the first task and opens the dashboard", async ({
    page,
    baseURL,
  }) => {
    // Intercept the fuel probe → instant "connected" (avoid running a real CLI check).
    await page.route("**/test-environment", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ status: "pass", checks: [] }),
      }),
    );

    // Intercept hire → perform a REAL hire server-side with an inert http
    // adapter so no real agent process spawns.
    await page.route("**/agent-hires", async (route) => {
      const req = route.request();
      const body = JSON.parse(req.postData() || "{}");
      const auth = req.headers().authorization;
      const real = await fetch(new URL(req.url(), baseURL).toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(auth ? { Authorization: auth } : {}),
        },
        body: JSON.stringify({
          name: body.name,
          role: body.role,
          adapterType: "http",
          adapterConfig: { url: "http://127.0.0.1:1/dead" },
          runtimeConfig: { heartbeat: { enabled: false } },
        }),
      });
      await route.fulfill({
        status: real.status,
        contentType: "application/json",
        body: await real.text(),
      });
    });

    await page.goto("/onboarding");

    // Step 1: company name.
    await expect(
      page.getByRole("heading", { name: "Name the company" }),
    ).toBeVisible({ timeout: 15_000 });
    await page.getByPlaceholder("Acme Corp").fill(COMPANY_NAME);
    await page.getByRole("button", { name: "Create company" }).click();

    // Step 2: fuel. Wait for the mocked probe to resolve so the CEO hire
    // that "Finish" triggers actually has a connected adapter to use. The
    // page.route mocks above add real per-request latency (every request,
    // matched or not, round-trips through Playwright to decide whether to
    // intercept it), so this step needs more headroom than a plain
    // navigation under load — 30s, matching the finish/dashboard wait below.
    await expect(
      page.getByRole("heading", { name: "Connect your fuel" }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Connected", { exact: false }).first()).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 3: repo pairing — skip it. "Finish" hires the CEO, creates the
    // first task, and opens the dashboard.
    await expect(
      page.getByRole("heading", { name: "Pair the work" }),
    ).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Finish without a repo" }).click();

    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });

    const companiesRes = await page.request.get("/api/companies");
    expect(companiesRes.ok()).toBe(true);
    const companies = await companiesRes.json();
    const company = companies.find((candidate: { name: string }) => candidate.name === COMPANY_NAME);
    expect(company).toBeTruthy();

    const issuesRes = await page.request.get(`/api/companies/${company.id}/issues`);
    expect(issuesRes.ok()).toBe(true);
    const issues = await issuesRes.json();
    const firstTask = issues.find((candidate: { title: string }) => candidate.title === FIRST_TASK_TITLE);
    expect(firstTask).toBeTruthy();
    await expect(page.getByText(FIRST_TASK_TITLE).first()).toBeVisible({ timeout: 15_000 });
  });
});
