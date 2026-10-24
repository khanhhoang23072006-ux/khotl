"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { grantRole, revokeRole } from "@/server/admin";

export function GrantRoleForm({ faculties }: { faculties: { id: string; label: string }[] }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"MODERATOR" | "ADMIN">("MODERATOR");
  const [facultyId, setFacultyId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-3 md:grid-cols-[1fr_160px_1fr_auto] md:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await grantRole({ email, role, facultyId: facultyId || undefined });
          if (!result.ok) {
            setErrors(result.fields ?? {});
            setMessage(result.error);
            return;
          }
          setErrors({});
          setEmail("");
          setMessage(t("roleGranted"));
          router.refresh();
        });
      }}
    >
      <Field id="grant-email" label={t("email")} error={errors.email} required>
        <Input id="grant-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </Field>
      <Field id="grant-role" label={t("role")}>
        <Select id="grant-role" value={role} onChange={(event) => setRole(event.target.value as "MODERATOR" | "ADMIN")}>
          <option value="MODERATOR">{t("roles.MODERATOR")}</option>
          <option value="ADMIN">{t("roles.ADMIN")}</option>
        </Select>
      </Field>
      <Field id="grant-faculty" label={t("scope")}>
        <Select
          id="grant-faculty"
          value={facultyId}
          disabled={role === "ADMIN"}
          onChange={(event) => setFacultyId(event.target.value)}
        >
          <option value="">{t("scopeAll")}</option>
          {faculties.map((faculty) => (
            <option key={faculty.id} value={faculty.id}>
              {faculty.label}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" variant="ink" disabled={pending}>
        {t("grant")}
      </Button>
      {message ? (
        <p role="status" className="text-sm md:col-span-4">
          {message}
        </p>
      ) : null}
    </form>
  );
}

export function RevokeRoleButton({ userRoleId }: { userRoleId: string }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <span className="flex flex-col items-end">
      <Button
        size="sm"
        variant="ghost"
        className="underline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await revokeRole(userRoleId);
            if (!result.ok) setError(result.error);
            else router.refresh();
          })
        }
      >
        {t("revoke")}
      </Button>
      {error ? <span className="text-[12px] text-stamp">{error}</span> : null}
    </span>
  );
}
