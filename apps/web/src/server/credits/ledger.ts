import { createHash, randomBytes } from "node:crypto";
import {
  CREDIT_SETTINGS_KEY,
  type CreditSettings,
  capGrant,
  crossedMilestones,
  creditExpiry,
  decideCharge,
  nextVietnamMidnight,
  parseCreditSettings,
  sortLotsForSpending,
  startOfVietnamDay,
  takeFromLots,
  vietnamDay,
} from "@khotl/core";
import { type DownloadCharge, type Prisma, type PrismaClient, prisma } from "@khotl/db";

/**
 * Sổ lượt tải. Mọi thay đổi số dư đi qua các hàm ở đây và ghi một dòng CreditLedger.
 * Không import "server-only" hay next/* để test tích hợp gọi trực tiếp được với Postgres thật.
 */

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;
type DbOrTx = Db | Tx;

/** Loại cộng thưởng tính vào trần mỗi ngày (điều chỉnh tay của admin thì không). */
const EARNED_TYPES = ["UPLOAD_REWARD", "BONUS"] as const;

function dayKey(now: Date): string {
  return vietnamDay(now).toISOString().slice(0, 10);
}

export async function getCreditSettings(db: DbOrTx = prisma): Promise<CreditSettings> {
  const row = await db.systemSetting.findUnique({ where: { key: CREDIT_SETTINGS_KEY } });
  return parseCreditSettings(row?.value);
}

export async function saveCreditSettings(
  values: Partial<CreditSettings>,
  actorId: string,
  db: Db = prisma,
): Promise<CreditSettings> {
  const before = await getCreditSettings(db);
  const next = parseCreditSettings({ ...before, ...values });
  await db.$transaction([
    db.systemSetting.upsert({
      where: { key: CREDIT_SETTINGS_KEY },
      create: {
        key: CREDIT_SETTINGS_KEY,
        value: next as unknown as Prisma.InputJsonValue,
        description: "Hạn mức tải xuống và lượt thưởng",
        updatedById: actorId,
      },
      update: { value: next as unknown as Prisma.InputJsonValue, updatedById: actorId },
    }),
    db.auditLog.create({
      data: {
        actorId,
        action: "settings.update",
        entityType: "SystemSetting",
        entityId: CREDIT_SETTINGS_KEY,
        before: before as unknown as Prisma.InputJsonValue,
        after: next as unknown as Prisma.InputJsonValue,
      },
    }),
  ]);
  return next;
}

// ---------------------------------------------------------------------------
// Số dư
// ---------------------------------------------------------------------------

interface LotRow {
  id: bigint;
  remaining: number;
  expiresAt: Date | null;
  documentId: string | null;
}

/** Các lô còn lượt và còn hạn. `lock` = khóa các dòng này tới hết transaction. */
async function validLots(db: DbOrTx, userId: string, now: Date, lock = false): Promise<LotRow[]> {
  const rows = lock
    ? await db.$queryRaw<LotRow[]>`
        SELECT id, remaining, "expiresAt", "documentId" FROM credit_ledger
        WHERE "userId" = ${userId} AND remaining > 0 AND ("expiresAt" IS NULL OR "expiresAt" > ${now})
        FOR UPDATE`
    : await db.$queryRaw<LotRow[]>`
        SELECT id, remaining, "expiresAt", "documentId" FROM credit_ledger
        WHERE "userId" = ${userId} AND remaining > 0 AND ("expiresAt" IS NULL OR "expiresAt" > ${now})`;
  return sortLotsForSpending(rows);
}

export interface CreditStatus {
  dailyFree: number;
  usedToday: number;
  freeLeft: number;
  /** lượt thưởng dùng được (đã trừ nợ) */
  bonus: number;
  debt: number;
  /** lô sắp hết hạn gần nhất trong 14 ngày tới */
  expiringSoon: { amount: number; at: Date } | null;
  nextReset: Date;
  rewardsLocked: boolean;
  rewardsLockReason: string | null;
}

export async function getCreditStatus(
  userId: string,
  now: Date = new Date(),
  db: DbOrTx = prisma,
): Promise<CreditStatus> {
  const [settings, quota, user, lots] = await Promise.all([
    getCreditSettings(db),
    db.downloadQuota.findUnique({
      where: { userId_date: { userId, date: vietnamDay(now) } },
      select: { used: true },
    }),
    db.user.findUnique({
      where: { id: userId },
      select: { creditDebt: true, rewardsLockedAt: true, rewardsLockReason: true },
    }),
    validLots(db, userId, now),
  ]);
  const usedToday = quota?.used ?? 0;
  const debt = user?.creditDebt ?? 0;
  const total = lots.reduce((sum, lot) => sum + lot.remaining, 0);
  const soonLimit = now.getTime() + 14 * 86_400_000;
  const soon = lots.find((lot) => lot.expiresAt && lot.expiresAt.getTime() <= soonLimit);
  return {
    dailyFree: settings.dailyFree,
    usedToday,
    freeLeft: Math.max(0, settings.dailyFree - usedToday),
    bonus: Math.max(0, total - debt),
    debt,
    expiringSoon: soon?.expiresAt ? { amount: soon.remaining, at: soon.expiresAt } : null,
    nextReset: nextVietnamMidnight(now),
    rewardsLocked: Boolean(user?.rewardsLockedAt),
    rewardsLockReason: user?.rewardsLockReason ?? null,
  };
}

// ---------------------------------------------------------------------------
// Cộng lượt
// ---------------------------------------------------------------------------

export interface GrantInput {
  userId: string;
  type: "UPLOAD_REWARD" | "BONUS" | "ADJUSTMENT";
  amount: number;
  /** chống cộng hai lần cho cùng một sự kiện */
  dedupeKey?: string;
  documentId?: string | null;
  actorId?: string | null;
  note: string;
  now?: Date;
}

export interface GrantResult {
  granted: number;
  reason?: "duplicate" | "locked" | "cap" | "zero";
}

/**
 * Cộng lượt thưởng trong transaction `tx`. Khóa dòng user để trần mỗi ngày và nợ được tính đúng
 * khi nhiều sự kiện cùng lúc. Thưởng tự động bị bỏ qua khi tài khoản đang bị khóa thưởng.
 */
export async function grantCredits(tx: Tx, input: GrantInput): Promise<GrantResult> {
  const now = input.now ?? new Date();
  if (input.amount <= 0) return { granted: 0, reason: "zero" };
  const settings = await getCreditSettings(tx);

  const [user] = await tx.$queryRaw<{ creditDebt: number; rewardsLockedAt: Date | null }[]>`
    SELECT "creditDebt", "rewardsLockedAt" FROM users WHERE id = ${input.userId} FOR UPDATE`;
  if (!user) return { granted: 0, reason: "zero" };

  if (input.dedupeKey) {
    const existing = await tx.creditLedger.findUnique({ where: { dedupeKey: input.dedupeKey } });
    if (existing) return { granted: 0, reason: "duplicate" };
  }

  const automatic = input.type !== "ADJUSTMENT";
  if (automatic && user.rewardsLockedAt) {
    // Ghi lại để người dùng và admin thấy lý do không được cộng
    await tx.creditLedger.create({
      data: {
        userId: input.userId,
        type: input.type,
        amount: 0,
        documentId: input.documentId ?? null,
        note: `${input.note} (tạm giữ: tài khoản đang bị khóa thưởng)`,
        dedupeKey: input.dedupeKey ?? null,
        createdAt: now,
      },
    });
    return { granted: 0, reason: "locked" };
  }

  let amount = input.amount;
  let capped = false;
  if (automatic) {
    const [earned] = await tx.$queryRaw<{ total: number }[]>`
      SELECT COALESCE(SUM(amount), 0)::int AS total FROM credit_ledger
      WHERE "userId" = ${input.userId} AND amount > 0
        AND type::text IN (${EARNED_TYPES[0]}, ${EARNED_TYPES[1]})
        AND "createdAt" >= ${startOfVietnamDay(now)}`;
    amount = capGrant(input.amount, earned?.total ?? 0, settings.dailyEarnCap);
    capped = amount < input.amount;
  }
  if (amount <= 0) {
    await tx.creditLedger.create({
      data: {
        userId: input.userId,
        type: input.type,
        amount: 0,
        documentId: input.documentId ?? null,
        note: `${input.note} (đã đạt trần ${settings.dailyEarnCap} lượt thưởng hôm nay)`,
        dedupeKey: input.dedupeKey ?? null,
        createdAt: now,
      },
    });
    return { granted: 0, reason: "cap" };
  }

  // Lượt thưởng trả nợ trước (nợ phát sinh khi bị thu hồi lượt đã tiêu)
  const payDebt = Math.min(user.creditDebt, amount);
  if (payDebt > 0) {
    await tx.user.update({ where: { id: input.userId }, data: { creditDebt: { decrement: payDebt } } });
  }
  const notes = [input.note];
  if (capped) notes.push(`chỉ cộng ${amount}/${input.amount} vì chạm trần ngày`);
  if (payDebt > 0) notes.push(`${payDebt} lượt bù nợ`);
  await tx.creditLedger.create({
    data: {
      userId: input.userId,
      type: input.type,
      amount,
      remaining: amount - payDebt,
      expiresAt: creditExpiry(now, settings),
      documentId: input.documentId ?? null,
      actorId: input.actorId ?? null,
      note: notes.join("; "),
      dedupeKey: input.dedupeKey ?? null,
      createdAt: now,
    },
  });
  return { granted: amount, ...(capped ? { reason: "cap" as const } : {}) };
}

/** Lấy `amount` lượt từ các lô (ưu tiên `preferDocumentId`), phần thiếu ghi thành nợ. */
async function takeCredits(
  tx: Tx,
  userId: string,
  amount: number,
  now: Date,
  preferDocumentId?: string,
): Promise<{ taken: number; debt: number }> {
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
  // Lô của chính tài liệu bị gỡ (kể cả đã hết hạn) trừ trước, rồi tới các lô còn hạn khác
  const own = preferDocumentId
    ? await tx.$queryRaw<LotRow[]>`
        SELECT id, remaining, "expiresAt", "documentId" FROM credit_ledger
        WHERE "userId" = ${userId} AND "documentId" = ${preferDocumentId} AND remaining > 0
        ORDER BY id FOR UPDATE`
    : [];
  const others = (await validLots(tx, userId, now, true)).filter(
    (lot) => !own.some((mine) => mine.id === lot.id),
  );
  const { takes, shortfall } = takeFromLots([...own, ...others], amount);
  for (const { lot, take } of takes) {
    await tx.creditLedger.update({ where: { id: lot.id }, data: { remaining: { decrement: take } } });
  }
  if (shortfall > 0) {
    await tx.user.update({ where: { id: userId }, data: { creditDebt: { increment: shortfall } } });
  }
  return { taken: amount - shortfall, debt: shortfall };
}

// ---------------------------------------------------------------------------
// Trừ lượt khi tải
// ---------------------------------------------------------------------------

export interface ChargeInput {
  userId: string;
  documentId: string;
  versionId: string;
  /** người đăng tải tài liệu của mình, kiểm duyệt viên tải để duyệt, tài liệu chưa công khai */
  exempt: boolean;
  ipHash?: string | null;
  deviceHash?: string | null;
  now?: Date;
}

export type ChargeResult =
  | { ok: true; charge: DownloadCharge; milestones: number }
  | { ok: false; reason: "NO_CREDITS" };

/**
 * Kiểm tra và trừ lượt trong MỘT transaction. Dòng DownloadQuota của người dùng trong ngày bị
 * khóa (FOR UPDATE) nên bấm tải nhiều lần cùng lúc vẫn được xử lý lần lượt, không trừ trùng,
 * không vượt hạn mức.
 */
export async function chargeDownload(input: ChargeInput, db: Db = prisma): Promise<ChargeResult> {
  const now = input.now ?? new Date();
  const day = dayKey(now);

  const result = await db.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO download_quotas ("userId", "date", used, "updatedAt")
      VALUES (${input.userId}, ${day}::date, 0, ${now})
      ON CONFLICT DO NOTHING`;
    const [quota] = await tx.$queryRaw<{ used: number }[]>`
      SELECT used FROM download_quotas WHERE "userId" = ${input.userId} AND "date" = ${day}::date FOR UPDATE`;
    const settings = await getCreditSettings(tx);

    const log = async (charge: DownloadCharge) =>
      tx.downloadLog.create({
        data: {
          userId: input.userId,
          documentId: input.documentId,
          versionId: input.versionId,
          ipHash: input.ipHash ?? null,
          deviceHash: input.deviceHash ?? null,
          charge,
          createdAt: now,
        },
      });

    if (input.exempt) {
      await log("EXEMPT");
      return { ok: true as const, charge: "EXEMPT" as const, marks: [] as number[], uploaderId: "" };
    }

    const since = new Date(now.getTime() - settings.redownloadWindowHours * 3_600_000);
    const recent = await tx.downloadLog.findFirst({
      where: {
        userId: input.userId,
        documentId: input.documentId,
        charge: { in: ["FREE", "BONUS"] },
        createdAt: { gt: since },
      },
      select: { id: true },
    });

    let bonusBalance = 0;
    const usedToday = quota?.used ?? 0;
    if (!recent && usedToday >= settings.dailyFree) {
      const [user] = await tx.$queryRaw<{ creditDebt: number }[]>`
        SELECT "creditDebt" FROM users WHERE id = ${input.userId} FOR UPDATE`;
      const lots = await validLots(tx, input.userId, now, true);
      bonusBalance = lots.reduce((sum, lot) => sum + lot.remaining, 0) - (user?.creditDebt ?? 0);
    }

    const decision = decideCharge({
      repeatWithinWindow: Boolean(recent),
      usedToday,
      dailyFree: settings.dailyFree,
      bonusBalance,
    });
    if (decision === "DENIED") return { ok: false as const, reason: "NO_CREDITS" as const };
    let marks: number[] = [];
    let uploaderId = "";

    if (decision === "FREE") {
      await tx.$executeRaw`
        UPDATE download_quotas SET used = used + 1, "updatedAt" = ${now}
        WHERE "userId" = ${input.userId} AND "date" = ${day}::date`;
      await tx.creditLedger.create({
        data: {
          userId: input.userId,
          type: "DAILY",
          amount: -1,
          documentId: input.documentId,
          note: `Lượt miễn phí ${usedToday + 1}/${settings.dailyFree} hôm nay`,
          createdAt: now,
        },
      });
    } else if (decision === "BONUS") {
      const lots = await validLots(tx, input.userId, now, true);
      const { takes } = takeFromLots(lots, 1);
      for (const { lot, take } of takes) {
        await tx.creditLedger.update({ where: { id: lot.id }, data: { remaining: { decrement: take } } });
      }
      await tx.creditLedger.create({
        data: {
          userId: input.userId,
          type: "SPEND",
          amount: -1,
          documentId: input.documentId,
          note: "Dùng 1 lượt thưởng",
          createdAt: now,
        },
      });
    }
    await log(decision);

    // Chỉ lần tải có trừ lượt mới tính vào lượt tải của tài liệu (chống tự tăng lượt tải để lấy thưởng)
    if (decision !== "REPEAT") {
      const doc = await tx.document.update({
        where: { id: input.documentId },
        data: { downloadCount: { increment: 1 } },
        select: { downloadCount: true, uploaderId: true, status: true },
      });
      await tx.documentDailyStat.upsert({
        where: { documentId_date: { documentId: input.documentId, date: vietnamDay(now) } },
        create: { documentId: input.documentId, date: vietnamDay(now), downloads: 1 },
        update: { downloads: { increment: 1 } },
      });
      if (doc.status === "APPROVED" && doc.uploaderId !== input.userId && settings.milestoneReward > 0) {
        marks = crossedMilestones(doc.downloadCount - 1, doc.downloadCount, settings.milestoneEvery);
        uploaderId = doc.uploaderId;
      }
    }
    return { ok: true as const, charge: decision, marks, uploaderId };
  });
  if (!result.ok) return result;

  // Thưởng mốc lượt tải cho người đăng chạy ở transaction riêng sau khi trừ lượt xong,
  // để không giữ khóa của hai người dùng cùng lúc (tránh deadlock). dedupeKey bảo đảm chỉ cộng một lần.
  let milestones = 0;
  for (const mark of result.marks) {
    const settings = await getCreditSettings(db);
    const granted = await db.$transaction((tx) =>
      grantCredits(tx, {
        userId: result.uploaderId,
        type: "BONUS",
        amount: settings.milestoneReward,
        dedupeKey: `milestone:${input.documentId}:${mark}`,
        documentId: input.documentId,
        note: `Tài liệu đạt ${mark} lượt tải`,
        now,
      }),
    );
    milestones += granted.granted;
  }
  return { ok: true, charge: result.charge, milestones };
}

// ---------------------------------------------------------------------------
// Sự kiện kiểm duyệt
// ---------------------------------------------------------------------------

/**
 * Tài liệu được DUYỆT: +uploadReward, thêm thưởng nếu học phần đang thiếu tài liệu.
 * `courseApprovedBefore` là số tài liệu đã duyệt của học phần TRƯỚC khi duyệt tài liệu này.
 * Gọi bên trong transaction duyệt.
 */
export async function rewardApproval(
  tx: Tx,
  input: {
    documentId: string;
    uploaderId: string;
    courseApprovedBefore: number;
    actorId: string;
    title: string;
    now?: Date;
  },
): Promise<number> {
  const settings = await getCreditSettings(tx);
  const base = await grantCredits(tx, {
    userId: input.uploaderId,
    type: "UPLOAD_REWARD",
    amount: settings.uploadReward,
    dedupeKey: `upload:${input.documentId}`,
    documentId: input.documentId,
    actorId: input.actorId,
    note: `Tài liệu “${input.title}” được duyệt`,
    now: input.now,
  });
  let total = base.granted;
  if (input.courseApprovedBefore < settings.scarceCourseThreshold) {
    const bonus = await grantCredits(tx, {
      userId: input.uploaderId,
      type: "BONUS",
      amount: settings.scarceCourseBonus,
      dedupeKey: `scarce:${input.documentId}`,
      documentId: input.documentId,
      actorId: input.actorId,
      note: "Thưởng đóng góp cho học phần đang thiếu tài liệu",
      now: input.now,
    });
    total += bonus.granted;
  }
  return total;
}

/**
 * Tài liệu bị gỡ sau khi đã nhận thưởng: thu hồi toàn bộ lượt đã cộng nhờ tài liệu này
 * (thưởng duyệt, mốc lượt tải, học phần thiếu). Lượt đã tiêu hết thì ghi nợ, trừ vào lần thưởng sau.
 * Gọi bên trong transaction gỡ. Trả về số lượt thu hồi.
 */
export async function revokeDocumentCredits(
  tx: Tx,
  input: { documentId: string; uploaderId: string; actorId: string | null; reason: string; now?: Date },
): Promise<number> {
  const now = input.now ?? new Date();
  const [sums] = await tx.$queryRaw<{ granted: number; revoked: number }[]>`
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE amount > 0 AND type::text IN ('UPLOAD_REWARD', 'BONUS')), 0)::int AS granted,
      COALESCE(-SUM(amount) FILTER (WHERE type::text = 'REVOKE'), 0)::int AS revoked
    FROM credit_ledger WHERE "userId" = ${input.uploaderId} AND "documentId" = ${input.documentId}`;
  const amount = (sums?.granted ?? 0) - (sums?.revoked ?? 0);
  if (amount <= 0) return 0;
  const { debt } = await takeCredits(tx, input.uploaderId, amount, now, input.documentId);
  await tx.creditLedger.create({
    data: {
      userId: input.uploaderId,
      type: "REVOKE",
      amount: -amount,
      documentId: input.documentId,
      actorId: input.actorId,
      note: `Thu hồi vì tài liệu bị gỡ: ${input.reason}${debt > 0 ? ` (ghi nợ ${debt} lượt đã dùng)` : ""}`,
      createdAt: now,
    },
  });
  return amount;
}

/** Bình luận đạt đủ lượt thích: thưởng người viết một lần. */
export async function rewardHelpfulComment(
  tx: Tx,
  input: { commentId: string; authorId: string; likeCount: number; documentId?: string | null; now?: Date },
): Promise<number> {
  const settings = await getCreditSettings(tx);
  if (input.likeCount < settings.helpfulCommentLikes) return 0;
  const result = await grantCredits(tx, {
    userId: input.authorId,
    type: "BONUS",
    amount: settings.helpfulCommentReward,
    dedupeKey: `comment:${input.commentId}`,
    documentId: input.documentId ?? null,
    note: `Bình luận hữu ích đạt ${settings.helpfulCommentLikes} lượt thích`,
    now: input.now,
  });
  return result.granted;
}

// ---------------------------------------------------------------------------
// Khóa thưởng, điều chỉnh tay
// ---------------------------------------------------------------------------

export async function lockRewards(db: DbOrTx, userId: string, reason: string, actorId: string | null = null) {
  const updated = await db.user.updateMany({
    where: { id: userId, rewardsLockedAt: null },
    data: { rewardsLockedAt: new Date(), rewardsLockReason: reason },
  });
  if (updated.count > 0) {
    await db.auditLog.create({
      data: { actorId, action: "credits.lock", entityType: "User", entityId: userId, after: { reason } },
    });
  }
  return updated.count > 0;
}

export async function unlockRewards(db: DbOrTx, userId: string, actorId: string) {
  await db.user.update({ where: { id: userId }, data: { rewardsLockedAt: null, rewardsLockReason: null } });
  await db.auditLog.create({ data: { actorId, action: "credits.unlock", entityType: "User", entityId: userId } });
}

/** Sau khi gỡ tài liệu vì vi phạm: đủ số lần vi phạm thì khóa cơ chế thưởng. */
export async function lockIfRepeatedViolations(db: DbOrTx, userId: string): Promise<boolean> {
  const settings = await getCreditSettings(db);
  const violations = await db.moderationLog.count({ where: { targetUserId: userId, action: "REMOVE" } });
  if (violations < settings.violationLockThreshold) return false;
  return lockRewards(db, userId, `Bị gỡ tài liệu vì vi phạm ${violations} lần`);
}

/** Quản trị viên cộng hoặc trừ tay; luôn ghi sổ và nhật ký kiểm toán. */
export async function adjustCredits(
  input: { userId: string; amount: number; note: string; actorId: string; now?: Date },
  db: Db = prisma,
): Promise<void> {
  const now = input.now ?? new Date();
  await db.$transaction(async (tx) => {
    if (input.amount > 0) {
      await grantCredits(tx, {
        userId: input.userId,
        type: "ADJUSTMENT",
        amount: input.amount,
        actorId: input.actorId,
        note: input.note,
        now,
      });
    } else if (input.amount < 0) {
      const { debt } = await takeCredits(tx, input.userId, -input.amount, now);
      await tx.creditLedger.create({
        data: {
          userId: input.userId,
          type: "ADJUSTMENT",
          amount: input.amount,
          actorId: input.actorId,
          note: debt > 0 ? `${input.note} (ghi nợ ${debt})` : input.note,
          createdAt: now,
        },
      });
    }
    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        action: "credits.adjust",
        entityType: "User",
        entityId: input.userId,
        after: { amount: input.amount, note: input.note },
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Nhiều tài khoản trên một thiết bị
// ---------------------------------------------------------------------------

/**
 * Ghi nhận thiết bị (cookie ngẫu nhiên đã băm) đang dùng tài khoản này. Khi một thiết bị dùng từ
 * `multiAccountThreshold` tài khoản trở lên trong 30 ngày, tạm khóa cộng thưởng cho các tài khoản đó
 * để kiểm duyệt viên xem lại. Không khóa tải xuống, chỉ khóa thưởng.
 * IP không dùng để khóa vì cả ký túc xá dùng chung một IP; IP chỉ được ghi lại để tra cứu.
 */
export async function recordDevice(
  input: { userId: string; deviceHash: string; ipHash?: string | null; now?: Date },
  db: DbOrTx = prisma,
): Promise<{ suspicious: boolean; accounts: number }> {
  const now = input.now ?? new Date();
  await db.deviceSighting.upsert({
    where: { deviceHash_userId: { deviceHash: input.deviceHash, userId: input.userId } },
    create: { deviceHash: input.deviceHash, userId: input.userId, ipHash: input.ipHash ?? null, firstSeenAt: now, lastSeenAt: now },
    update: { lastSeenAt: now, ipHash: input.ipHash ?? null },
  });
  const settings = await getCreditSettings(db);
  const recent = await db.deviceSighting.findMany({
    where: { deviceHash: input.deviceHash, lastSeenAt: { gt: new Date(now.getTime() - 30 * 86_400_000) } },
    select: { userId: true },
  });
  if (recent.length < settings.multiAccountThreshold) return { suspicious: false, accounts: recent.length };
  for (const { userId } of recent) {
    await lockRewards(db, userId, `Một thiết bị dùng ${recent.length} tài khoản trong 30 ngày`);
  }
  return { suspicious: true, accounts: recent.length };
}

// ---------------------------------------------------------------------------
// Link tải dùng một lần
// ---------------------------------------------------------------------------

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createDownloadToken(
  input: { userId: string; documentId: string; versionId: string; ttlSeconds: number; now?: Date },
  db: DbOrTx = prisma,
): Promise<string> {
  const now = input.now ?? new Date();
  const token = randomBytes(24).toString("base64url");
  await db.downloadToken.create({
    data: {
      tokenHash: hashToken(token),
      userId: input.userId,
      documentId: input.documentId,
      versionId: input.versionId,
      expiresAt: new Date(now.getTime() + input.ttlSeconds * 1000),
      createdAt: now,
    },
  });
  return token;
}

/** Dùng token đúng một lần: lần thứ hai, token sai hoặc hết hạn đều trả về null. */
export async function consumeDownloadToken(
  token: string,
  userId: string,
  now: Date = new Date(),
  db: DbOrTx = prisma,
): Promise<{ documentId: string; versionId: string } | null> {
  const tokenHash = hashToken(token);
  const used = await db.downloadToken.updateMany({
    where: { tokenHash, userId, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (used.count !== 1) return null;
  return db.downloadToken.findUnique({
    where: { tokenHash },
    select: { documentId: true, versionId: true },
  });
}

/** Dự đoán lần tải tới sẽ tính thế nào (chỉ để hiển thị, không khóa, không trừ). */
export async function previewCharge(
  userId: string,
  documentId: string,
  now: Date = new Date(),
  db: DbOrTx = prisma,
): Promise<{ decision: "REPEAT" | "FREE" | "BONUS" | "DENIED"; status: CreditStatus; settings: CreditSettings }> {
  const [status, settings] = await Promise.all([getCreditStatus(userId, now, db), getCreditSettings(db)]);
  const recent = await db.downloadLog.findFirst({
    where: {
      userId,
      documentId,
      charge: { in: ["FREE", "BONUS"] },
      createdAt: { gt: new Date(now.getTime() - settings.redownloadWindowHours * 3_600_000) },
    },
    select: { id: true },
  });
  const decision = decideCharge({
    repeatWithinWindow: Boolean(recent),
    usedToday: status.usedToday,
    dailyFree: status.dailyFree,
    bonusBalance: status.bonus,
  });
  return { decision, status, settings };
}
