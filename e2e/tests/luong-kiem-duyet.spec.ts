import { expect, test } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { signIn, signOut } from "./helpers";

/** PDF nhỏ có nội dung riêng để không trùng SHA-256 với tài liệu mẫu. */
async function makePdf(marker: string): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 2; i++) {
    const page = pdf.addPage([595, 842]);
    page.drawText(`De thi thu Giai tich ${marker} trang ${i}`, { x: 60, y: 780, size: 14, font });
    for (let line = 0; line < 20; line++) {
      page.drawText(`Cau ${line + 1}. Tinh tich phan va dao ham ham so ${marker}.`, {
        x: 60,
        y: 740 - line * 22,
        size: 11,
        font,
      });
    }
  }
  return Buffer.from(await pdf.save());
}

test("sinh viên tải lên, kiểm duyệt viên duyệt, tài liệu xuất hiện khi tìm kiếm", async ({ page }) => {
  test.setTimeout(240_000);
  const marker = `E2E${Date.now()}`;
  const title = `Đề thi thử Giải tích ${marker}`;

  // 1. Sinh viên đăng nhập và tải file lên
  await signIn(page, "sv.demo@sis.hust.edu.vn", "/tai-len");
  await page.goto("/tai-len");
  await page.locator('input[type="file"]').setInputFiles({
    name: `de-thi-thu-${marker}.pdf`,
    mimeType: "application/pdf",
    buffer: await makePdf(marker),
  });
  await expect(page.getByText("Xong", { exact: true })).toBeVisible({ timeout: 30_000 });

  await page.getByLabel("Học phần").fill("MI1111");
  await page.getByRole("option").filter({ hasText: "MI1111" }).first().click();
  await page.getByLabel("Loại tài liệu").selectOption("EXAM_FINAL");
  await page.getByLabel("Tiêu đề").fill(title);
  await page.getByLabel("Thẻ").fill("ôn thi, tích phân");
  await page.getByRole("checkbox", { name: /Tôi xác nhận có quyền chia sẻ/ }).check();
  await page.getByRole("button", { name: "Gửi kiểm duyệt" }).click();
  await expect(page.getByRole("heading", { name: "Đã nhận tài liệu của bạn" })).toBeVisible();

  // 2. Worker kiểm tra xong thì tài liệu chuyển sang "Chờ duyệt"
  await page.goto("/tai-lieu-cua-toi");
  const row = page.locator("li").filter({ hasText: title });
  await expect(async () => {
    await page.reload();
    await expect(row.getByText("Chờ duyệt")).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 120_000 });

  // 3. Kiểm duyệt viên duyệt
  await signOut(page);
  await signIn(page, "kdv.demo@hust.edu.vn", "/kiem-duyet");
  await page.goto("/kiem-duyet");
  await page.getByRole("link", { name: title }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Đạt" }).first()).toBeVisible();
  const reviewPath = new URL(page.url()).pathname;
  await page.getByRole("button", { name: "Duyệt 1" }).click();
  // Sau khi duyệt, trang chuyển sang tài liệu kế tiếp hoặc về hàng chờ
  await page.waitForURL((url) => url.pathname !== reviewPath);

  // 4. Tài liệu đã công khai: tìm không dấu thấy ngay
  await signOut(page);
  await page.goto(`/tim-kiem?q=${encodeURIComponent(marker.toLowerCase())}`);
  await expect(page.getByRole("link", { name: new RegExp(marker) })).toBeVisible();
  await page.getByRole("link", { name: new RegExp(marker) }).click();
  await expect(page.locator(".stamp").filter({ hasText: "Đã duyệt" })).toBeVisible();
});
