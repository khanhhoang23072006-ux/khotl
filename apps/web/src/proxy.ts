import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Chặn sớm các trang cần đăng nhập: không có cookie phiên thì chuyển tới /dang-nhap.
 * Đây chỉ là lớp lọc nhanh (không truy vấn CSDL); quyền thật được kiểm tra lại trong
 * từng trang và server action bằng requireUser/requirePermission.
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  const url = new URL("/dang-nhap", request.url);
  url.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/tai-len/:path*",
    "/tai-lieu-cua-toi/:path*",
    "/thong-bao/:path*",
    "/kiem-duyet/:path*",
    "/quan-tri/:path*",
    "/hoan-thien-ho-so/:path*",
  ],
};
