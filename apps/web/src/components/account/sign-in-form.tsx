"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { describedBy, Field, Input } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";

/**
 * Đăng nhập không mật khẩu: nhập email trường → nhận mã 6 số → nhập mã.
 * Lần đầu đăng nhập tài khoản được tạo tự động (chỉ nhận domain trường).
 */
export function SignInForm({
  next,
  domains,
  microsoftEnabled,
}: {
  next: string;
  domains: string[];
  microsoftEnabled: boolean;
}) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const domainHint = domains.map((domain) => `@${domain}`).join(", ");

  const sendCode = () =>
    startTransition(async () => {
      setError(null);
      const normalized = email.trim().toLowerCase();
      if (!domains.some((domain) => normalized.endsWith(`@${domain}`))) {
        setError(t("domainOnly", { domains: domainHint }));
        return;
      }
      const result = await authClient.emailOtp.sendVerificationOtp({ email: normalized, type: "sign-in" });
      if (result.error) {
        setError(result.error.status === 429 ? t("tooMany") : (result.error.message ?? t("sendFailed")));
        return;
      }
      setEmail(normalized);
      setStep("code");
      setInfo(t("codeSent", { email: normalized }));
    });

  const verify = () =>
    startTransition(async () => {
      setError(null);
      const result = await authClient.signIn.emailOtp({ email, otp: code.trim() });
      if (result.error) {
        setError(result.error.status === 429 ? t("tooMany") : t("invalidCode"));
        return;
      }
      // Trang hoàn thiện hồ sơ tự chuyển tiếp nếu hồ sơ đã đủ
      router.push(`/hoan-thien-ho-so?next=${encodeURIComponent(next)}&tu=dang-nhap`);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-5">
      {step === "email" ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            sendCode();
          }}
        >
          <Field id="email" label={t("emailLabel")} hint={t("emailHint", { domains: domainHint })} error={error ?? undefined}>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={`ten.mssv@${domains[0] ?? "sis.hust.edu.vn"}`}
              aria-invalid={Boolean(error)}
              aria-describedby={describedBy("email", error ?? undefined, true)}
            />
          </Field>
          <Button type="submit" variant="primary" size="lg" disabled={pending}>
            {pending ? t("sending") : t("sendCode")}
          </Button>
        </form>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            verify();
          }}
        >
          {info ? <p className="border-l-4 border-ink bg-sheet px-3 py-2 text-sm">{info}</p> : null}
          <Field id="otp" label={t("codeLabel")} error={error ?? undefined}>
            <Input
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              className="h-14 text-center font-code text-3xl tracking-[0.4em]"
              aria-invalid={Boolean(error)}
              aria-describedby={describedBy("otp", error ?? undefined)}
            />
          </Field>
          <Button type="submit" variant="primary" size="lg" disabled={pending || code.length !== 6}>
            {pending ? t("verifying") : t("verify")}
          </Button>
          <div className="flex justify-between text-[13px]">
            <button type="button" className="underline" onClick={() => setStep("email")}>
              {t("changeEmail")}
            </button>
            <button type="button" className="underline" onClick={sendCode} disabled={pending}>
              {t("resend")}
            </button>
          </div>
        </form>
      )}

      {microsoftEnabled ? (
        <>
          <div className="flex items-center gap-3 text-[12px] text-pencil">
            <span className="h-px flex-1 bg-ink/30" />
            {t("or")}
            <span className="h-px flex-1 bg-ink/30" />
          </div>
          <Button
            variant="outline"
            size="lg"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await authClient.signIn.social({
                  provider: "microsoft",
                  callbackURL: `/hoan-thien-ho-so?next=${encodeURIComponent(next)}&tu=dang-nhap`,
                  errorCallbackURL: "/dang-nhap?loi=microsoft",
                });
              })
            }
          >
            <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
              <path fill="#f25022" d="M1 1h9v9H1z" />
              <path fill="#00a4ef" d="M1 11h9v9H1z" />
              <path fill="#7fba00" d="M11 1h9v9h-9z" />
              <path fill="#ffb900" d="M11 11h9v9h-9z" />
            </svg>
            {t("microsoft")}
          </Button>
        </>
      ) : null}
    </div>
  );
}
