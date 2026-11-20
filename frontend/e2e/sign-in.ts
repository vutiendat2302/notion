import { expect, type Page } from "@playwright/test";

export async function signInOrBootstrap(page: Page): Promise<void> {
  const marker = await page.request.get("/api/v1/__e2e__/transactional");
  expect(marker.ok(), "E2E must use the rollback-only backend").toBe(true);
  expect(await marker.json()).toEqual({ transactional: true });
  await page.goto("/login");
  await page.getByLabel("Email").fill("browser-e2e@example.com");
  await page.getByLabel("Password").fill("TestPassword123!");
  await page.locator("form").getByRole("button", { name: "Sign in" }).click();
  await page.waitForFunction(() => location.pathname === "/today" || Boolean(document.querySelector('[role="alert"]')));
  if (page.url().endsWith("/login")) {
    await page.getByRole("button", { name: "First-time Bootstrap" }).click();
    await page.getByLabel("Display name").fill("Browser E2E");
    await page.getByRole("button", { name: "Create Owner Workspace" }).click();
  }
  await expect(page).toHaveURL(/\/today$/);
}
