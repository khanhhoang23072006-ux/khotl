import { expect, test } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { signIn, signOut } from "./helpers";

/** PDF có nội dung khác hẳn bài e2e của sinh viên, để không bị coi là bản gần giống. */
async function makeSlidePdf(marker: string): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const topics = ["ngan xep", "hang doi", "cay nhi phan", "bang bam", "do thi", "sap xep nhanh", "quy hoach dong"];
  for (let i = 1; i <= 2; i++) {
    const page = pdf.addPage([595, 842]);
    page.drawText(`Slide on tap ${marker} phan ${i}`, { x: 60, y: 780, size: 14, font });
    for (let line = 0; line < 20; line++) {
      const topic = topics[(line + i) % topics.length];
      page.drawText(`Muc ${marker}-${i}-${line}: ${topic} ${marker} vi du minh hoa ${line * 7 + i}`, {
        x: 60,
        y: 740 - line * 22,
        size: 11,
        font,
      });
    }
  }
  return Buffer.from(await pdf.save());
}

test("kiểm duyệt viên đăng tài liệu thì công khai ngay, không vào hàng chờ", async ({ page }) => {
  test.setTimeout(240_000);
  const marker = `KDV${Date.now()}`;
  const title = `Slide ôn tập CTDL ${marker}`;

  await signIn(page, "kdv.demo@hust.edu.vn", "/tai-len");
  await page.goto("/tai-len");
  await expect(page.getByText(/công khai ngay, không cần chờ duyệt/)).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: `slide-${marker}.pdf`,
    mimeType: "application/pdf",
    buffer: await makeSlidePdf(marker),
  });
  await expect(page.getByText("Xong", { exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Học phần").fill("IT3011");
  await page.getByRole("option").filter({ hasText: "IT3011" }).first().click();
  await page.getByLabel("Loại tài liệu").selectOption("SLIDE");
  await page.getByLabel("Tiêu đề").fill(title);
  await page.getByRole("checkbox", { name: /Tôi xác nhận có quyền chia sẻ/ }).check();
  await page.getByRole("button", { name: "Gửi kiểm duyệt" }).click();
  await expect(page.getByRole("heading", { name: "Đã nhận tài liệu của bạn" })).toBeVisible();

  // Worker kiểm tra tự động xong là "Đã duyệt", không qua bước "Chờ duyệt"
  await page.goto("/tai-lieu-cua-toi");
  const row = page.locator("li").filter({ hasText: title });
  await expect(async () => {
    await page.reload();
    await expect(row.getByText("Đã duyệt")).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 120_000 });

  // Không nằm trong hàng chờ kiểm duyệt
  await page.goto("/kiem-duyet");
  await expect(page.getByRole("link", { name: title })).toHaveCount(0);

  // Khách tìm thấy ngay
  await signOut(page);
  await page.goto(`/tim-kiem?q=${encodeURIComponent(marker.toLowerCase())}`);
  await expect(page.getByRole("link", { name: new RegExp(marker) })).toBeVisible();
});
