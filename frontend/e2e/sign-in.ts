import { expect, type Page } from "@playwright/test";

export async function signInOrBootstrap(page: Page): Promise<void> {
  const marker = await page.request.get("/api/v1/__e2e__/transactional");
  expect(marker.ok(), "E2E must use the rollback-only backend").toBe(true);
  expect(await marker.json()).toEqual({ transactional: true });
  await page.goto("/login");
  await page.getByLabel("Email hoặc Số điện thoại").fill("browser-e2e@example.com");
  const password = page.getByLabel("Mật khẩu");
  await password.fill("TestPassword123!");
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Hiện mật khẩu" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(password).toHaveValue("TestPassword123!");
  await page.getByRole("button", { name: "Ẩn mật khẩu" }).click();
  await expect(password).toHaveAttribute("type", "password");
  await page.locator("form").getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForFunction(
    () => location.pathname === "/today" || Boolean(document.querySelector('[role="alert"]'))
  );
  if (page.url().endsWith("/login")) {
    await page.getByRole("link", { name: "Đăng ký ngay" }).click();
    await page.getByLabel("Tên hiển thị").fill("Browser E2E");
    await page.getByLabel(/Email/).fill("browser-e2e@example.com");
    await page.getByLabel("Mật khẩu").fill("TestPassword123!");
    await page.locator("form").getByRole("button", { name: "Đăng ký" }).click();
  }
  await expect(page).toHaveURL(/\/today$/);
}
