import { expect, test } from "@playwright/test";

function todayInVietnam(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

test("owner can plan an occurrence, manage checklist and open Calendar", async ({ page }) => {
  const marker = await page.request.get("/api/v1/__e2e__/transactional");
  expect(marker.ok(), "E2E must use the rollback-only backend").toBe(true);
  expect(await marker.json()).toEqual({ transactional: true });

  await page.goto("/login");
  await page.getByRole("button", { name: "First-time Bootstrap" }).click();
  await page.getByLabel("Display name").fill("Browser E2E");
  await page.getByLabel("Email").fill("browser-e2e@example.com");
  await page.getByLabel("Password").fill("TestPassword123!");
  await page.getByRole("button", { name: "Create Owner Workspace" }).click();
  await expect(page).toHaveURL(/\/today$/);

  await page.goto("/tasks");
  await page.getByRole("textbox", { name: "Quick add task" }).fill("E2E planning task");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("button", { name: "E2E planning task", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "E2E planning task", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: /Chi tiết E2E planning task/ });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Checklist" }).click();
  await dialog.getByRole("textbox", { name: "Tên mục checklist" }).fill("E2E checklist item");
  await dialog.getByRole("button", { name: "Thêm", exact: true }).click();
  await expect(dialog.getByText("E2E checklist item")).toBeVisible();
  await dialog.getByRole("checkbox", { name: "Hoàn thành E2E checklist item" }).click();
  await expect(dialog.getByRole("checkbox", { name: "Hoàn thành E2E checklist item" })).toBeChecked();

  await dialog.getByRole("button", { name: "Chi tiết", exact: true }).click();
  await dialog.getByRole("button", { name: "Bắt đầu" }).click();
  await expect(dialog.getByText("Đang thực hiện", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Hoàn thành", exact: true }).click();
  await expect(dialog.getByText("Hoàn thành", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Mở lại" }).click();
  await dialog.getByLabel("Ngày thực hiện").fill(todayInVietnam());
  await dialog.getByRole("button", { name: "Lưu ngày" }).click();
  await dialog.getByRole("button", { name: "Đóng chi tiết task" }).click();

  await page.goto("/planning");
  await expect(page.getByRole("button", { name: "E2E planning task", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Chuyển mục chưa xong sang kỳ sau" }).click();
  await expect(page.getByRole("dialog", { name: "Xác nhận chuyển kỳ" })).toBeVisible();
  await page.getByRole("dialog", { name: "Xác nhận chuyển kỳ" }).getByRole("button", { name: "Hủy" }).click();

  await page.goto("/calendar");
  await expect(page.getByText("E2E planning task", { exact: true })).toBeVisible();
  await expect(page.getByText("Chưa xếp lịch", { exact: true })).toBeVisible();
});
