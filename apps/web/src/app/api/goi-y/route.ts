import { getRateLimiter } from "@khotl/adapters";
import { NextResponse } from "next/server";
import { clientIp } from "@/lib/request";
import { searchCourses, suggestTitles } from "@/lib/search";

/** Gợi ý khi gõ: học phần (mã, tên) và tiêu đề tài liệu. ?loai=hoc-phan chỉ trả học phần. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const onlyCourses = url.searchParams.get("loai") === "hoc-phan";
  if (q.length < 2) return NextResponse.json({ courses: [], documents: [] });

  const rate = await getRateLimiter().hit(`suggest:${await clientIp()}`, 120, 60);
  if (!rate.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const [courses, documents] = await Promise.all([
    searchCourses(q, onlyCourses ? 8 : 4),
    onlyCourses ? Promise.resolve([]) : suggestTitles(q, 5),
  ]);
  return NextResponse.json(
    { courses, documents },
    { headers: { "Cache-Control": "private, max-age=30" } },
  );
}
