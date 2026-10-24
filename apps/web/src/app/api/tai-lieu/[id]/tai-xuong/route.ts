import { getRateLimiter } from "@khotl/adapters";
import { can, isStaff, PERMISSIONS } from "@khotl/core";
import { prisma } from "@khotl/db";
import { NextResponse } from "next/server";
import { deviceHash } from "@/lib/device";
import { documentAccess } from "@/lib/policies";
import { hashedIp } from "@/lib/request";
import { getCurrentUser } from "@/lib/session";
import { chargeDownload, createDownloadToken, getCreditSettings, recordDevice } from "@/server/credits/ledger";

function tooMany(resetIn: number) {
  return new NextResponse("Bạn tải quá nhiều trong một giờ, thử lại sau.", {
    status: 429,
    headers: { "Retry-After": String(resetIn), "Content-Type": "text/plain; charset=utf-8" },
  });
}

/**
 * Tải file gốc:
 * 1. bắt buộc đăng nhập (khách chỉ xem bản xem trước);
 * 2. giới hạn số lần gọi mỗi giờ theo tài khoản, IP và thiết bị;
 * 3. trừ lượt trong một transaction (miễn phí trong ngày trước, rồi lượt thưởng; tải lại trong 24 giờ không trừ);
 * 4. cấp link dùng một lần /api/tai-xuong/<token>, hết hạn sau vài chục giây.
 * Hết lượt thì chuyển tới trang /het-luot giải thích cách kiếm thêm.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const back = new URL(request.url).searchParams.get("tu") ?? "/";
  const safeBack = back.startsWith("/") && !back.startsWith("//") ? back : "/";
  if (!user) {
    return NextResponse.redirect(new URL(`/dang-nhap?next=${encodeURIComponent(safeBack)}`, request.url));
  }
  if (!can(user, PERMISSIONS.documentDownload)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const settings = await getCreditSettings();
  const [ipHash, device] = await Promise.all([hashedIp(), deviceHash()]);
  // Kiểm duyệt viên và quản trị viên tải không giới hạn: không trừ lượt, không giới hạn số lần mỗi giờ
  const staff = isStaff(user);
  const limiter = getRateLimiter();
  for (const [key, limit] of staff ? [] : [
    [`download:user:${user.id}`, settings.rateLimitPerHourUser],
    [`download:ip:${ipHash}`, settings.rateLimitPerHourIp],
    [`download:device:${device}`, settings.rateLimitPerHourDevice],
  ] as const)) {
    const rate = await limiter.hit(key, limit, 3600);
    if (!rate.ok) return tooMany(rate.resetIn);
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
      currentVersion: { select: { id: true } },
    },
  });
  const version = doc?.currentVersion;
  const access = doc ? documentAccess(doc, user) : null;
  if (!doc || !version || !access) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Người đăng, kiểm duyệt viên và tài liệu chưa công khai không tính lượt
  const exempt = staff || access !== "public" || doc.uploaderId === user.id || doc.status !== "APPROVED";
  if (!staff) await recordDevice({ userId: user.id, deviceHash: device, ipHash });
  const result = await chargeDownload({
    userId: user.id,
    documentId: doc.id,
    versionId: version.id,
    exempt,
    ipHash,
    deviceHash: device,
  });
  if (!result.ok) {
    return NextResponse.redirect(new URL(`/het-luot?tai-lieu=${encodeURIComponent(doc.slug)}`, request.url), {
      status: 303,
    });
  }

  const token = await createDownloadToken({
    userId: user.id,
    documentId: doc.id,
    versionId: version.id,
    ttlSeconds: settings.linkTtlSeconds,
  });
  return NextResponse.redirect(new URL(`/api/tai-xuong/${token}`, request.url), {
    status: 303,
    headers: { "Cache-Control": "private, no-store" },
  });
}
