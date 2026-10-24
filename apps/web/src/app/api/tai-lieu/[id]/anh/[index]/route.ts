import { getStorage } from "@khotl/adapters";
import { prisma } from "@khotl/db";
import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";
import { documentAccess } from "@/lib/policies";
import { getCurrentUser } from "@/lib/session";

/** Ảnh xem trước trang thứ `index` (0 = ảnh thu nhỏ). Khách chỉ xem được vài trang đầu. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; index: string }> },
) {
  const { id, index } = await params;
  const page = Number(index);
  if (!Number.isInteger(page) || page < 0 || page > serverEnv.guestPreviewPages) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const doc = await prisma.document.findUnique({
    where: { id },
    select: {
      status: true,
      visibility: true,
      uploaderId: true,
      deletedAt: true,
      course: { select: { facultyId: true } },
      currentVersion: { select: { previewImageKeys: true, thumbnailKey: true } },
    },
  });
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // Tài liệu công khai không cần kiểm tra phiên đăng nhập (ảnh được cache ở trình duyệt)
  const access = documentAccess(doc, null) ?? documentAccess(doc, await getCurrentUser());
  if (!access) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const key =
    page === 0 ? doc.currentVersion?.thumbnailKey : doc.currentVersion?.previewImageKeys[page - 1];
  if (!key) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const url = await getStorage().presignGet(key, { expiresIn: 3600, contentType: "image/webp" });
  return NextResponse.redirect(url, {
    status: 302,
    headers: { "Cache-Control": access === "public" ? "public, max-age=1800" : "private, no-store" },
  });
}
