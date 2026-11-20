import { expect, test } from "@playwright/test";
import { signInOrBootstrap } from "./sign-in";

test("owner can save a plan, pin an occurrence, manage a project and preferences", async ({ page }) => {
  await signInOrBootstrap(page);
  await page.goto("/tasks");
  const title = `FE3 task ${Date.now()}`;
  await page.getByRole("textbox", { name: "Quick add task" }).fill(title);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("button", { name: title, exact: true })).toBeVisible();
  await page.getByRole("button", { name: title, exact: true }).click();
  const detail = page.getByRole("dialog", { name: `Chi tiết ${title}` });
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value;
  await detail.getByLabel("Ngày thực hiện").fill(`${part("year")}-${part("month")}-${part("day")}`);
  await detail.getByRole("button", { name: "Lưu ngày" }).click();
  await detail.getByRole("button", { name: "Đóng chi tiết task" }).click();

  await page.goto("/planning");
  await expect(page.getByRole("button", { name: title, exact: true })).toBeVisible();
  await page.getByLabel("Tên kế hoạch").fill("FE3 weekly focus");
  await page.getByLabel("Trọng tâm").fill("Validate backend planning");
  await page.getByRole("button", { name: "Lưu kế hoạch" }).click();
  await expect(page.getByText("Phiên bản 1")).toBeVisible();
  await page.getByRole("button", { name: "Ghim", exact: true }).last().click();
  await expect(page.getByText("1 mục", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Chuyển mục chưa xong sang kỳ sau" }).click();
  const rollover = page.getByRole("dialog", { name: "Xác nhận chuyển kỳ" });
  await expect(rollover.getByText(title)).toBeVisible();
  await rollover.getByLabel("Dời lịch").check();
  await rollover.getByText(title).locator("..").getByRole("checkbox").check();
  await rollover.getByRole("button", { name: "Chuyển 1 mục" }).click();
  await expect(rollover).toHaveCount(0);

  await page.goto("/projects");
  await page.getByRole("button", { name: "Tạo project" }).click();
  await page.getByLabel("Tên project").fill("FE3 project");
  await page.getByRole("button", { name: "Lưu project" }).click();
  await expect(page.getByRole("button", { name: /FE3 project/ })).toBeVisible();
  await page.getByRole("button", { name: /FE3 project/ }).click();
  await expect(page.getByRole("heading", { name: "FE3 project" })).toBeVisible();
  await page.getByRole("button", { name: "Sửa", exact: true }).click();
  await page.getByLabel("Tên project").fill("FE3 project updated");
  await page.getByRole("button", { name: "Lưu project" }).click();
  await expect(page.getByRole("heading", { name: "FE3 project updated" })).toBeVisible();

  await page.goto("/settings");
  await expect(page.getByLabel("Múi giờ IANA")).toHaveValue("Asia/Ho_Chi_Minh");
  await page.getByLabel("Ngày đầu tuần").selectOption("7");
  await page.getByRole("button", { name: "Lưu cài đặt" }).click();
  await expect(page.getByLabel("Ngày đầu tuần")).toHaveValue("7");
  await page.reload();
  await expect(page.getByLabel("Ngày đầu tuần")).toHaveValue("7");
  await page.getByLabel("Ngày đầu tuần").selectOption("1");
  await page.getByRole("button", { name: "Lưu cài đặt" }).click();
  await page.getByLabel("Tên danh mục mới").fill("FE3 category");
  await page.getByRole("button", { name: "Thêm", exact: true }).click();
  await expect(page.getByText("FE3 category")).toBeVisible();

  await page.goto("/calendar");
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("button", { name: "More navigation" }).click();
  await page.getByRole("link", { name: "Projects", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Dự án của bạn" })).toBeVisible();
});
