"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { CheckIcon, FileIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Checkbox, describedBy, Field, Input, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { resubmitDocument, startUpload, submitUpload } from "@/server/upload";
import { CoursePicker, type PickedCourse } from "./course-picker";

const ACCEPT = ".pdf,.docx,.pptx,.xlsx,.jpg,.jpeg,.png,.webp,.zip";
const EXTENSIONS = ["pdf", "docx", "pptx", "xlsx", "jpg", "jpeg", "png", "webp", "zip"];

type FileState =
  | { status: "idle" }
  | { status: "preparing"; name: string; size: number }
  | { status: "uploading"; name: string; size: number; loaded: number }
  | { status: "done"; name: string; size: number; token: string }
  | { status: "error"; name: string; size: number; message: string };

export interface UploadFormProps {
  mode: { kind: "create" } | { kind: "edit"; documentId: string };
  types: { value: string; label: string }[];
  terms: string[];
  limits: { maxMb: number; zipMaxMb: number };
  initial?: {
    course: PickedCourse | null;
    type: string;
    term: string;
    title: string;
    description: string;
    tags: string;
    isAnonymous: boolean;
  };
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

/** Gợi ý tiêu đề từ tên file: bỏ đuôi, thay gạch nối bằng khoảng trắng. */
function titleFromFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/** PUT file thẳng lên kho bằng URL ký sẵn, báo tiến độ qua XHR (fetch chưa hỗ trợ tiến độ upload). */
function putFile(url: string, file: File, contentType: string, onProgress: (loaded: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (event) => onProgress(event.loaded);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(String(xhr.status))));
    xhr.onerror = () => reject(new Error("network"));
    xhr.send(file);
  });
}

export function UploadForm({ mode, types, terms, limits, initial }: UploadFormProps) {
  const t = useTranslations("upload");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<FileState>({ status: "idle" });
  const [dragging, setDragging] = useState(false);
  const [course, setCourse] = useState<PickedCourse | null>(initial?.course ?? null);
  const [type, setType] = useState(initial?.type ?? "");
  const [term, setTerm] = useState(initial?.term ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [tags, setTags] = useState(initial?.tags ?? "");
  const [isAnonymous, setAnonymous] = useState(initial?.isAnonymous ?? false);
  const [copyright, setCopyright] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [pending, startTransition] = useTransition();
  const editing = mode.kind === "edit";

  async function chooseFile(selected: File) {
    setFormError(null);
    const ext = selected.name.split(".").pop()?.toLowerCase() ?? "";
    const base = { name: selected.name, size: selected.size };
    if (!EXTENSIONS.includes(ext)) {
      setFile({ status: "error", ...base, message: t("badFormat") });
      return;
    }
    const maxMb = ext === "zip" ? limits.zipMaxMb : limits.maxMb;
    if (selected.size > maxMb * 1024 * 1024) {
      setFile({ status: "error", ...base, message: t("tooLarge", { mb: maxMb }) });
      return;
    }
    if (!title) setTitle(titleFromFileName(selected.name));

    setFile({ status: "preparing", ...base });
    const ticket = await startUpload({ fileName: selected.name, fileSize: selected.size });
    if (!ticket.ok) {
      setFile({ status: "error", ...base, message: ticket.error });
      return;
    }
    try {
      setFile({ status: "uploading", ...base, loaded: 0 });
      await putFile(ticket.url, selected, ticket.contentType, (loaded) =>
        setFile({ status: "uploading", ...base, loaded }),
      );
      setFile({ status: "done", ...base, token: ticket.token });
    } catch {
      setFile({ status: "error", ...base, message: t("uploadFailed") });
    }
  }

  function submit() {
    setFormError(null);
    const token = file.status === "done" ? file.token : undefined;
    if (!editing && !token) {
      setFormError(t("waitForUpload"));
      return;
    }
    startTransition(async () => {
      const payload = {
        token: token ?? "",
        courseId: course?.id ?? "",
        type: type as "OTHER",
        term: term || undefined,
        title,
        description,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        isAnonymous,
        copyrightAccepted: copyright as true,
      };
      const result =
        mode.kind === "edit"
          ? await resubmitDocument({ ...payload, documentId: mode.documentId, token })
          : await submitUpload(payload);
      if (!result.ok) {
        setErrors(result.fields ?? {});
        setFormError(result.error);
        return;
      }
      setErrors({});
      if (mode.kind === "edit") {
        router.push("/tai-lieu-cua-toi?gui-lai=1");
        router.refresh();
        return;
      }
      setSubmitted(true);
      router.refresh();
    });
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-start gap-3 border-2 border-ink bg-sheet p-5">
        <span className="stamp">{t("sentStamp")}</span>
        <h2 className="font-head text-xl">{t("submittedTitle")}</h2>
        <p className="text-sm">{t("submittedBody")}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ink"
            onClick={() => {
              setSubmitted(false);
              setFile({ status: "idle" });
              setTitle("");
              setDescription("");
              setTags("");
              setCopyright(false);
            }}
          >
            {t("uploadAnother")}
          </Button>
          <Link href="/tai-lieu-cua-toi" className="flex h-11 items-center px-3 font-head underline">
            {t("viewMine")}
          </Link>
        </div>
      </div>
    );
  }

  const percent =
    file.status === "uploading" && file.size > 0 ? Math.round((file.loaded / file.size) * 100) : 0;

  return (
    <form
      className="flex flex-col gap-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 border-2 border-dashed border-ink bg-sheet px-4 py-8 text-center",
          dragging && "border-solid bg-wash",
        )}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const dropped = event.dataTransfer.files[0];
          if (dropped) void chooseFile(dropped);
        }}
      >
        <FileIcon size={28} />
        <p className="font-head">{editing ? t("dropReplace") : t("drop")}</p>
        <p className="text-[13px] text-pencil">{t("formats", { mb: limits.maxMb, zipMb: limits.zipMaxMb })}</p>
        <input
          ref={inputRef}
          id="file"
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(event) => {
            const selected = event.target.files?.[0];
            if (selected) void chooseFile(selected);
            event.target.value = "";
          }}
        />
        <Button variant="ink" onClick={() => inputRef.current?.click()} disabled={file.status === "uploading"}>
          {t("chooseFile")}
        </Button>
      </div>

      {file.status !== "idle" ? (
        <div className="tb grid-cols-[1fr_auto]" aria-live="polite">
          <div className="min-w-0 bg-sheet px-3 py-2">
            <p className="truncate text-sm font-semibold">{file.name}</p>
            <p className="text-[12px] text-pencil">
              {file.status === "uploading"
                ? `${formatSize(file.loaded)} / ${formatSize(file.size)}`
                : formatSize(file.size)}
            </p>
            {file.status === "uploading" ? (
              <div
                className="mt-1.5 h-2 border border-ink bg-paper"
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t("progress")}
              >
                <div className="h-full bg-ink" style={{ width: `${percent}%` }} />
              </div>
            ) : null}
            {file.status === "error" ? (
              <p role="alert" className="mt-1 text-[13px] font-semibold text-stamp">
                {file.message}
              </p>
            ) : null}
          </div>
          <div className="flex min-w-20 items-center justify-center bg-sheet px-3 font-head text-sm">
            {file.status === "done" ? (
              <span className="flex items-center gap-1">
                <CheckIcon size={16} /> {t("uploaded")}
              </span>
            ) : file.status === "uploading" ? (
              `${percent}%`
            ) : file.status === "preparing" ? (
              t("preparing")
            ) : (
              t("failed")
            )}
          </div>
        </div>
      ) : null}

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 font-head text-lg">{t("details")}</legend>
        <Field id="course" label={t("course")} error={errors.courseId} required>
          <CoursePicker
            id="course"
            value={course}
            onChange={setCourse}
            invalid={Boolean(errors.courseId)}
            describedBy={describedBy("course", errors.courseId)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="type" label={t("type")} error={errors.type} required>
            <Select
              id="type"
              value={type}
              onChange={(event) => setType(event.target.value)}
              aria-invalid={Boolean(errors.type)}
              aria-describedby={describedBy("type", errors.type)}
            >
              <option value="">{t("chooseType")}</option>
              {types.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="term" label={t("term")} error={errors.term}>
            <Select id="term" value={term} onChange={(event) => setTerm(event.target.value)}>
              <option value="">{t("noTerm")}</option>
              {terms.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field id="title" label={t("title")} hint={t("titleHint")} error={errors.title} required>
          <Input
            id="title"
            value={title}
            maxLength={200}
            onChange={(event) => setTitle(event.target.value)}
            aria-invalid={Boolean(errors.title)}
            aria-describedby={describedBy("title", errors.title, true)}
          />
        </Field>
        <Field id="description" label={t("description")} error={errors.description}>
          <Textarea
            id="description"
            value={description}
            maxLength={2000}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        <Field id="tags" label={t("tags")} hint={t("tagsHint")} error={errors.tags}>
          <Input
            id="tags"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            aria-describedby={describedBy("tags", errors.tags, true)}
          />
        </Field>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={isAnonymous} onChange={(event) => setAnonymous(event.target.checked)} />
          <span>
            {t("anonymous")}
            <span className="block text-[12px] text-pencil">{t("anonymousHint")}</span>
          </span>
        </label>
        <div className="flex flex-col gap-1">
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={copyright}
              onChange={(event) => setCopyright(event.target.checked)}
              aria-invalid={Boolean(errors.copyrightAccepted)}
            />
            <span>
              {t.rich("copyright", {
                terms: (chunks) => (
                  <Link href="/dieu-khoan" className="underline" target="_blank">
                    {chunks}
                  </Link>
                ),
              })}
            </span>
          </label>
          {errors.copyrightAccepted ? (
            <p role="alert" className="text-[13px] font-semibold text-stamp">
              {errors.copyrightAccepted}
            </p>
          ) : null}
        </div>
      </fieldset>

      {formError ? (
        <p role="alert" className="border-l-4 border-stamp bg-sheet px-3 py-2 text-sm">
          {formError}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={pending || file.status === "uploading" || file.status === "preparing"}
        >
          {pending
            ? t("submitting")
            : file.status === "uploading"
              ? t("waitingUpload", { percent })
              : editing
                ? t("resubmit")
                : t("submit")}
        </Button>
        <p className="text-[13px] text-pencil">{t("after")}</p>
      </div>
    </form>
  );
}
