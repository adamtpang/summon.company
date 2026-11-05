import { expect, test } from "@playwright/test";

const TASK_TITLE = "Hire your first AI employee and create the operating plan";

test("captures planning mode UI for desktop and mobile", async ({ page }) => {
  const timestamp = Date.now();
  const companyName = `PAP-3413-${timestamp}`;
  const screenshotDir = "test-results/planning-mode";

  await page.route("**/test-environment", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ status: "pass", checks: [] }),
    }),
  );

  await page.route("**/agent-hires", async (route) => {
    const req = route.request();
    const body = JSON.parse(req.postData() || "{}");
    const auth = req.headers().authorization;
    const real = await fetch(new URL(req.url()).toString(), {
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

  await expect(page.getByRole("heading", { name: "Name the company" })).toBeVisible({ timeout: 15_000 });
  await page.locator('input[placeholder="Acme Corp"]').fill(companyName);
  await page.getByRole("button", { name: "Create company" }).click();

  // Fuel step — wait for the mocked probe to resolve before continuing, so
  // "Finish" below has a connected adapter to hire the CEO with. The
  // page.route mocks above add real per-request latency under load, so this
  // needs more headroom than a plain navigation.
  await expect(page.getByRole("heading", { name: "Connect your fuel" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Connected", { exact: false }).first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Pair the work" })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Finish without a repo" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });

  const baseOrigin = new URL(page.url()).origin;
  const companyRes = await page.request.get(`${baseOrigin}/api/companies`);
  expect(companyRes.ok()).toBe(true);
  const companies = await companyRes.json();
  const company = companies.find((c: { name: string }) => c.name === companyName);
  expect(company).toBeTruthy();
  const issueRes = await page.request.get(`${baseOrigin}/api/companies/${company.id}/issues`);
  expect(issueRes.ok()).toBe(true);
  const issues = await issueRes.json();
  const planningSeedIssue = issues.find(
    (candidate: { id: string; identifier?: string; title: string }) =>
      candidate.title === TASK_TITLE,
  );
  expect(planningSeedIssue).toBeTruthy();

  const issue = planningSeedIssue;
  const issueIdentifier = issue.identifier ?? issue.id;
  const issuePath = `/${company.issuePrefix ?? company.id}/issues/${issueIdentifier}`;
  const companyPrefix = company.issuePrefix ?? company.id;
  const issueLinkSelector = `a[href$="/issues/${issueIdentifier}"]`;

  const setMode = async (mode: "standard" | "planning") => {
    const patchRes = await page.request.patch(`${baseOrigin}/api/issues/${issue.id}`, {
      data: { workMode: mode },
    });
    expect(patchRes.ok()).toBe(true);
    await expect
      .poll(async () => {
        const currentRes = await page.request.get(`${baseOrigin}/api/issues/${issue.id}`);
        expect(currentRes.ok()).toBe(true);
        const current = await currentRes.json();
        return current.workMode;
      }, { timeout: 10_000 })
      .toBe(mode);
  };

  await setMode("planning");

  await page.goto(issuePath);
  await expect(page.getByText("Plan mode").first()).toBeVisible();
  await expect(page.getByTestId("issue-chat-composer")).toHaveAttribute("data-pending-work-mode", "planning");
  const desktopPlanningToggle = page.getByTestId("issue-chat-composer-work-mode-toggle");
  await expect(desktopPlanningToggle).toBeVisible();
  await expect(desktopPlanningToggle).toHaveAttribute("data-pending-work-mode", "planning");
  await expect(desktopPlanningToggle).toHaveAttribute("aria-pressed", "true");

  await page.screenshot({
    path: `${screenshotDir}/desktop-planning-detail-${timestamp}.png`,
    fullPage: true,
  });

  await page.goto(`/${companyPrefix}/issues`);
  await expect(page.locator(issueLinkSelector)).toBeVisible();
  await expect(page.locator(issueLinkSelector)).not.toContainText("Plan mode");
  await page.screenshot({
    path: `${screenshotDir}/desktop-planning-row-${timestamp}.png`,
    fullPage: true,
  });

  await page.goto(issuePath);
  await page.getByTestId("issue-chat-composer-work-mode-toggle").click();
  await page.getByTestId("issue-chat-composer-work-mode-menu-standard").click();
  await expect(page.getByTestId("issue-chat-composer")).toHaveAttribute("data-pending-work-mode", "standard");
  await expect(page.getByTestId("issue-chat-composer-work-mode-toggle")).toHaveAttribute("data-pending-work-mode", "standard");
  await expect(page.getByTestId("issue-chat-composer-work-mode-toggle")).toHaveAttribute("aria-pressed", "false");
  await page.screenshot({
    path: `${screenshotDir}/desktop-standard-toggle-${timestamp}.png`,
    fullPage: true,
  });

  await setMode("planning");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(issuePath);
  await expect(page.getByText("Plan mode").first()).toBeVisible();
  const mobilePlanningToggle = page.getByTestId("issue-chat-composer-work-mode-toggle");
  await expect(mobilePlanningToggle).toBeVisible();
  await expect(mobilePlanningToggle).toHaveAttribute("data-pending-work-mode", "planning");
  await expect(mobilePlanningToggle).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({
    path: `${screenshotDir}/mobile-planning-detail-${timestamp}.png`,
    fullPage: true,
  });

  await page.goto(`/${companyPrefix}/issues`);
  await expect(page.locator(issueLinkSelector)).toBeVisible();
  await expect(page.locator(issueLinkSelector)).not.toContainText("Plan mode");
  await page.screenshot({
    path: `${screenshotDir}/mobile-planning-row-${timestamp}.png`,
    fullPage: true,
  });
});
