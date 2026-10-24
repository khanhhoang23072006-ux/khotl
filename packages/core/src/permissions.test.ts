import { describe, expect, it } from "vitest";
import { can, hasRole, moderationScope, PERMISSIONS } from "./permissions";

const student = { roles: [{ key: "STUDENT" as const, facultyId: null }] };
const soictModerator = {
  roles: [
    { key: "STUDENT" as const, facultyId: null },
    { key: "MODERATOR" as const, facultyId: "soict" },
  ],
};
const globalModerator = { roles: [{ key: "MODERATOR" as const, facultyId: null }] };
const admin = { roles: [{ key: "ADMIN" as const, facultyId: null }] };

describe("can", () => {
  it("sinh viên được tải lên và tải xuống, không được kiểm duyệt", () => {
    expect(can(student, PERMISSIONS.documentUpload)).toBe(true);
    expect(can(student, PERMISSIONS.documentDownload)).toBe(true);
    expect(can(student, PERMISSIONS.documentModerate)).toBe(false);
  });

  it("kiểm duyệt viên theo Viện chỉ duyệt được trong Viện của mình", () => {
    expect(can(soictModerator, PERMISSIONS.documentModerate, { facultyId: "soict" })).toBe(true);
    expect(can(soictModerator, PERMISSIONS.documentModerate, { facultyId: "sami" })).toBe(false);
    expect(can(soictModerator, PERMISSIONS.documentModerate)).toBe(true);
  });

  it("kiểm duyệt viên toàn hệ thống duyệt được mọi Viện", () => {
    expect(can(globalModerator, PERMISSIONS.documentModerate, { facultyId: "sami" })).toBe(true);
  });

  it("chỉ admin quản lý danh mục", () => {
    expect(can(globalModerator, PERMISSIONS.adminCatalog)).toBe(false);
    expect(can(admin, PERMISSIONS.adminCatalog)).toBe(true);
  });
});

describe("moderationScope", () => {
  it("trả về danh sách Viện hoặc null nếu toàn hệ thống", () => {
    expect(moderationScope(student)).toEqual([]);
    expect(moderationScope(soictModerator)).toEqual(["soict"]);
    expect(moderationScope(globalModerator)).toBeNull();
    expect(moderationScope(admin)).toBeNull();
  });
});

describe("hasRole", () => {
  it("nhận ra vai trò", () => {
    expect(hasRole(admin, "ADMIN")).toBe(true);
    expect(hasRole(student, "ADMIN")).toBe(false);
  });
});
