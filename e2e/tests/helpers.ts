import { expect, type Page } from "@playwright/test";

const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";

interface MailpitList {
  messages: { ID: string; Subject: string; To: { Address: string }[]; Created: string }[];
}

/** Lấy mã OTP mới nhất gửi tới `email` từ Mailpit (mã nằm ở đầu tiêu đề email). */
export async function latestOtp(email: string, after: Date): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const response = await fetch(`${MAILPIT}/api/v1/messages?limit=50`);
    const data = (await response.json()) as MailpitList;
    const message = data.messages.find(
      (item) =>
        item.To.some((to) => to.Address.toLowerCase() === email.toLowerCase()) &&
        new Date(item.Created) >= new Date(after.getTime() - 2000) &&
        /^\d{6}\b/.test(item.Subject),
    );
    if (message) return message.Subject.slice(0, 6);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Không thấy email OTP gửi tới ${email}`);
}

/** Đăng nhập bằng mã OTP qua giao diện. */
export async function signIn(page: Page, email: string, next = "/") {
  await page.goto(`/dang-nhap?next=${encodeURIComponent(next)}`);
  const startedAt = new Date();
  await page.getByLabel("Email trường").fill(email);
  await page.getByRole("button", { name: "Gửi mã đăng nhập" }).click();
  await expect(page.getByLabel("Mã 6 số")).toBeVisible();
  const otp = await latestOtp(email, startedAt);
  await page.getByLabel("Mã 6 số").fill(otp);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/dang-nhap") && !url.pathname.startsWith("/hoan-thien-ho-so"));
}

export async function signOut(page: Page) {
  await page.context().clearCookies();
}
