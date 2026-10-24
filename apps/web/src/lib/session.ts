import "server-only";
import {
  can,
  moderationScope,
  type Permission,
  type PermissionScope,
  type RoleAssignment,
} from "@khotl/core";
import { prisma } from "@khotl/db";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  username: string | null;
  displayName: string | null;
  image: string | null;
  facultyId: string | null;
  cohort: number | null;
  trustLevel: number;
  reputation: number;
  approvedDocumentCount: number;
  roles: RoleAssignment[];
  /** đã chọn Viện và khóa ở bước hoàn thiện hồ sơ */
  profileComplete: boolean;
}

/** Phiên đăng nhập của request hiện tại (gọi nhiều lần trong một request chỉ truy vấn một lần). */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: { include: { role: { select: { key: true } } } } },
  });
  if (!user || user.deletedAt) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    username: user.username,
    displayName: user.displayName,
    image: user.image,
    facultyId: user.facultyId,
    cohort: user.cohort,
    trustLevel: user.trustLevel,
    reputation: user.reputation,
    approvedDocumentCount: user.approvedDocumentCount,
    roles: user.roles.map((assignment) => ({
      key: assignment.role.key,
      facultyId: assignment.facultyId,
    })),
    profileComplete: Boolean(user.facultyId && user.cohort),
  };
});

export function displayNameOf(user: { displayName: string | null; name: string }): string {
  return user.displayName || user.name;
}

/** Bắt buộc đăng nhập; chưa đăng nhập thì chuyển tới trang đăng nhập rồi quay lại `next`. */
export async function requireUser(next: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/dang-nhap?next=${encodeURIComponent(next)}`);
  return user;
}

/** Bắt buộc đăng nhập và đã hoàn thiện hồ sơ (chọn Viện, khóa). */
export async function requireProfile(next: string): Promise<CurrentUser> {
  const user = await requireUser(next);
  if (!user.profileComplete) redirect(`/hoan-thien-ho-so?next=${encodeURIComponent(next)}`);
  return user;
}

/** Bắt buộc có quyền; không có thì trả 404 để không lộ trang quản trị. */
export async function requirePermission(
  permission: Permission,
  next: string,
  scope?: PermissionScope,
): Promise<CurrentUser> {
  const user = await requireUser(next);
  if (!can(user, permission, scope)) notFound();
  return user;
}

export { can, moderationScope };
