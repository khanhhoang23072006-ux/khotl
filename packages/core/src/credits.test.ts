import { describe, expect, it } from "vitest";
import {
  capGrant,
  crossedMilestones,
  DEFAULT_CREDIT_SETTINGS,
  decideCharge,
  hammingDistance,
  isTooShort,
  NEAR_DUPLICATE_MAX_DISTANCE,
  nextVietnamMidnight,
  parseCreditSettings,
  simhash,
  sortLotsForSpending,
  startOfVietnamDay,
  takeFromLots,
} from "./credits";

describe("cấu hình lượt tải", () => {
  it("thiếu hoặc sai kiểu thì dùng mặc định, vượt giới hạn thì kẹp lại", () => {
    expect(parseCreditSettings(null)).toEqual(DEFAULT_CREDIT_SETTINGS);
    const parsed = parseCreditSettings({ dailyFree: "15", uploadReward: -3, dailyEarnCap: "abc", creditTtlDays: 9e9 });
    expect(parsed.dailyFree).toBe(15);
    expect(parsed.uploadReward).toBe(0);
    expect(parsed.dailyEarnCap).toBe(30);
    expect(parsed.creditTtlDays).toBe(3650);
  });
});

describe("ngày theo giờ Việt Nam", () => {
  it("reset lúc 00:00 giờ Việt Nam, tức 17:00 UTC hôm trước", () => {
    expect(nextVietnamMidnight(new Date("2026-10-24T16:59:59Z")).toISOString()).toBe("2026-10-24T17:00:00.000Z");
    expect(nextVietnamMidnight(new Date("2026-10-24T17:00:00Z")).toISOString()).toBe("2026-10-25T17:00:00.000Z");
    expect(startOfVietnamDay(new Date("2026-10-25T02:00:00Z")).toISOString()).toBe("2026-10-24T17:00:00.000Z");
  });
});

describe("thứ tự trừ lượt", () => {
  const base = { repeatWithinWindow: false, usedToday: 0, dailyFree: 10, bonusBalance: 0 };
  it("tải lại trong 24 giờ không bị trừ", () => {
    expect(decideCharge({ ...base, repeatWithinWindow: true, usedToday: 10 })).toBe("REPEAT");
  });
  it("dùng lượt miễn phí trước, hết mới dùng lượt thưởng", () => {
    expect(decideCharge({ ...base, usedToday: 9, bonusBalance: 5 })).toBe("FREE");
    expect(decideCharge({ ...base, usedToday: 10, bonusBalance: 5 })).toBe("BONUS");
  });
  it("hết cả hai thì từ chối", () => {
    expect(decideCharge({ ...base, usedToday: 10 })).toBe("DENIED");
  });
});

describe("lô lượt thưởng", () => {
  const lots = [
    { id: 1, remaining: 2, expiresAt: new Date("2026-12-01") },
    { id: 2, remaining: 5, expiresAt: null },
    { id: 3, remaining: 1, expiresAt: new Date("2026-11-01") },
  ];
  it("lô sắp hết hạn dùng trước", () => {
    expect(sortLotsForSpending(lots).map((lot) => lot.id)).toEqual([3, 1, 2]);
  });
  it("lấy qua nhiều lô và báo phần thiếu", () => {
    const { takes, shortfall } = takeFromLots(sortLotsForSpending(lots), 10);
    expect(takes.map((t) => [t.lot.id, t.take])).toEqual([
      [3, 1],
      [1, 2],
      [2, 5],
    ]);
    expect(shortfall).toBe(2);
  });
});

describe("trần thưởng mỗi ngày và mốc lượt tải", () => {
  it("không vượt trần", () => {
    expect(capGrant(5, 28, 30)).toBe(2);
    expect(capGrant(5, 30, 30)).toBe(0);
    expect(capGrant(5, 0, 30)).toBe(5);
  });
  it("mỗi 20 lượt tải là một mốc", () => {
    expect(crossedMilestones(19, 20, 20)).toEqual([20]);
    expect(crossedMilestones(20, 21, 20)).toEqual([]);
    expect(crossedMilestones(5, 45, 20)).toEqual([20, 40]);
  });
});

describe("phát hiện nội dung gần giống", () => {
  const paragraph =
    "Cấu trúc dữ liệu và giải thuật là học phần nền tảng của ngành công nghệ thông tin. " +
    "Bài thi gồm năm câu: danh sách liên kết, ngăn xếp và hàng đợi, cây nhị phân tìm kiếm, cây AVL, " +
    "đồ thị với thuật toán Dijkstra và thuật toán Kruskal. Sinh viên được dùng một tờ A4 viết tay. " +
    "Câu một yêu cầu cài đặt danh sách liên kết đơn và đảo ngược danh sách trong thời gian tuyến tính. " +
    "Câu hai dùng ngăn xếp để kiểm tra biểu thức ngoặc hợp lệ và tính giá trị biểu thức hậu tố. " +
    "Câu ba chèn lần lượt các khóa vào cây AVL và vẽ cây sau mỗi lần quay. ";
  it("bản sao có thêm vài chữ vẫn bị coi là gần giống", () => {
    const a = simhash(paragraph);
    const b = simhash(`${paragraph} Chúc các bạn thi tốt.`);
    expect(a).not.toBeNull();
    expect(hammingDistance(a as bigint, b as bigint)).toBeLessThanOrEqual(NEAR_DUPLICATE_MAX_DISTANCE);
  });
  it("văn bản khác hẳn thì cách xa", () => {
    const other =
      "Giải tích một gồm giới hạn dãy số, hàm số liên tục, đạo hàm và vi phân, tích phân xác định. " +
      "Đề thi giữa kỳ có bốn câu về khảo sát hàm số, tính tích phân suy rộng và ứng dụng hình học. " +
      "Sinh viên không được dùng tài liệu. Thời gian làm bài chín mươi phút, không kể thời gian phát đề. " +
      "Câu bốn yêu cầu chứng minh bất đẳng thức bằng định lý giá trị trung bình Lagrange cho hàm khả vi. " +
      "Phần tự luận cuối cùng hỏi về chuỗi số dương, tiêu chuẩn so sánh, tiêu chuẩn d'Alembert và Cauchy. " +
      "Ngoài ra đề có một câu thưởng về khai triển Taylor của hàm mũ và hàm lượng giác quanh điểm không, " +
      "yêu cầu đánh giá phần dư và tính gần đúng giá trị với sai số nhỏ hơn một phần nghìn.";
    const a = simhash(paragraph);
    const b = simhash(other);
    expect(b).not.toBeNull();
    expect(hammingDistance(a as bigint, b as bigint)).toBeGreaterThan(NEAR_DUPLICATE_MAX_DISTANCE);
  });
  it("văn bản quá ngắn thì không so", () => {
    expect(simhash("Đề thi")).toBeNull();
  });
});

describe("tài liệu trống", () => {
  it("một trang gần như không có chữ thì bị loại", () => {
    expect(isTooShort({ text: "  Trang 1 ", pageCount: 1, hasTextLayer: true })).toBe(true);
    expect(isTooShort({ text: "", pageCount: 12, hasTextLayer: true })).toBe(false);
    expect(isTooShort({ text: "", pageCount: 1, hasTextLayer: false })).toBe(false);
  });
});
