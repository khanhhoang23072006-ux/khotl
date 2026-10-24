"use client";

import { CREDIT_SETTINGS_BOUNDS, type CreditSettings } from "@khotl/core";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { adjustCreditsAction, saveCreditSettingsAction, unlockRewardsAction } from "@/server/credits/actions";

const KEYS = Object.keys(CREDIT_SETTINGS_BOUNDS) as (keyof CreditSettings)[];

/** Cấu hình hạn mức: lưu vào SystemSetting, có hiệu lực ngay, không cần deploy lại. */
export function CreditSettingsForm({ settings }: { settings: CreditSettings }) {
  const t = useTranslations("credits.admin");
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(KEYS.map((key) => [key, String(settings[key])])),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await saveCreditSettingsAction(values);
          setMessage(result.ok ? t("saved") : result.error);
          if (result.ok) router.refresh();
        });
      }}
    >
      {KEYS.map((key) => {
        const [min, max] = CREDIT_SETTINGS_BOUNDS[key];
        return (
          <Field key={key} id={`credit-${key}`} label={t(`fields.${key}` as "fields.dailyFree")}>
            <Input
              id={`credit-${key}`}
              type="number"
              inputMode="numeric"
              min={min}
              max={max}
              value={values[key] ?? ""}
              onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
            />
          </Field>
        );
      })}
      <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
        <Button type="submit" variant="ink" disabled={pending}>
          {t("save")}
        </Button>
        {message ? (
          <p role="status" className="text-sm">
            {message}
          </p>
        ) : null}
      </div>
    </form>
  );
}

export function AdjustCreditsForm() {
  const t = useTranslations("credits.admin");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="grid gap-3 md:grid-cols-[1fr_160px_1fr_auto] md:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await adjustCreditsAction({ email, amount: Number(amount), note });
          if (!result.ok) {
            setErrors(result.fields ?? {});
            setMessage(result.error);
            return;
          }
          setErrors({});
          setMessage(t("adjusted", { amount, email }));
          setAmount("");
          setNote("");
          router.refresh();
        });
      }}
    >
      <Field id="adjust-email" label={t("email")} error={errors.email} required>
        <Input id="adjust-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </Field>
      <Field id="adjust-amount" label={t("amount")} error={errors.amount} required>
        <Input
          id="adjust-amount"
          type="number"
          inputMode="numeric"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </Field>
      <Field id="adjust-note" label={t("note")} error={errors.note} required>
        <Input id="adjust-note" value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <Button type="submit" variant="ink" disabled={pending}>
        {t("adjust")}
      </Button>
      {message ? (
        <p role="status" className="text-sm md:col-span-4">
          {message}
        </p>
      ) : null}
    </form>
  );
}

export function UnlockRewardsButton({ userId }: { userId: string }) {
  const t = useTranslations("credits.admin");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await unlockRewardsAction(userId);
          if (result.ok) router.refresh();
        })
      }
    >
      {t("unlock")}
    </Button>
  );
}
