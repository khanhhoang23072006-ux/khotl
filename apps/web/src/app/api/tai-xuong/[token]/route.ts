import { getStorage } from "@khotl/adapters";
import { prisma } from "@khotl/db";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { consumeDownloadToken, getCreditSettings } from "@/server/credits/ledger";

/**
 * Link tải dùng một lần. Lượt đã được trừ khi cấp link; ở đây chỉ đổi token (đúng chủ, chưa dùng,
 * chưa hết hạn) lấy URL ký sẵn rất ngắn hạn tới file trong kho. Chia sẻ link này cho người khác
 * hoặc dùng lại đều không được.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/dang-nhap", request.url));

  const target = await consumeDownloadToken(token, user.id);
  if (!target) {
    return new NextResponse("Link tải đã dùng hoặc đã hết hạn. Quay lại trang tài liệu và bấm tải lại (tải lại trong 24 giờ không bị trừ lượt).", {
      status: 410,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  const version = await prisma.documentVersion.findUnique({
    where: { id: target.versionId },
    select: {
      storageKey: true,
      originalName: true,
      document: { select: { slug: true, course: { select: { code: true } } } },
    },
  });
  if (!version) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const settings = await getCreditSettings();
  const ext = version.originalName.includes(".") ? version.originalName.split(".").pop() : "pdf";
  const url = await getStorage().presignGet(version.storageKey, {
    expiresIn: settings.linkTtlSeconds,
    downloadName: `${version.document.course.code}-${version.document.slug}.${ext}`,
  });
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, no-store" } });
}
