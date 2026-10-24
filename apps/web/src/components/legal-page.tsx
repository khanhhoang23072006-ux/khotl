import { PageHeader } from "@/components/ui/title-block";

/** Mục trong file messages: đoạn văn cách nhau bằng một dòng trống. */
export type RawSections = Record<string, { title: string; body: string }>;

/** Trang văn bản quy định: mỗi mục là một ô khung tên đánh số. */
export function LegalPage({ title, updated, raw }: { title: string; updated: string; raw: RawSections }) {
  const sections = Object.values(raw).map((section) => ({
    title: section.title,
    body: section.body.split(/\n\s*\n/),
  }));
  return (
    <>
      <PageHeader title={title} kicker={updated} />
      <div className="mx-auto max-w-3xl px-4 py-6">
        <ol className="tb grid-cols-[56px_1fr]">
          {sections.map((section, index) => (
            <li key={section.title} className="contents">
              <span className="flex justify-center bg-sheet pt-3 font-code text-2xl">{index + 1}</span>
              <div className="bg-sheet px-4 py-3">
                <h2 className="font-head text-lg">{section.title}</h2>
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="mt-2 text-[15px] leading-relaxed">
                    {paragraph}
                  </p>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
