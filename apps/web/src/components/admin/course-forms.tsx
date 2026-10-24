"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { describedBy, Field, Input, Select, Textarea } from "@/components/ui/field";
import { createCourse, type ImportSummary, importCourses } from "@/server/admin";

export function CreateCourseForm({ faculties }: { faculties: { id: string; label: string }[] }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const empty = { code: "", name: "", nameEn: "", credits: "", facultyId: "" };
  const [values, setValues] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (key: keyof typeof empty) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  return (
    <form
      className="flex flex-col gap-3"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await createCourse({
            code: values.code,
            name: values.name,
            nameEn: values.nameEn,
            credits: values.credits || undefined,
            facultyId: values.facultyId,
          });
          if (!result.ok) {
            setErrors(result.fields ?? {});
            setMessage(result.error);
            return;
          }
          setErrors({});
          setValues(empty);
          setMessage(t("courseCreated"));
          router.refresh();
        });
      }}
    >
      <div className="grid grid-cols-[120px_1fr] gap-3">
        <Field id="code" label={t("code")} error={errors.code} required>
          <Input id="code" value={values.code} onChange={set("code")} aria-describedby={describedBy("code", errors.code)} />
        </Field>
        <Field id="name" label={t("name")} error={errors.name} required>
          <Input id="name" value={values.name} onChange={set("name")} aria-describedby={describedBy("name", errors.name)} />
        </Field>
      </div>
      <div className="grid grid-cols-[1fr_100px] gap-3">
        <Field id="nameEn" label={t("nameEn")} error={errors.nameEn}>
          <Input id="nameEn" value={values.nameEn} onChange={set("nameEn")} />
        </Field>
        <Field id="credits" label={t("credits")} error={errors.credits}>
          <Input id="credits" inputMode="numeric" value={values.credits} onChange={set("credits")} />
        </Field>
      </div>
      <Field id="facultyId" label={t("faculty")} error={errors.facultyId} required>
        <Select id="facultyId" value={values.facultyId} onChange={set("facultyId")}>
          <option value="">{t("chooseFaculty")}</option>
          {faculties.map((faculty) => (
            <option key={faculty.id} value={faculty.id}>
              {faculty.label}
            </option>
          ))}
        </Select>
      </Field>
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
      <Button type="submit" variant="ink" disabled={pending}>
        {t("createCourse")}
      </Button>
    </form>
  );
}

export function ImportCoursesForm() {
  const t = useTranslations("admin");
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await importCourses(csv);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setError(null);
          setSummary({ created: result.created, updated: result.updated, errors: result.errors });
          router.refresh();
        });
      }}
    >
      <Field id="csv" label={t("csv")} hint={t("csvHint")}>
        <Textarea
          id="csv"
          value={csv}
          onChange={(event) => setCsv(event.target.value)}
          className="min-h-40 font-mono text-[13px]"
          placeholder={"IT3011,Cấu trúc dữ liệu và giải thuật,Data Structures and Algorithms,2,SOICT"}
        />
      </Field>
      <label className="flex flex-col gap-1 text-[13px]">
        {t("csvFile")}
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (file) setCsv(await file.text());
          }}
        />
      </label>
      {error ? <p className="text-sm text-stamp">{error}</p> : null}
      {summary ? (
        <div role="status" className="border-2 border-ink bg-paper px-3 py-2 text-sm">
          <p>{t("importResult", { created: summary.created, updated: summary.updated, errors: summary.errors.length })}</p>
          {summary.errors.length > 0 ? (
            <ul className="mt-1 max-h-40 overflow-auto text-[12px] text-stamp">
              {summary.errors.map((item) => (
                <li key={item.line}>{t("importLineError", { line: item.line, message: item.message })}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <Button type="submit" variant="ink" disabled={pending || !csv.trim()}>
        {t("import")}
      </Button>
    </form>
  );
}
