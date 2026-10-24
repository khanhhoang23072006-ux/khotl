/**
 * Test tích hợp sổ lượt tải, chạy với Postgres thật đã áp migration (job "Migration" trong CI):
 *   DATABASE_URL=... pnpm --filter @khotl/web test:int
 * Mỗi test tạo người dùng và tài liệu riêng nên chạy lại nhiều lần không ảnh hưởng nhau.
 */
import { randomUUID } from "node:crypto";
import { CREDIT_SETTINGS_KEY, DEFAULT_CREDIT_SETTINGS } from "@khotl/core";
import { prisma } from "@khotl/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adjustCredits,
  chargeDownload,
  consumeDownloadToken,
  createDownloadToken,
  getCreditStatus,
  grantCredits,
  lockIfRepeatedViolations,
  recordDevice,
  revokeDocumentCredits,
  rewardApproval,
  rewardHelpfulComment,
} from "./ledger";

let courseId = "";
const run = randomUUID().slice(0, 8);

async function makeUser(label: string) {
  return prisma.user.create({
    data: { name: `Test ${label}`, email: `${label}.${run}.${randomUUID().slice(0, 6)}@sis.hust.edu.vn` },
  });
}

async function makeDoc(uploaderId: string, status: "APPROVED" | "PENDING_REVIEW" = "APPROVED") {
  const id = randomUUID();
  const doc = await prisma.document.create({
    data: {
      id,
      slug: `test-${run}-${id.slice(0, 8)}`,
      title: `Tài liệu thử ${id.slice(0, 4)}`,
      type: "EXAM_FINAL",
      status,
      courseId,
      uploaderId,
      copyrightAcceptedAt: new Date(),
    },
  });
  const version = await prisma.documentVersion.create({
    data: {
      documentId: doc.id,
      versionNumber: 1,
      originalName: "de-thi.pdf",
      storageKey: `test/${run}/${id}.pdf`,
      fileKind: "PDF",
      declaredMime: "application/pdf",
      sizeBytes: 1000n,
      processingStatus: "DONE",
    },
  });
  return { doc, version };
}

/** Thời điểm cố định giữa ngày (giờ Việt Nam) để test không phụ thuộc giờ chạy. */
const NOON = new Date("2026-10-24T05:00:00Z"); // 12:00 giờ Việt Nam

beforeAll(async () => {
  // Cấu hình mặc định (10 lượt/ngày, +5 khi duyệt, trần 30/ngày, mốc 20 lượt tải)
  await prisma.systemSetting.upsert({
    where: { key: CREDIT_SETTINGS_KEY },
    create: { key: CREDIT_SETTINGS_KEY, value: { ...DEFAULT_CREDIT_SETTINGS } },
    update: { value: { ...DEFAULT_CREDIT_SETTINGS } },
  });
  const faculty = await prisma.faculty.create({
    data: { code: `T${run}`, slug: `test-${run}`, name: "Viện thử nghiệm" },
  });
  const course = await prisma.course.create({
    data: { code: `TT${run}`, slug: `tt-${run}`, name: "Học phần thử", facultyId: faculty.id },
  });
  courseId = course.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("hạn mức mỗi ngày", () => {
  it("10 lượt miễn phí, lượt thứ 11 bị từ chối khi không có lượt thưởng", async () => {
    const owner = await makeUser("owner");
    const user = await makeUser("hetluot");
    for (let i = 0; i < 10; i++) {
      const { doc, version } = await makeDoc(owner.id);
      const result = await chargeDownload(
        { userId: user.id, documentId: doc.id, versionId: version.id, exempt: false, now: NOON },
      );
      expect(result.ok && result.charge).toBe("FREE");
    }
    const { doc, version } = await makeDoc(owner.id);
    const denied = await chargeDownload({ userId: user.id, documentId: doc.id, versionId: version.id, exempt: false, now: NOON });
    expect(denied.ok).toBe(false);
    const status = await getCreditStatus(user.id, NOON);
    expect(status.freeLeft).toBe(0);
    expect(status.bonus).toBe(0);
    // Lượt bị từ chối không ghi DownloadLog và không tăng lượt tải
    expect(await prisma.downloadLog.count({ where: { userId: user.id, documentId: doc.id } })).toBe(0);
  });

  it("hết lượt miễn phí thì dùng lượt thưởng, hết cả hai thì từ chối", async () => {
    const owner = await makeUser("owner");
    const user = await makeUser("thuong");
    await prisma.downloadQuota.create({ data: { userId: user.id, date: new Date("2026-10-24T00:00:00Z"), used: 10 } });
    await adjustCredits({ userId: user.id, amount: 2, note: "test", actorId: owner.id, now: NOON });
    const charges: string[] = [];
    for (let i = 0; i < 3; i++) {
      const { doc, version } = await makeDoc(owner.id);
      const result = await chargeDownload({ userId: user.id, documentId: doc.id, versionId: version.id, exempt: false, now: NOON });
      charges.push(result.ok ? result.charge : "DENIED");
    }
    expect(charges).toEqual(["BONUS", "BONUS", "DENIED"]);
    const spends = await prisma.creditLedger.count({ where: { userId: user.id, type: "SPEND" } });
    expect(spends).toBe(2);
  });

  it("qua 00:00 giờ Việt Nam thì có lại 10 lượt", async () => {
    const owner = await makeUser("owner");
    const user = await makeUser("reset");
    const lateNight = new Date("2026-10-24T16:30:00Z"); // 23:30 giờ Việt Nam
    for (let i = 0; i < 10; i++) {
      const { doc, version } = await makeDoc(owner.id);
      await chargeDownload({ userId: user.id, documentId: doc.id, versionId: version.id, exempt: false, now: lateNight });
    }
    const { doc, version } = await makeDoc(owner.id);
    const before = await chargeDownload({ userId: user.id, documentId: doc.id, versionId: version.id, exempt: false, now: lateNight });
    expect(before.ok).toBe(false);

    const afterMidnight = new Date("2026-10-24T17:01:00Z"); // 00:01 giờ Việt Nam ngày 25
    const after = await chargeDownload({ userId: user.id, documentId: doc.id, versionId: version.id, exempt: false, now: afterMidnight });
    expect(after.ok && after.charge).toBe("FREE");
    const status = await getCreditStatus(user.id, afterMidnight);
    expect(status.usedToday).toBe(1);
    expect(status.freeLeft).toBe(9);
    expect(status.nextReset.toISOString()).toBe("2026-10-25T17:00:00.000Z");
  });
});

describe("tải lại", () => {
  it("tải lại cùng tài liệu trong 24 giờ không bị trừ, sau 24 giờ thì bị trừ", async () => {
    const owner = await makeUser("owner");
    const user = await makeUser("tailai");
    const { doc, version } = await makeDoc(owner.id);
    const first = await chargeDownload({ userId: user.id, documentId: doc.id, versionId: version.id, exempt: false, now: NOON });
    const again = await chargeDownload({
      userId: user.id,
      documentId: doc.id,
      versionId: version.id,
      exempt: false,
      now: new Date(NOON.getTime() + 23 * 3_600_000),
    });
    expect(first.ok && first.charge).toBe("FREE");
    expect(again.ok && again.charge).toBe("REPEAT");
    const status = await getCreditStatus(user.id, NOON);
    expect(status.usedToday).toBe(1);

    const later = await chargeDownload({
      userId: user.id,
      documentId: doc.id,
      versionId: version.id,
      exempt: false,
      now: new Date(NOON.getTime() + 25 * 3_600_000),
    });
    expect(later.ok && later.charge).toBe("FREE");
    // Lượt tải của tài liệu chỉ tăng ở lần có trừ lượt
    const fresh = await prisma.document.findUniqueOrThrow({ where: { id: doc.id } });
    expect(fresh.downloadCount).toBe(2);
  });

  it("người đăng tải tài liệu của mình không bị trừ", async () => {
    const owner = await makeUser("owner");
    const { doc, version } = await makeDoc(owner.id);
    const result = await chargeDownload({ userId: owner.id, documentId: doc.id, versionId: version.id, exempt: true, now: NOON });
    expect(result.ok && result.charge).toBe("EXEMPT");
    expect((await getCreditStatus(owner.id, NOON)).usedToday).toBe(0);
  });
});

describe("bấm tải nhiều lần cùng lúc", () => {
  it("15 yêu cầu song song chỉ 10 lần thành công, không trừ trùng", async () => {
    const owner = await makeUser("owner");
    const user = await makeUser("race");
    const docs = await Promise.all(Array.from({ length: 15 }, () => makeDoc(owner.id)));
    const results = await Promise.all(
      docs.map(({ doc, version }) =>
        chargeDownload({ userId: user.id, documentId: doc.id, versionId: version.id, exempt: false, now: NOON }),
      ),
    );
    expect(results.filter((r) => r.ok).length).toBe(10);
    const quota = await prisma.downloadQuota.findFirstOrThrow({ where: { userId: user.id } });
    expect(quota.used).toBe(10);
  });

  it("cùng một tài liệu bấm 5 lần cùng lúc chỉ trừ 1 lượt", async () => {
    const owner = await makeUser("owner");
    const user = await makeUser("race2");
    const { doc, version } = await makeDoc(owner.id);
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        chargeDownload({ userId: user.id, documentId: doc.id, versionId: version.id, exempt: false, now: NOON }),
      ),
    );
    expect(results.every((r) => r.ok)).toBe(true);
    expect((await getCreditStatus(user.id, NOON)).usedToday).toBe(1);
  });
});

describe("thưởng khi được duyệt", () => {
  it("+5 khi duyệt, thêm thưởng học phần thiếu, không cộng hai lần", async () => {
    const uploader = await makeUser("uploader");
    const mod = await makeUser("mod");
    const { doc } = await makeDoc(uploader.id);
    const total = await prisma.$transaction((tx) =>
      rewardApproval(tx, { documentId: doc.id, uploaderId: uploader.id, courseApprovedBefore: 0, actorId: mod.id, title: doc.title, now: NOON }),
    );
    expect(total).toBe(5 + 3);
    const again = await prisma.$transaction((tx) =>
      rewardApproval(tx, { documentId: doc.id, uploaderId: uploader.id, courseApprovedBefore: 0, actorId: mod.id, title: doc.title, now: NOON }),
    );
    expect(again).toBe(0);
    expect((await getCreditStatus(uploader.id, NOON)).bonus).toBe(8);
  });

  it("trần 30 lượt thưởng mỗi ngày", async () => {
    const uploader = await makeUser("farm");
    const mod = await makeUser("mod");
    let total = 0;
    for (let i = 0; i < 5; i++) {
      const { doc } = await makeDoc(uploader.id);
      total += await prisma.$transaction((tx) =>
        rewardApproval(tx, { documentId: doc.id, uploaderId: uploader.id, courseApprovedBefore: 100, actorId: mod.id, title: doc.title, now: NOON }),
      );
    }
    for (let i = 0; i < 3; i++) {
      const { doc } = await makeDoc(uploader.id);
      total += await prisma.$transaction((tx) =>
        rewardApproval(tx, { documentId: doc.id, uploaderId: uploader.id, courseApprovedBefore: 100, actorId: mod.id, title: doc.title, now: NOON }),
      );
    }
    expect(total).toBe(30);
    // Hôm sau lại được cộng
    const { doc } = await makeDoc(uploader.id);
    const tomorrow = new Date(NOON.getTime() + 86_400_000);
    const next = await prisma.$transaction((tx) =>
      rewardApproval(tx, { documentId: doc.id, uploaderId: uploader.id, courseApprovedBefore: 100, actorId: mod.id, title: doc.title, now: tomorrow }),
    );
    expect(next).toBe(5);
  });

  it("lượt thưởng hết hạn sau 90 ngày", async () => {
    const uploader = await makeUser("expire");
    const mod = await makeUser("mod");
    const { doc } = await makeDoc(uploader.id);
    await prisma.$transaction((tx) =>
      rewardApproval(tx, { documentId: doc.id, uploaderId: uploader.id, courseApprovedBefore: 100, actorId: mod.id, title: doc.title, now: NOON }),
    );
    expect((await getCreditStatus(uploader.id, new Date(NOON.getTime() + 89 * 86_400_000))).bonus).toBe(5);
    expect((await getCreditStatus(uploader.id, new Date(NOON.getTime() + 91 * 86_400_000))).bonus).toBe(0);
  });

  it("mỗi 20 lượt tải được +1 cho người đăng", async () => {
    const uploader = await makeUser("milestone");
    const { doc, version } = await makeDoc(uploader.id);
    await prisma.document.update({ where: { id: doc.id }, data: { downloadCount: 19 } });
    const reader = await makeUser("reader");
    const result = await chargeDownload({ userId: reader.id, documentId: doc.id, versionId: version.id, exempt: false, now: NOON });
    expect(result.ok && result.milestones).toBe(1);
    expect((await getCreditStatus(uploader.id, NOON)).bonus).toBe(1);
  });

  it("bình luận hữu ích được thưởng một lần", async () => {
    const author = await makeUser("comment");
    const commentId = randomUUID();
    const first = await prisma.$transaction((tx) => rewardHelpfulComment(tx, { commentId, authorId: author.id, likeCount: 5, now: NOON }));
    const second = await prisma.$transaction((tx) => rewardHelpfulComment(tx, { commentId, authorId: author.id, likeCount: 6, now: NOON }));
    const notYet = await prisma.$transaction((tx) => rewardHelpfulComment(tx, { commentId: randomUUID(), authorId: author.id, likeCount: 2, now: NOON }));
    expect([first, second, notYet]).toEqual([1, 0, 0]);
  });
});

describe("tài liệu bị gỡ sau khi đã nhận thưởng", () => {
  it("thu hồi đủ số lượt khi chưa dùng", async () => {
    const uploader = await makeUser("revoke");
    const mod = await makeUser("mod");
    const { doc } = await makeDoc(uploader.id);
    await prisma.$transaction((tx) =>
      rewardApproval(tx, { documentId: doc.id, uploaderId: uploader.id, courseApprovedBefore: 100, actorId: mod.id, title: doc.title, now: NOON }),
    );
    const revoked = await prisma.$transaction((tx) =>
      revokeDocumentCredits(tx, { documentId: doc.id, uploaderId: uploader.id, actorId: mod.id, reason: "vi phạm", now: NOON }),
    );
    expect(revoked).toBe(5);
    const status = await getCreditStatus(uploader.id, NOON);
    expect(status.bonus).toBe(0);
    expect(status.debt).toBe(0);
    // Gỡ lần nữa không trừ thêm
    const twice = await prisma.$transaction((tx) =>
      revokeDocumentCredits(tx, { documentId: doc.id, uploaderId: uploader.id, actorId: mod.id, reason: "vi phạm", now: NOON }),
    );
    expect(twice).toBe(0);
  });

  it("đã tiêu lượt thì ghi nợ, lần thưởng sau trả nợ trước", async () => {
    const uploader = await makeUser("debt");
    const mod = await makeUser("mod");
    const owner = await makeUser("owner");
    const { doc } = await makeDoc(uploader.id);
    await prisma.$transaction((tx) =>
      rewardApproval(tx, { documentId: doc.id, uploaderId: uploader.id, courseApprovedBefore: 100, actorId: mod.id, title: doc.title, now: NOON }),
    );
    // Dùng hết 10 lượt miễn phí và 3 lượt thưởng
    await prisma.downloadQuota.create({ data: { userId: uploader.id, date: new Date("2026-10-24T00:00:00Z"), used: 10 } });
    for (let i = 0; i < 3; i++) {
      const other = await makeDoc(owner.id);
      const r = await chargeDownload({ userId: uploader.id, documentId: other.doc.id, versionId: other.version.id, exempt: false, now: NOON });
      expect(r.ok && r.charge).toBe("BONUS");
    }
    await prisma.$transaction((tx) =>
      revokeDocumentCredits(tx, { documentId: doc.id, uploaderId: uploader.id, actorId: mod.id, reason: "bản quyền", now: NOON }),
    );
    let status = await getCreditStatus(uploader.id, NOON);
    expect(status.bonus).toBe(0);
    expect(status.debt).toBe(3);

    const second = await makeDoc(uploader.id);
    const tomorrow = new Date(NOON.getTime() + 86_400_000);
    await prisma.$transaction((tx) =>
      rewardApproval(tx, { documentId: second.doc.id, uploaderId: uploader.id, courseApprovedBefore: 100, actorId: mod.id, title: "x", now: tomorrow }),
    );
    status = await getCreditStatus(uploader.id, tomorrow);
    expect(status.debt).toBe(0);
    expect(status.bonus).toBe(2);
  });

  it("vi phạm đủ số lần thì khóa thưởng, thưởng sau đó bị tạm giữ", async () => {
    const uploader = await makeUser("violator");
    const mod = await makeUser("mod");
    for (let i = 0; i < 3; i++) {
      const { doc } = await makeDoc(uploader.id);
      await prisma.moderationLog.create({ data: { action: "REMOVE", actorId: mod.id, documentId: doc.id, targetUserId: uploader.id } });
    }
    expect(await lockIfRepeatedViolations(prisma, uploader.id)).toBe(true);
    const { doc } = await makeDoc(uploader.id);
    const granted = await prisma.$transaction((tx) =>
      grantCredits(tx, { userId: uploader.id, type: "UPLOAD_REWARD", amount: 5, dedupeKey: `upload:${doc.id}`, note: "x", now: NOON }),
    );
    expect(granted).toEqual({ granted: 0, reason: "locked" });
  });
});

describe("chống gian lận", () => {
  it("một thiết bị dùng 3 tài khoản thì khóa thưởng cả 3", async () => {
    const device = `dev-${randomUUID()}`;
    const users = [await makeUser("a"), await makeUser("b"), await makeUser("c")];
    const results = [];
    for (const u of users) results.push(await recordDevice({ userId: u.id, deviceHash: device, now: NOON }));
    expect(results.map((r) => r.suspicious)).toEqual([false, false, true]);
    const locked = await prisma.user.count({ where: { id: { in: users.map((u) => u.id) }, rewardsLockedAt: { not: null } } });
    expect(locked).toBe(3);
  });

  it("link tải chỉ dùng được một lần và hết hạn nhanh", async () => {
    const owner = await makeUser("owner");
    const user = await makeUser("token");
    const { doc, version } = await makeDoc(owner.id);
    const token = await createDownloadToken({ userId: user.id, documentId: doc.id, versionId: version.id, ttlSeconds: 60, now: NOON });
    expect(await consumeDownloadToken(token, user.id, NOON)).toEqual({ documentId: doc.id, versionId: version.id });
    expect(await consumeDownloadToken(token, user.id, NOON)).toBeNull();

    const other = await createDownloadToken({ userId: user.id, documentId: doc.id, versionId: version.id, ttlSeconds: 60, now: NOON });
    expect(await consumeDownloadToken(other, owner.id, NOON)).toBeNull(); // người khác không dùng được
    expect(await consumeDownloadToken(other, user.id, new Date(NOON.getTime() + 61_000))).toBeNull(); // hết hạn
  });

  it("mọi giao dịch đều có trong sổ", async () => {
    const owner = await makeUser("owner");
    const user = await makeUser("audit");
    const { doc, version } = await makeDoc(owner.id);
    await adjustCredits({ userId: user.id, amount: 3, note: "bù lỗi", actorId: owner.id, now: NOON });
    await adjustCredits({ userId: user.id, amount: -1, note: "trừ tay", actorId: owner.id, now: NOON });
    await chargeDownload({ userId: user.id, documentId: doc.id, versionId: version.id, exempt: false, now: NOON });
    const entries = await prisma.creditLedger.findMany({ where: { userId: user.id }, orderBy: { id: "asc" } });
    expect(entries.map((e) => [e.type, e.amount])).toEqual([
      ["ADJUSTMENT", 3],
      ["ADJUSTMENT", -1],
      ["DAILY", -1],
    ]);
    expect(await prisma.auditLog.count({ where: { entityId: user.id, action: "credits.adjust" } })).toBe(2);
  });
});
