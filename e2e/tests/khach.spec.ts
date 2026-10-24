import { expect, test } from "@playwright/test";

test.describe("khách chưa đăng nhập", () => {
  test("trang chủ hiển thị số liệu và tài liệu mới duyệt", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Hôm nay ôn môn gì?" })).toBeVisible();
    await expect(page.getByText("Tài liệu đã duyệt", { exact: true })).toBeVisible();
    await expect(page.locator('a[href^="/tai-lieu/"]').first()).toBeVisible();
  });

  test("tìm không dấu ra kết quả có dấu, từ khóa được gạch chân", async ({ page }) => {
    await page.goto("/tim-kiem?q=giai+tich");
    await expect(page.getByRole("heading", { name: /kết quả cho “giai tich”/ })).toBeVisible();
    const firstMark = page.locator("main mark").first();
    await expect(firstMark).toBeVisible();
    await expect(firstMark).toHaveText(/giải|tích/i);
  });

  test("gõ sai chính tả vẫn có kết quả gần đúng", async ({ page }) => {
    await page.goto("/tim-kiem?q=giai+tihc");
    await expect(page.locator('a[href^="/tai-lieu/"]').first()).toBeVisible();
  });

  test("gợi ý mã học phần khi gõ", async ({ page }) => {
    await page.goto("/tim-kiem");
    await page.getByRole("combobox", { name: "Tìm tài liệu" }).fill("MI11");
    await expect(page.getByRole("option", { name: /^MI1111/ })).toBeVisible();
  });

  test("trang học phần và trang tài liệu chỉ cho xem vài trang đầu", async ({ page }) => {
    await page.goto("/hoc-phan/MI1111");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("MI1111");
    await page.locator('main a[href^="/tai-lieu/"]').first().click();
    await expect(page.getByText(/Khách xem được \d+ trang đầu/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Đăng nhập để tải xuống" })).toBeVisible();
  });

  test("trang cần đăng nhập chuyển về trang đăng nhập", async ({ page }) => {
    await page.goto("/tai-len");
    await expect(page).toHaveURL(/\/dang-nhap\?next=%2Ftai-len/);
  });

  test("email ngoài trường bị từ chối", async ({ page }) => {
    await page.goto("/dang-nhap");
    await page.getByLabel("Email trường").fill("ai.do@gmail.com");
    await page.getByRole("button", { name: "Gửi mã đăng nhập" }).click();
    await expect(page.getByText(/Chỉ nhận email trường/)).toBeVisible();
  });
});
