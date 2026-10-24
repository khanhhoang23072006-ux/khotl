export const PERMISSIONS = {
  documentUpload: "document:upload",
  documentDownload: "document:download",
  documentModerate: "document:moderate",
  reportCreate: "report:create",
  reportResolve: "report:resolve",
  userRevealAnonymous: "user:reveal-anonymous",
  adminCatalog: "admin:catalog",
  adminUsers: "admin:users",
  adminSettings: "admin:settings",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export type RoleName = "STUDENT" | "MODERATOR" | "ADMIN";

const STUDENT: Permission[] = [
  PERMISSIONS.documentUpload,
  PERMISSIONS.documentDownload,
  PERMISSIONS.reportCreate,
];

const MODERATOR: Permission[] = [
  ...STUDENT,
  PERMISSIONS.documentModerate,
  PERMISSIONS.reportResolve,
  PERMISSIONS.userRevealAnonymous,
];

const ADMIN: Permission[] = [
  ...MODERATOR,
  PERMISSIONS.adminCatalog,
  PERMISSIONS.adminUsers,
  PERMISSIONS.adminSettings,
];

/** Nguồn sự thật của phân quyền. Bảng Role trong CSDL được seed từ đây. */
export const ROLE_PERMISSIONS: Record<RoleName, readonly Permission[]> = {
  STUDENT,
  MODERATOR,
  ADMIN,
};

/** Quyền gắn với Viện: chỉ có hiệu lực trong Viện được giao nếu vai trò có facultyId. */
const SCOPED_PERMISSIONS: ReadonlySet<Permission> = new Set([
  PERMISSIONS.documentModerate,
  PERMISSIONS.reportResolve,
]);

export interface RoleAssignment {
  key: RoleName;
  /** null = toàn hệ thống */
  facultyId: string | null;
}

export interface Subject {
  roles: readonly RoleAssignment[];
}

export interface PermissionScope {
  facultyId?: string | null;
}

/**
 * Kiểm tra quyền. Với quyền gắn Viện (kiểm duyệt), vai trò có facultyId chỉ áp dụng
 * khi scope.facultyId trùng; vai trò toàn hệ thống áp dụng mọi nơi.
 * Không truyền scope nghĩa là hỏi "có quyền này ở ít nhất một nơi không".
 */
export function can(subject: Subject, permission: Permission, scope?: PermissionScope): boolean {
  return subject.roles.some((role) => {
    if (!ROLE_PERMISSIONS[role.key].includes(permission)) return false;
    if (!SCOPED_PERMISSIONS.has(permission) || role.facultyId === null) return true;
    if (scope === undefined) return true;
    return scope.facultyId === role.facultyId;
  });
}

/** Danh sách Viện mà người dùng được kiểm duyệt; null = mọi Viện. */
export function moderationScope(subject: Subject): string[] | null {
  const facultyIds: string[] = [];
  for (const role of subject.roles) {
    if (!ROLE_PERMISSIONS[role.key].includes(PERMISSIONS.documentModerate)) continue;
    if (role.facultyId === null) return null;
    facultyIds.push(role.facultyId);
  }
  return facultyIds;
}

export function hasRole(subject: Subject, key: RoleName): boolean {
  return subject.roles.some((role) => role.key === key);
}

/**
 * Kiểm duyệt viên (mọi phạm vi Viện) và quản trị viên:
 * tải tài liệu không giới hạn lượt, tài liệu họ đăng được công khai ngay sau kiểm tra tự động.
 */
export function isStaff(subject: Subject): boolean {
  return hasRole(subject, "MODERATOR") || hasRole(subject, "ADMIN");
}
