import { highlightSegments } from "@/lib/highlight";

/** Hiện chuỗi với từ khóa khớp được gạch chân đỏ (thẻ <mark>). */
export function Highlighted({ text, terms }: { text: string; terms: readonly string[] }) {
  if (terms.length === 0) return <>{text}</>;
  return (
    <>
      {highlightSegments(text, terms).map((segment, index) =>
        segment.match ? <mark key={index}>{segment.text}</mark> : <span key={index}>{segment.text}</span>,
      )}
    </>
  );
}
