import { prisma } from "@khotl/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Kiểm tra sống cho Docker/Vercel: web chạy và kết nối được CSDL. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
