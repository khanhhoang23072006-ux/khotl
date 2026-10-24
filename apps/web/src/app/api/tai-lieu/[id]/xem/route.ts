import { getStorage } from "@khotl/adapters";
import { prisma } from "@khotl/db";
import { NextResponse } from "next/server";
import { documentAccess } from "@/lib/policies";
import { getCurrentUser } from "@/lib/session";

/**
 * PDF để xem trong trình đọc pdf.js: chỉ cho người đã đăng nhập (khách xem ảnh vài trang đầu).
 * Chuyển hướng tới URL ký sẵn ngắn hạn, file không đi qua server web.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const doc = await prisma.document.findUnique({
    where: { id },
    select: {
      status: true,
      visibility: true,
      uploaderId: true,
      deletedAt: true,
      course: { select: { facultyId: true } },
      currentVersion: { select: { previewPdfKey: true } },
    },
  });
  if (!doc || !documentAccess(doc, user) || !doc.currentVersion?.previewPdfKey) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const url = await getStorage().presignGet(doc.currentVersion.previewPdfKey, {
    expiresIn: 600,
    inline: true,
    contentType: "application/pdf",
  });
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, no-store" } });
}
