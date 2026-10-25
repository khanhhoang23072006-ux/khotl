/* ===================== Giai đoạn 7: cộng đồng và động lực đóng góp ===================== */
/* Nhiệm vụ, streak, sự kiện mùa thi; xếp hạng theo Viện, lớp, CLB; huy hiệu hiếm; hỏi đáp theo học phần;
   thông báo trường; quảng cáo; không gian CLB, lớp; vinh danh và chứng nhận. Dữ liệu trong S.cm. */
const D7 = 86400e3;
/** Ngày theo giờ Việt Nam, dạng YYYY-MM-DD */
function vnDate(t) {
  return new Date(t + 7 * 3600e3).toISOString().slice(0, 10);
}
/** Thứ Hai đầu tuần (giờ Việt Nam) */
function vnWeekKey(t) {
  const d = new Date(t + 7 * 3600e3);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
const EXTRA_USERS = [
  ["Vũ Hải Đăng", "dang.vh", "SEEE", 68],
  ["Đỗ Thị Lan", "lan.dt", "SEEE", 68],
  ["Bùi Quang Huy", "huy.bq", "SME", 67],
  ["Ngô Minh Châu", "chau.nm", "SME", 69],
  ["Đặng Thùy Linh", "linh.dt", "SCLS", 68],
  ["Hoàng Văn Phúc", "phuc.hv", "SCLS", 67],
  ["Lý Gia Bảo", "bao.lg", "SEM", 69],
  ["Trịnh Ngọc Ánh", "anh.tn", "SEM", 68],
  ["Phan Đức Thịnh", "thinh.pd", "FAMI", 68],
  ["Mai Phương Thảo", "thao.mp", "FAMI", 67],
  ["Cao Tiến Dũng", "dung.ct", "FEP", 68],
  ["Đinh Khánh Vy", "vy.dk", "SOICT", 69],
];
function CM() {
  if (!S.cm) S.cm = seedCm();
  return S.cm;
}
function seedCm() {
  const now = Date.now();
  // Người dùng mẫu ở các Viện khác để xếp hạng theo Viện, lớp, CLB có ý nghĩa
  EXTRA_USERS.forEach(([name, username, fac, cohort], i) => {
    const email = `${username}@sis.hust.edu.vn`;
    if (!userBy(email)) S.users.push({ email, name, username, faculty: fac, cohort, roles: [{ key: "STUDENT" }], reputation: 40 + ((i * 53) % 260), approved: (i * 7) % 9, trust: 1, createdAt: now - (30 + i) * D7 });
  });
  const sv = "sv.demo@sis.hust.edu.vn";
  const em = (u) => `${u}@sis.hust.edu.vn`;
  const cm = { log: [], claims: {}, questions: [], answers: [], spaces: [], ads: [], adSeen: {}, adHidden: {}, certs: [], seenFeed: {} };
  // Nhật ký hoạt động: sv.demo học đều 6 ngày gần đây (streak), người khác rải rác
  const kinds = ["quiz", "card", "pomo", "comment", "answer"];
  for (let d = 0; d < 6; d++) cm.log.push({ user: sv, kind: kinds[d % kinds.length], t: now - d * D7 - 3600e3 });
  cm.log.push({ user: sv, kind: "quiz", t: now - 9 * D7 });
  S.users.forEach((x, i) => {
    if (x.email === sv || /^(kdv|admin)\./.test(x.email)) return;
    const days = 3 + ((i * 5) % 12);
    for (let d = 0; d < days; d++) {
      const k = kinds[(i + d) % kinds.length];
      cm.log.push({ user: x.email, kind: k, t: now - d * D7 * (1 + (i % 2)) - (i + 1) * 1800e3 });
      cm.log.push({ user: x.email, kind: "xp", xp: 10 + ((i * 7 + d * 3) % 30), t: now - d * D7 * (1 + (i % 2)) - (i + 1) * 1800e3 });
    }
  });
  // Không gian lớp và CLB (tên mẫu)
  const space = (id, type, name, fac, owner, admins, members, opts = {}) => ({ id, type, name, faculty: fac, owner, admins, members: [...new Set([owner, ...admins, ...members])], requests: [], join: opts.join || "request", code: opts.code || id.slice(-4).toUpperCase() + "68", desc: opts.desc || "", posts: opts.posts || [], files: opts.files || [], t: now - 60 * D7 });
  const ap = (code, i) => S.docs.filter((d) => d.status === "APPROVED" && d.course === code)[i || 0];
  cm.spaces.push(
    space("lop-khmt01-k68", "class", "Lớp Khoa học máy tính 01-K68", "SOICT", em("le.minh.quan"), [em("nguyen.thu.ha")], [sv, em("vy.dk")], {
      desc: "Lớp sinh hoạt KHMT 01 khóa 68. Thông báo của lớp, tài liệu ôn tập nội bộ.",
      posts: [
        { id: uid(), by: em("le.minh.quan"), title: "Lịch họp lớp tuần 8", body: "Họp lớp 20:00 thứ 5 trên Teams, bàn kế hoạch ôn thi giữa kỳ và chia nhóm ôn CTDL.", t: now - 2 * D7, pinned: true },
        { id: uid(), by: em("nguyen.thu.ha"), title: "Nhắc nộp minh chứng hoạt động", body: "Bạn nào thiếu minh chứng điểm rèn luyện thì gửi lớp trưởng trước chủ nhật nhé.", t: now - 5 * D7 },
      ],
      files: [ap("IT3011") && { id: uid(), by: em("le.minh.quan"), title: "Tổng hợp đề CTDL lớp mình hay dùng", doc: ap("IT3011").id, t: now - 4 * D7 }].filter(Boolean),
    }),
    space("lop-khmt02-k68", "class", "Lớp Khoa học máy tính 02-K68", "SOICT", em("tran.duc.anh"), [], [em("pham.ngoc.mai")], { desc: "Lớp sinh hoạt KHMT 02 khóa 68." }),
    space("lop-dien03-k68", "class", "Lớp Kỹ thuật điện 03-K68", "SEEE", em("dang.vh"), [em("lan.dt")], [em("dung.ct")], { desc: "Lớp sinh hoạt ngành Kỹ thuật điện." }),
    space("lop-kt01-k68", "class", "Lớp Kinh tế công nghiệp 01-K68", "SEM", em("anh.tn"), [], [em("bao.lg")], { desc: "Lớp sinh hoạt Kinh tế công nghiệp." }),
    space("clb-hocthuat", "club", "CLB Học thuật CNTT (mẫu)", "SOICT", em("nguyen.thu.ha"), [em("le.minh.quan")], [sv, em("tran.duc.anh"), em("thinh.pd"), em("vy.dk")], {
      join: "request",
      desc: "Sinh hoạt học thuật, chữa đề, mentor môn đại cương và chuyên ngành. Không gian mẫu trong bản demo.",
      posts: [{ id: uid(), by: em("nguyen.thu.ha"), title: "Buổi chữa đề giữa kỳ Toán rời rạc", body: "Thứ 7 tuần này, 9:00, phòng D9-201. Mang theo đề các năm trước, CLB in sẵn đáp án.", t: now - D7, pinned: true }],
      files: [ap("IT3020") && { id: uid(), by: em("nguyen.thu.ha"), title: "Slide buổi chữa đề Toán rời rạc", doc: ap("IT3020").id, t: now - D7 }].filter(Boolean),
    }),
    space("clb-tienganh", "club", "CLB Tiếng Anh (mẫu)", "SOFL", em("thao.mp"), [], [em("bao.lg"), em("linh.dt"), em("chau.nm")], { join: "open", desc: "Luyện nói tiếng Anh mỗi tối thứ 4. Không gian mẫu." }),
    space("clb-codien", "club", "CLB Cơ điện tử (mẫu)", "SME", em("huy.bq"), [em("chau.nm")], [em("phuc.hv"), em("dung.ct")], { join: "request", desc: "Làm robot, thi đấu, chia sẻ tài liệu cơ khí. Không gian mẫu." }),
  );
  // Hỏi đáp theo học phần
  const Q = (course, by, title, body, days, answers, accepted) => {
    const id = `q${cm.questions.length + 1}`;
    const q = { id, course, by: em(by), title, body, t: now - days * D7, votes: {}, views: 20 + days * 13, accepted: null, status: "VISIBLE" };
    cm.questions.push(q);
    answers.forEach(([aby, text, up], i) => {
      const a = { id: `${id}a${i + 1}`, q: id, by: aby === "sv" ? sv : em(aby), body: text, t: q.t + (i + 1) * 3 * 3600e3, votes: {}, status: "VISIBLE" };
      S.users.slice(0, up).forEach((x) => x.email !== a.by && (a.votes[x.email] = 1));
      cm.answers.push(a);
      if (accepted === i) q.accepted = a.id;
    });
    S.users.slice(0, 2 + (days % 4)).forEach((x) => x.email !== q.by && (q.votes[x.email] = 1));
    return q;
  };
  Q("IT3011", "vy.dk", "Khi nào cây AVL cần quay kép thay vì quay đơn?", "Em hiểu quay đơn khi lệch trái-trái hoặc phải-phải, nhưng vẫn hay nhầm khi gặp trường hợp trái-phải. Có cách nào nhớ nhanh không ạ?", 1, [["le.minh.quan", "Nhìn hướng lệch của nút con: nếu con trái lệch sang phải (trường hợp trái-phải) thì phải quay trái ở nút con trước để đưa về trái-trái, rồi quay phải ở nút mất cân bằng. Mẹo nhớ: hai hướng lệch giống nhau thì quay một lần, khác nhau thì quay hai lần.", 5], ["nguyen.thu.ha", "Vẽ ba nút ra giấy rồi xoay, làm 3-4 bài là quen. Đề giữa kỳ hay hỏi đúng dạng này.", 2]], 0);
  Q("IT3011", "pham.ngoc.mai", "Độ phức tạp của Dijkstra dùng heap là bao nhiêu?", "Slide ghi O((V + E) log V) nhưng bạn em bảo O(V²). Cái nào đúng ạ?", 3, [["tran.duc.anh", "Cả hai đều đúng tùy cách cài: dùng mảng tìm min thì O(V²), hợp với đồ thị dày; dùng hàng đợi ưu tiên (binary heap) thì O((V + E) log V), hợp với đồ thị thưa.", 4]], 0);
  Q("MI1111", "thinh.pd", "Tích phân suy rộng ∫ từ 0 đến 1 của 1/√x dx có hội tụ không?", "Hàm không bị chặn tại 0 nên em không chắc.", 2, [["thao.mp", "Hội tụ, bằng 2. Nguyên hàm 2√x, giới hạn khi cận dưới tiến về 0 bằng 0. Tổng quát ∫ từ 0 đến 1 của 1/xᵖ hội tụ khi p < 1.", 6]], 0);
  Q("IT3080", "sv", "Tại sao TCP cần bắt tay ba bước mà không phải hai?", "Hai bước thì server đã biết client muốn kết nối rồi mà?", 4, [["le.minh.quan", "Bước thứ ba để server chắc chắn client nhận được số thứ tự ban đầu của server và kết nối không phải gói SYN cũ bị trễ. Với hai bước, server có thể mở kết nối cho một SYN cũ, gây lãng phí tài nguyên.", 3]], null);
  Q("PH1110", "dung.ct", "Bảo toàn momen động lượng khi người đứng trên ghế xoay co tay lại?", "Tại sao co tay vào thì quay nhanh hơn?", 6, [], null);
  Q("IT3090", "anh.tn", "Khác nhau giữa WHERE và HAVING là gì?", "Em hay bị lỗi khi dùng COUNT trong WHERE.", 5, [["vy.dk", "WHERE lọc từng dòng trước khi nhóm, nên không dùng được hàm gộp như COUNT. HAVING lọc sau GROUP BY, dùng được hàm gộp. Ví dụ: SELECT lop, COUNT(*) FROM sv GROUP BY lop HAVING COUNT(*) > 40.", 4]], 0);
  Q("MI1141", "linh.dt", "Cách nhanh để kiểm tra một ma trận 3×3 có khả nghịch?", "", 8, [["thinh.pd", "Tính định thức bằng quy tắc Sarrus; khác 0 là khả nghịch. Nếu chỉ cần biết có hay không thì đưa về dạng bậc thang cũng nhanh.", 2]], null);
  Q("IT3011", "bao.lg", "Nên ôn phần nào trước khi thi giữa kỳ CTDL?", "Còn 5 ngày nữa thi, em mới học tới cây.", 0, [], null);
  // Quảng cáo mẫu (tên nhà tài trợ là hư cấu)
  cm.ads.push(
    { id: "ad1", sponsor: "Nhà sách Bách Việt (mẫu)", title: "Giảm 20% giáo trình đại cương", body: "Giáo trình Giải tích, Đại số, Vật lý cho tân sinh viên. Áp dụng khi xuất trình thẻ sinh viên.", url: "https://example.com/nha-sach", cta: "Xem ưu đãi", placements: ["home", "search", "doc"], faculties: [], from: vnDate(now - 10 * D7), to: vnDate(now + 30 * D7), active: true, cap: 3, imp: 1240, clicks: 37 },
    { id: "ad2", sponsor: "Trung tâm Luyện thi IELTS ABC (mẫu)", title: "Thi thử IELTS miễn phí cho sinh viên", body: "Đăng ký thi thử, nhận nhận xét kỹ năng Viết và Nói.", url: "https://example.com/ielts", cta: "Đăng ký", placements: ["home", "doc"], faculties: [], from: vnDate(now - 3 * D7), to: vnDate(now + 20 * D7), active: true, cap: 2, imp: 610, clicks: 22 },
    { id: "ad3", sponsor: "Phòng lab Điện tử XYZ (mẫu)", title: "Tuyển thực tập sinh nhúng", body: "Dành cho sinh viên Điện - Điện tử năm 3, năm 4.", url: "https://example.com/lab", cta: "Ứng tuyển", placements: ["search", "doc"], faculties: ["SEEE"], from: vnDate(now - 5 * D7), to: vnDate(now + 15 * D7), active: true, cap: 3, imp: 210, clicks: 9 },
  );
  return cm;
}

/* ===================== Nhật ký hoạt động, XP, streak ===================== */
const STREAK_KINDS = new Set(["quiz", "card", "pomo", "comment", "answer", "ask", "upload", "approved"]);
/** Ghi một hành động (để tính nhiệm vụ, streak). Mỗi ngày chỉ ghi "visit" một lần. */
function logAction(u, kind, extra = {}) {
  if (!u || !S) return;
  const cm = CM();
  const now = Date.now();
  if (kind === "visit" && cm.log.some((x) => x.user === u.email && x.kind === "visit" && vnDate(x.t) === vnDate(now))) return;
  cm.log.push({ user: u.email, kind, t: now, ...extra });
  if (cm.log.length > 8000) cm.log.splice(0, cm.log.length - 8000);
  if (kind !== "visit") {
    const before = u.badges?.length || 0;
    checkBadges(u);
    if ((u.badges?.length || 0) !== before) renderHeader();
  }
}
/** Tài liệu được duyệt: ghi cho người đăng (nhiệm vụ tuần, nhiệm vụ sự kiện theo loại đề). */
function cmApproved(d) {
  const up = userBy(d.uploader);
  if (!up) return;
  logAction(up, "approved");
  if (d.type === "EXAM_MIDTERM") logAction(up, "approved-midterm");
  if (d.type === "EXAM_FINAL") logAction(up, "approved-final");
}
function activeDays(email) {
  return new Set(CM().log.filter((x) => x.user === email && STREAK_KINDS.has(x.kind)).map((x) => vnDate(x.t)));
}
/** Chuỗi ngày học liên tiếp kết thúc hôm nay (hoặc hôm qua nếu hôm nay chưa học) và chuỗi dài nhất. */
function streakOf(email) {
  const days = activeDays(email);
  const now = Date.now();
  let cur = 0;
  let start = days.has(vnDate(now)) ? 0 : 1;
  while (days.has(vnDate(now - (start + cur) * D7))) cur++;
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  for (let i = 0; i < sorted.length; i++) {
    run = i && Date.parse(sorted[i]) - Date.parse(sorted[i - 1]) === D7 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return { cur, best: Math.max(best, cur), today: days.has(vnDate(now)), days };
}
function xpOf(email, from = 0) {
  return CM().log.filter((x) => x.user === email && x.kind === "xp" && x.t >= from).reduce((s, x) => s + (x.xp || 0), 0);
}
function levelOf(xp) {
  let lv = 1;
  let need = 100;
  let left = xp;
  while (left >= need) {
    left -= need;
    lv++;
    need = Math.round(need * 1.35);
  }
  return { lv, left, need };
}

/* ===================== Nhiệm vụ và sự kiện ===================== */
const QUESTS = {
  daily: [
    { id: "d-visit", name: "Ghé HUSTDOCU hôm nay", kinds: ["visit"], n: 1, xp: 5 },
    { id: "d-quiz", name: "Làm 1 lượt trắc nghiệm", kinds: ["quiz"], n: 1, xp: 15, href: "#/on-tap" },
    { id: "d-card", name: "Ôn 10 thẻ flashcard", kinds: ["card"], n: 10, xp: 15, href: "#/flashcard" },
    { id: "d-pomo", name: "Tập trung 1 phiên Pomodoro", kinds: ["pomo"], n: 1, xp: 15, href: "#/hoc-chung" },
    { id: "d-help", name: "Trả lời 1 câu hỏi hoặc viết 1 bình luận", kinds: ["answer", "comment"], n: 1, xp: 20, href: "#/hoi-dap?loc=chua-tra-loi" },
  ],
  weekly: [
    { id: "w-approved", name: "Có 1 tài liệu được duyệt", kinds: ["approved"], n: 1, xp: 80, href: "#/tai-len" },
    { id: "w-answer", name: "Trả lời 5 câu hỏi", kinds: ["answer"], n: 5, xp: 60, href: "#/hoi-dap" },
    { id: "w-accepted", name: "Được chọn là câu trả lời hay nhất", kinds: ["accepted"], n: 1, xp: 60, href: "#/hoi-dap" },
    { id: "w-pomo", name: "Hoàn thành 8 phiên Pomodoro", kinds: ["pomo"], n: 8, xp: 50, href: "#/hoc-chung" },
    { id: "w-days", name: "Học 5 ngày trong tuần", kinds: ["day"], n: 5, xp: 50 },
  ],
};
/** Sự kiện theo mùa thi (ngày theo lịch học kỳ 20261). Nhiệm vụ sự kiện nhân đôi XP. */
const EVENTS = [
  {
    id: "gk-20261",
    name: "Mùa thi giữa kỳ 20261",
    from: "2026-10-19",
    to: "2026-11-15",
    desc: "Cùng nhau góp đề thi giữa kỳ và giải đáp thắc mắc trước kỳ thi. Hoàn thành cả 3 nhiệm vụ sự kiện để nhận huy hiệu hiếm “Chiến binh giữa kỳ”.",
    goal: { label: "đề thi giữa kỳ được duyệt trong mùa", type: "EXAM_MIDTERM", target: 40 },
    quests: [
      { id: "e-mid", name: "Đóng góp 1 đề thi giữa kỳ (được duyệt)", kinds: ["approved-midterm"], n: 1, xp: 150, href: "#/tai-len" },
      { id: "e-quiz", name: "Làm 5 lượt trắc nghiệm", kinds: ["quiz"], n: 5, xp: 80, href: "#/on-tap" },
      { id: "e-answer", name: "Giải đáp 3 câu hỏi", kinds: ["answer"], n: 3, xp: 80, href: "#/hoi-dap?loc=chua-tra-loi" },
    ],
    badge: "ev-gk20261",
  },
  {
    id: "ck-20261",
    name: "Mùa thi cuối kỳ 20261",
    from: "2026-12-21",
    to: "2027-01-17",
    desc: "Thử thách ôn thi cuối kỳ: đóng góp đề cuối kỳ, bài giải và giữ streak học mỗi ngày.",
    goal: { label: "đề thi cuối kỳ được duyệt trong mùa", type: "EXAM_FINAL", target: 60 },
    quests: [
      { id: "e-final", name: "Đóng góp 1 đề thi cuối kỳ (được duyệt)", kinds: ["approved-final"], n: 1, xp: 150, href: "#/tai-len" },
      { id: "e-streak", name: "Học 10 ngày trong mùa thi", kinds: ["day"], n: 10, xp: 120 },
      { id: "e-answer2", name: "Giải đáp 5 câu hỏi", kinds: ["answer"], n: 5, xp: 100, href: "#/hoi-dap" },
    ],
    badge: "ev-ck20261",
  },
];
function currentEvent(t = Date.now()) {
  const d = vnDate(t);
  return EVENTS.find((e) => d >= e.from && d <= e.to) || null;
}
function nextEvent(t = Date.now()) {
  const d = vnDate(t);
  return EVENTS.filter((e) => e.from > d).sort((a, b) => a.from.localeCompare(b.from))[0] || null;
}
/** Tiến độ một nhiệm vụ trong khoảng [from, to] */
function questProgress(email, q, from, to = Infinity) {
  const log = CM().log.filter((x) => x.user === email && x.t >= from && x.t <= to);
  if (q.kinds.includes("day")) return new Set(log.filter((x) => STREAK_KINDS.has(x.kind)).map((x) => vnDate(x.t))).size;
  return log.filter((x) => q.kinds.includes(x.kind)).length;
}
function periodOf(type, t = Date.now(), ev = null) {
  if (type === "daily") {
    const key = vnDate(t);
    return { key, from: Date.parse(`${key}T00:00:00+07:00`) };
  }
  if (type === "weekly") {
    const key = vnWeekKey(t);
    return { key, from: Date.parse(`${key}T00:00:00+07:00`) };
  }
  return { key: ev.id, from: Date.parse(`${ev.from}T00:00:00+07:00`), to: Date.parse(`${ev.to}T23:59:59+07:00`) };
}
function claimsOf(email) {
  const cm = CM();
  cm.claims[email] = cm.claims[email] || {};
  return cm.claims[email];
}
function claimQuest(u, type, q, ev) {
  const p = periodOf(type, Date.now(), ev);
  const key = `${q.id}|${p.key}`;
  const claims = claimsOf(u.email);
  if (claims[key]) return 0;
  if (questProgress(u.email, q, p.from, p.to) < q.n) return 0;
  claims[key] = Date.now();
  const xp = q.xp;
  CM().log.push({ user: u.email, kind: "xp", xp, t: Date.now(), quest: q.id });
  if (ev && ev.quests.every((x) => claims[`${x.id}|${ev.id}`])) {
    u.badges = u.badges || [];
    if (!u.badges.includes(ev.badge)) {
      u.badges.push(ev.badge);
      S.notifications.unshift({ id: uid(), to: u.email, type: "BADGE_AWARDED", title: BADGES.find((b) => b.id === ev.badge)?.name || ev.name, link: `#/u/${u.username}`, t: Date.now(), read: false });
    }
  }
  checkBadges(u);
  save();
  return xp;
}

/* ===================== Huy hiệu hiếm ===================== */
function acceptedCount(email) {
  const cm = CM();
  return cm.questions.filter((q) => q.accepted && cm.answers.find((a) => a.id === q.accepted)?.by === email).length;
}
BADGES.push(
  { id: "gold-doc", ic: "★", name: "Tài liệu vàng", desc: "Có tài liệu đạt 4,5 sao trở lên với ít nhất 10 lượt chấm", rare: true, ok: (u) => S.docs.some((d) => d.uploader === u.email && d.status === "APPROVED" && d.ratingCount >= 10 && d.ratingSum / d.ratingCount >= 4.5) },
  { id: "k-dl", ic: "1K", name: "Ngàn lượt tải", desc: "Có tài liệu đạt 1.000 lượt tải", rare: true, ok: (u) => S.docs.some((d) => d.uploader === u.email && d.status === "APPROVED" && d.downloads >= 1000) },
  { id: "pioneer", ic: "KP", name: "Khai phá", desc: "Tài liệu đầu tiên được duyệt của một học phần", rare: true, ok: (u) => S.courses.some((c) => { const first = S.docs.filter((d) => d.course === c.code && d.status === "APPROVED" && d.publishedAt).sort((a, b) => a.publishedAt - b.publishedAt)[0]; return first?.uploader === u.email; }) },
  { id: "solver", ic: "GĐ", name: "Người giải đáp", desc: "10 câu trả lời được chọn là hay nhất", rare: true, ok: (u) => acceptedCount(u.email) >= 10 },
  { id: "streak30", ic: "30N", name: "Bền bỉ", desc: "Học 30 ngày liên tiếp", rare: true, ok: (u) => streakOf(u.email).best >= 30 },
  { id: "ev-gk20261", ic: "GK", name: "Chiến binh giữa kỳ", desc: "Hoàn thành mọi nhiệm vụ sự kiện Mùa thi giữa kỳ 20261", rare: true, ok: (u) => (u.badges || []).includes("ev-gk20261") },
  { id: "ev-ck20261", ic: "CK", name: "Chiến binh cuối kỳ", desc: "Hoàn thành mọi nhiệm vụ sự kiện Mùa thi cuối kỳ 20261", rare: true, ok: (u) => (u.badges || []).includes("ev-ck20261") },
);
/** Tỉ lệ người dùng có huy hiệu (để biết độ hiếm). */
function badgeRarity(b) {
  const users = S.users.filter((x) => !/^(kdv|admin)\./.test(x.email));
  const n = users.filter((x) => (x.badges || []).includes(b.id) || b.ok(x)).length;
  return users.length ? n / users.length : 0;
}

/* ===================== Trang Cộng đồng: streak, nhiệm vụ, sự kiện ===================== */
function cmTabs(active) {
  const tabs = [
    ["hub", "#/cong-dong", "Nhiệm vụ"],
    ["xh", "#/bang-xep-hang", "Xếp hạng"],
    ["qa", "#/hoi-dap", "Hỏi đáp"],
    ["kg", "#/khong-gian", "CLB, lớp"],
    ["tb", "#/thong-bao-truong", "Thông báo trường"],
    ["vd", "#/vinh-danh", "Vinh danh"],
  ];
  return `<nav class="tabs study-tabs" aria-label="Cộng đồng">${tabs.map(([k, h, l]) => `<a href="${h}"${k === active ? ' aria-current="page"' : ""}>${l}</a>`).join("")}</nav>`;
}
function cmHead(title, active, extra = "") {
  return `<section class="page-head gridpaper"><div class="wrap stack" style="gap:12px">${cmTabs(active)}<h1>${title}</h1>${extra}</div></section>`;
}
function questRow(u, type, q, ev) {
  const p = periodOf(type, Date.now(), ev);
  const done = Math.min(q.n, questProgress(u.email, q, p.from, p.to));
  const claimed = claimsOf(u.email)[`${q.id}|${p.key}`];
  const ok = done >= q.n;
  return `<li style="padding:10px 12px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 12px;align-items:center"><span style="min-width:0">${q.href && !ok ? `<a href="${q.href}"><b style="font-weight:600">${esc(q.name)}</b></a>` : `<b style="font-weight:600">${esc(q.name)}</b>`}<span class="tiny muted" style="display:block">${done}/${q.n}, +${q.xp} XP</span></span>
   ${claimed ? '<span class="stamp" style="transform:none">Đã nhận</span>' : `<button class="btn sm${ok ? " primary" : ""}" type="button" data-claim="${type}|${q.id}"${ok ? "" : " disabled"}>Nhận ${q.xp} XP</button>`}
   <div class="bar" style="grid-column:1/-1"><i style="width:${Math.round((done / q.n) * 100)}%"></i></div></li>`;
}
function heatmap(days) {
  const now = Date.now();
  const cells = Array.from({ length: 35 }, (_, i) => vnDate(now - (34 - i) * D7));
  return `<div style="display:grid;grid-template-columns:repeat(7,14px);gap:3px" role="img" aria-label="Các ngày học trong 5 tuần qua: ${cells.filter((d) => days.has(d)).length} ngày">${cells.map((d) => `<span title="${d}" style="width:14px;height:14px;border:1px solid var(--line);background:${days.has(d) ? "var(--stamp)" : "var(--sheet)"}"></span>`).join("")}</div>`;
}
views["/cong-dong"] = () => {
  const u = me();
  if (!u) return needLogin("/cong-dong");
  logAction(u, "visit");
  const st = streakOf(u.email);
  const xp = xpOf(u.email);
  const lv = levelOf(xp);
  const ev = currentEvent();
  const nx = nextEvent();
  let evHtml = "";
  if (ev) {
    const from = Date.parse(`${ev.from}T00:00:00+07:00`);
    const to = Date.parse(`${ev.to}T23:59:59+07:00`);
    const got = S.docs.filter((d) => d.status === "APPROVED" && d.type === ev.goal.type && d.publishedAt >= from && d.publishedAt <= to).length;
    evHtml = `<section class="stack" style="gap:10px;border:2px solid var(--stamp);background:var(--sheet);padding:16px"><div class="row" style="justify-content:space-between;align-items:baseline"><h2 class="h2" style="margin:0">Sự kiện: ${esc(ev.name)}</h2><span class="tiny muted">${fmtDate(Date.parse(ev.from))} đến ${fmtDate(Date.parse(ev.to))}, còn ${Math.max(0, Math.ceil((to - Date.now()) / D7))} ngày</span></div>
     <p class="small" style="margin:0">${esc(ev.desc)}</p>
     <div class="stack" style="gap:4px"><span class="small"><b>Mục tiêu chung:</b> ${got}/${ev.goal.target} ${ev.goal.label}</span><div class="bar"><i style="width:${Math.min(100, Math.round((got / ev.goal.target) * 100))}%"></i></div></div>
     <ul class="tb" style="list-style:none;margin:0;padding:0">${ev.quests.map((q) => questRow(u, "event", q, ev)).join("")}</ul></section>`;
  } else if (nx) evHtml = `<p class="note" style="margin:0">Sự kiện tiếp theo: <b>${esc(nx.name)}</b>, bắt đầu ${fmtDate(Date.parse(nx.from))}.</p>`;
  const html =
    cmHead("Cộng đồng", "hub", `<p class="small muted" style="margin:0">Làm nhiệm vụ hằng ngày, hằng tuần để nhận XP, giữ chuỗi ngày học và tham gia sự kiện mùa thi.</p>`) +
    `<div class="wrap stack" style="padding-block:20px;gap:24px">
    <div class="tb" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">
     <div class="cell"><span class="l">Chuỗi ngày học</span><span class="v code" style="font-size:34px;color:var(--stamp)">${st.cur} ngày</span><span class="tiny muted">${st.today ? "Hôm nay đã học" : "Học hôm nay để giữ chuỗi"}, dài nhất ${st.best} ngày</span></div>
     <div class="cell"><span class="l">Cấp độ</span><span class="v code" style="font-size:34px">Cấp ${lv.lv}</span><div class="bar" style="margin-top:4px"><i style="width:${Math.round((lv.left / lv.need) * 100)}%"></i></div><span class="tiny muted">${lv.left}/${lv.need} XP lên cấp ${lv.lv + 1}</span></div>
     <div class="cell"><span class="l">XP tuần này</span><span class="v code" style="font-size:34px">${xpOf(u.email, periodOf("weekly").from)}</span><span class="tiny muted">Tổng ${xp} XP</span></div>
     <div class="cell"><span class="l">5 tuần qua</span>${heatmap(st.days)}</div></div>
    ${evHtml}
    <div class="two" style="gap:16px;align-items:start">
     <section class="stack" style="gap:8px;min-width:0"><h2 class="h2" style="margin:0">Nhiệm vụ hôm nay</h2><ul class="tb" style="list-style:none;margin:0;padding:0">${QUESTS.daily.map((q) => questRow(u, "daily", q)).join("")}</ul><p class="tiny muted" style="margin:0">Làm mới lúc 00:00 giờ Việt Nam. Chuỗi ngày học tính khi bạn làm trắc nghiệm, ôn flashcard, học Pomodoro, bình luận, hỏi đáp hoặc đóng góp tài liệu.</p></section>
     <section class="stack" style="gap:8px;min-width:0"><h2 class="h2" style="margin:0">Nhiệm vụ tuần</h2><ul class="tb" style="list-style:none;margin:0;padding:0">${QUESTS.weekly.map((q) => questRow(u, "weekly", q)).join("")}</ul><p class="tiny muted" style="margin:0">Làm mới thứ Hai hằng tuần.</p></section></div>
    <section class="stack" style="gap:8px"><h2 class="h2" style="margin:0">Huy hiệu hiếm</h2><div class="cards">${BADGES.filter((b) => b.rare)
      .map((b) => {
        const has = (u.badges || []).includes(b.id) || b.ok(u);
        return `<div class="rec" style="border:2px solid ${has ? "var(--stamp)" : "var(--line)"};${has ? "" : "opacity:.65"}"><span class="why">${has ? "Bạn đã có" : `${Math.round(badgeRarity(b) * 100)}% người dùng có`}</span><b class="head" style="font-size:16px">${b.ic} ${esc(b.name)}</b><span class="small muted">${esc(b.desc)}</span></div>`;
      })
      .join("")}</div></section></div>`;
  return {
    html,
    mount(root) {
      root.querySelectorAll("[data-claim]").forEach((b) =>
        b.addEventListener("click", () => {
          const [type, id] = b.dataset.claim.split("|");
          const evx = type === "event" ? currentEvent() : null;
          const q = type === "event" ? evx.quests.find((x) => x.id === id) : QUESTS[type].find((x) => x.id === id);
          const got = claimQuest(u, type, q, evx);
          toast(got ? `+${got} XP` : "Chưa đủ điều kiện nhận.");
          render();
        }),
      );
    },
  };
};

/* ===================== Bảng xếp hạng theo Viện, lớp, CLB ===================== */
function spacesOf(email, type) {
  return CM().spaces.filter((s) => s.members.includes(email) && (!type || s.type === type));
}
views["/bang-xep-hang"] = () => {
  const u = me();
  const p = params();
  const by = ["xp", "uy-tin", "tai-lieu", "hoi-dap"].includes(p.get("theo")) ? p.get("theo") : "xp";
  const ky = ["tuan", "thang", "tat-ca"].includes(p.get("ky")) ? p.get("ky") : "tuan";
  const scope = ["truong", "vien", "lop", "clb", "tap-the"].includes(p.get("pham-vi")) ? p.get("pham-vi") : "truong";
  const cm = CM();
  const from = ky === "tuan" ? periodOf("weekly").from : ky === "thang" ? Date.now() - 30 * D7 : 0;
  const all = S.users.filter((x) => !/^(kdv|admin)\./.test(x.email));
  const score = (x) =>
    by === "xp" ? xpOf(x.email, from) : by === "uy-tin" ? x.reputation : by === "tai-lieu" ? x.approved : cm.questions.filter((q) => q.accepted && q.t >= from && cm.answers.find((a) => a.id === q.accepted)?.by === x.email).length * 15 + cm.answers.filter((a) => a.by === x.email && a.t >= from).length * 5;
  const unit = { xp: "XP", "uy-tin": "điểm uy tín", "tai-lieu": "tài liệu được duyệt", "hoi-dap": "điểm hỏi đáp" }[by];
  const periodic = by === "xp" || by === "hoi-dap";
  const groupOpts = (type) => cm.spaces.filter((s) => s.type === type);
  const myClass = u && spacesOf(u.email, "class")[0];
  const myClub = u && spacesOf(u.email, "club")[0];
  const sel = p.get("nhom") || (scope === "vien" ? u?.faculty || "SOICT" : scope === "lop" ? myClass?.id || groupOpts("class")[0]?.id : scope === "clb" ? myClub?.id || groupOpts("club")[0]?.id : "");
  const link = (over) => {
    const q = new URLSearchParams({ theo: by, ky, "pham-vi": scope, ...(sel && scope !== "truong" && scope !== "tap-the" ? { nhom: sel } : {}), ...over });
    if (over["pham-vi"]) q.delete("nhom");
    return `#/bang-xep-hang?${q}`;
  };
  let pool = all;
  if (scope === "vien") pool = all.filter((x) => x.faculty === sel);
  if (scope === "lop" || scope === "clb") pool = all.filter((x) => cm.spaces.find((s) => s.id === sel)?.members.includes(x.email));
  let body;
  if (scope === "tap-the") {
    const groups = [
      ...DATA.faculties.map((f) => ({ kind: "Viện", name: f.shortName, members: all.filter((x) => x.faculty === f.code) })),
      ...cm.spaces.map((s) => ({ kind: s.type === "class" ? "Lớp" : "CLB", name: s.name, members: all.filter((x) => s.members.includes(x.email)) })),
    ].filter((g) => g.members.length);
    const rows = groups.map((g) => ({ ...g, v: g.members.reduce((s, x) => s + score(x), 0) })).sort((a, b) => b.v - a.v).slice(0, 15);
    body = `<table class="t"><thead><tr><th style="width:56px">Hạng</th><th>Tập thể</th><th class="num">Thành viên</th><th class="num">Tổng ${unit}</th></tr></thead><tbody>${rows.map((r, i) => `<tr><td class="code" style="font-size:24px;text-align:center;${i < 3 ? "color:var(--stamp)" : ""}">${i + 1}</td><td><b style="font-weight:600">${esc(r.name)}</b> <span class="tiny muted">${r.kind}</span></td><td class="num">${r.members.length}</td><td class="num"><b>${r.v}</b></td></tr>`).join("")}</tbody></table>`;
  } else {
    const rows = pool.map((x) => ({ x, v: score(x) })).sort((a, b) => b.v - a.v).slice(0, 20);
    const mineIdx = u ? pool.map((x) => ({ x, v: score(x) })).sort((a, b) => b.v - a.v).findIndex((r) => r.x.email === u.email) : -1;
    body = `${mineIdx >= 0 ? `<p class="small" style="margin:0">Bạn đang xếp hạng <b>${mineIdx + 1}</b>/${pool.length}${scope !== "truong" ? " trong nhóm này" : ""}.</p>` : ""}<table class="t"><thead><tr><th style="width:56px">Hạng</th><th>Người đóng góp</th><th class="num">${unit}</th></tr></thead><tbody>${rows
      .map((r, i) => `<tr${u && r.x.email === u.email ? ' style="background:var(--wash)"' : ""}><td class="code" style="font-size:24px;text-align:center;line-height:1;${i < 3 ? "color:var(--stamp)" : ""}">${i + 1}</td><td><div class="row" style="flex-wrap:nowrap"><span class="avatar av-sm">${esc(initials(displayName(r.x)))}</span><span style="min-width:0">${userLink(r.x)}${(r.x.badges || []).some((b) => BADGES.find((x) => x.id === b)?.rare) ? ' <span class="why" title="Có huy hiệu hiếm">Hiếm</span>' : ""}<span class="tiny muted" style="display:block">${faculty(r.x.faculty)?.shortName || ""}${r.x.cohort ? `, K${r.x.cohort}` : ""}${spacesOf(r.x.email, "class")[0] ? `, ${esc(spacesOf(r.x.email, "class")[0].name.replace("Lớp ", ""))}` : ""}</span></span></div></td><td class="num"><b>${r.v}</b></td></tr>`)
      .join("")}</tbody></table>`;
  }
  const tabs = (key, list, cur) => `<nav class="tabs" aria-label="${key}">${list.map(([k, l]) => `<a href="${link({ [key]: k })}"${k === cur ? ' aria-current="page"' : ""}>${l}</a>`).join("")}</nav>`;
  const groupSelect =
    scope === "vien"
      ? DATA.faculties.map((f) => [f.code, f.shortName])
      : scope === "lop"
        ? groupOpts("class").map((s) => [s.id, s.name])
        : scope === "clb"
          ? groupOpts("club").map((s) => [s.id, s.name])
          : null;
  return {
    html:
      cmHead("Bảng xếp hạng", "xh", `<div class="stack" style="gap:8px">${tabs("pham-vi", [["truong", "Toàn trường"], ["vien", "Theo Viện"], ["lop", "Theo lớp"], ["clb", "Theo CLB"], ["tap-the", "Tập thể"]], scope)}${tabs("theo", [["xp", "XP nhiệm vụ"], ["hoi-dap", "Hỏi đáp"], ["tai-lieu", "Tài liệu"], ["uy-tin", "Uy tín"]], by)}${periodic ? tabs("ky", [["tuan", "Tuần này"], ["thang", "30 ngày"], ["tat-ca", "Mọi lúc"]], ky) : ""}</div>`) +
      `<div class="wrap stack" style="max-width:860px;padding-block:24px;gap:12px">${groupSelect ? `<div class="field" style="max-width:360px"><label for="grp">${scope === "vien" ? "Viện" : scope === "lop" ? "Lớp" : "CLB"}</label><select class="select" id="grp">${groupSelect.map(([k, l]) => `<option value="${k}"${k === sel ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></div>` : ""}${body}
      <p class="small muted" style="margin:0">XP nhận từ nhiệm vụ. Điểm hỏi đáp: +15 mỗi câu trả lời được chọn, +5 mỗi câu trả lời. Uy tín: +10 mỗi tài liệu được duyệt, +10 mỗi lượt thích câu trả lời, −20 khi tài liệu bị gỡ vì vi phạm. Lớp và CLB lấy từ thành viên các không gian.</p></div>`,
    mount(root) {
      root.querySelector("#grp")?.addEventListener("change", (e) => go(link({ nhom: e.target.value })));
    },
  };
};

/* ===================== Hỏi đáp theo học phần ===================== */
const VOTE_REP = { q: 5, a: 10, down: -2, accept: 15 };
function voteSum(v) {
  return Object.values(v || {}).reduce((s, x) => s + x, 0);
}
function changeRep(email, delta) {
  const x = userBy(email);
  if (x && delta) x.reputation = (x.reputation || 0) + delta;
}
function qaCheck(text) {
  const banned = DATA.bannedWords.find((w) => norm(text).includes(norm(w)));
  return banned ? `Nội dung chứa từ không được phép: “${banned}”.` : null;
}
views["/hoi-dap"] = () => {
  const u = me();
  const cm = CM();
  const p = params();
  const hp = p.get("hp") || "";
  const loc = p.get("loc") || "moi";
  const q = (p.get("q") || "").trim();
  let list = cm.questions.filter((x) => x.status === "VISIBLE" && (!hp || x.course === hp) && (!q || norm(`${x.title} ${x.body}`).includes(norm(q))));
  const ans = (x) => cm.answers.filter((a) => a.q === x.id && a.status === "VISIBLE");
  if (loc === "chua-tra-loi") list = list.filter((x) => !ans(x).length);
  list.sort(loc === "binh-chon" ? (a, b) => voteSum(b.votes) - voteSum(a.votes) : (a, b) => b.t - a.t);
  const codes = [...new Set(cm.questions.map((x) => x.course))].sort();
  const link = (over) => `#/hoi-dap?${new URLSearchParams({ ...(hp ? { hp } : {}), loc, ...(q ? { q } : {}), ...over })}`;
  return {
    html:
      cmHead("Hỏi đáp", "qa", `<p class="small muted" style="margin:0">Đặt câu hỏi theo học phần, trả lời, bình chọn. Người hỏi chọn câu trả lời hay nhất. Câu trả lời được thích +${VOTE_REP.a} uy tín, được chọn +${VOTE_REP.accept}.</p>`) +
      `<div class="wrap stack" style="padding-block:20px;gap:16px">
      <div class="row" style="justify-content:space-between;gap:8px"><form class="row" data-form="qs" style="gap:6px;flex-wrap:nowrap;flex:1 1 320px"><label class="sr" for="qsq">Tìm câu hỏi</label><input class="input" id="qsq" value="${esc(q)}" placeholder="Tìm câu hỏi"><select class="select" id="qshp" style="width:auto" aria-label="Học phần"><option value="">Mọi học phần</option>${S.courses.map((c) => `<option value="${c.code}"${c.code === hp ? " selected" : ""}>${c.code}</option>`).join("")}</select><button class="btn ink" type="submit">Tìm</button></form><a class="btn primary" href="#/hoi-dap/hoi${hp ? `?hp=${hp}` : ""}">Đặt câu hỏi</a></div>
      <nav class="tabs" aria-label="Lọc">${[["moi", "Mới nhất"], ["binh-chon", "Nhiều bình chọn"], ["chua-tra-loi", "Chưa có trả lời"]].map(([k, l]) => `<a href="${link({ loc: k })}"${k === loc ? ' aria-current="page"' : ""}>${l}</a>`).join("")}</nav>
      ${codes.length ? `<div class="row" style="gap:6px">${codes.map((c) => `<a class="btn sm${c === hp ? " ink" : ""}" href="#/hoi-dap?${new URLSearchParams({ hp: c === hp ? "" : c, loc })}">${c}</a>`).join("")}</div>` : ""}
      ${list.length ? `<ul class="tb" style="list-style:none;margin:0;padding:0">${list
        .map((x) => {
          const a = ans(x);
          return `<li style="display:grid;grid-template-columns:auto auto minmax(0,1fr);gap:12px;padding:10px 12px;align-items:start"><span style="text-align:center;min-width:44px"><b class="code" style="font-size:20px;display:block">${voteSum(x.votes)}</b><span class="tiny muted">bình chọn</span></span><span style="text-align:center;min-width:52px;${x.accepted ? "border:2px solid var(--stamp);color:var(--stamp)" : a.length ? "border:2px solid var(--line)" : ""};padding:2px 4px"><b class="code" style="font-size:20px;display:block">${a.length}</b><span class="tiny">trả lời</span></span><span style="min-width:0"><a href="#/hoi-dap/${x.id}" style="font-weight:600;line-height:1.35">${esc(x.title)}</a><span class="tiny muted" style="display:block">${x.course} ${esc(course(x.course)?.name || "")}, ${esc(displayName(userBy(x.by) || { name: "?" }))}, ${fmtTime(x.t)}</span></span></li>`;
        })
        .join("")}</ul>` : empty("Chưa có câu hỏi nào.", '<a href="#/hoi-dap/hoi">Đặt câu hỏi đầu tiên</a>')}
      </div>`,
    mount(root) {
      root.querySelector('[data-form="qs"]').addEventListener("submit", (e) => {
        e.preventDefault();
        go(`#/hoi-dap?${new URLSearchParams({ hp: root.querySelector("#qshp").value, loc, q: root.querySelector("#qsq").value.trim() })}`);
      });
    },
  };
};
views["/hoi-dap/hoi"] = () => {
  const u = me();
  if (!u) return needLogin("/hoi-dap/hoi");
  const hp = params().get("hp") || "";
  return {
    html:
      cmHead("Đặt câu hỏi", "qa") +
      `<div class="wrap" style="max-width:760px;padding-block:20px"><form class="stack" data-form="ask" style="border:2px solid var(--line);background:var(--sheet);padding:16px;gap:12px">
      <div class="field"><label for="aq-c">Học phần <span class="req">*</span></label><select class="select" id="aq-c" required><option value="">Chọn học phần</option>${S.courses.map((c) => `<option value="${c.code}"${c.code === hp ? " selected" : ""}>${c.code} ${esc(c.name)}</option>`).join("")}</select></div>
      <div class="field"><label for="aq-t">Tiêu đề <span class="req">*</span></label><input class="input" id="aq-t" maxlength="150" placeholder="Hỏi cụ thể, ví dụ: Khi nào cây AVL cần quay kép?"></div>
      <div class="field"><label for="aq-b">Nội dung</label><textarea class="textarea" id="aq-b" maxlength="3000" placeholder="Bạn đã thử gì, chỗ nào chưa hiểu"></textarea></div>
      <p class="small muted" style="margin:0">Không đăng đáp án bài kiểm tra đang diễn ra. Câu hỏi vi phạm quy định sẽ bị ẩn.</p>
      <p class="err" data-err role="alert" hidden></p><div><button class="btn primary" type="submit">Đăng câu hỏi</button></div></form></div>`,
    mount(root) {
      root.querySelector('[data-form="ask"]').addEventListener("submit", (e) => {
        e.preventDefault();
        const err = root.querySelector("[data-err]");
        const fail = (m) => ((err.textContent = tr(m)), (err.hidden = false));
        const c = root.querySelector("#aq-c").value;
        const title = root.querySelector("#aq-t").value.trim();
        const body = root.querySelector("#aq-b").value.trim();
        if (!c) return fail("Chọn học phần.");
        if (title.length < 10) return fail("Tiêu đề ít nhất 10 ký tự.");
        const bad = qaCheck(`${title} ${body}`);
        if (bad) return fail(bad);
        const cm = CM();
        const recent = cm.questions.filter((x) => x.by === u.email && Date.now() - x.t < 3600e3).length;
        if (recent >= 5) return fail("Bạn đặt quá nhiều câu hỏi trong một giờ, thử lại sau.");
        const q = { id: `q${uid()}`, course: c, by: u.email, title, body, t: Date.now(), votes: {}, views: 0, accepted: null, status: "VISIBLE" };
        cm.questions.unshift(q);
        logAction(u, "ask");
        for (const [email, list] of Object.entries(S.follows)) if (list.includes(c) && email !== u.email) S.notifications.unshift({ id: uid(), to: email, type: "QA", title: `Câu hỏi mới ở ${c}: ${title}`, link: `#/hoi-dap/${q.id}`, t: Date.now(), read: false });
        save();
        toast("Đã đăng câu hỏi.");
        go(`#/hoi-dap/${q.id}`);
      });
    },
  };
};
function voteBox(kind, item, u) {
  const mine = u ? item.votes[u.email] || 0 : 0;
  return `<div class="stack" style="gap:2px;align-items:center;min-width:44px"><button class="icon-btn" type="button" data-vote="${kind}|${item.id}|1" aria-label="Bình chọn hữu ích" aria-pressed="${mine === 1}" style="${mine === 1 ? "color:var(--stamp)" : ""}">▲</button><b class="code" style="font-size:22px">${voteSum(item.votes)}</b><button class="icon-btn" type="button" data-vote="${kind}|${item.id}|-1" aria-label="Bình chọn không hữu ích" aria-pressed="${mine === -1}" style="${mine === -1 ? "color:var(--stamp)" : ""}">▼</button></div>`;
}
views["/hoi-dap/:id"] = ({ id }) => {
  const u = me();
  const cm = CM();
  const q = cm.questions.find((x) => x.id === id);
  if (!q || (q.status !== "VISIBLE" && !isMod(u))) return views.notfound();
  q.views = (q.views || 0) + 1;
  const asker = userBy(q.by) || { name: "?" };
  const list = cm.answers.filter((a) => a.q === q.id && (a.status === "VISIBLE" || isMod(u))).sort((a, b) => (b.id === q.accepted) - (a.id === q.accepted) || voteSum(b.votes) - voteSum(a.votes) || a.t - b.t);
  const docs = typeof examDocs === "function" ? examDocs(q.course, 3) : [];
  return {
    html:
      cmHead(esc(q.title), "qa", `<p class="small muted" style="margin:0"><a href="#/hoi-dap?hp=${q.course}">${q.course} ${esc(course(q.course)?.name || "")}</a>, hỏi bởi ${userLink(asker)}, ${fmtTime(q.t)}, ${q.views} lượt xem</p>`) +
      `<div class="wrap stack" style="max-width:860px;padding-block:20px;gap:16px">
      <div class="tb" style="grid-template-columns:auto minmax(0,1fr)"><div style="padding:10px">${voteBox("q", q, u)}</div><div style="padding:12px 14px" class="stack"><p style="margin:0;white-space:pre-line">${esc(q.body || "(Không có mô tả thêm)")}</p>${isMod(u) ? `<div><button class="btn sm" type="button" data-hideq>${q.status === "VISIBLE" ? "Ẩn câu hỏi (KDV)" : "Hiện lại"}</button></div>` : ""}</div></div>
      <h2 class="h2" style="margin:8px 0 0">${list.length} câu trả lời</h2>
      ${list
        .map((a) => {
          const by = userBy(a.by) || { name: "?" };
          const acc = a.id === q.accepted;
          return `<div class="tb" style="grid-template-columns:auto minmax(0,1fr);${acc ? "border-color:var(--stamp)" : ""}${a.status !== "VISIBLE" ? ";opacity:.5" : ""}"><div style="padding:10px">${voteBox("a", a, u)}</div><div style="padding:12px 14px" class="stack">${acc ? '<span class="stamp" style="transform:none;width:fit-content">Câu trả lời hay nhất</span>' : ""}<p style="margin:0;white-space:pre-line">${esc(a.body)}</p><div class="row" style="justify-content:space-between;gap:8px"><span class="tiny muted">${userLink(by)}, uy tín ${by.reputation ?? 0}, ${fmtTime(a.t)}</span><span class="row" style="gap:6px">${u?.email === q.by && !acc ? `<button class="btn sm" type="button" data-accept="${a.id}">Chọn là hay nhất</button>` : ""}${u?.email === q.by && acc ? `<button class="btn sm ghost" type="button" data-accept="">Bỏ chọn</button>` : ""}${isMod(u) ? `<button class="btn sm ghost" type="button" data-hidea="${a.id}">${a.status === "VISIBLE" ? "Ẩn (KDV)" : "Hiện lại"}</button>` : ""}</span></div></div></div>`;
        })
        .join("") || '<p class="small muted" style="margin:0">Chưa có câu trả lời. Bạn biết thì giúp một tay nhé.</p>'}
      ${u ? `<form class="stack" data-form="ans" style="border:2px solid var(--line);background:var(--sheet);padding:16px;gap:10px"><label class="h2" for="ans-b" style="margin:0">Câu trả lời của bạn</label><textarea class="textarea" id="ans-b" maxlength="4000" placeholder="Giải thích rõ ràng, có thể kèm ví dụ"></textarea><p class="err" data-err role="alert" hidden></p><div><button class="btn primary" type="submit">Đăng câu trả lời</button></div></form>` : `<p class="note" style="margin:0"><a href="#/dang-nhap?next=${encodeURIComponent(`/hoi-dap/${q.id}`)}">Đăng nhập</a> để trả lời.</p>`}
      ${docs.length ? `<section class="stack" style="gap:6px"><h2 class="h2" style="margin:0">Tài liệu liên quan</h2>${docs.map((d) => docRow(d)).join("")}</section>` : ""}
      </div>`,
    mount(root) {
      root.querySelectorAll("[data-vote]").forEach((b) =>
        b.addEventListener("click", () => {
          if (!u) return go(`#/dang-nhap?next=${encodeURIComponent(`/hoi-dap/${q.id}`)}`);
          const [kind, iid, v] = b.dataset.vote.split("|");
          const item = kind === "q" ? q : cm.answers.find((x) => x.id === iid);
          if (item.by === u.email) return toast("Không tự bình chọn cho mình.");
          const old = item.votes[u.email] || 0;
          const nv = old === +v ? 0 : +v;
          const repFor = (x) => (x === 1 ? (kind === "q" ? VOTE_REP.q : VOTE_REP.a) : x === -1 ? VOTE_REP.down : 0);
          changeRep(item.by, repFor(nv) - repFor(old));
          if (nv) item.votes[u.email] = nv;
          else delete item.votes[u.email];
          if (kind === "a" && nv === 1 && typeof crCommentLiked === "function") crCommentLiked({ id: `ans-${item.id}`, by: item.by, likes: Object.values(item.votes).filter((x) => x > 0) }, { id: null, title: `câu trả lời ở “${q.title}”` });
          save();
          render();
        }),
      );
      root.querySelectorAll("[data-accept]").forEach((b) =>
        b.addEventListener("click", () => {
          const prev = q.accepted && cm.answers.find((x) => x.id === q.accepted);
          if (prev) changeRep(prev.by, -VOTE_REP.accept);
          q.accepted = b.dataset.accept || null;
          const a = q.accepted && cm.answers.find((x) => x.id === q.accepted);
          if (a && a.by !== u.email) {
            changeRep(a.by, VOTE_REP.accept);
            CM().log.push({ user: a.by, kind: "accepted", t: Date.now() });
            S.notifications.unshift({ id: uid(), to: a.by, type: "QA", title: `Câu trả lời của bạn được chọn là hay nhất: ${q.title}`, link: `#/hoi-dap/${q.id}`, t: Date.now(), read: false });
            const au = userBy(a.by);
            if (au) checkBadges(au);
          }
          save();
          render();
        }),
      );
      root.querySelector('[data-form="ans"]')?.addEventListener("submit", (e) => {
        e.preventDefault();
        const err = root.querySelector('[data-form="ans"] [data-err]');
        const body = root.querySelector("#ans-b").value.trim();
        const fail = (m) => ((err.textContent = tr(m)), (err.hidden = false));
        if (body.length < 15) return fail("Câu trả lời ít nhất 15 ký tự.");
        const bad = qaCheck(body);
        if (bad) return fail(bad);
        if (cm.answers.some((a) => a.by === u.email && Date.now() - a.t < 20e3)) return fail("Bạn trả lời quá nhanh, đợi một chút nhé.");
        cm.answers.push({ id: `a${uid()}`, q: q.id, by: u.email, body, t: Date.now(), votes: {}, status: "VISIBLE" });
        logAction(u, "answer");
        if (q.by !== u.email) S.notifications.unshift({ id: uid(), to: q.by, type: "QA", title: `Có câu trả lời mới: ${q.title}`, link: `#/hoi-dap/${q.id}`, t: Date.now(), read: false });
        save();
        toast("Đã đăng câu trả lời.");
        render();
      });
      root.querySelector("[data-hideq]")?.addEventListener("click", () => {
        q.status = q.status === "VISIBLE" ? "HIDDEN" : "VISIBLE";
        save();
        render();
      });
      root.querySelectorAll("[data-hidea]").forEach((b) =>
        b.addEventListener("click", () => {
          const a = cm.answers.find((x) => x.id === b.dataset.hidea);
          a.status = a.status === "VISIBLE" ? "HIDDEN" : "VISIBLE";
          save();
          render();
        }),
      );
    },
  };
};

/* ===================== Không gian CLB, lớp ===================== */
const SPACE_TYPE = { class: "Lớp", club: "CLB" };
const JOIN_LABEL = { open: "Ai cũng vào được", request: "Xin vào, quản trị duyệt", code: "Chỉ vào bằng mã mời" };
function roleIn(s, email) {
  if (!email) return null;
  if (s.owner === email) return "owner";
  if (s.admins.includes(email)) return "admin";
  if (s.members.includes(email)) return "member";
  return null;
}
const ROLE_LABEL = { owner: "Chủ nhiệm", admin: "Quản trị", member: "Thành viên" };
views["/khong-gian"] = () => {
  const u = me();
  const cm = CM();
  const t = params().get("loai") || "";
  const mine = u ? cm.spaces.filter((s) => s.members.includes(u.email)) : [];
  const dir = cm.spaces.filter((s) => (!t || s.type === t) && !(u && s.members.includes(u.email)));
  const card = (s) => `<a class="rec" href="#/khong-gian/${s.id}"><span class="why">${SPACE_TYPE[s.type]}</span><b class="head" style="font-size:16px">${esc(s.name)}</b><span class="small muted">${esc(s.desc || "")}</span><span class="tiny muted">${s.members.length} thành viên, ${faculty(s.faculty)?.shortName || ""}${u && roleIn(s, u.email) ? `, bạn là ${ROLE_LABEL[roleIn(s, u.email)].toLowerCase()}` : ""}</span></a>`;
  return {
    html:
      cmHead("CLB và lớp", "kg", `<p class="small muted" style="margin:0">Không gian riêng của CLB hoặc lớp: thông báo, tài liệu nội bộ chỉ thành viên xem được, phân quyền quản trị.</p>`) +
      `<div class="wrap stack" style="padding-block:20px;gap:24px">
      ${u ? `<section class="stack" style="gap:10px"><h2 class="h2" style="margin:0">Của tôi</h2>${mine.length ? `<div class="cards">${mine.map(card).join("")}</div>` : '<p class="small muted" style="margin:0">Bạn chưa tham gia không gian nào.</p>'}</section>` : ""}
      <section class="stack" style="gap:10px"><div class="row" style="justify-content:space-between;align-items:center"><h2 class="h2" style="margin:0">Khám phá</h2><nav class="tabs" aria-label="Loại">${[["", "Tất cả"], ["club", "CLB"], ["class", "Lớp"]].map(([k, l]) => `<a href="#/khong-gian${k ? `?loai=${k}` : ""}"${k === t ? ' aria-current="page"' : ""}>${l}</a>`).join("")}</nav></div><div class="cards">${dir.map(card).join("")}</div></section>
      ${u ? `<div class="two" style="gap:16px">
       <form class="stack" data-form="newsp" style="border:2px solid var(--line);background:var(--sheet);padding:16px;gap:10px"><h2 class="h2" style="margin:0">Tạo không gian</h2>
        <div class="field"><label for="sp-n">Tên</label><input class="input" id="sp-n" maxlength="80" placeholder="Ví dụ: Lớp Kỹ thuật phần mềm 02-K69"></div>
        <div style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))"><div class="field"><label for="sp-t">Loại</label><select class="select" id="sp-t"><option value="club">CLB</option><option value="class">Lớp</option></select></div><div class="field"><label for="sp-f">Viện</label><select class="select" id="sp-f">${DATA.faculties.map((f) => `<option value="${f.code}"${f.code === u.faculty ? " selected" : ""}>${esc(f.shortName)}</option>`).join("")}</select></div><div class="field"><label for="sp-j">Tham gia</label><select class="select" id="sp-j">${Object.entries(JOIN_LABEL).map(([k, l]) => `<option value="${k}"${k === "request" ? " selected" : ""}>${l}</option>`).join("")}</select></div></div>
        <div class="field"><label for="sp-d">Giới thiệu</label><textarea class="textarea" id="sp-d" style="min-height:56px" maxlength="300"></textarea></div>
        <div><button class="btn primary" type="submit">Tạo</button></div></form>
       <form class="stack" data-form="joincode" style="border:2px solid var(--line);background:var(--sheet);padding:16px;gap:10px"><h2 class="h2" style="margin:0">Vào bằng mã mời</h2><div class="field"><label for="sp-code">Mã mời</label><input class="input" id="sp-code" maxlength="12" style="text-transform:uppercase"></div><div><button class="btn ink" type="submit">Vào</button></div></form></div>` : ""}
      </div>`,
    mount(root) {
      root.querySelector('[data-form="newsp"]')?.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = root.querySelector("#sp-n").value.trim();
        if (name.length < 4) return toast("Tên ít nhất 4 ký tự.");
        const bad = qaCheck(name);
        if (bad) return toast(bad);
        const id = `${slugify(name).slice(0, 40)}-${uid().slice(0, 4)}`;
        cm.spaces.unshift({ id, type: root.querySelector("#sp-t").value, name, faculty: root.querySelector("#sp-f").value, owner: u.email, admins: [], members: [u.email], requests: [], join: root.querySelector("#sp-j").value, code: uid().slice(0, 6).toUpperCase(), desc: root.querySelector("#sp-d").value.trim(), posts: [], files: [], t: Date.now() });
        save();
        go(`#/khong-gian/${id}`);
      });
      root.querySelector('[data-form="joincode"]')?.addEventListener("submit", (e) => {
        e.preventDefault();
        const code = root.querySelector("#sp-code").value.trim().toUpperCase();
        const s = cm.spaces.find((x) => x.code === code);
        if (!s) return toast("Mã mời không đúng.");
        if (!s.members.includes(u.email)) s.members.push(u.email);
        s.requests = s.requests.filter((x) => x !== u.email);
        save();
        go(`#/khong-gian/${s.id}`);
      });
    },
  };
};
views["/khong-gian/:id"] = ({ id }) => {
  const u = me();
  const cm = CM();
  const s = cm.spaces.find((x) => x.id === id);
  if (!s) return views.notfound();
  const role = roleIn(s, u?.email);
  const manage = role === "owner" || role === "admin" || isAdmin(u);
  const tab = ["tb", "tl", "tv"].includes(params().get("tab")) ? params().get("tab") : "tb";
  const pending = u && s.requests.includes(u.email);
  const head = `<div class="row" style="gap:8px;align-items:center"><span class="why">${SPACE_TYPE[s.type]}</span><span class="small muted">${faculty(s.faculty)?.shortName || ""}, ${s.members.length} thành viên, ${JOIN_LABEL[s.join].toLowerCase()}</span></div>${s.desc ? `<p class="small" style="margin:0;max-width:720px">${esc(s.desc)}</p>` : ""}
   <div class="row" style="gap:6px">${!u ? `<a class="btn primary sm" href="#/dang-nhap?next=${encodeURIComponent(`/khong-gian/${s.id}`)}">Đăng nhập để tham gia</a>` : role ? (role !== "owner" ? '<button class="btn sm" type="button" data-leave>Rời không gian</button>' : "") : pending ? '<span class="tiny muted">Đã gửi yêu cầu, chờ quản trị duyệt.</span>' : s.join === "code" ? '<span class="tiny muted">Cần mã mời để vào.</span>' : `<button class="btn primary sm" type="button" data-join>${s.join === "open" ? "Tham gia" : "Xin tham gia"}</button>`}${manage ? `<span class="tiny muted">Mã mời: <b class="code" style="font-size:15px">${s.code}</b></span>` : ""}</div>
   <nav class="tabs" aria-label="Mục">${[["tb", "Thông báo"], ["tl", "Tài liệu nội bộ"], ["tv", `Thành viên${manage && s.requests.length ? ` (${s.requests.length} chờ duyệt)` : ""}`]].map(([k, l]) => `<a href="#/khong-gian/${s.id}?tab=${k}"${k === tab ? ' aria-current="page"' : ""}>${l}</a>`).join("")}</nav>`;
  let body = "";
  const locked = !role && !isAdmin(u);
  if (locked && tab !== "tv") body = `<div class="empty"><p class="head" style="margin:0">Nội dung chỉ dành cho thành viên</p><div class="small muted" style="margin-top:8px">Tham gia không gian để xem thông báo và tài liệu nội bộ.</div></div>`;
  else if (tab === "tb") {
    const posts = [...s.posts].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.t - a.t);
    body = `${manage ? `<form class="stack" data-form="post" style="border:2px solid var(--line);background:var(--sheet);padding:12px 16px;gap:8px"><div class="field"><label for="po-t">Tiêu đề thông báo</label><input class="input" id="po-t" maxlength="120"></div><div class="field"><label for="po-b">Nội dung</label><textarea class="textarea" id="po-b" style="min-height:64px" maxlength="2000"></textarea></div><label class="check"><input type="checkbox" id="po-p"><span>Ghim lên đầu</span></label><label class="check"><input type="checkbox" id="po-n" checked><span>Gửi thông báo cho thành viên</span></label><div><button class="btn primary" type="submit">Đăng thông báo</button></div></form>` : ""}
     ${posts.length ? posts.map((p) => `<article class="stack" style="border:2px solid ${p.pinned ? "var(--stamp)" : "var(--line)"};background:var(--sheet);padding:12px 16px;gap:6px"><div class="row" style="justify-content:space-between;gap:8px"><b class="head" style="font-size:17px">${p.pinned ? "📌 " : ""}${esc(p.title)}</b>${manage ? `<span class="row" style="gap:6px"><button class="btn sm ghost" type="button" data-pin="${p.id}">${p.pinned ? "Bỏ ghim" : "Ghim"}</button><button class="btn sm ghost" type="button" data-delpost="${p.id}">Xóa</button></span>` : ""}</div><p style="margin:0;white-space:pre-line">${esc(p.body)}</p><span class="tiny muted">${esc(displayName(userBy(p.by) || { name: "?" }))}, ${fmtTime(p.t)}</span></article>`).join("") : empty("Chưa có thông báo.")}`;
  } else if (tab === "tl") {
    body = `${role || isAdmin(u) ? `<form class="stack" data-form="file" style="border:2px solid var(--line);background:var(--sheet);padding:12px 16px;gap:8px"><h2 class="h2" style="margin:0">Chia sẻ tài liệu nội bộ</h2><div class="field"><label for="fi-t">Tiêu đề</label><input class="input" id="fi-t" maxlength="150"></div><div style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))"><div class="field"><label for="fi-f">Tải file lên</label><input class="input" id="fi-f" type="file"></div><div class="field"><label for="fi-d">Hoặc chọn tài liệu trong kho</label><select class="select" id="fi-d"><option value="">Không chọn</option>${S.docs.filter((d) => d.status === "APPROVED").map((d) => `<option value="${d.id}">${d.course}: ${esc(d.title)}</option>`).join("")}</select></div></div><p class="tiny muted" style="margin:0">Tài liệu nội bộ chỉ thành viên thấy và không qua hàng chờ kiểm duyệt chung. Không chia sẻ tài liệu vi phạm bản quyền.</p><div><button class="btn ink" type="submit">Chia sẻ</button></div></form>` : ""}
     ${s.files.length ? `<ul class="tb" style="list-style:none;margin:0;padding:0">${s.files
       .slice()
       .reverse()
       .map((f) => {
         const d = f.doc && S.docs.find((x) => x.id === f.doc);
         return `<li style="padding:10px 12px;display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap"><span style="min-width:0"><b style="font-weight:600">${esc(f.title)}</b><span class="tiny muted" style="display:block">${esc(displayName(userBy(f.by) || { name: "?" }))}, ${fmtTime(f.t)}${f.size ? `, ${fmtSize(f.size / 1024)}` : ""}</span></span><span class="row" style="gap:6px">${d ? `<a class="btn sm" href="#/tai-lieu/${d.slug}">Mở tài liệu</a>` : `<button class="btn sm" type="button" data-getfile="${f.id}">Tải về</button>`}${manage || f.by === u?.email ? `<button class="btn sm ghost" type="button" data-delfile="${f.id}">Xóa</button>` : ""}</span></li>`;
       })
       .join("")}</ul>` : empty("Chưa có tài liệu nội bộ.")}`;
  } else {
    const people = s.members.map((e) => [e, roleIn(s, e)]).sort((a, b) => ["owner", "admin", "member"].indexOf(a[1]) - ["owner", "admin", "member"].indexOf(b[1]));
    body = `${manage && s.requests.length ? `<section class="stack" style="gap:6px"><h2 class="h2" style="margin:0">Yêu cầu tham gia</h2><ul class="tb" style="list-style:none;margin:0;padding:0">${s.requests.map((e) => `<li style="padding:8px 12px;display:flex;justify-content:space-between;gap:8px;align-items:center"><span>${userLink(userBy(e))}</span><span class="row" style="gap:6px"><button class="btn sm primary" type="button" data-approve="${e}">Duyệt</button><button class="btn sm" type="button" data-deny="${e}">Từ chối</button></span></li>`).join("")}</ul></section>` : ""}
     <ul class="tb" style="list-style:none;margin:0;padding:0">${people
       .map(([e, r]) => `<li style="padding:8px 12px;display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap"><span>${userLink(userBy(e))} <span class="tiny muted">${ROLE_LABEL[r]}</span></span>${(role === "owner" || isAdmin(u)) && r !== "owner" ? `<span class="row" style="gap:6px"><button class="btn sm ghost" type="button" data-role="${e}">${r === "admin" ? "Bỏ quyền quản trị" : "Cho làm quản trị"}</button><button class="btn sm ghost" type="button" data-kick="${e}">Mời ra</button></span>` : role === "admin" && r === "member" ? `<button class="btn sm ghost" type="button" data-kick="${e}">Mời ra</button>` : ""}</li>`)
       .join("")}</ul>`;
  }
  return {
    html: cmHead(esc(s.name), "kg", head) + `<div class="wrap stack" style="max-width:900px;padding-block:20px;gap:16px">${body}</div>`,
    mount(root) {
      const notifyMembers = (title) => s.members.filter((e) => e !== u.email).forEach((e) => S.notifications.unshift({ id: uid(), to: e, type: "SPACE", title: `${s.name}: ${title}`, link: `#/khong-gian/${s.id}`, t: Date.now(), read: false }));
      const done = (msg) => {
        save();
        if (msg) toast(msg);
        render();
      };
      root.querySelector("[data-join]")?.addEventListener("click", () => {
        if (s.join === "open") {
          s.members.push(u.email);
          done("Đã tham gia.");
        } else {
          s.requests.push(u.email);
          [s.owner, ...s.admins].forEach((e) => S.notifications.unshift({ id: uid(), to: e, type: "SPACE", title: `${displayName(u)} xin vào ${s.name}`, link: `#/khong-gian/${s.id}?tab=tv`, t: Date.now(), read: false }));
          done("Đã gửi yêu cầu.");
        }
      });
      root.querySelector("[data-leave]")?.addEventListener("click", () => {
        s.members = s.members.filter((e) => e !== u.email);
        s.admins = s.admins.filter((e) => e !== u.email);
        done("Đã rời không gian.");
      });
      root.querySelector('[data-form="post"]')?.addEventListener("submit", (e) => {
        e.preventDefault();
        const title = root.querySelector("#po-t").value.trim();
        const body = root.querySelector("#po-b").value.trim();
        if (title.length < 3 || !body) return toast("Nhập tiêu đề và nội dung.");
        const bad = qaCheck(`${title} ${body}`);
        if (bad) return toast(bad);
        s.posts.push({ id: uid(), by: u.email, title, body, t: Date.now(), pinned: root.querySelector("#po-p").checked });
        if (root.querySelector("#po-n").checked) notifyMembers(title);
        done("Đã đăng thông báo.");
      });
      root.querySelectorAll("[data-pin]").forEach((b) => b.addEventListener("click", () => ((s.posts.find((p) => p.id === b.dataset.pin).pinned ^= true), done())));
      root.querySelectorAll("[data-delpost]").forEach((b) => b.addEventListener("click", () => ((s.posts = s.posts.filter((p) => p.id !== b.dataset.delpost)), done("Đã xóa."))));
      root.querySelector('[data-form="file"]')?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const title = root.querySelector("#fi-t").value.trim();
        const file = root.querySelector("#fi-f").files[0];
        const doc = root.querySelector("#fi-d").value;
        if (title.length < 3) return toast("Nhập tiêu đề.");
        if (!file && !doc) return toast("Chọn file hoặc tài liệu trong kho.");
        if (file && file.size > 20 * 1024 * 1024) return toast("File tối đa 20 MB trong bản demo.");
        const f = { id: uid(), by: u.email, title, t: Date.now() };
        if (doc) f.doc = doc;
        else {
          f.name = file.name;
          f.size = file.size;
          await fileDB.put(`space-${f.id}`, file);
        }
        s.files.push(f);
        notifyMembers(`tài liệu mới “${title}”`);
        done("Đã chia sẻ.");
      });
      root.querySelectorAll("[data-getfile]").forEach((b) =>
        b.addEventListener("click", async () => {
          const f = s.files.find((x) => x.id === b.dataset.getfile);
          const blob = await fileDB.get(`space-${f.id}`);
          if (!blob) return toast("File chỉ lưu trên máy của người tải lên trong bản demo.");
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = f.name || "tai-lieu";
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 2000);
        }),
      );
      root.querySelectorAll("[data-delfile]").forEach((b) => b.addEventListener("click", () => ((s.files = s.files.filter((f) => f.id !== b.dataset.delfile)), done("Đã xóa."))));
      root.querySelectorAll("[data-approve]").forEach((b) =>
        b.addEventListener("click", () => {
          const e = b.dataset.approve;
          s.requests = s.requests.filter((x) => x !== e);
          if (!s.members.includes(e)) s.members.push(e);
          S.notifications.unshift({ id: uid(), to: e, type: "SPACE", title: `Bạn đã được nhận vào ${s.name}`, link: `#/khong-gian/${s.id}`, t: Date.now(), read: false });
          done("Đã duyệt.");
        }),
      );
      root.querySelectorAll("[data-deny]").forEach((b) => b.addEventListener("click", () => ((s.requests = s.requests.filter((x) => x !== b.dataset.deny)), done("Đã từ chối."))));
      root.querySelectorAll("[data-role]").forEach((b) =>
        b.addEventListener("click", () => {
          const e = b.dataset.role;
          s.admins = s.admins.includes(e) ? s.admins.filter((x) => x !== e) : [...s.admins, e];
          done("Đã cập nhật quyền.");
        }),
      );
      root.querySelectorAll("[data-kick]").forEach((b) =>
        b.addEventListener("click", () => {
          const e = b.dataset.kick;
          s.members = s.members.filter((x) => x !== e);
          s.admins = s.admins.filter((x) => x !== e);
          done("Đã mời ra.");
        }),
      );
    },
  };
};

/* ===================== Quảng cáo ===================== */
/**
 * Mỗi chỗ đặt (trang chủ, kết quả tìm kiếm, trang tài liệu) hiện tối đa một quảng cáo, luôn ghi rõ "Quảng cáo"
 * và nhà tài trợ, không xen vào nội dung tài liệu, không ảnh hưởng thứ hạng tìm kiếm. Nhắm theo Viện là tùy chọn;
 * không dùng lịch sử xem hay tải để nhắm quảng cáo. Người dùng ẩn được từng quảng cáo; mỗi người tối đa `cap` lần/ngày.
 */
const adCache = {};
function adSlot(placement) {
  if (!S) return "";
  const u = me();
  const cm = CM();
  const today = vnDate(Date.now());
  const who = u?.email || "guest";
  const hidden = cm.adHidden[who] || [];
  const seen = (cm.adSeen[`${who}|${today}`] = cm.adSeen[`${who}|${today}`] || {});
  const list = cm.ads.filter((a) => a.active && a.from <= today && a.to >= today && a.placements.includes(placement) && (!a.faculties.length || (u && a.faculties.includes(u.faculty))) && !hidden.includes(a.id) && (seen[a.id] || 0) < a.cap);
  if (!list.length) return "";
  // Một lượt xem trang chỉ tính một lần hiển thị (trang vẽ lại nhiều lần khi thao tác)
  const ck = `${placement}|${location.hash}`;
  const cached = adCache[ck];
  let a = cached && Date.now() - cached.t < 120e3 && list.find((x) => x.id === cached.id);
  if (!a) {
    a = list[(Object.values(seen).reduce((s, x) => s + x, 0) + placement.length) % list.length];
    seen[a.id] = (seen[a.id] || 0) + 1;
    a.imp++;
    adCache[ck] = { id: a.id, t: Date.now() };
  }
  return `<aside class="ad" aria-label="Quảng cáo"><div class="row" style="justify-content:space-between;gap:8px"><span class="tiny" style="border:1px solid var(--pencil);padding:0 6px;color:var(--pencil)">Quảng cáo</span><button type="button" class="tiny" data-adhide="${a.id}" style="all:unset;cursor:pointer;color:var(--pencil);text-decoration:underline">Ẩn quảng cáo này</button></div><b class="head" style="font-size:15px">${esc(a.title)}</b><span class="small">${esc(a.body)}</span><span class="row" style="justify-content:space-between;gap:8px"><span class="tiny muted">Tài trợ bởi ${esc(a.sponsor)}</span><a class="btn sm" href="${esc(a.url)}" target="_blank" rel="sponsored noopener" data-adclick="${a.id}">${esc(a.cta || "Xem")}</a></span></aside>`;
}
document.addEventListener("click", (e) => {
  const c = e.target.closest("[data-adclick]");
  if (c) {
    const a = CM().ads.find((x) => x.id === c.dataset.adclick);
    if (a) {
      a.clicks++;
      save();
    }
    return;
  }
  const h = e.target.closest("[data-adhide]");
  if (h) {
    const who = me()?.email || "guest";
    const cm = CM();
    cm.adHidden[who] = [...(cm.adHidden[who] || []), h.dataset.adhide];
    save();
    h.closest(".ad")?.remove();
    toast("Đã ẩn quảng cáo này.");
  }
});
views["/quan-tri/quang-cao"] = () => {
  const u = me();
  if (!isAdmin(u)) return needLogin("/quan-tri/quang-cao");
  const cm = CM();
  const editId = params().get("sua");
  const ed = cm.ads.find((a) => a.id === editId) || { id: "", sponsor: "", title: "", body: "", url: "https://", cta: "Xem", placements: ["home"], faculties: [], from: vnDate(Date.now()), to: vnDate(Date.now() + 30 * D7), active: true, cap: 3 };
  const PL = { home: "Trang chủ", search: "Kết quả tìm kiếm", doc: "Trang tài liệu" };
  return {
    html: `<div class="wrap stack" style="padding-block:20px;gap:24px">${adminTabs("ad")}
     <p class="note" style="margin:0">Nguyên tắc: luôn ghi “Quảng cáo” và tên nhà tài trợ; không đặt trong trình xem tài liệu; không ảnh hưởng thứ hạng tìm kiếm; chỉ nhắm theo Viện, không dùng lịch sử xem/tải; không nhận quảng cáo dịch vụ làm bài hộ, bán đề thi, vay tiền.</p>
     <div style="overflow-x:auto"><table class="t" style="min-width:720px"><thead><tr><th>Chiến dịch</th><th>Vị trí</th><th>Thời gian</th><th class="num">Hiển thị</th><th class="num">Nhấp</th><th class="num">CTR</th><th>Trạng thái</th><th></th></tr></thead><tbody>${cm.ads
       .map((a) => `<tr><td><b style="font-weight:600">${esc(a.title)}</b><span class="tiny muted" style="display:block">${esc(a.sponsor)}${a.faculties.length ? `, nhắm ${a.faculties.join(", ")}` : ""}</span></td><td class="small">${a.placements.map((p) => PL[p]).join(", ")}</td><td class="small">${fmtDate(Date.parse(a.from))} đến ${fmtDate(Date.parse(a.to))}</td><td class="num">${fmtCount(a.imp)}</td><td class="num">${a.clicks}</td><td class="num">${a.imp ? ((a.clicks / a.imp) * 100).toFixed(1).replace(".", ",") : "0"}%</td><td>${a.active ? "Đang chạy" : "Tạm dừng"}</td><td class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn sm" type="button" data-toggle="${a.id}">${a.active ? "Dừng" : "Chạy"}</button><a class="btn sm" href="#/quan-tri/quang-cao?sua=${a.id}">Sửa</a><button class="btn sm ghost" type="button" data-delad="${a.id}">Xóa</button></td></tr>`)
       .join("")}</tbody></table></div>
     <form class="stack" data-form="ad" style="border:2px solid var(--line);background:var(--sheet);padding:16px;gap:10px"><h2 class="h2" style="margin:0">${ed.id ? "Sửa chiến dịch" : "Chiến dịch mới"}</h2>
      <div style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
       <div class="field"><label for="ad-s">Nhà tài trợ</label><input class="input" id="ad-s" value="${esc(ed.sponsor)}" maxlength="80"></div>
       <div class="field"><label for="ad-t">Tiêu đề</label><input class="input" id="ad-t" value="${esc(ed.title)}" maxlength="70"></div>
       <div class="field" style="grid-column:1/-1"><label for="ad-b">Nội dung</label><textarea class="textarea" id="ad-b" maxlength="160" style="min-height:56px">${esc(ed.body)}</textarea></div>
       <div class="field"><label for="ad-u">Liên kết (https)</label><input class="input" id="ad-u" value="${esc(ed.url)}"></div>
       <div class="field"><label for="ad-c">Nút</label><input class="input" id="ad-c" value="${esc(ed.cta)}" maxlength="20"></div>
       <div class="field"><label for="ad-f">Từ ngày</label><input class="input" id="ad-f" type="date" value="${ed.from}"></div>
       <div class="field"><label for="ad-to">Đến ngày</label><input class="input" id="ad-to" type="date" value="${ed.to}"></div>
       <div class="field"><label for="ad-cap">Tối đa mỗi người mỗi ngày</label><input class="input" id="ad-cap" type="number" min="1" max="20" value="${ed.cap}"></div>
      </div>
      <div class="row" style="gap:12px"><span class="small">Vị trí:</span>${Object.entries(PL).map(([k, l]) => `<label class="check"><input type="checkbox" data-pl="${k}"${ed.placements.includes(k) ? " checked" : ""}><span>${l}</span></label>`).join("")}</div>
      <div class="row" style="gap:12px"><span class="small">Nhắm theo Viện (bỏ trống là mọi Viện):</span>${DATA.faculties.map((f) => `<label class="check"><input type="checkbox" data-fac="${f.code}"${ed.faculties.includes(f.code) ? " checked" : ""}><span>${f.code}</span></label>`).join("")}</div>
      <p class="err" data-err role="alert" hidden></p><div class="row" style="gap:6px"><button class="btn primary" type="submit">${ed.id ? "Lưu" : "Tạo chiến dịch"}</button>${ed.id ? '<a class="btn ghost" href="#/quan-tri/quang-cao">Thôi</a>' : ""}</div></form></div>`,
    mount(root) {
      root.querySelectorAll("[data-toggle]").forEach((b) => b.addEventListener("click", () => ((cm.ads.find((a) => a.id === b.dataset.toggle).active ^= true), save(), render())));
      root.querySelectorAll("[data-delad]").forEach((b) => b.addEventListener("click", () => ((cm.ads = cm.ads.filter((a) => a.id !== b.dataset.delad)), save(), render())));
      root.querySelector('[data-form="ad"]').addEventListener("submit", (e) => {
        e.preventDefault();
        const v = (sel) => root.querySelector(sel).value.trim();
        const err = root.querySelector("[data-err]");
        const fail = (m) => ((err.textContent = tr(m)), (err.hidden = false));
        const data = { sponsor: v("#ad-s"), title: v("#ad-t"), body: v("#ad-b"), url: v("#ad-u"), cta: v("#ad-c") || "Xem", from: v("#ad-f"), to: v("#ad-to"), cap: Math.max(1, Math.min(20, +v("#ad-cap") || 3)), placements: [...root.querySelectorAll("[data-pl]:checked")].map((x) => x.dataset.pl), faculties: [...root.querySelectorAll("[data-fac]:checked")].map((x) => x.dataset.fac) };
        if (!data.sponsor || data.title.length < 5) return fail("Nhập nhà tài trợ và tiêu đề.");
        if (!/^https:\/\/[^\s]+$/.test(data.url)) return fail("Liên kết phải bắt đầu bằng https://");
        if (!data.placements.length) return fail("Chọn ít nhất một vị trí.");
        if (data.to < data.from) return fail("Ngày kết thúc phải sau ngày bắt đầu.");
        if (/lam bai ho|ban de|vay tien|thi ho/.test(norm(`${data.title} ${data.body}`))) return fail("Nội dung quảng cáo không phù hợp quy định.");
        if (ed.id) Object.assign(cm.ads.find((a) => a.id === ed.id), data);
        else cm.ads.unshift({ id: `ad${uid()}`, active: true, imp: 0, clicks: 0, ...data });
        S.audit.unshift({ t: Date.now(), by: u.email, action: ed.id ? "ad.update" : "ad.create", detail: `${data.sponsor}: ${data.title}` });
        save();
        toast("Đã lưu chiến dịch.");
        go("#/quan-tri/quang-cao");
      });
    },
  };
};

/* ===================== Thông báo từ trường ===================== */
views["/thong-bao-truong"] = () => {
  const u = me();
  loadFeed();
  const p = params();
  const tag = p.get("nhan") || "";
  const q = (p.get("q") || "").trim();
  const cm = CM();
  const who = u?.email || "guest";
  const lastSeen = cm.seenFeed[who] || 0;
  cm.seenFeed[who] = Date.now();
  save();
  const items = (hustFeed?.items || []).filter((x) => (!tag || x.tags.includes(tag)) && (!q || norm(x.title).includes(norm(q))));
  return {
    html:
      cmHead("Thông báo từ trường", "tb", `<p class="small muted" style="margin:0">Tự động lấy mỗi ngày từ trang công khai <a href="https://ctt.hust.edu.vn" target="_blank" rel="noopener">ctt.hust.edu.vn</a> và gắn nhãn theo chủ đề. Bấm vào tiêu đề để đọc bản gốc trên trang của trường.</p>`) +
      `<div class="wrap stack" style="max-width:900px;padding-block:20px;gap:12px">
      <form class="row" data-form="fq" style="gap:6px;flex-wrap:nowrap"><label class="sr" for="fq">Tìm thông báo</label><input class="input" id="fq" value="${esc(q)}" placeholder="Tìm, ví dụ: học phí, đăng ký"><button class="btn ink" type="submit">Tìm</button></form>
      <nav class="tabs" aria-label="Nhãn"><a href="#/thong-bao-truong"${!tag ? ' aria-current="page"' : ""}>Tất cả</a>${Object.entries(FEED_TAG).map(([k, l]) => `<a href="#/thong-bao-truong?nhan=${k}"${k === tag ? ' aria-current="page"' : ""}>${l}</a>`).join("")}</nav>
      ${items.length ? `<ul class="tb" style="list-style:none;margin:0;padding:0">${items
        .map((x) => `<li style="padding:10px 12px;display:flex;flex-direction:column;gap:4px">${Date.parse(x.firstSeen) > lastSeen && lastSeen ? '<span class="stamp" style="transform:none;width:fit-content">Mới</span>' : ""}<a href="${esc(x.url)}" target="_blank" rel="noopener" style="font-weight:600;line-height:1.35">${esc(x.title)}</a><span class="row" style="gap:6px">${x.date ? `<span class="tiny muted">${fmtDate(Date.parse(x.date))}</span>` : ""}<span class="tiny muted">${esc(x.source)}</span>${x.tags.map((t) => `<a class="why" href="#/thong-bao-truong?nhan=${t}" style="font-size:11px;text-decoration:none">${FEED_TAG[t] || t}</a>`).join("")}</span></li>`)
        .join("")}</ul>` : empty("Không có thông báo phù hợp.")}
      ${hustFeed ? `<p class="tiny muted" style="margin:0">Lần lấy gần nhất: ${fmtTime(Date.parse(hustFeed.fetchedAt))}. ${hustFeed.items.length} thông báo đang lưu.</p>` : ""}</div>`,
    mount(root) {
      root.querySelector('[data-form="fq"]').addEventListener("submit", (e) => {
        e.preventDefault();
        go(`#/thong-bao-truong?${new URLSearchParams({ ...(tag ? { nhan: tag } : {}), q: root.querySelector("#fq").value.trim() })}`);
      });
    },
  };
};
function feedWidget() {
  loadFeed();
  if (!hustFeed?.items?.length) return "";
  const items = hustFeed.items.filter((x) => x.date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  return `<section class="stack"><div class="sechead"><h2 class="h2">Thông báo từ trường</h2><a href="#/thong-bao-truong">Xem tất cả</a></div><ul class="tb" style="list-style:none;margin:0;padding:0">${items.map((x) => `<li style="padding:8px 12px"><a href="${esc(x.url)}" target="_blank" rel="noopener" style="font-weight:600;font-size:14px;line-height:1.35">${esc(x.title)}</a><span class="tiny muted" style="display:block">${fmtDate(Date.parse(x.date))}</span></li>`).join("")}</ul></section>`;
}

/* ===================== Vinh danh và chứng nhận ===================== */
function certEligible(x) {
  if (isMod(x)) return { ok: true, role: "Cộng tác viên kiểm duyệt" };
  if ((x.approved || 0) >= 5) return { ok: true, role: "Cộng tác viên đóng góp tài liệu" };
  if (acceptedCount(x.email) >= 5) return { ok: true, role: "Cộng tác viên hỏi đáp" };
  return { ok: false };
}
function issueCert(x, role, by) {
  const cm = CM();
  const existing = cm.certs.find((c) => c.user === x.email && c.role === role);
  if (existing) return existing;
  const modActs = S.docs.reduce((n, d) => n + (d.logs || []).filter((l) => l.by === x.email && ["APPROVE", "REJECT", "REQUEST_CHANGES", "REMOVE"].includes(l.a)).length, 0);
  const cert = { code: `HD-${uid().slice(0, 4).toUpperCase()}-${uid().slice(0, 4).toUpperCase()}`, user: x.email, name: displayName(x), role, stats: { docs: x.approved || 0, answers: acceptedCount(x.email), reviews: modActs, reputation: x.reputation || 0 }, issuedAt: Date.now(), by };
  cm.certs.push(cert);
  S.notifications.unshift({ id: uid(), to: x.email, type: "SPACE", title: `Bạn nhận chứng nhận điện tử: ${role}`, link: `#/chung-nhan/${cert.code}`, t: Date.now(), read: false });
  save();
  return cert;
}
views["/vinh-danh"] = () => {
  const u = me();
  const cm = CM();
  const users = S.users.filter((x) => !/^(kdv|admin)\./.test(x.email));
  const topDocs = [...users].sort((a, b) => b.approved - a.approved || b.reputation - a.reputation).slice(0, 6);
  const topQa = [...users].map((x) => [x, acceptedCount(x.email)]).filter((r) => r[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const month = Date.now() - 30 * D7;
  const topXp = [...users].map((x) => [x, xpOf(x.email, month)]).filter((r) => r[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const mods = S.users.filter((x) => isMod(x)).map((x) => [x, S.docs.reduce((n, d) => n + (d.logs || []).filter((l) => l.by === x.email && ["APPROVE", "REJECT", "REQUEST_CHANGES", "REMOVE"].includes(l.a)).length, 0)]);
  const rare = BADGES.filter((b) => b.rare).map((b) => [b, users.filter((x) => (x.badges || []).includes(b.id) || b.ok(x))]).filter(([, l]) => l.length);
  const elig = u ? certEligible(u) : { ok: false };
  const myCerts = u ? cm.certs.filter((c) => c.user === u.email) : [];
  const card = (x, line, i) => `<a class="rec" href="#/u/${esc(x.username)}"><span class="row" style="gap:10px;flex-wrap:nowrap"><b class="code" style="font-size:28px;color:${i < 3 ? "var(--stamp)" : "var(--ink)"}">${i + 1}</b><span class="avatar" style="width:40px;height:40px">${esc(initials(displayName(x)))}</span><span style="min-width:0"><b style="font-weight:600;display:block">${esc(displayName(x))}</b><span class="tiny muted">${faculty(x.faculty)?.shortName || ""}${x.cohort ? `, K${x.cohort}` : ""}</span></span></span><span class="small">${line}</span></a>`;
  return {
    html:
      cmHead("Vinh danh", "vd", `<p class="small muted" style="margin:0">Cảm ơn những người đã làm nên kho tài liệu. Cộng tác viên đủ điều kiện nhận chứng nhận điện tử có mã xác minh.</p>`) +
      `<div class="wrap stack" style="padding-block:20px;gap:28px">
      <section class="stack" style="gap:10px"><h2 class="h2" style="margin:0">Đóng góp tài liệu nhiều nhất</h2><div class="cards">${topDocs.map((x, i) => card(x, `${x.approved} tài liệu được duyệt, ${x.reputation} điểm uy tín`, i)).join("")}</div></section>
      ${topQa.length ? `<section class="stack" style="gap:10px"><h2 class="h2" style="margin:0">Người giải đáp</h2><div class="cards">${topQa.map(([x, n], i) => card(x, `${n} câu trả lời hay nhất`, i)).join("")}</div></section>` : ""}
      ${topXp.length ? `<section class="stack" style="gap:10px"><h2 class="h2" style="margin:0">Chăm chỉ nhất 30 ngày qua</h2><div class="cards">${topXp.map(([x, n], i) => card(x, `${n} XP nhiệm vụ`, i)).join("")}</div></section>` : ""}
      <section class="stack" style="gap:10px"><h2 class="h2" style="margin:0">Đội kiểm duyệt</h2><p class="small muted" style="margin:0">Những người âm thầm duyệt tài liệu để kho luôn sạch.</p><div class="cards">${mods.map(([x, n]) => `<div class="rec"><b style="font-weight:600">${esc(displayName(x))}</b><span class="small">${n} lượt xử lý tài liệu</span></div>`).join("")}</div></section>
      ${rare.length ? `<section class="stack" style="gap:10px"><h2 class="h2" style="margin:0">Huy hiệu hiếm</h2><ul class="tb" style="list-style:none;margin:0;padding:0">${rare.map(([b, l]) => `<li style="padding:8px 12px"><b>${b.ic} ${esc(b.name)}</b> <span class="tiny muted">${esc(b.desc)}</span><div class="small" style="margin-top:4px">${l.map((x) => userLink(x)).join(", ")}</div></li>`).join("")}</ul></section>` : ""}
      <section class="stack" style="gap:10px;border:2px solid var(--line);background:var(--sheet);padding:16px"><h2 class="h2" style="margin:0">Chứng nhận điện tử</h2>
       <p class="small" style="margin:0">Điều kiện: có từ 5 tài liệu được duyệt, hoặc 5 câu trả lời được chọn là hay nhất, hoặc là kiểm duyệt viên. Mỗi chứng nhận có mã xác minh, ai cũng kiểm tra được.</p>
       ${!u ? '<p class="small muted" style="margin:0">Đăng nhập để kiểm tra điều kiện.</p>' : myCerts.length ? `<div class="row" style="gap:6px">${myCerts.map((c) => `<a class="btn sm ink" style="white-space:normal;height:auto;min-height:36px" href="#/chung-nhan/${c.code}">${esc(c.role)} (${c.code})</a>`).join("")}</div>` : elig.ok ? `<div><button class="btn primary" type="button" data-cert style="white-space:normal;height:auto;min-height:44px;padding-block:8px;text-align:left">Nhận chứng nhận: ${elig.role}</button></div>` : `<p class="small muted" style="margin:0">Bạn chưa đủ điều kiện. Hiện có ${u.approved || 0} tài liệu được duyệt và ${acceptedCount(u.email)} câu trả lời hay nhất.</p>`}
       <form class="row" data-form="verify" style="gap:6px;flex-wrap:nowrap;max-width:420px"><label class="sr" for="vcode">Mã chứng nhận</label><input class="input" id="vcode" placeholder="Nhập mã để xác minh, ví dụ HD-AB12-CD34"><button class="btn" type="submit">Xác minh</button></form>
       ${isAdmin(u) ? `<form class="row" data-form="issue" style="gap:6px;flex-wrap:wrap"><label class="sr" for="iss-e">Email</label><input class="input" id="iss-e" list="iss-list" placeholder="Email cộng tác viên" style="flex:1 1 220px"><datalist id="iss-list">${S.users.map((x) => `<option value="${esc(x.email)}">`).join("")}</datalist><label class="sr" for="iss-r">Danh hiệu</label><select class="select" id="iss-r" style="width:auto"><option>Cộng tác viên đóng góp tài liệu</option><option>Cộng tác viên kiểm duyệt</option><option>Cộng tác viên hỏi đáp</option><option>Cộng tác viên truyền thông</option></select><button class="btn ink" type="submit">Cấp chứng nhận (quản trị)</button></form>` : ""}
      </section></div>`,
    mount(root) {
      root.querySelector("[data-cert]")?.addEventListener("click", () => go(`#/chung-nhan/${issueCert(u, elig.role, "tự động").code}`));
      root.querySelector('[data-form="verify"]').addEventListener("submit", (e) => {
        e.preventDefault();
        go(`#/chung-nhan/${encodeURIComponent(root.querySelector("#vcode").value.trim().toUpperCase())}`);
      });
      root.querySelector('[data-form="issue"]')?.addEventListener("submit", (e) => {
        e.preventDefault();
        const x = userBy(root.querySelector("#iss-e").value.trim().toLowerCase());
        if (!x) return toast("Không tìm thấy người dùng.");
        const c = issueCert(x, root.querySelector("#iss-r").value, u.email);
        S.audit.unshift({ t: Date.now(), by: u.email, action: "cert.issue", detail: `${x.email}: ${c.role} (${c.code})` });
        save();
        go(`#/chung-nhan/${c.code}`);
      });
    },
  };
};
views["/chung-nhan/:code"] = ({ code }) => {
  const c = CM().certs.find((x) => x.code === decodeURIComponent(code));
  if (!c)
    return { html: `<div class="wrap" style="max-width:640px;padding-block:48px"><div class="note red"><b>Không tìm thấy chứng nhận ${esc(decodeURIComponent(code))}.</b> Mã không đúng hoặc chứng nhận đã bị thu hồi.</div><p class="small muted">Bản demo lưu chứng nhận trên trình duyệt này; bản thật lưu trên máy chủ để ai cũng xác minh được.</p><a class="btn" href="#/vinh-danh">Về trang vinh danh</a></div>` };
  const x = userBy(c.user) || { name: c.name };
  const lines = [c.stats.docs ? `${c.stats.docs} tài liệu được duyệt` : "", c.stats.answers ? `${c.stats.answers} câu trả lời hay nhất` : "", c.stats.reviews ? `${c.stats.reviews} lượt kiểm duyệt` : ""].filter(Boolean);
  const verify = `${location.origin}${location.pathname}#/chung-nhan/${c.code}`;
  return {
    html: `<div class="wrap stack" style="max-width:900px;padding-block:24px;gap:12px"><div class="row no-print" style="gap:6px"><button class="btn primary" type="button" data-print>In hoặc lưu PDF</button><a class="btn" href="#/vinh-danh">Vinh danh</a></div>
     <article class="cert"><div class="cert-in"><span class="logo" style="justify-content:center"><span class="mark" aria-hidden="true"><span></span><span><span></span><i></i></span></span><b>HUSTDOCU</b></span>
      <p class="head" style="letter-spacing:.2em;margin:16px 0 0;font-size:14px">CHỨNG NHẬN</p><h1 class="code" style="font-size:clamp(32px,6vw,54px);line-height:1;margin:8px 0">${esc(c.role)}</h1>
      <p style="margin:12px 0 4px">Trao cho</p><p class="head" style="font-size:clamp(24px,4vw,34px);margin:0">${esc(displayName(x))}</p>
      <p style="margin:14px auto 0;max-width:560px">vì đã đóng góp cho kho tài liệu học tập của sinh viên${lines.length ? `: ${lines.join(", ")}` : ""}.</p>
      <div class="row" style="justify-content:space-between;margin-top:28px;gap:16px;text-align:left;align-items:flex-end"><span class="small">Ngày cấp ${fmtDate(c.issuedAt)}<br>Mã xác minh <b class="code" style="font-size:18px">${c.code}</b></span><span class="small" style="text-align:right">Ban điều hành HUSTDOCU<br><span class="stamp">Đã xác minh</span></span></div>
      <p class="tiny muted" style="margin:18px 0 0">Kiểm tra tại ${esc(verify)}. Chứng nhận của dự án sinh viên HUSTDOCU, không phải văn bằng hay giấy tờ của Đại học Bách khoa Hà Nội.</p></div></article></div>`,
    mount(root) {
      root.querySelector("[data-print]").addEventListener("click", () => window.print());
    },
  };
};

/* Bản dịch tiếng Anh cho giao diện giai đoạn 7 */
Object.assign(EN, {
  "Cộng đồng": "Community", "Nhiệm vụ": "Quests", "Hỏi đáp": "Q&A", "CLB, lớp": "Clubs, classes", "Thông báo trường": "University notices", "Vinh danh": "Hall of fame", "Cộng đồng, nhiệm vụ": "Community, quests",
  "Chuỗi ngày học": "Study streak", "Cấp độ": "Level", "XP tuần này": "XP this week", "5 tuần qua": "Last 5 weeks", "Nhiệm vụ hôm nay": "Today's quests", "Nhiệm vụ tuần": "Weekly quests", "Huy hiệu hiếm": "Rare badges", "Đã nhận": "Claimed",
  "Toàn trường": "Whole university", "Theo Viện": "By school", "Theo lớp": "By class", "Theo CLB": "By club", "Tập thể": "Groups", "XP nhiệm vụ": "Quest XP", "Tuần này": "This week", "30 ngày": "30 days", "Mọi lúc": "All time", "Tài liệu": "Documents", "Uy tín": "Reputation", "Người đóng góp": "Contributor",
  "Đặt câu hỏi": "Ask a question", "Mới nhất": "Newest", "Nhiều bình chọn": "Most votes", "Chưa có trả lời": "Unanswered", "Mọi học phần": "All courses", "Tìm câu hỏi": "Search questions", "Đăng câu hỏi": "Post question", "Đăng câu trả lời": "Post answer", "Câu trả lời của bạn": "Your answer",
  "Câu trả lời hay nhất": "Accepted answer", "Chọn là hay nhất": "Accept", "Bỏ chọn": "Unaccept", "Tài liệu liên quan": "Related documents",
  "CLB và lớp": "Clubs and classes", "Của tôi": "Mine", "Khám phá": "Explore", "Tạo không gian": "Create a space", "Vào bằng mã mời": "Join with code", "Mã mời": "Invite code", "Tham gia": "Join", "Xin tham gia": "Request to join", "Rời không gian": "Leave",
  "Tài liệu nội bộ": "Internal files", "Thành viên": "Members", "Đăng thông báo": "Post announcement", "Ghim lên đầu": "Pin", "Chia sẻ tài liệu nội bộ": "Share an internal file", "Chia sẻ": "Share", "Tải về": "Download", "Mở tài liệu": "Open document", "Yêu cầu tham gia": "Join requests", "Mời ra": "Remove", "Cho làm quản trị": "Make admin", "Bỏ quyền quản trị": "Remove admin",
  "Quảng cáo": "Ad", "Ẩn quảng cáo này": "Hide this ad", "Chiến dịch mới": "New campaign", "Sửa chiến dịch": "Edit campaign", "Tạo chiến dịch": "Create campaign", "Nhà tài trợ": "Sponsor", "Đang chạy": "Running", "Dừng": "Pause", "Chạy": "Run", "Sửa": "Edit",
  "Thông báo từ trường": "University notices", "Xem tất cả": "See all",
  "Đóng góp tài liệu nhiều nhất": "Top document contributors", "Người giải đáp": "Top answerers", "Chăm chỉ nhất 30 ngày qua": "Most active in 30 days", "Đội kiểm duyệt": "Moderation team", "Chứng nhận điện tử": "Digital certificate", "Xác minh": "Verify", "In hoặc lưu PDF": "Print or save PDF",
});
EN_RX.push(
  [/^Nhận (\d+) XP$/, "Claim $1 XP"],
  [/^Cấp (\d+)$/, "Level $1"],
  [/^(\d+) ngày$/, "$1 days"],
  [/^(\d+) câu trả lời$/, "$1 answers"],
  [/^Sự kiện: (.+)$/, "Event: $1"],
  [/^Tài trợ bởi (.+)$/, "Sponsored by $1"],
);
