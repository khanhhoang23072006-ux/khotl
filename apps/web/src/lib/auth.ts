import "server-only";
import { getMailer, getRateLimiter } from "@khotl/adapters";
import { isAllowedEmail, suggestUsername } from "@khotl/core";
import { prisma } from "@khotl/db";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import { serverEnv } from "./env";


const DOMAIN_MESSAGE = `Chỉ nhận email trường: ${serverEnv.allowedDomains.map((d) => `@${d}`).join(", ")}`;

/** Username duy nhất từ phần trước @ của email; trùng thì thêm số. */
async function uniqueUsername(email: string): Promise<string> {
  const base = suggestUsername(email);
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base.slice(0, 26)}${i}`;
    const taken = await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `${base.slice(0, 22)}${Date.now().toString().slice(-6)}`;
}

/** Tài khoản đang bị cấm toàn trang thì không tạo phiên đăng nhập mới. */
async function isSiteBanned(userId: string): Promise<boolean> {
  const ban = await prisma.userSanction.findFirst({
    where: {
      userId,
      type: "SITE_BAN",
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { id: true },
  });
  return Boolean(ban);
}

function clientIp(headers: Headers | undefined): string {
  const forwarded = headers?.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers?.get("x-real-ip") || "unknown";
}

export const auth = betterAuth({
  appName: "Kho tài liệu HUST",
  baseURL: process.env.BETTER_AUTH_URL ?? serverEnv.appUrl,
  secret: serverEnv.authSecret || undefined,
  trustedOrigins: [serverEnv.appUrl],
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  account: {
    // Cùng một email trường đăng nhập bằng Microsoft hay mã OTP đều vào một tài khoản
    accountLinking: { enabled: true, trustedProviders: ["microsoft", "email-otp"] },
  },
  socialProviders: serverEnv.microsoft
    ? {
        microsoft: {
          clientId: serverEnv.microsoft.clientId,
          clientSecret: serverEnv.microsoft.clientSecret,
          tenantId: serverEnv.microsoft.tenantId,
          prompt: "select_account",
        },
      }
    : {},
  rateLimit: {
    // Tắt được khi chạy kiểm thử e2e (nhiều lần đăng nhập từ cùng một IP)
    enabled: process.env.AUTH_RATE_LIMIT !== "off",
    window: 60,
    max: 60,
    customRules: {
      "/email-otp/send-verification-otp": { window: 60, max: 3 },
      "/sign-in/email-otp": { window: 60, max: 10 },
    },
  },
  hooks: {
    // Giới hạn gửi mã theo email và theo IP bằng Redis (dùng chung giữa nhiều instance)
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/email-otp/send-verification-otp") return;
      const email = String((ctx.body as { email?: string } | undefined)?.email ?? "")
        .trim()
        .toLowerCase();
      if (!isAllowedEmail(email, serverEnv.allowedDomains)) {
        throw new APIError("BAD_REQUEST", { message: DOMAIN_MESSAGE });
      }
      const limiter = getRateLimiter();
      const [byEmail, byIp] = await Promise.all([
        limiter.hit(`otp:email:${email}`, 5, 15 * 60),
        limiter.hit(`otp:ip:${clientIp(ctx.headers)}`, 20, 15 * 60),
      ]);
      if (process.env.AUTH_RATE_LIMIT !== "off" && (!byEmail.ok || !byIp.ok)) {
        throw new APIError("TOO_MANY_REQUESTS", {
          message: "Bạn đã yêu cầu quá nhiều mã. Thử lại sau ít phút.",
        });
      }
    }),
  },
  databaseHooks: {
    user: {
      create: {
        // Chặn mọi tài khoản không thuộc domain trường, kể cả qua Microsoft
        before: async (user) => {
          if (!isAllowedEmail(user.email, serverEnv.allowedDomains)) {
            throw new APIError("FORBIDDEN", { message: DOMAIN_MESSAGE });
          }
          return { data: { ...user, email: user.email.toLowerCase() } };
        },
        // Gán username, vai trò Sinh viên, và Quản trị nếu email nằm trong ADMIN_EMAILS
        after: async (user) => {
          const keys: ("STUDENT" | "ADMIN")[] = ["STUDENT"];
          if (serverEnv.adminEmails.includes(user.email.toLowerCase())) keys.push("ADMIN");
          const roles = await prisma.role.findMany({ where: { key: { in: keys } } });
          await prisma.user.update({
            where: { id: user.id },
            data: {
              username: await uniqueUsername(user.email),
              roles: { create: roles.map((role) => ({ roleId: role.id })) },
            },
          });
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          if (await isSiteBanned(session.userId)) {
            throw new APIError("FORBIDDEN", { message: "Tài khoản đang bị khóa." });
          }
          return { data: session };
        },
      },
    },
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 10 * 60,
      allowedAttempts: 5,
      async sendVerificationOTP({ email, otp }) {
        await getMailer().send({
          to: email,
          subject: `${otp} là mã đăng nhập Kho tài liệu HUST`,
          text: [
            "Chào bạn,",
            "",
            `Mã đăng nhập của bạn: ${otp}`,
            "Mã có hiệu lực trong 10 phút. Đừng chia sẻ mã này với ai.",
            "",
            "Nếu bạn không yêu cầu, hãy bỏ qua email này.",
            "",
            "Kho tài liệu HUST",
          ].join("\n"),
        });
      },
    }),
    // Phải đứng cuối: cho phép server action đặt cookie phiên
    nextCookies(),
  ],
});

export type Auth = typeof auth;
