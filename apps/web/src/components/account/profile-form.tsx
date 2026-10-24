"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, describedBy, Field, Input, Select } from "@/components/ui/field";
import { saveProfile } from "@/server/account";

interface Props {
  next: string;
  faculties: { id: string; label: string }[];
  initial: {
    username: string;
    displayName: string;
    facultyId: string;
    cohort: string;
    studentCode: string;
    acceptTerms: boolean;
  };
}

export function ProfileForm({ next, faculties, initial }: Props) {
  const t = useTranslations("profile");
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (key: keyof typeof values) => (value: string | boolean) =>
    setValues((current) => ({ ...current, [key]: value }));

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await saveProfile({
            username: values.username,
            displayName: values.displayName,
            facultyId: values.facultyId,
            cohort: values.cohort,
            studentCode: values.studentCode,
            acceptTerms: values.acceptTerms as true,
          });
          if (!result.ok) {
            setErrors(result.fields ?? {});
            setFormError(result.error);
            return;
          }
          window.location.assign(next);
        });
      }}
    >
      <Field id="username" label={t("username")} hint={t("usernameHint")} error={errors.username} required>
        <Input
          id="username"
          value={values.username}
          onChange={(event) => set("username")(event.target.value)}
          autoComplete="username"
          aria-invalid={Boolean(errors.username)}
          aria-describedby={describedBy("username", errors.username, true)}
        />
      </Field>
      <Field id="displayName" label={t("displayName")} hint={t("displayNameHint")} error={errors.displayName}>
        <Input
          id="displayName"
          value={values.displayName}
          onChange={(event) => set("displayName")(event.target.value)}
          autoComplete="nickname"
          aria-describedby={describedBy("displayName", errors.displayName, true)}
        />
      </Field>
      <Field id="facultyId" label={t("faculty")} error={errors.facultyId} required>
        <Select
          id="facultyId"
          value={values.facultyId}
          onChange={(event) => set("facultyId")(event.target.value)}
          aria-invalid={Boolean(errors.facultyId)}
          aria-describedby={describedBy("facultyId", errors.facultyId)}
        >
          <option value="">{t("chooseFaculty")}</option>
          {faculties.map((faculty) => (
            <option key={faculty.id} value={faculty.id}>
              {faculty.label}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="cohort" label={t("cohort")} hint={t("cohortHint")} error={errors.cohort} required>
          <Input
            id="cohort"
            inputMode="numeric"
            value={values.cohort}
            onChange={(event) => set("cohort")(event.target.value.replace(/\D/g, "").slice(0, 2))}
            aria-invalid={Boolean(errors.cohort)}
            aria-describedby={describedBy("cohort", errors.cohort, true)}
          />
        </Field>
        <Field id="studentCode" label={t("studentCode")} hint={t("optional")} error={errors.studentCode}>
          <Input
            id="studentCode"
            inputMode="numeric"
            value={values.studentCode}
            onChange={(event) => set("studentCode")(event.target.value.replace(/\D/g, "").slice(0, 8))}
            aria-describedby={describedBy("studentCode", errors.studentCode, true)}
          />
        </Field>
      </div>
      <div className="flex flex-col gap-1">
        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            checked={values.acceptTerms}
            onChange={(event) => set("acceptTerms")(event.target.checked)}
            aria-invalid={Boolean(errors.acceptTerms)}
          />
          <span>
            {t.rich("acceptTerms", {
              terms: (chunks) => (
                <Link href="/dieu-khoan" className="underline" target="_blank">
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </label>
        {errors.acceptTerms ? (
          <p role="alert" className="text-[13px] font-semibold text-stamp">
            {errors.acceptTerms}
          </p>
        ) : null}
      </div>
      {formError ? (
        <p role="alert" className="border-l-4 border-stamp bg-sheet px-3 py-2 text-sm">
          {formError}
        </p>
      ) : null}
      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {pending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
