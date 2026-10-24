import { getRateLimiter, getStorage } from "@khotl/adapters";
import { can, PERMISSIONS, vietnamDay } from "@khotl/core";
import { prisma } from "@khotl/db";
import { after, NextResponse } from "next/server";
import { documentAccess } from "@/lib/policies";
import { hashedIp } from "@/lib/request";
import { getCurrentUser } from "@/lib/session";

/**
 * Tải file gốc: bắt buộc đăng nhập, giới hạn 60 lượt/giờ mỗi người, ghi DownloadLog.
 * Trả về chuyển hướng tới URL ký sẵn 5 phút với tên file đẹp.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    const back = new URL(request.url).searchParams.get("tu") ?? "/";
    return NextResponse.redirect(
      new URL(`/dang-nhap?next=${encodeURIComponent(back.startsWith("/") ? back : "/")}`, request.url),
    );
  }
  if (!can(user, PERMISSIONS.documentDownload)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const rate = await getRateLimiter().hit(`download:${user.id}`, 60, 3600);
  if (!rate.ok) {
    return new NextResponse("Bạn tải quá nhiều trong một giờ, thử lại sau.", {
      status: 429,
      headers: { "Retry-After": String(rate.resetIn), "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const doc = await prisma.document.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      status: true,
      visibility: true,
      uploaderId: true,
      deletedAt: true,
      course: { select: { facultyId: true, code: true } },
      currentVersion: { select: { id: true, storageKey: true, originalName: true, processingStatus: true } },
    },
  });
  const version = doc?.currentVersion;
  if (!doc || !version || !documentAccess(doc, user)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const ext = version.originalName.includes(".") ? version.originalName.split(".").pop() : "pdf";
  const url = await getStorage().presignGet(version.storageKey, {
    expiresIn: 300,
    downloadName: `${doc.course.code}-${doc.slug}.${ext}`,
  });

  if (doc.status === "APPROVED") {
    const ipHash = await hashedIp();
    after(async () => {
      const day = vietnamDay();
      await prisma.$transaction([
        prisma.downloadLog.create({
          data: { userId: user.id, documentId: doc.id, versionId: version.id, ipHash },
        }),
        prisma.document.update({ where: { id: doc.id }, data: { downloadCount: { increment: 1 } } }),
        prisma.documentDailyStat.upsert({
          where: { documentId_date: { documentId: doc.id, date: day } },
          create: { documentId: doc.id, date: day, downloads: 1 },
          update: { downloads: { increment: 1 } },
        }),
      ]);
    });
  }

  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, no-store" } });
}
