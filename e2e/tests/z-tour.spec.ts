import { test } from "@playwright/test";
import { signIn, signOut } from "./helpers";

// Chụp ảnh các màn hình chính để xem giao diện (không kiểm tra gì thêm).
const dir = "screenshots";

test.describe.configure({ mode: "serial" });

test("chụp màn hình giao diện", async ({ page }, info) => {
  test.setTimeout(300_000);
  const device = info.project.name;
  const shot = async (name: string) => {
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.screenshot({ path: `${dir}/${device}-${name}.png`, fullPage: true });
  };

  await page.goto("/");
  await shot("01-trang-chu");
  await page.goto("/tim-kiem?q=giai+tich");
  await shot("02-tim-kiem-khong-dau");
  await page.goto("/tim-kiem?q=giai+tihc");
  await shot("03-tim-kiem-go-sai");
  await page.goto("/vien");
  await shot("04-danh-sach-vien");
  await page.goto("/hoc-phan/MI1111");
  await shot("05-hoc-phan");
  const docHref = await page.locator('main a[href^="/tai-lieu/"]').first().getAttribute("href");
  await page.goto(docHref ?? "/");
  await shot("06-tai-lieu-khach");
  await page.goto("/dang-nhap");
  await shot("07-dang-nhap");
  if (device === "mobile") return;

  await signIn(page, "sv.demo@sis.hust.edu.vn", docHref ?? "/");
  await page.goto(docHref ?? "/");
  await page.waitForTimeout(2500);
  await shot("08-tai-lieu-doc-pdf");
  await page.goto("/tai-len");
  await shot("09-tai-len");
  await page.goto("/tai-lieu-cua-toi");
  await shot("10-tai-lieu-cua-toi");
  await page.goto("/thong-bao");
  await shot("11-thong-bao");

  await signOut(page);
  await signIn(page, "kdv.demo@hust.edu.vn", "/kiem-duyet");
  await page.goto("/kiem-duyet");
  await shot("12-hang-cho-kiem-duyet");
  const pending = page.locator('a[href^="/kiem-duyet/"]').filter({ hasNotText: "Báo cáo" });
  if ((await pending.count()) > 0) {
    await pending.first().click();
    await page.waitForTimeout(2500);
    await shot("13-chi-tiet-kiem-duyet");
  }

  await signOut(page);
  await signIn(page, "admin.demo@hust.edu.vn", "/quan-tri/hoc-phan");
  await page.goto("/quan-tri/hoc-phan");
  await shot("14-quan-tri-hoc-phan");
  await page.goto("/quan-tri/nguoi-dung");
  await shot("15-quan-tri-phan-quyen");

  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await shot("16-nen-toi");
  await page.context().addCookies([{ name: "locale", value: "en", url: "http://localhost:3000" }]);
  await page.goto("/tim-kiem?q=cau+truc+du+lieu");
  await shot("17-tieng-anh");
});
