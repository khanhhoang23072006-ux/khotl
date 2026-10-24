import { prisma } from "@khotl/db";
import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const [faculties, courses, documents] = await Promise.all([
    prisma.faculty.findMany({ select: { slug: true, updatedAt: true } }),
    prisma.course.findMany({ where: { documentCount: { gt: 0 } }, select: { code: true, updatedAt: true } }),
    prisma.document.findMany({
      where: { status: "APPROVED", visibility: "PUBLIC", deletedAt: null },
      select: { slug: true, updatedAt: true },
      orderBy: { publishedAt: "desc" },
      take: 5000,
    }),
  ]);
  return [
    { url: `${base}/`, changeFrequency: "daily" },
    { url: `${base}/vien` },
    ...faculties.map((f) => ({ url: `${base}/vien/${f.slug}`, lastModified: f.updatedAt })),
    ...courses.map((c) => ({ url: `${base}/hoc-phan/${c.code}`, lastModified: c.updatedAt })),
    ...documents.map((d) => ({ url: `${base}/tai-lieu/${d.slug}`, lastModified: d.updatedAt })),
  ];
}
