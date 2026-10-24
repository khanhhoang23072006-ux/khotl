/* ===================== Giai đoạn 6: học tập thông minh và cá nhân hóa ===================== */
/* Lịch học, lịch thi, nhắc nhở; xếp lịch đăng ký lớp; CTĐT; ôn tập trắc nghiệm, flashcard (SM-2);
   gợi ý tài liệu; Pomodoro và phòng học chung. Dữ liệu lưu trong S.study (trình duyệt này). */
const D6 = 86400e3;
const SEMESTERS = {
  20261: { name: "Học kỳ 20261 (2026-2027, kỳ 1)", start: "2026-09-07", end: "2027-01-10" },
  20262: { name: "Học kỳ 20262 (2026-2027, kỳ 2)", start: "2027-02-22", end: "2027-06-27" },
};
/** Các kíp học thường gặp ở Bách khoa (giờ bắt đầu, kết thúc). */
const SLOTS = [
  ["06:45", "09:10"],
  ["09:20", "11:45"],
  ["12:30", "14:55"],
  ["15:05", "17:30"],
  ["17:45", "20:10"],
];
const DOW = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];
const DOW_SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const KIND = {
  class: { label: "Lớp học", bg: "var(--sheet)", fg: "var(--ink)", bd: "var(--line)" },
  exam: { label: "Lịch thi", bg: "var(--stamp)", fg: "#fff", bd: "var(--stamp)" },
  deadline: { label: "Hạn nộp", bg: "var(--wash)", fg: "var(--ink)", bd: "var(--stamp)" },
  study: { label: "Ôn tập", bg: "var(--wash)", fg: "var(--ink)", bd: "var(--line)" },
};

/** Điểm trung bình dạng số (rating() của trang trả về chuỗi đã định dạng). */
function avgRating(d) {
  return d.ratingCount ? d.ratingSum / d.ratingCount : 0;
}
function ymd(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseYmd(s) {
  const [y, m, d] = String(s).split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}
function hm(s) {
  s = String(s).trim();
  return s.includes(":") ? s.padStart(5, "0") : `${s.slice(0, 2)}:${s.slice(2, 4)}`;
}
function mins(s) {
  const [h, m] = hm(s).split(":").map(Number);
  return h * 60 + m;
}
function weekStart(t) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime() - ((d.getDay() + 6) % 7) * D6;
}
function dayStart(t) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function fmtDay(t) {
  return `${DOW[(new Date(t).getDay() + 6) % 7]}, ${new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(new Date(t))}`;
}
function daysUntil(t) {
  return Math.round((dayStart(t) - dayStart(Date.now())) / D6);
}
function countdown(t) {
  const n = daysUntil(t);
  return n <= 0 ? "Hôm nay" : n === 1 ? "Ngày mai" : `Còn ${n} ngày`;
}
/** "2-9,11-18" → Set các tuần */
function parseWeeks(text) {
  const set = new Set();
  for (const part of String(text || "").split(/[,;\s]+/)) {
    const m = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    for (let w = +m[1]; w <= +(m[2] || m[1]); w++) set.add(w);
  }
  return set;
}
function weeksText(set) {
  const list = [...set].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < list.length; i++) {
    let j = i;
    while (list[j + 1] === list[j] + 1) j++;
    out.push(i === j ? `${list[i]}` : `${list[i]}-${list[j]}`);
    i = j;
  }
  return out.join(",");
}
/** Số thứ tự tuần trong học kỳ (tuần 1 là tuần chứa ngày bắt đầu). */
function semWeek(t, semStart) {
  return Math.floor((weekStart(t) - weekStart(parseYmd(semStart))) / (7 * D6)) + 1;
}
function currentSemester() {
  const today = ymd(Date.now());
  return Object.keys(SEMESTERS).find((k) => today <= SEMESTERS[k].end) || "20262";
}

/* ----- Trạng thái ----- */
function ST() {
  if (!S.study) S.study = seedStudy();
  return S.study;
}
function seedStudy() {
  const sv = "sv.demo@sis.hust.edu.vn";
  const today = dayStart(Date.now());
  const st = {
    events: [],
    sent: {},
    prefs: {},
    offerings: null,
    offeringsName: null,
    plans: {},
    attempts: [],
    srs: {},
    cards: [],
    activity: seedActivity(),
    rooms: seedRooms(),
    pomo: [],
    goals: {},
    program: {
      [sv]: { prog: "IT1", done: ["MI1111", "MI1121", "MI1141", "PH1110", "PH1120", "IT1110", "FL1100", "FL1101", "SSH1111", "IT3020"] },
    },
  };
  const sem = SEMESTERS["20261"];
  const classes = [
    ["IT3011", 0, 0, "D9-401", "LT"],
    ["IT3080", 1, 1, "TC-205", "LT+BT"],
    ["IT3090", 2, 2, "D5-302", "LT+BT"],
    ["MI2020", 3, 0, "D3-201", "LT+BT"],
    ["IT3100", 4, 3, "TC-310", "LT+BT"],
    ["IT3011", 3, 3, "D9-203", "BT"],
  ];
  for (const [c, day, slot, room, type] of classes) {
    st.events.push({
      id: uid(),
      user: sv,
      kind: "class",
      title: `${course(c)?.name || c} (${type})`,
      course: c,
      weekly: { day, from: sem.start, to: sem.end, weeks: "1-8,10-17" },
      start: SLOTS[slot][0],
      end: SLOTS[slot][1],
      location: room,
    });
  }
  const add = (kind, c, days, start, end, title, location = "") =>
    st.events.push({ id: uid(), user: sv, kind, title, course: c, date: ymd(today + days * D6), start, end, location });
  add("exam", "IT3011", 5, "07:00", "08:30", "Thi giữa kỳ Cấu trúc dữ liệu và giải thuật", "D9-101");
  add("exam", "MI2020", 12, "09:30", "11:00", "Thi giữa kỳ Xác suất thống kê", "D3-5-301");
  add("deadline", "IT3080", 2, "23:59", "23:59", "Nộp bài tập lớn Mạng máy tính (nhóm 4)");
  add("deadline", "IT3090", 6, "23:59", "23:59", "Nộp báo cáo thiết kế cơ sở dữ liệu");
  return st;
}
function prefsOf(u) {
  const p = ST().prefs;
  p[u.email] = { exam: true, deadline: true, study: true, class: false, browser: false, ...(p[u.email] || {}) };
  return p[u.email];
}

/* ----- Lịch: các lần xảy ra trong khoảng [from, to) ----- */
function occurrences(u, from, to) {
  const out = [];
  for (const e of ST().events) {
    if (e.user !== u.email) continue;
    if (e.weekly) {
      const first = parseYmd(e.weekly.from);
      const last = parseYmd(e.weekly.to) + D6;
      const weeks = e.weekly.weeks ? parseWeeks(e.weekly.weeks) : null;
      for (let d = weekStart(Math.max(first, from)) + e.weekly.day * D6; d < Math.min(last, to); d += 7 * D6) {
        if (d < from || d < first) continue;
        if (weeks && !weeks.has(semWeek(d, e.weekly.from))) continue;
        out.push({ e, day: d, at: d + mins(e.start) * 60e3, endAt: d + mins(e.end) * 60e3 });
      }
    } else {
      const d = parseYmd(e.date);
      if (d >= from && d < to) out.push({ e, day: d, at: d + mins(e.start) * 60e3, endAt: d + mins(e.end) * 60e3 });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}
function upcoming(u, kind, days) {
  const now = Date.now();
  return occurrences(u, dayStart(now), dayStart(now) + (days + 1) * D6).filter(
    (o) => o.e.kind === kind && o.endAt >= now && !(o.e.kind === "deadline" && o.e.done),
  );
}

/* ----- Nhắc nhở: thông báo trong trang (và trên trình duyệt nếu cho phép) ----- */
const REMIND_RULES = {
  exam: [
    [2 * 3600e3, "2 giờ nữa thi"],
    [D6, "Ngày mai thi"],
    [3 * D6, "Còn 3 ngày nữa thi, bắt đầu ôn"],
    [7 * D6, "Còn 7 ngày nữa thi"],
  ],
  deadline: [
    [3 * 3600e3, "Còn 3 giờ tới hạn"],
    [D6, "Còn 1 ngày tới hạn"],
    [3 * D6, "Còn 3 ngày tới hạn"],
  ],
  study: [[30 * 60e3, "30 phút nữa tới giờ ôn"]],
  class: [[15 * 60e3, "15 phút nữa vào lớp"]],
};
function studyTick() {
  const u = me();
  if (!u || !S.study) return false;
  const st = ST();
  const pf = prefsOf(u);
  const now = Date.now();
  let changed = false;
  for (const o of occurrences(u, dayStart(now), dayStart(now) + 9 * D6)) {
    const e = o.e;
    if (!pf[e.kind] || o.at <= now || (e.kind === "deadline" && e.done)) continue;
    const rules = REMIND_RULES[e.kind] || [];
    const hit = rules.filter(([before]) => now >= o.at - before);
    if (!hit.length) continue;
    const key = (b) => `${e.id}|${o.day}|${b}`;
    if (st.sent[key(hit[0][0])]) continue;
    for (const [b] of hit) st.sent[key(b)] = now;
    const label = hit[0][1];
    const body = `${label}: ${e.title}${e.kind !== "deadline" ? `, ${hm(e.start)} ${fmtDay(o.day)}` : ""}${e.location ? `, ${e.location}` : ""}`;
    S.notifications.unshift({ id: uid(), to: u.email, type: "STUDY_REMINDER", title: body, link: e.kind === "exam" ? "#/lich#sap-thi" : "#/lich", t: now, read: false });
    if (pf.browser && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification("HUSTDOCU", { body, icon: "icons/icon-192.png", tag: key(hit[0][0]) });
      } catch {}
    }
    changed = true;
  }
  if (changed) save();
  return changed;
}
setInterval(() => {
  if (studyTick()) renderHeader();
}, 60e3);

/* ----- Gợi ý tài liệu theo lịch thi ----- */
const EXAM_DOC_ORDER = { EXAM_FINAL: 0, EXAM_MIDTERM: 1, SOLUTION: 2, NOTES: 3, SLIDE: 4, SYLLABUS: 5, TEXTBOOK: 6 };
function examDocs(code, k = 3) {
  return S.docs
    .filter((d) => d.course === code && d.status === "APPROVED")
    .sort((a, b) => (EXAM_DOC_ORDER[a.type] ?? 9) - (EXAM_DOC_ORDER[b.type] ?? 9) || avgRating(b) - avgRating(a))
    .slice(0, k);
}
/** Kế hoạch ôn theo lặp lại ngắt quãng: các buổi trước ngày thi 7, 4, 2, 1 ngày. */
function planReview(u, o) {
  const st = ST();
  let n = 0;
  for (const before of [7, 4, 2, 1]) {
    const day = o.day - before * D6;
    if (day < dayStart(Date.now())) continue;
    const date = ymd(day);
    if (st.events.some((e) => e.user === u.email && e.kind === "study" && e.course === o.e.course && e.date === date)) continue;
    st.events.push({ id: uid(), user: u.email, kind: "study", title: `Ôn ${course(o.e.course)?.name || o.e.course} (còn ${before} ngày)`, course: o.e.course, date, start: "20:00", end: "21:30", location: "" });
    n++;
  }
  save();
  return n;
}
function examPanel(u) {
  const exams = upcoming(u, "exam", 21);
  if (!exams.length) return "";
  return `<section class="stack" id="sap-thi" style="gap:8px"><h2 class="h2" style="margin:0">Sắp thi</h2>
  <div class="stack" style="gap:12px">${exams
    .map((o) => {
      const docs = examDocs(o.e.course);
      return `<div class="tb" style="grid-template-columns:minmax(0,1fr)"><div style="padding:10px 12px;display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div style="min-width:0"><span class="stamp" style="transform:none">${countdown(o.at)}</span><div class="head" style="font-size:17px;margin-top:6px">${esc(o.e.title)}</div><div class="small muted">${fmtDay(o.day)}, ${hm(o.e.start)}${o.e.location ? `, ${esc(o.e.location)}` : ""}</div></div>
      <div class="row" style="gap:6px"><a class="btn sm" href="#/on-tap?hp=${o.e.course}">Ôn trắc nghiệm</a><a class="btn sm" href="#/flashcard?hp=${o.e.course}">Flashcard</a><button class="btn ink sm" type="button" data-plan="${o.e.id}|${o.day}">Lập kế hoạch ôn</button></div></div>
      ${docs.length ? `<div style="padding:8px 12px"><span class="tiny muted">Tài liệu nên xem trước khi thi</span><ul style="margin:4px 0 0;padding-left:18px;font-size:14px">${docs.map((d) => `<li><a href="#/tai-lieu/${d.slug}">${esc(d.title)}</a> <span class="tiny muted">${TYPES[d.type]}${d.ratingCount ? `, ${rating(d)}` : ""}</span></li>`).join("")}</ul></div>` : `<div style="padding:8px 12px" class="small muted">Học phần này chưa có tài liệu. <a href="#/tai-len?hp=${o.e.course}">Đóng góp tài liệu</a></div>`}</div>`;
    })
    .join("")}</div></section>`;
}
function mountExamPanel(root, u) {
  root.querySelectorAll("[data-plan]").forEach((b) =>
    b.addEventListener("click", () => {
      const [id, day] = b.dataset.plan.split("|");
      const o = occurrences(u, +day, +day + D6).find((x) => x.e.id === id);
      if (!o) return;
      const n = planReview(u, o);
      toast(n ? `Đã thêm ${n} buổi ôn vào lịch (20:00 các ngày trước thi).` : "Kế hoạch ôn đã có trong lịch.");
      render();
    }),
  );
}

/* ----- Lưới tuần (dùng cho lịch và xếp lịch) ----- */
function weekGrid(blocks, { from = 6 * 60, to = 21 * 60, days = 7, h = 44, onclick = "data-ev" } = {}) {
  const hours = [];
  for (let m = from; m < to; m += 60) hours.push(m);
  const H = ((to - from) / 60) * h;
  return `<div class="wk" style="--rows:${hours.length};--days:${days}"><div class="wk-head"><span></span>${DOW_SHORT.slice(0, days).map((d, i) => `<span>${blocks.dayLabels ? blocks.dayLabels[i] : d}</span>`).join("")}</div>
  <div class="wk-body" style="height:${H}px"><div class="wk-hours">${hours.map((m) => `<span style="height:${h}px">${String(m / 60).padStart(2, "0")}:00</span>`).join("")}</div>
  ${Array.from({ length: days }, (_, day) => `<div class="wk-col">${blocks
    .filter((b) => b.day === day)
    .map((b) => {
      const top = ((Math.max(b.start, from) - from) / 60) * h;
      const height = Math.max(18, ((Math.min(b.end, to) - Math.max(b.start, from)) / 60) * h - 2);
      const k = KIND[b.kind] || KIND.class;
      return `<button type="button" class="wk-ev${b.conflict ? " conflict" : ""}" ${b.id ? `${onclick}="${b.id}"` : ""} style="top:${top}px;height:${height}px;background:${k.bg};color:${k.fg};border-color:${b.conflict ? "var(--stamp)" : k.bd}" title="${esc(b.title)}"><b>${esc(b.title)}</b>${b.sub ? `<span>${esc(b.sub)}</span>` : ""}</button>`;
    })
    .join("")}</div>`).join("")}</div></div>`;
}

/* ----- Nhập/xuất file lịch ----- */
function splitRow(line, sep) {
  if (sep === "\t") return line.split("\t").map((x) => x.trim());
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}
/** Bảng CSV/TSV (cả khi dán từ Excel). Trả về [{cột không dấu: giá trị}] */
function parseTable(text) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const sep = lines[0].includes("\t") ? "\t" : lines[0].split(";").length > lines[0].split(",").length ? ";" : ",";
  const head = splitRow(lines[0], sep).map((h) => norm(h).replace(/[^a-z0-9 ]/g, "").trim());
  return lines.slice(1).map((l) => {
    const cells = splitRow(l, sep);
    return Object.fromEntries(head.map((h, i) => [h, cells[i] ?? ""]));
  });
}
const col = (row, ...names) => {
  for (const n of names) for (const k of Object.keys(row)) if (k === n || k.startsWith(n)) return row[k];
  return "";
};
/** "0645-0910" hoặc "06:45 - 09:10" → [start, end] */
function parseRange(text) {
  const m = String(text).match(/(\d{1,2}):?(\d{2})\s*[-–]\s*(\d{1,2}):?(\d{2})/);
  return m ? [`${m[1].padStart(2, "0")}:${m[2]}`, `${m[3].padStart(2, "0")}:${m[4]}`] : null;
}
/** Thứ theo cách ghi của trường (2..7, CN/8) → 0..6 */
function parseThu(text) {
  const t = norm(String(text));
  if (/cn|chu nhat|^8$/.test(t)) return 6;
  const n = Number.parseInt(t.replace(/\D/g, ""), 10);
  return n >= 2 && n <= 7 ? n - 2 : null;
}
function parseDateVN(text) {
  const m = String(text).match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const iso = String(text).match(/(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : null;
}
function guessKind(title, weekly) {
  const t = norm(title);
  if (/\bthi\b|kiem tra/.test(t)) return "exam";
  if (/han|deadline|nop|bao cao/.test(t)) return "deadline";
  return weekly ? "class" : "study";
}
function icsDate(v) {
  const m = v.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
  if (!m) return null;
  let d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
  if (/Z$/.test(v)) d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)));
  return d;
}
/** Đọc file lịch: .ics, TKB (Thứ, Thời gian, Tuần, Phòng, Mã HP...), lịch thi (Ngày thi...), hoặc danh sách sự kiện. */
function importCalendar(u, text, sem = currentSemester()) {
  const events = [];
  const semInfo = SEMESTERS[sem];
  if (/BEGIN:VCALENDAR/.test(text)) {
    const unfolded = text.replace(/\r?\n[ \t]/g, "");
    for (const block of unfolded.split("BEGIN:VEVENT").slice(1)) {
      const get = (k) => (block.match(new RegExp(`^${k}(?:;[^:\\n]*)?:(.*)$`, "m")) || [])[1]?.trim() || "";
      const start = icsDate(get("DTSTART"));
      if (!start) continue;
      const end = icsDate(get("DTEND")) || new Date(start.getTime() + 3600e3);
      const title = get("SUMMARY").replace(/\\,/g, ",").replace(/\\n/g, " ") || "Sự kiện";
      const rrule = get("RRULE");
      const ev = { id: uid(), user: u.email, title, location: get("LOCATION").replace(/\\,/g, ","), start: `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`, end: `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}` };
      const code = (title.match(/\b[A-Z]{2,4}\d{4}[A-Z]?\b/) || [])[0];
      if (code) ev.course = code;
      if (/FREQ=WEEKLY/.test(rrule)) {
        const until = rrule.match(/UNTIL=(\d{8})/);
        const count = rrule.match(/COUNT=(\d+)/);
        const to = until ? `${until[1].slice(0, 4)}-${until[1].slice(4, 6)}-${until[1].slice(6, 8)}` : ymd(start.getTime() + ((count ? +count[1] : 16) - 1) * 7 * D6);
        ev.weekly = { day: (start.getDay() + 6) % 7, from: ymd(start.getTime()), to };
      } else ev.date = ymd(start.getTime());
      ev.kind = guessKind(title, !!ev.weekly);
      events.push(ev);
    }
    return events;
  }
  for (const r of parseTable(text)) {
    const code = (col(r, "ma hp", "ma hoc phan", "hoc phan") || "").toUpperCase().match(/[A-Z]{2,4}\d{4}[A-Z]?/)?.[0] || "";
    const name = col(r, "ten hp", "ten hoc phan", "mon", "tieu de", "title", "su kien") || course(code)?.name || code;
    const examDate = parseDateVN(col(r, "ngay thi"));
    if (examDate) {
      const range = parseRange(col(r, "gio thi", "thoi gian", "kip")) || ["07:00", "09:00"];
      events.push({ id: uid(), user: u.email, kind: "exam", title: `Thi ${name}`, course: code, date: examDate, start: range[0], end: range[1], location: col(r, "phong") });
      continue;
    }
    const day = parseThu(col(r, "thu"));
    const range = parseRange(col(r, "thoi gian", "gio"));
    if (day !== null && range) {
      const type = col(r, "loai lop", "loai");
      events.push({ id: uid(), user: u.email, kind: "class", title: `${name}${type ? ` (${type})` : ""}`, course: code, weekly: { day, from: semInfo.start, to: semInfo.end, weeks: col(r, "tuan") || "" }, start: range[0], end: range[1], location: col(r, "phong") });
      continue;
    }
    const date = parseDateVN(col(r, "ngay", "date"));
    if (date) {
      const rg = parseRange(col(r, "thoi gian", "gio")) || [hm(col(r, "bat dau") || "23:59"), hm(col(r, "ket thuc") || col(r, "bat dau") || "23:59")];
      const kindText = norm(col(r, "loai"));
      const kind = /thi/.test(kindText) ? "exam" : /han|nop/.test(kindText) ? "deadline" : /on/.test(kindText) ? "study" : guessKind(name, false);
      events.push({ id: uid(), user: u.email, kind, title: name, course: code, date, start: rg[0], end: rg[1], location: col(r, "phong", "dia diem") });
    }
  }
  return events;
}
function icsEscape(s) {
  return String(s || "").replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
}
function exportIcs(u) {
  const stamp = (date, time) => `${date.replace(/-/g, "")}T${hm(time).replace(":", "")}00`;
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//HUSTDOCU//Lich hoc//VI", "CALSCALE:GREGORIAN"];
  for (const e of ST().events.filter((x) => x.user === u.email)) {
    const date = e.weekly ? ymd(weekStart(parseYmd(e.weekly.from)) + e.weekly.day * D6 + (parseYmd(e.weekly.from) > weekStart(parseYmd(e.weekly.from)) + e.weekly.day * D6 ? 7 * D6 : 0)) : e.date;
    lines.push("BEGIN:VEVENT", `UID:${e.id}@hustdocu`, `DTSTAMP:${stamp(ymd(Date.now()), "00:00")}`, `DTSTART;TZID=Asia/Ho_Chi_Minh:${stamp(date, e.start)}`, `DTEND;TZID=Asia/Ho_Chi_Minh:${stamp(date, e.end)}`, `SUMMARY:${icsEscape(`[${KIND[e.kind].label}] ${e.title}`)}`);
    if (e.location) lines.push(`LOCATION:${icsEscape(e.location)}`);
    if (e.weekly) lines.push(`RRULE:FREQ=WEEKLY;UNTIL=${e.weekly.to.replace(/-/g, "")}T235959`);
    if (e.kind === "exam" || e.kind === "deadline") lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsEscape(e.title)}`, "TRIGGER:-P1D", "END:VALARM");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  downloadText(`lich-hoc-${u.username}.ics`, lines.join("\r\n"), "text/calendar");
}
function downloadText(name, text, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const SAMPLE_TKB = `Thứ,Thời gian,Tuần học,Phòng,Mã lớp,Loại lớp,Mã HP,Tên HP
2,0645-0910,"1-8,10-17",D9-401,150321,LT,IT3011,Cấu trúc dữ liệu và giải thuật
5,1505-1730,"2-8,10-17",D9-203,150322,BT,IT3011,Cấu trúc dữ liệu và giải thuật
3,0920-1145,"1-8,10-17",TC-205,150410,LT+BT,IT3080,Mạng máy tính
`;
const SAMPLE_EXAMS = `Ngày thi,Giờ thi,Mã HP,Tên HP,Phòng
${ymd(Date.now() + 40 * D6).split("-").reverse().join("/")},07:00-09:00,IT3011,Cấu trúc dữ liệu và giải thuật,D9-101
${ymd(Date.now() + 43 * D6).split("-").reverse().join("/")},09:30-11:30,IT3080,Mạng máy tính,TC-201
`;

/* ----- Thanh chuyển giữa các trang học tập ----- */
function studyTabs(active) {
  const tabs = [
    ["hub", "#/hoc-tap", "Tổng quan"],
    ["lich", "#/lich", "Lịch"],
    ["xep", "#/xep-lich", "Xếp lịch"],
    ["ctdt", "#/ctdt", "CTĐT"],
    ["ontap", "#/on-tap", "Ôn tập"],
    ["fc", "#/flashcard", "Flashcard"],
    ["chung", "#/hoc-chung", "Học chung"],
  ];
  return `<nav class="tabs study-tabs" aria-label="Học tập">${tabs.map(([k, h, l]) => `<a href="${h}"${k === active ? ' aria-current="page"' : ""}>${l}</a>`).join("")}</nav>`;
}
function studyHead(title, active, extra = "") {
  return `<section class="page-head gridpaper"><div class="wrap stack" style="gap:12px">${studyTabs(active)}<h1>${title}</h1>${extra}</div></section>`;
}

/* ----- Trang Lịch ----- */
views["/lich"] = () => {
  const u = me();
  if (!u) return needLogin("/lich");
  const st = ST();
  studyTick();
  const off = Number(params().get("tuan") || 0);
  const ws = weekStart(Date.now()) + off * 7 * D6;
  const occ = occurrences(u, ws, ws + 7 * D6);
  const blocks = occ.map((o) => ({
    day: (new Date(o.day).getDay() + 6) % 7,
    start: mins(o.e.start),
    end: o.e.kind === "deadline" ? mins(o.e.end) + 30 : mins(o.e.end),
    title: o.e.kind === "deadline" ? `Hạn: ${o.e.title}` : o.e.title,
    sub: `${o.e.kind === "deadline" ? hm(o.e.end) : `${hm(o.e.start)}-${hm(o.e.end)}`}${o.e.location ? ` ${o.e.location}` : ""}`,
    kind: o.e.kind,
    id: o.e.id,
  }));
  blocks.dayLabels = DOW_SHORT.map((d, i) => `${d} ${new Date(ws + i * D6).getDate()}/${new Date(ws + i * D6).getMonth() + 1}`);
  const sem = currentSemester();
  const wk = semWeek(ws, SEMESTERS[sem].start);
  const deadlines = upcoming(u, "deadline", 14);
  const pf = prefsOf(u);
  const courseOpts = S.courses.map((c) => `<option value="${c.code}">${esc(c.name)}</option>`).join("");
  const html =
    studyHead("Lịch học và lịch thi", "lich", `<p class="small muted" style="margin:0">${SEMESTERS[sem].name}${wk >= 1 && wk <= 20 ? `, tuần ${wk}` : ""}. Nhắc lịch thi và hạn nộp hiện trong mục Thông báo${pf.browser ? " và trên trình duyệt" : ""}.</p>`) +
    `<div class="wrap stack" style="padding-block:20px;gap:24px">
    ${examPanel(u)}
    ${deadlines.length ? `<section class="stack" style="gap:8px"><h2 class="h2" style="margin:0">Hạn nộp sắp tới</h2><ul class="tb" style="list-style:none;margin:0;padding:0">${deadlines.map((o) => `<li style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 12px;flex-wrap:wrap"><span style="min-width:0"><b style="font-weight:600">${esc(o.e.title)}</b><span class="tiny muted" style="display:block">${fmtDay(o.day)} ${hm(o.e.end)}, ${countdown(o.at)}</span></span><button class="btn sm" type="button" data-done="${o.e.id}">Đã xong</button></li>`).join("")}</ul></section>` : ""}
    <section class="stack" style="gap:8px"><div class="row" style="justify-content:space-between;align-items:center"><h2 class="h2" style="margin:0">Tuần ${fmtDay(ws).split(", ")[1]} - ${fmtDay(ws + 6 * D6).split(", ")[1]}</h2><div class="row" style="gap:6px"><a class="btn sm" href="#/lich?tuan=${off - 1}" aria-label="Tuần trước">‹</a><a class="btn sm" href="#/lich">Tuần này</a><a class="btn sm" href="#/lich?tuan=${off + 1}" aria-label="Tuần sau">›</a></div></div>
     <div class="wk-desktop">${weekGrid(blocks)}</div>
     <div class="wk-agenda">${Array.from({ length: 7 }, (_, i) => {
       const list = occ.filter((o) => dayStart(o.day) === ws + i * D6);
       return `<div class="tb" style="grid-template-columns:72px minmax(0,1fr);margin-bottom:-2px"><div style="padding:8px;background:${ws + i * D6 === dayStart(Date.now()) ? "var(--fill);color:var(--on-fill)" : "var(--sheet)"}"><b class="head">${DOW_SHORT[i]}</b><div class="tiny">${new Date(ws + i * D6).getDate()}/${new Date(ws + i * D6).getMonth() + 1}</div></div><div style="padding:6px 10px;display:flex;flex-direction:column;gap:4px">${list.length ? list.map((o) => `<button type="button" class="agenda-ev" data-ev="${o.e.id}" style="border-left:4px solid ${KIND[o.e.kind].bd}"><b>${o.e.kind === "deadline" ? `Hạn ${hm(o.e.end)}` : `${hm(o.e.start)}-${hm(o.e.end)}`}</b> ${esc(o.e.title)}${o.e.location ? ` <span class="muted">${esc(o.e.location)}</span>` : ""}</button>`).join("") : '<span class="tiny muted">Trống</span>'}</div></div>`;
     }).join("")}</div>
     <div class="row" style="gap:12px">${Object.entries(KIND).map(([k, v]) => `<span class="tiny"><span style="display:inline-block;width:12px;height:12px;border:2px solid ${v.bd};background:${v.bg};vertical-align:-2px"></span> ${v.label}</span>`).join("")}</div>
     <div data-evdetail></div></section>
    <div class="two" style="gap:16px">
     <form class="stack" data-form="ev" style="border:2px solid var(--line);background:var(--sheet);padding:16px;gap:10px"><h2 class="h2" style="margin:0">Thêm vào lịch</h2>
      <div style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
       <div class="field"><label for="ev-k">Loại</label><select class="select" id="ev-k" name="kind"><option value="class">Lớp học</option><option value="exam">Lịch thi</option><option value="deadline">Hạn nộp</option><option value="study">Ôn tập</option></select></div>
       <div class="field"><label for="ev-c">Học phần</label><select class="select" id="ev-c" name="course"><option value="">Không gắn học phần</option>${courseOpts}</select></div>
       <div class="field" style="grid-column:1/-1"><label for="ev-t">Tiêu đề</label><input class="input" id="ev-t" name="title" placeholder="Ví dụ: Thi cuối kỳ Giải tích I"></div>
       <div class="field"><label for="ev-d">Ngày</label><input class="input" id="ev-d" name="date" type="date" value="${ymd(Date.now())}"></div>
       <div class="field"><label for="ev-s">Bắt đầu</label><input class="input" id="ev-s" name="start" type="time" value="07:00"></div>
       <div class="field"><label for="ev-e">Kết thúc</label><input class="input" id="ev-e" name="end" type="time" value="09:00"></div>
       <div class="field"><label for="ev-l">Phòng, địa điểm</label><input class="input" id="ev-l" name="location"></div>
      </div>
      <label class="check"><input type="checkbox" name="weekly"><span>Lặp lại hằng tuần tới hết ${SEMESTERS[sem].name.split(" (")[0].toLowerCase()} (${fmtDate(parseYmd(SEMESTERS[sem].end))})</span></label>
      <p class="err" data-err role="alert" hidden></p><div><button class="btn primary" type="submit">Thêm</button></div></form>
     <div class="stack" style="gap:16px">
      <section class="stack" style="border:2px solid var(--line);background:var(--sheet);padding:16px;gap:10px"><h2 class="h2" style="margin:0">Nhập, xuất file</h2>
       <p class="small" style="margin:0">Nhận file <b>.ics</b> (Google Calendar, Outlook), file thời khóa biểu hoặc lịch thi dạng <b>CSV</b>, hoặc dán thẳng bảng từ Excel. Cột nhận ra: Thứ, Thời gian, Tuần học, Phòng, Mã HP, Tên HP; lịch thi cần cột Ngày thi.</p>
       <div class="row" style="gap:6px"><label class="btn sm" for="cal-file" style="cursor:pointer">Chọn file</label><input class="sr" type="file" id="cal-file" accept=".ics,.csv,.tsv,.txt"><button class="btn sm" type="button" data-sample="tkb">File TKB mẫu</button><button class="btn sm" type="button" data-sample="thi">File lịch thi mẫu</button><button class="btn ink sm" type="button" data-export>Xuất .ics</button></div>
       <div class="field"><label for="cal-paste">Hoặc dán nội dung</label><textarea class="textarea" id="cal-paste" style="min-height:72px" placeholder="Dán bảng thời khóa biểu từ Excel hoặc nội dung file .ics"></textarea></div><div><button class="btn sm" type="button" data-import>Nhập</button></div></section>
      <section class="stack" style="border:2px solid var(--line);background:var(--sheet);padding:16px;gap:6px"><h2 class="h2" style="margin:0">Nhắc nhở</h2>
       ${[["exam", "Lịch thi: trước 7 ngày, 3 ngày, 1 ngày, 2 giờ"], ["deadline", "Hạn nộp: trước 3 ngày, 1 ngày, 3 giờ"], ["study", "Buổi ôn: trước 30 phút"], ["class", "Lớp học: trước 15 phút"]].map(([k, l]) => `<label class="check"><input type="checkbox" data-pref="${k}"${pf[k] ? " checked" : ""}><span>${l}</span></label>`).join("")}
       <label class="check"><input type="checkbox" data-pref="browser"${pf.browser ? " checked" : ""}><span>Hiện thông báo của trình duyệt (khi trang đang mở)</span></label></section>
     </div></div></div>`;
  return {
    html,
    mount(root) {
      mountExamPanel(root, u);
      root.querySelectorAll("[data-done]").forEach((b) =>
        b.addEventListener("click", () => {
          const e = st.events.find((x) => x.id === b.dataset.done);
          if (e) e.done = true;
          save();
          toast("Đã đánh dấu xong.");
          render();
        }),
      );
      const detail = root.querySelector("[data-evdetail]");
      root.querySelectorAll("[data-ev]").forEach((b) =>
        b.addEventListener("click", () => {
          const e = st.events.find((x) => x.id === b.dataset.ev);
          if (!e) return;
          const docs = e.course ? examDocs(e.course, 3) : [];
          detail.innerHTML = `<div class="tb" style="grid-template-columns:minmax(0,1fr)"><div style="padding:10px 12px" class="stack"><b class="head">${esc(e.title)}</b><span class="small">${KIND[e.kind].label}, ${e.weekly ? `${DOW[e.weekly.day]} hằng tuần${e.weekly.weeks ? ` (tuần ${esc(e.weekly.weeks)})` : ""}` : fmtDay(parseYmd(e.date))}, ${hm(e.start)}-${hm(e.end)}${e.location ? `, ${esc(e.location)}` : ""}</span>${e.course ? `<span class="small">Học phần <a href="#/hoc-phan/${e.course}">${e.course} ${esc(course(e.course)?.name || "")}</a>${docs.length ? `: ${docs.map((d) => `<a href="#/tai-lieu/${d.slug}">${esc(d.title)}</a>`).join(", ")}` : ""}</span>` : ""}<div class="row" style="gap:6px"><button class="btn sm" type="button" data-del="${e.id}">Xóa khỏi lịch</button>${e.kind === "deadline" && !e.done ? `<button class="btn sm" type="button" data-done2="${e.id}">Đã xong</button>` : ""}</div></div></div>`;
          detail.querySelector("[data-del]").addEventListener("click", () => {
            st.events = st.events.filter((x) => x.id !== e.id);
            save();
            toast("Đã xóa.");
            render();
          });
          detail.querySelector("[data-done2]")?.addEventListener("click", () => {
            e.done = true;
            save();
            render();
          });
          detail.scrollIntoView({ block: "nearest" });
        }),
      );
      const form = root.querySelector('[data-form="ev"]');
      form.addEventListener("submit", (ev) => {
        ev.preventDefault();
        const f = new FormData(form);
        const err = form.querySelector("[data-err]");
        const code = String(f.get("course"));
        const kind = String(f.get("kind"));
        const title = String(f.get("title")).trim() || (code ? `${KIND[kind].label} ${course(code)?.name || code}` : "");
        if (!title) {
          err.textContent = tr("Nhập tiêu đề hoặc chọn học phần.");
          err.hidden = false;
          return;
        }
        const date = String(f.get("date"));
        let start = String(f.get("start"));
        const end = String(f.get("end")) || start;
        if (kind === "deadline") start = end;
        if (mins(end) < mins(start)) {
          err.textContent = tr("Giờ kết thúc phải sau giờ bắt đầu.");
          err.hidden = false;
          return;
        }
        const e = { id: uid(), user: u.email, kind, title, course: code, start, end, location: String(f.get("location")).trim() };
        if (f.get("weekly")) e.weekly = { day: (new Date(parseYmd(date)).getDay() + 6) % 7, from: date, to: SEMESTERS[sem].end };
        else e.date = date;
        st.events.push(e);
        save();
        toast("Đã thêm vào lịch.");
        go(`#/lich?tuan=${Math.round((weekStart(parseYmd(date)) - weekStart(Date.now())) / (7 * D6))}`);
      });
      const doImport = (text, name) => {
        const list = importCalendar(u, text, sem);
        if (!list.length) return toast("Không đọc được sự kiện nào trong nội dung này.");
        st.events.push(...list);
        save();
        toast(`Đã nhập ${list.length} sự kiện${name ? ` từ ${name}` : ""}.`);
        render();
      };
      root.querySelector("#cal-file").addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (file) doImport(await file.text(), file.name);
      });
      root.querySelector("[data-import]").addEventListener("click", () => doImport(root.querySelector("#cal-paste").value));
      root.querySelector("[data-export]").addEventListener("click", () => exportIcs(u));
      root.querySelectorAll("[data-sample]").forEach((b) => b.addEventListener("click", () => (b.dataset.sample === "tkb" ? downloadText("tkb-mau.csv", `﻿${SAMPLE_TKB}`, "text/csv") : downloadText("lich-thi-mau.csv", `﻿${SAMPLE_EXAMS}`, "text/csv"))));
      root.querySelectorAll("[data-pref]").forEach((c) =>
        c.addEventListener("change", async () => {
          const k = c.dataset.pref;
          if (k === "browser" && c.checked && "Notification" in window && Notification.permission !== "granted") {
            const r = await Notification.requestPermission().catch(() => "denied");
            if (r !== "granted") {
              c.checked = false;
              return toast("Trình duyệt chưa cho phép hiện thông báo.");
            }
          }
          pf[k] = c.checked;
          save();
          toast("Đã lưu cài đặt nhắc nhở.");
        }),
      );
    },
  };
};

/* ===================== Dữ liệu ôn tập ===================== */
/** Ngân hàng câu hỏi theo học phần: [chủ đề, câu hỏi, [đáp án đúng, sai, sai, sai], giải thích] */
const QB_RAW = {
  IT3011: [
    ["Độ phức tạp", "Tìm kiếm nhị phân trên mảng đã sắp xếp n phần tử có độ phức tạp thời gian là?", ["O(log n)", "O(n)", "O(n log n)", "O(1)"], "Mỗi bước loại bỏ một nửa số phần tử còn lại."],
    ["Ngăn xếp, hàng đợi", "Cấu trúc dữ liệu nào hoạt động theo nguyên tắc vào sau ra trước (LIFO)?", ["Ngăn xếp", "Hàng đợi", "Hàng đợi ưu tiên", "Danh sách liên kết đôi"], "Phần tử đẩy vào cuối cùng được lấy ra đầu tiên."],
    ["Cây", "Duyệt cây nhị phân tìm kiếm theo thứ tự giữa (inorder) cho dãy khóa như thế nào?", ["Tăng dần", "Giảm dần", "Theo từng mức", "Không theo thứ tự nào"], "Trái, gốc, phải: khóa bên trái nhỏ hơn gốc, bên phải lớn hơn."],
    ["Cây", "Chiều cao của cây AVL có n nút là?", ["O(log n)", "O(n)", "O(√n)", "O(1)"], "Cây AVL luôn cân bằng nên chiều cao tăng theo logarit."],
    ["Sắp xếp", "Thuật toán nào có độ phức tạp trường hợp xấu nhất là O(n log n)?", ["Sắp xếp vun đống (heap sort)", "Sắp xếp nhanh (quick sort)", "Sắp xếp chèn", "Sắp xếp nổi bọt"], "Quick sort xấu nhất là O(n²); heap sort luôn O(n log n)."],
    ["Sắp xếp", "Thuật toán sắp xếp nào ổn định (giữ thứ tự các phần tử bằng nhau)?", ["Sắp xếp trộn (merge sort)", "Sắp xếp vun đống", "Sắp xếp nhanh bản thông thường", "Sắp xếp chọn"], "Merge sort giữ thứ tự khi trộn nếu ưu tiên lấy phần tử bên trái."],
    ["Đồ thị", "Duyệt đồ thị theo chiều rộng (BFS) dùng cấu trúc phụ nào?", ["Hàng đợi", "Ngăn xếp", "Cây đỏ đen", "Bảng băm"], "Đỉnh phát hiện trước được xét trước."],
    ["Đồ thị", "Thuật toán Dijkstra có thể cho kết quả sai khi đồ thị có đặc điểm gì?", ["Có cạnh trọng số âm", "Là đồ thị vô hướng", "Là đồ thị thưa", "Có chu trình"], "Dijkstra giả định khoảng cách đã chốt không giảm được nữa."],
    ["Băm", "Với hàm băm tốt và hệ số tải hợp lý, thời gian tìm kiếm trung bình trong bảng băm là?", ["O(1)", "O(log n)", "O(n)", "O(n log n)"], "Mỗi khóa được ánh xạ thẳng tới một ô, va chạm ít."],
    ["Đồ thị", "Đồ thị vô hướng liên thông n đỉnh có ít nhất bao nhiêu cạnh?", ["n − 1", "n", "n(n − 1)/2", "2n"], "Cây khung là đồ thị liên thông có ít cạnh nhất, gồm n − 1 cạnh."],
  ],
  MI1111: [
    ["Giới hạn", "lim (x→0) sin x / x bằng?", ["1", "0", "∞", "Không tồn tại"], "Giới hạn cơ bản, chứng minh bằng định lý kẹp."],
    ["Giới hạn", "lim (x→∞) (1 + 1/x)^x bằng?", ["e", "1", "∞", "0"], "Đây là một định nghĩa của số e."],
    ["Đạo hàm", "Đạo hàm của ln x (x > 0) là?", ["1/x", "x ln x − x", "eˣ", "ln x / x"], "(ln x)′ = 1/x."],
    ["Đạo hàm", "Đạo hàm của arctan x là?", ["1/(1 + x²)", "1/√(1 − x²)", "−1/(1 + x²)", "1/(1 − x²)"], "1/√(1 − x²) là đạo hàm của arcsin x."],
    ["Tích phân", "∫ từ 0 đến 1 của x² dx bằng?", ["1/3", "1/2", "1", "2/3"], "Nguyên hàm x³/3, thay cận được 1/3."],
    ["Tích phân", "Tích phân suy rộng ∫ từ 1 đến ∞ của 1/xᵖ dx hội tụ khi nào?", ["p > 1", "p ≥ 1", "p < 1", "p > 0"], "Với p = 1 nguyên hàm là ln x, tiến ra vô cùng."],
    ["Đạo hàm", "Định lý Lagrange: f liên tục trên [a, b], khả vi trên (a, b) thì tồn tại c ∈ (a, b) sao cho?", ["f(b) − f(a) = f′(c)(b − a)", "f′(c) = 0", "f(c) = (f(a) + f(b))/2", "f(b) + f(a) = f′(c)(b + a)"], "f′(c) = 0 là định lý Rolle, trường hợp riêng khi f(a) = f(b)."],
    ["Khai triển", "Khai triển Maclaurin của eˣ đến bậc 2 là?", ["1 + x + x²/2", "1 + x + x²", "1 − x + x²/2", "x + x²/2"], "eˣ = Σ xⁿ/n!."],
  ],
  IT3080: [
    ["Mô hình phân tầng", "Mô hình OSI có bao nhiêu tầng?", ["7", "4", "5", "6"], "Vật lý, liên kết dữ liệu, mạng, giao vận, phiên, trình diễn, ứng dụng."],
    ["Tầng giao vận", "TCP thuộc tầng nào trong mô hình OSI?", ["Giao vận", "Mạng", "Liên kết dữ liệu", "Phiên"], "TCP và UDP là giao thức tầng giao vận."],
    ["Tầng giao vận", "Giao thức tầng giao vận nào gửi dữ liệu mà không cần thiết lập kết nối?", ["UDP", "TCP", "ARP", "ICMP"], "ARP và ICMP không phải giao thức tầng giao vận."],
    ["Địa chỉ IP", "Địa chỉ IPv4 dài bao nhiêu bit?", ["32", "16", "64", "128"], "IPv6 dài 128 bit."],
    ["Địa chỉ IP", "Mạng /24 có bao nhiêu địa chỉ host dùng được?", ["254", "256", "255", "252"], "2⁸ = 256, trừ địa chỉ mạng và địa chỉ quảng bá."],
    ["Tầng ứng dụng", "DNS dùng để làm gì?", ["Phân giải tên miền thành địa chỉ IP", "Cấp phát địa chỉ IP động", "Định tuyến gói tin", "Mã hóa dữ liệu"], "Cấp phát IP động là việc của DHCP."],
    ["Tầng ứng dụng", "Giao thức nào cấp phát địa chỉ IP tự động cho máy trong mạng?", ["DHCP", "DNS", "ARP", "NAT"], "DHCP: Dynamic Host Configuration Protocol."],
    ["Tầng giao vận", "Bắt tay ba bước của TCP gồm các gói nào?", ["SYN, SYN-ACK, ACK", "SYN, ACK, FIN", "HELLO, ACK, DATA", "SYN, FIN, ACK"], "FIN dùng khi đóng kết nối."],
    ["Liên kết dữ liệu", "ARP dùng để ánh xạ gì?", ["Địa chỉ IP sang địa chỉ MAC", "Địa chỉ MAC sang IP", "Tên miền sang IP", "Cổng sang tiến trình"], "Address Resolution Protocol."],
  ],
  IT3090: [
    ["Mô hình quan hệ", "Khóa chính của một bảng phải thỏa mãn điều gì?", ["Duy nhất và không NULL", "Chỉ cần duy nhất", "Chỉ cần không NULL", "Phải là số nguyên tự tăng"], "Khóa chính định danh mỗi bộ."],
    ["SQL", "Mệnh đề nào lọc các nhóm sau GROUP BY?", ["HAVING", "WHERE", "ORDER BY", "DISTINCT"], "WHERE lọc từng dòng trước khi nhóm."],
    ["Chuẩn hóa", "Dạng chuẩn 3 (3NF) loại bỏ loại phụ thuộc nào vào khóa?", ["Phụ thuộc bắc cầu", "Phụ thuộc bộ phận", "Nhóm lặp", "Phụ thuộc đa trị"], "2NF loại phụ thuộc bộ phận, 1NF loại nhóm lặp, 4NF xử lý phụ thuộc đa trị."],
    ["Giao dịch", "Chữ A trong ACID là gì?", ["Atomicity (tính nguyên tố)", "Availability (tính sẵn sàng)", "Accuracy (tính chính xác)", "Authorization (phân quyền)"], "Giao dịch thực hiện trọn vẹn hoặc không thực hiện gì."],
    ["SQL", "Phép kết nối nào giữ lại mọi bộ của bảng bên trái?", ["LEFT OUTER JOIN", "INNER JOIN", "CROSS JOIN", "RIGHT OUTER JOIN"], "Bộ không khớp nhận NULL ở các cột của bảng bên phải."],
    ["Chuẩn hóa", "Theo hệ tiên đề Armstrong, nếu X → Y và Y → Z thì?", ["X → Z", "Z → X", "Y → X", "Z → Y"], "Đây là luật bắc cầu."],
  ],
  PH1110: [
    ["Động lực học", "Định luật II Newton được viết là?", ["F = m·a", "F = m·v", "F = m·g·h", "F = p/v"], "Gia tốc tỉ lệ với hợp lực, tỉ lệ nghịch với khối lượng."],
    ["Công, năng lượng", "Đơn vị của công trong hệ SI là?", ["Jun (J)", "Oát (W)", "Niutơn (N)", "Pascal (Pa)"], "1 J = 1 N·m; oát là đơn vị công suất."],
    ["Công, năng lượng", "Động năng của vật khối lượng m, vận tốc v là?", ["mv²/2", "mv", "mgh", "mv²"], "mv là động lượng."],
    ["Chuyển động quay", "Momen động lượng của hệ được bảo toàn khi nào?", ["Tổng momen ngoại lực bằng 0", "Tổng ngoại lực bằng 0", "Hệ không có ma sát", "Hệ quay đều"], "dL/dt bằng tổng momen ngoại lực."],
    ["Dao động", "Chu kỳ dao động nhỏ của con lắc đơn chiều dài l là?", ["2π√(l/g)", "2π√(g/l)", "π√(l/g)", "2π·l/g"], "Không phụ thuộc khối lượng vật nặng."],
    ["Nhiệt động lực học", "Hiệu suất của chu trình Carnot giữa nguồn nóng T₁ và nguồn lạnh T₂ là?", ["1 − T₂/T₁", "1 − T₁/T₂", "T₂/T₁", "(T₁ + T₂)/T₁"], "Nhiệt độ tính theo kelvin."],
  ],
  MI1141: [
    ["Định thức", "Với hai ma trận vuông cùng cấp, det(AB) bằng?", ["det A · det B", "det A + det B", "det A − det B", "det(A + B)"], "Định thức có tính nhân."],
    ["Ma trận", "Ma trận vuông A khả nghịch khi và chỉ khi?", ["det A ≠ 0", "det A = 0", "A đối xứng", "A có ít nhất một phần tử khác 0"], "A⁻¹ = adj(A)/det A."],
    ["Ma trận", "Hạng của ma trận đơn vị cấp n là?", ["n", "1", "0", "n − 1"], "Các cột độc lập tuyến tính."],
    ["Không gian vector", "Không gian các đa thức bậc không quá n có số chiều là?", ["n + 1", "n", "n − 1", "2n"], "Cơ sở 1, x, x², …, xⁿ."],
    ["Trị riêng", "λ là trị riêng của ma trận A khi?", ["det(A − λI) = 0", "det(A − λI) ≠ 0", "A = λI", "tr A = λ"], "Phương trình đặc trưng."],
    ["Hệ phương trình", "Hệ thuần nhất Ax = 0 (A vuông) có nghiệm không tầm thường khi?", ["det A = 0", "det A ≠ 0", "A khả nghịch", "A là ma trận đơn vị"], "Khi det A ≠ 0 hệ chỉ có nghiệm x = 0."],
  ],
};
/** Câu hỏi có đáp án đúng ở vị trí 0; khi hiển thị thì xáo trộn. */
const QBANK = Object.entries(QB_RAW).flatMap(([c, list]) =>
  list.map(([topic, q, opts, ex], i) => ({ id: `${c}-${i + 1}`, c, topic, q, opts, ex })),
);
function shuffleSeeded(arr, seed) {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ===================== Chương trình đào tạo (minh họa) ===================== */
const PROGRAMS = {
  IT1: {
    name: "Khoa học Máy tính",
    faculty: "SOICT",
    versions: [
      {
        id: "K70",
        label: "Khóa K70 trở đi (áp dụng từ 2025)",
        updated: "2025-08-15",
        terms: [
          ["MI1111", "MI1141", "IT1110", "FL1100", "SSH1111"],
          ["MI1121", "PH1110", "IT3020", "FL1101", "SSH1121"],
          ["MI1131", "PH1120", "IT3011", "IT3040", "SSH1131"],
          ["MI2020", "IT3030", "IT3100", "IT3090", "IT3160"],
          ["IT3070", "IT3080", "SSH1141", "SSH1151", "EM1180"],
          ["IT4409", "SSH1170", "EM1010"],
        ],
      },
      {
        id: "K68",
        label: "Khóa K68, K69 (áp dụng từ 2023)",
        updated: "2023-08-10",
        terms: [
          ["MI1111", "MI1141", "IT1110", "FL1100", "SSH1111"],
          ["MI1121", "PH1110", "IT3020", "FL1101", "SSH1121"],
          ["MI1131", "PH1120", "IT3011", "IT3040", "SSH1131"],
          ["MI2020", "IT3030", "IT3100", "IT3090", "SSH1141"],
          ["IT3070", "IT3080", "IT3160", "SSH1151", "EM1180"],
          ["IT4409", "SSH1170", "EM3100"],
        ],
      },
    ],
  },
};
function programOf(u) {
  const st = ST();
  st.program[u.email] = st.program[u.email] || { prog: "IT1", version: null, done: [] };
  const p = st.program[u.email];
  const prog = PROGRAMS[p.prog] || PROGRAMS.IT1;
  const version = prog.versions.find((v) => v.id === p.version) || (u.cohort && u.cohort < 70 ? prog.versions.find((v) => v.id === "K68") : prog.versions[0]);
  return { p, prog, version };
}
/** Các học phần nên học kỳ tới: chưa học, thuộc kỳ sớm nhất còn dở, tối đa khoảng 18 tín chỉ. */
function nextTermCourses(u) {
  const { p, version } = programOf(u);
  const left = version.terms.flat().filter((c) => !p.done.includes(c));
  const out = [];
  let credits = 0;
  for (const c of left) {
    const cr = course(c)?.credits || 3;
    if (credits + cr > 18) continue;
    out.push(c);
    credits += cr;
  }
  return out;
}

/* ===================== Hành vi xem, tải (cho gợi ý) ===================== */
function seedActivity() {
  const out = [];
  const now = Date.now();
  const approved = S.docs.filter((d) => d.status === "APPROVED");
  const byCourse = (codes) => approved.filter((d) => codes.includes(d.course));
  out.push(
    ...byCourse(["IT3011", "IT3080"]).slice(0, 5).map((d, i) => ({ user: "sv.demo@sis.hust.edu.vn", doc: d.id, kind: i % 2 ? "download" : "view", t: now - (i + 1) * 2 * D6 })),
  );
  // Người khác: mỗi người quan tâm một cụm học phần, tạo dữ liệu "người tải X cũng tải Y"
  const clusters = [["IT3011", "IT3020", "IT3040"], ["IT3080", "IT3070", "IT3090"], ["MI1111", "MI1121", "MI1141"], ["PH1110", "PH1120", "EE2020"]];
  S.users.filter((x) => x.email !== "sv.demo@sis.hust.edu.vn").forEach((x, i) => {
    const docs = byCourse(clusters[i % clusters.length]);
    docs.slice(0, 6).forEach((d, j) => out.push({ user: x.email, doc: d.id, kind: "download", t: now - (j + 3) * D6 }));
  });
  return out;
}
function logAct(u, d, kind) {
  if (!u || !d || !S.study) return;
  const list = ST().activity;
  list.push({ user: u.email, doc: d.id, kind, t: Date.now() });
  if (list.length > 3000) list.splice(0, list.length - 3000);
}

/* ===================== Gợi ý tài liệu ===================== */
/**
 * Điểm mỗi tài liệu = học phần đang theo dõi + sắp thi + đúng CTĐT kỳ tới + mức quan tâm của bạn với học phần
 * (xem, tải gần đây, giảm dần theo thời gian) + "người tải tài liệu bạn tải cũng tải" + độ phổ biến.
 * Lý do hiển thị là thành phần đóng góp nhiều nhất.
 */
function recommend(u, k = 8) {
  const now = Date.now();
  const acts = ST().activity;
  const mine = acts.filter((a) => a.user === u.email);
  const seen = new Map();
  const courseAff = {};
  for (const a of mine) {
    const d = S.docs.find((x) => x.id === a.doc);
    if (!d) continue;
    const w = (a.kind === "download" ? 2 : 1) * Math.exp(-(now - a.t) / (14 * D6));
    courseAff[d.course] = (courseAff[d.course] || 0) + w;
    seen.set(d.id, Math.max(seen.get(d.id) || 0, a.t));
  }
  const maxAff = Math.max(1, ...Object.values(courseAff));
  // Đồng xuất hiện: người khác đã tải chung ít nhất một tài liệu với bạn
  const myDocs = new Set(mine.map((a) => a.doc));
  const co = {};
  const byUser = {};
  for (const a of acts) if (a.user !== u.email && a.kind === "download") (byUser[a.user] = byUser[a.user] || new Set()).add(a.doc);
  for (const set of Object.values(byUser)) {
    if (![...set].some((d) => myDocs.has(d))) continue;
    for (const d of set) if (!myDocs.has(d)) co[d] = (co[d] || 0) + 1;
  }
  const follows = S.follows[u.email] || [];
  const exams = upcoming(u, "exam", 21);
  const examIn = {};
  for (const o of exams) examIn[o.e.course] = Math.min(examIn[o.e.course] ?? 99, daysUntil(o.at));
  const nextTerm = new Set(nextTermCourses(u));
  const fac = u.faculty;
  const scored = [];
  for (const d of S.docs) {
    if (d.status !== "APPROVED" || d.uploader === u.email) continue;
    const parts = [];
    if (follows.includes(d.course)) parts.push([3, `Bạn theo dõi ${d.course}`]);
    if (examIn[d.course] !== undefined) parts.push([5 * (1 - examIn[d.course] / 22) + (d.type.startsWith("EXAM") ? 1.5 : 0), `Sắp thi ${d.course}, còn ${Math.max(0, examIn[d.course])} ngày`]);
    if (nextTerm.has(d.course)) parts.push([1.5, `Trong CTĐT kỳ tới của bạn`]);
    else if (fac && course(d.course)?.faculty === fac) parts.push([0.6, "Đúng Viện của bạn"]);
    if (courseAff[d.course]) parts.push([3 * (courseAff[d.course] / maxAff), `Vì bạn hay xem ${d.course}`]);
    if (co[d.id]) parts.push([Math.min(3, co[d.id]), "Người tải tài liệu giống bạn cũng tải"]);
    const pop = Math.log10(1 + d.downloads) / 2 + (d.ratingCount ? (avgRating(d) - 3) / 4 : 0);
    let score = parts.reduce((s, p) => s + p[0], 0) + pop;
    const last = seen.get(d.id);
    if (last && now - last < 30 * D6) score -= 4;
    if (!parts.length) continue;
    parts.sort((a, b) => b[0] - a[0]);
    scored.push({ d, score, why: parts[0][1] });
  }
  scored.sort((a, b) => b.score - a.score);
  // Đa dạng: tối đa 2 tài liệu mỗi học phần
  const per = {};
  return scored.filter((x) => (per[x.d.course] = (per[x.d.course] || 0) + 1) <= 2).slice(0, k);
}
function recCards(list) {
  return `<div class="cards">${list
    .map(({ d, why }) => `<a class="rec" href="#/tai-lieu/${d.slug}"><span class="why">${esc(why)}</span><b style="font-weight:600;line-height:1.3">${esc(d.title)}</b><span class="tiny muted">${d.course}, ${TYPES[d.type]}${d.ratingCount ? `, ${rating(d)}` : ""}, ${fmtCount(d.downloads)} lượt tải</span></a>`)
    .join("")}</div>`;
}
function recSection(u) {
  if (!u) return "";
  const list = recommend(u, 4);
  if (!list.length) return "";
  return `<section class="stack" style="gap:12px"><div class="row" style="justify-content:space-between;align-items:baseline"><h2 class="h2" style="margin:0">Gợi ý cho bạn</h2><a class="small" href="#/hoc-tap">Xem thêm</a></div>${recCards(list)}</section>`;
}

/* ===================== Thông báo từ ctt.hust.edu.vn ===================== */
const FEED_TAG = { ctdt: "CTĐT", decuong: "Đề cương", dangky: "Đăng ký học tập", lichthi: "Lịch thi", hocphi: "Học phí", hocbong: "Học bổng, khen thưởng", quyche: "Quy chế" };
let hustFeed = DATA.hustFeed || null;
let feedLoading = false;
/** Lấy bản mới nhất data/hust-feed.json (GitHub Actions cập nhật mỗi ngày); mở file trực tiếp thì dùng bản nhúng lúc dựng. */
function loadFeed() {
  if (feedLoading || location.protocol === "file:") return;
  feedLoading = true;
  fetch(`data/hust-feed.json?v=${Math.floor(Date.now() / 3600e3)}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      if (j && Array.isArray(j.items) && (!hustFeed || j.fetchedAt !== hustFeed.fetchedAt)) {
        hustFeed = j;
        if (/^\/(hoc-tap|ctdt)/.test(currentPath())) render();
      }
    })
    .catch(() => {});
}
function feedList(filter, k = 6) {
  if (!hustFeed?.items?.length) return '<p class="small muted" style="margin:0">Chưa lấy được thông báo.</p>';
  const items = hustFeed.items.filter((x) => !filter || x.tags.some((t) => filter.includes(t))).slice(0, k);
  if (!items.length) return '<p class="small muted" style="margin:0">Chưa có thông báo mới thuộc mục này.</p>';
  return `<ul class="tb" style="list-style:none;margin:0;padding:0">${items
    .map((x) => `<li style="padding:8px 12px;display:flex;flex-direction:column;gap:4px"><a href="${esc(x.url)}" target="_blank" rel="noopener" style="font-weight:600;line-height:1.35">${esc(x.title)}</a><span class="row" style="gap:6px">${x.date ? `<span class="tiny muted">${fmtDate(parseYmd(x.date))}</span>` : ""}${x.tags.map((t) => `<span class="why" style="font-size:11px;border:1px solid var(--line);padding:0 6px">${FEED_TAG[t] || t}</span>`).join("")}</span></li>`)
    .join("")}</ul><p class="tiny muted" style="margin:0">Nguồn: <a href="https://ctt.hust.edu.vn" target="_blank" rel="noopener">ctt.hust.edu.vn</a>, tự động cập nhật mỗi ngày. Lần lấy gần nhất: ${fmtTime(Date.parse(hustFeed.fetchedAt))}.</p>`;
}

/* ===================== Xếp lịch đăng ký lớp ===================== */
const PLAN_SEM = "20262";
/** Danh sách lớp mở mẫu cho kỳ 20262 (minh họa): mỗi học phần 2-3 lớp LT, lớp BT kèm theo mã lớp LT. */
function sampleOfferings() {
  let seed = 20262;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const rooms = ["D9-", "D3-", "D5-", "TC-", "D7-", "D6-"];
  const codes = [...new Set(Object.values(PROGRAMS).flatMap((p) => p.versions.flatMap((v) => v.terms.flat())))].filter((c) => course(c));
  const out = [];
  let id = 160100;
  for (const c of codes) {
    const combined = /^(SSH|EM|FL)/.test(c);
    const nLt = 2 + Math.floor(rnd() * 2);
    for (let i = 0; i < nLt; i++) {
      const lt = { id: String(++id), kem: "", code: c, name: course(c).name, type: combined ? "LT+BT" : "LT", day: rnd() < 0.08 ? 5 : Math.floor(rnd() * 5), slot: Math.floor(rnd() * 5), weeks: "1-8,10-17", room: rooms[Math.floor(rnd() * rooms.length)] + (101 + Math.floor(rnd() * 400)) };
      out.push(lt);
      if (!combined) {
        const nBt = 1 + Math.floor(rnd() * 2);
        for (let j = 0; j < nBt; j++) out.push({ id: String(++id), kem: lt.id, code: c, name: lt.name, type: "BT", day: rnd() < 0.08 ? 5 : Math.floor(rnd() * 5), slot: Math.floor(rnd() * 5), weeks: "2-8,10-17", room: rooms[Math.floor(rnd() * rooms.length)] + (101 + Math.floor(rnd() * 400)) });
      }
    }
  }
  return out.map((o) => ({ ...o, start: SLOTS[o.slot][0], end: SLOTS[o.slot][1] }));
}
function offeringsCsv(list) {
  const q = (s) => (/[",\n]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : s);
  return ["Mã lớp,Mã lớp kèm,Mã HP,Tên HP,Loại lớp,Thứ,Thời gian,Tuần,Phòng", ...list.map((o) => [o.id, o.kem, o.code, o.name, o.type, o.day + 2, `${o.start.replace(":", "")}-${o.end.replace(":", "")}`, o.weeks, o.room].map(q).join(","))].join("\n");
}
/** Đọc file TKB của trường (CSV, dán từ Excel, hoặc bảng chuyển từ XLSX). Bỏ qua các dòng tiêu đề phía trên bảng. */
function parseOfferings(text) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const start = lines.findIndex((l) => /ma ?lop|ma ?hp|ma hoc phan/.test(norm(l)) && /thu/.test(norm(l)));
  if (start < 0) return [];
  const rows = parseTable(lines.slice(start).join("\n"));
  const get = (r, ...names) => {
    for (const n of names) if (r[n] !== undefined && r[n] !== "") return r[n];
    for (const n of names) for (const k of Object.keys(r)) if (k.startsWith(n) && r[k] !== "") return r[k];
    return "";
  };
  const out = [];
  for (const r of rows) {
    const code = (get(r, "ma hp", "ma hoc phan").toUpperCase().match(/[A-Z]{2,4}\d{4}[A-Z]?/) || [])[0];
    const day = parseThu(get(r, "thu"));
    const range = parseRange(get(r, "thoi gian", "gio"));
    const id = get(r, "ma lop").replace(/\D/g, "");
    if (!code || day === null || !range || !id) continue;
    const type = get(r, "loai lop", "loai").toUpperCase().replace(/\s/g, "") || "LT";
    out.push({ id, kem: get(r, "ma lop kem", "lop kem").replace(/\D/g, ""), code, name: get(r, "ten hp", "ten hoc phan") || course(code)?.name || code, type, day, start: range[0], end: range[1], weeks: get(r, "tuan"), room: get(r, "phong") });
  }
  // Mã lớp kèm của chính nó (lớp LT+BT) thì coi như không kèm
  for (const o of out) if (o.kem === o.id) o.kem = "";
  return out;
}
/** Nạp SheetJS khi cần đọc file .xlsx */
let xlsxLoading = null;
function loadXlsx() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  xlsxLoading =
    xlsxLoading ||
    new Promise((ok, fail) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      s.onload = () => ok(window.XLSX);
      s.onerror = () => fail(new Error("Không tải được thư viện đọc Excel"));
      document.head.appendChild(s);
    });
  return xlsxLoading;
}
async function fileToText(file) {
  if (/\.xlsx?$/i.test(file.name)) {
    const X = await loadXlsx();
    const wb = X.read(await file.arrayBuffer(), { type: "array" });
    return X.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
  }
  return file.text();
}
function offeringsOf() {
  const st = ST();
  if (!st.offerings) {
    st.offerings = sampleOfferings();
    st.offeringsName = null;
  }
  return st.offerings;
}
/** Các phương án cho một học phần: LT + một lớp BT kèm, hoặc lớp LT+BT/LT đứng riêng. */
function courseOptions(code, list) {
  const own = list.filter((o) => o.code === code);
  const opts = [];
  for (const o of own) {
    if (o.type === "BT" || o.type === "TN" || o.kem) continue;
    const kids = own.filter((k) => k.kem === o.id);
    if (kids.length) for (const k of kids) opts.push([o, k]);
    else opts.push([o]);
  }
  // File chỉ có lớp kèm mà thiếu lớp chính: dùng riêng từng lớp
  if (!opts.length) for (const o of own) opts.push([o]);
  return opts;
}
function clash(a, b) {
  if (a.day !== b.day || !(mins(a.start) < mins(b.end) && mins(b.start) < mins(a.end))) return false;
  if (!a.weeks || !b.weeks) return true;
  const wa = parseWeeks(a.weeks);
  for (const w of parseWeeks(b.weeks)) if (wa.has(w)) return true;
  return false;
}
function scoreSchedule(sections, pref) {
  let s = 0;
  const days = new Set(sections.map((x) => x.day));
  if (pref.compact) s += days.size * 10;
  for (const x of sections) {
    if (pref.noEarly && mins(x.start) < 7 * 60) s += 6;
    if (pref.noEvening && mins(x.start) >= 17 * 60) s += 6;
  }
  for (const d of days) {
    const list = sections.filter((x) => x.day === d).sort((a, b) => mins(a.start) - mins(b.start));
    for (let i = 1; i < list.length; i++) s += Math.max(0, mins(list[i].start) - mins(list[i - 1].end) - 10) / 60;
  }
  return s;
}
/**
 * Xếp tự động: quay lui trên từng học phần (học phần ít phương án xếp trước), bỏ phương án trùng giờ
 * (cùng thứ, giao giờ, giao tuần) hoặc rơi vào ngày muốn nghỉ. Giữ 5 phương án điểm phạt thấp nhất.
 */
function solveSchedule(codes, list, pref) {
  const opts = codes.map((c) => ({ c, o: courseOptions(c, list).filter((sec) => sec.every((x) => !(pref.offDays || []).includes(x.day))) }));
  const missing = opts.filter((x) => !x.o.length).map((x) => x.c);
  if (missing.length) return { best: [], missing, nodes: 0 };
  opts.sort((a, b) => a.o.length - b.o.length);
  const best = [];
  let nodes = 0;
  const pick = [];
  const placed = [];
  const walk = (i) => {
    if (nodes++ > 60000) return;
    if (i === opts.length) {
      const score = scoreSchedule(placed, pref);
      best.push({ score, pick: [...pick] });
      best.sort((a, b) => a.score - b.score);
      if (best.length > 5) best.pop();
      return;
    }
    for (const sec of opts[i].o) {
      if (sec.some((x) => placed.some((y) => clash(x, y)))) continue;
      pick.push({ c: opts[i].c, sec });
      placed.push(...sec);
      walk(i + 1);
      placed.length -= sec.length;
      pick.pop();
    }
  };
  walk(0);
  let blocker = null;
  if (!best.length) {
    // Tìm cặp học phần trùng mọi phương án để giải thích
    for (let a = 0; a < opts.length && !blocker; a++)
      for (let b = a + 1; b < opts.length && !blocker; b++)
        if (opts[a].o.every((x) => opts[b].o.every((y) => x.some((p) => y.some((q) => clash(p, q)))))) blocker = [opts[a].c, opts[b].c];
  }
  return { best, missing: [], blocker, nodes };
}
function planOf(u) {
  const st = ST();
  st.plans[u.email] = st.plans[u.email] || { courses: [], pref: { compact: true, noEarly: false, noEvening: true, offDays: [] }, result: null, choice: 0 };
  return st.plans[u.email];
}
views["/xep-lich"] = () => {
  const u = me();
  if (!u) return needLogin("/xep-lich");
  const st = ST();
  const list = offeringsOf();
  const plan = planOf(u);
  const avail = [...new Set(list.map((o) => o.code))].sort();
  const suggest = nextTermCourses(u).filter((c) => avail.includes(c) && !plan.courses.includes(c));
  const res = plan.result;
  const chosen = res?.best?.[plan.choice];
  const credits = plan.courses.reduce((s, c) => s + (course(c)?.credits || 0), 0);
  let resultHtml = "";
  if (res) {
    if (res.missing?.length) resultHtml = `<p class="note red" style="margin:0">Không có lớp nào phù hợp cho ${res.missing.join(", ")} (không có trong file hoặc rơi hết vào ngày bạn muốn nghỉ).</p>`;
    else if (!res.best.length) resultHtml = `<p class="note red" style="margin:0">Không xếp được lịch không trùng giờ${res.blocker ? `: mọi lớp của <b>${res.blocker[0]}</b> đều trùng với mọi lớp của <b>${res.blocker[1]}</b>` : ""}. Thử bỏ bớt một học phần hoặc nới điều kiện.</p>`;
    else {
      const secs = chosen.pick.flatMap((p) => p.sec);
      const blocks = secs.map((x) => ({ day: x.day, start: mins(x.start), end: mins(x.end), title: `${x.code} ${x.type}`, sub: `${x.id} ${x.room}`, kind: "class" }));
      const days = new Set(secs.map((x) => x.day));
      resultHtml = `<div class="row" style="gap:6px">${res.best.map((b, i) => `<button class="btn sm${i === plan.choice ? " ink" : ""}" type="button" data-choice="${i}">Phương án ${i + 1}</button>`).join("")}</div>
       <div class="tb" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr))"><div class="cell"><span class="l">Số ngày lên trường</span><span class="v code" style="font-size:28px">${days.size}</span></div><div class="cell"><span class="l">Ngày nghỉ</span><span class="v">${DOW.slice(0, 6).filter((_, i) => !days.has(i)).join(", ") || "Không"}</span></div><div class="cell"><span class="l">Số lớp</span><span class="v code" style="font-size:28px">${secs.length}</span></div><div class="cell"><span class="l">Tín chỉ</span><span class="v code" style="font-size:28px">${credits}</span></div></div>
       <div class="wk-desktop">${weekGrid(Object.assign(blocks, { dayLabels: DOW_SHORT.slice(0, 6) }), { days: 6, from: 6 * 60, to: 21 * 60 })}</div>
       <div style="overflow-x:auto"><table class="t" style="min-width:560px"><thead><tr><th>Mã lớp</th><th>Học phần</th><th>Loại</th><th>Thứ</th><th>Giờ</th><th>Tuần</th><th>Phòng</th></tr></thead><tbody>${secs
         .sort((a, b) => a.day - b.day || mins(a.start) - mins(b.start))
         .map((x) => `<tr><td class="code" style="font-size:16px">${x.id}</td><td>${x.code} ${esc(x.name)}</td><td>${x.type}</td><td>${DOW[x.day]}</td><td>${x.start}-${x.end}</td><td>${esc(x.weeks || "")}</td><td>${esc(x.room || "")}</td></tr>`)
         .join("")}</tbody></table></div>
       <div class="row" style="gap:6px"><button class="btn primary" type="button" data-apply>Đưa vào lịch học kỳ ${PLAN_SEM}</button><button class="btn" type="button" data-copy>Chép danh sách mã lớp</button></div>
       <p class="tiny muted" style="margin:0">Đã thử ${fmtCount(res.nodes)} tổ hợp. Đăng ký thật vẫn làm trên trang đăng ký học tập của trường; số chỗ còn trống có thể thay đổi.</p>`;
    }
  }
  const html =
    studyHead("Xếp lịch đăng ký lớp", "xep", `<p class="small muted" style="margin:0">Học kỳ ${PLAN_SEM}. Dữ liệu lớp: ${st.offeringsName ? `<b>${esc(st.offeringsName)}</b> (${list.length} lớp)` : `danh sách mẫu ${list.length} lớp (minh họa, chưa phải lớp mở thật)`}.</p>`) +
    `<div class="wrap stack" style="padding-block:20px;gap:24px">
    <div class="two" style="gap:16px">
     <section class="stack" style="border:2px solid var(--line);background:var(--sheet);padding:16px;gap:10px"><h2 class="h2" style="margin:0">1. Danh sách lớp mở</h2>
      <p class="small" style="margin:0">Tải file thời khóa biểu dự kiến của trường (<b>.xlsx</b> hoặc <b>.csv</b>), hoặc dán bảng từ Excel. Cột cần có: Mã lớp, Mã lớp kèm, Mã HP, Loại lớp, Thứ, Thời gian, Tuần, Phòng.</p>
      <div class="row" style="gap:6px"><label class="btn sm" for="off-file" style="cursor:pointer">Chọn file TKB</label><input class="sr" id="off-file" type="file" accept=".xlsx,.xls,.csv,.tsv,.txt"><button class="btn sm" type="button" data-offsample>Tải file mẫu</button>${st.offeringsName ? '<button class="btn sm" type="button" data-offreset>Dùng lại dữ liệu mẫu</button>' : ""}</div>
      <div class="field"><label for="off-paste">Hoặc dán bảng</label><textarea class="textarea" id="off-paste" style="min-height:60px"></textarea></div><div><button class="btn sm" type="button" data-offpaste>Đọc bảng</button></div></section>
     <section class="stack" style="border:2px solid var(--line);background:var(--sheet);padding:16px;gap:10px"><h2 class="h2" style="margin:0">2. Học phần muốn đăng ký</h2>
      <div class="row" style="gap:6px">${plan.courses.map((c) => `<span class="why" style="font-size:13px;padding:4px 8px;border:2px solid var(--line);color:var(--ink)">${c} ${esc(course(c)?.name || "")} <button type="button" data-rm="${c}" aria-label="Bỏ ${c}" style="all:unset;cursor:pointer;margin-left:6px;font-weight:700">×</button></span>`).join("") || '<span class="small muted">Chưa chọn học phần nào.</span>'}</div>
      <form class="row" data-form="addc" style="gap:6px;flex-wrap:nowrap"><label class="sr" for="addc">Thêm học phần</label><input class="input" id="addc" list="addc-list" placeholder="Mã học phần, ví dụ IT3080"><datalist id="addc-list">${avail.map((c) => `<option value="${c}">${esc(course(c)?.name || "")}</option>`).join("")}</datalist><button class="btn ink" type="submit">Thêm</button></form>
      ${suggest.length ? `<p class="small" style="margin:0">Theo CTĐT, kỳ tới bạn nên học: ${suggest.map((c) => `<b>${c}</b>`).join(", ")}. <button class="btn sm" type="button" data-sug>Thêm tất cả</button></p>` : ""}
      <p class="tiny muted" style="margin:0">${plan.courses.length} học phần, ${credits} tín chỉ.</p></section>
    </div>
    <section class="stack" style="border:2px solid var(--line);background:var(--sheet);padding:16px;gap:10px"><h2 class="h2" style="margin:0">3. Ưu tiên</h2>
     <div class="row" style="gap:16px"><label class="check"><input type="checkbox" data-p="compact"${plan.pref.compact ? " checked" : ""}><span>Dồn lịch, ít ngày lên trường</span></label><label class="check"><input type="checkbox" data-p="noEarly"${plan.pref.noEarly ? " checked" : ""}><span>Tránh kíp 6:45</span></label><label class="check"><input type="checkbox" data-p="noEvening"${plan.pref.noEvening ? " checked" : ""}><span>Tránh học tối</span></label></div>
     <div class="row" style="gap:12px"><span class="small">Ngày muốn nghỉ hẳn:</span>${DOW.slice(0, 6).map((d, i) => `<label class="check"><input type="checkbox" data-off="${i}"${plan.pref.offDays.includes(i) ? " checked" : ""}><span>${d}</span></label>`).join("")}</div>
     <div><button class="btn primary" type="button" data-solve${plan.courses.length ? "" : " disabled"}>Xếp tự động</button></div></section>
    ${res ? `<section class="stack" style="gap:12px" id="ket-qua"><h2 class="h2" style="margin:0">Kết quả</h2>${resultHtml}</section>` : ""}
    </div>`;
  return {
    html,
    mount(root) {
      const rerun = () => {
        if (plan.result) {
          plan.result = solveSchedule(plan.courses, list, plan.pref);
          plan.choice = 0;
        }
        save();
        render();
      };
      const setOfferings = (items, name) => {
        if (!items.length) return toast("Không đọc được lớp nào. Kiểm tra lại các cột Mã lớp, Mã HP, Thứ, Thời gian.");
        st.offerings = items;
        st.offeringsName = name;
        plan.result = null;
        save();
        toast(`Đã đọc ${items.length} lớp.`);
        render();
      };
      root.querySelector("#off-file").addEventListener("change", async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        try {
          setOfferings(parseOfferings(await fileToText(f)), f.name);
        } catch (err) {
          toast(err.message);
        }
      });
      root.querySelector("[data-offpaste]").addEventListener("click", () => setOfferings(parseOfferings(root.querySelector("#off-paste").value), "Bảng dán vào"));
      root.querySelector("[data-offsample]").addEventListener("click", () => downloadText(`tkb-du-kien-${PLAN_SEM}-mau.csv`, `﻿${offeringsCsv(list)}`, "text/csv"));
      root.querySelector("[data-offreset]")?.addEventListener("click", () => {
        st.offerings = null;
        plan.result = null;
        save();
        render();
      });
      root.querySelector('[data-form="addc"]').addEventListener("submit", (e) => {
        e.preventDefault();
        const c = (root.querySelector("#addc").value.toUpperCase().match(/[A-Z]{2,4}\d{4}[A-Z]?/) || [])[0];
        if (!c || !avail.includes(c)) return toast("Học phần này không có lớp mở trong danh sách.");
        if (!plan.courses.includes(c)) plan.courses.push(c);
        rerun();
      });
      root.querySelector("[data-sug]")?.addEventListener("click", () => {
        plan.courses.push(...suggest);
        rerun();
      });
      root.querySelectorAll("[data-rm]").forEach((b) =>
        b.addEventListener("click", () => {
          plan.courses = plan.courses.filter((c) => c !== b.dataset.rm);
          rerun();
        }),
      );
      root.querySelectorAll("[data-p]").forEach((c) => c.addEventListener("change", () => ((plan.pref[c.dataset.p] = c.checked), rerun())));
      root.querySelectorAll("[data-off]").forEach((c) =>
        c.addEventListener("change", () => {
          const d = +c.dataset.off;
          plan.pref.offDays = c.checked ? [...plan.pref.offDays, d] : plan.pref.offDays.filter((x) => x !== d);
          rerun();
        }),
      );
      root.querySelector("[data-solve]").addEventListener("click", () => {
        plan.result = solveSchedule(plan.courses, list, plan.pref);
        plan.choice = 0;
        save();
        render();
        document.getElementById("ket-qua")?.scrollIntoView({ block: "start" });
      });
      root.querySelectorAll("[data-choice]").forEach((b) => b.addEventListener("click", () => ((plan.choice = +b.dataset.choice), save(), render())));
      root.querySelector("[data-apply]")?.addEventListener("click", () => {
        const sem = SEMESTERS[PLAN_SEM];
        st.events = st.events.filter((e) => !(e.user === u.email && e.plan === PLAN_SEM));
        for (const p of chosen.pick)
          for (const x of p.sec)
            st.events.push({ id: uid(), user: u.email, kind: "class", plan: PLAN_SEM, title: `${x.name} (${x.type})`, course: x.code, weekly: { day: x.day, from: sem.start, to: sem.end, weeks: x.weeks }, start: x.start, end: x.end, location: x.room });
        save();
        toast(`Đã đưa ${chosen.pick.reduce((s, p) => s + p.sec.length, 0)} lớp vào lịch học kỳ ${PLAN_SEM}.`);
      });
      root.querySelector("[data-copy]")?.addEventListener("click", async () => {
        const ids = chosen.pick.flatMap((p) => p.sec.map((x) => x.id)).join(", ");
        try {
          await navigator.clipboard.writeText(ids);
          toast("Đã chép mã lớp.");
        } catch {
          prompt("Mã lớp", ids);
        }
      });
    },
  };
};

/* ===================== Chương trình đào tạo ===================== */
function diffVersions(a, b) {
  const pos = (v) => Object.fromEntries(v.terms.flatMap((t, i) => t.map((c) => [c, i + 1])));
  const pa = pos(a);
  const pb = pos(b);
  const out = [];
  for (const c of Object.keys(pa)) if (!(c in pb)) out.push(["Thêm", c, `kỳ ${pa[c]}`]);
  for (const c of Object.keys(pb)) if (!(c in pa)) out.push(["Bỏ", c, `trước ở kỳ ${pb[c]}`]);
  for (const c of Object.keys(pa)) if (c in pb && pa[c] !== pb[c]) out.push(["Chuyển", c, `kỳ ${pb[c]} → kỳ ${pa[c]}`]);
  return out;
}
views["/ctdt"] = () => {
  const u = me();
  if (!u) return needLogin("/ctdt");
  loadFeed();
  const { p, prog, version } = programOf(u);
  const all = version.terms.flat();
  const doneCr = all.filter((c) => p.done.includes(c)).reduce((s, c) => s + (course(c)?.credits || 0), 0);
  const totalCr = all.reduce((s, c) => s + (course(c)?.credits || 0), 0);
  const older = prog.versions.filter((v) => v.id !== version.id);
  const syllabus = (c) => S.docs.filter((d) => d.course === c && d.status === "APPROVED" && d.type === "SYLLABUS").sort((a, b) => b.publishedAt - a.publishedAt)[0];
  const html =
    studyHead(`Chương trình đào tạo: ${prog.name}`, "ctdt", `<p class="small muted" style="margin:0">${esc(version.label)}, cập nhật ${fmtDate(parseYmd(version.updated))}. Khung chương trình trong bản demo là <b>minh họa</b>; thông báo bên dưới lấy thật từ ctt.hust.edu.vn.</p>`) +
    `<div class="wrap stack" style="padding-block:20px;gap:24px">
    <div class="tb" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))"><div class="cell"><span class="l">Đã học</span><span class="v code" style="font-size:28px">${doneCr}/${totalCr} TC</span><div class="bar" style="margin-top:6px"><i style="width:${Math.round((doneCr / Math.max(1, totalCr)) * 100)}%"></i></div></div>
     <div class="cell"><span class="l">Phiên bản</span><select class="select" id="ver" aria-label="Phiên bản chương trình">${prog.versions.map((v) => `<option value="${v.id}"${v.id === version.id ? " selected" : ""}>${esc(v.label)}</option>`).join("")}</select></div>
     <div class="cell"><span class="l">Kỳ tới nên học</span><span class="v">${nextTermCourses(u).join(", ") || "Đã học hết"}</span><a class="small" href="#/xep-lich" data-toplan>Xếp lịch cho các môn này</a></div></div>
    <section class="stack" style="gap:8px"><h2 class="h2" style="margin:0">Các học kỳ</h2><p class="small muted" style="margin:0">Đánh dấu môn đã học để tính tiến độ và gợi ý môn kỳ tới.</p>
     <div style="display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(280px,1fr))">${version.terms
       .map((t, i) => `<div class="tb" style="grid-template-columns:minmax(0,1fr)"><div style="padding:8px 12px;background:var(--fill);color:var(--on-fill)" class="head">Học kỳ ${i + 1} <span class="tiny" style="opacity:.8">${t.reduce((s, c) => s + (course(c)?.credits || 0), 0)} TC</span></div>${t
         .map((c) => {
           const sy = syllabus(c);
           return `<label class="check" style="padding:6px 12px;margin:0;align-items:flex-start"><input type="checkbox" data-done="${c}"${p.done.includes(c) ? " checked" : ""}><span style="display:flex;flex-direction:column"><span><a href="#/hoc-phan/${c}"><b>${c}</b></a> ${esc(course(c)?.name || c)} <span class="tiny muted">${course(c)?.credits || "?"} TC</span></span>${sy ? `<a class="tiny" href="#/tai-lieu/${sy.slug}">Đề cương mới nhất (${fmtDate(sy.publishedAt)})</a>` : ""}</span></label>`;
         })
         .join("")}</div>`)
       .join("")}</div></section>
    ${older.length ? `<section class="stack" style="gap:8px"><h2 class="h2" style="margin:0">Thay đổi so với ${esc(older[0].label)}</h2>${(() => {
      const d = diffVersions(version, older[0]);
      return d.length ? `<ul class="tb" style="list-style:none;margin:0;padding:0">${d.map(([k, c, w]) => `<li style="padding:6px 12px"><span class="why" style="margin-right:8px">${k}</span><b>${c}</b> ${esc(course(c)?.name || "")} <span class="tiny muted">${w}</span></li>`).join("")}</ul>` : '<p class="small muted">Không có khác biệt.</p>';
    })()}</section>` : ""}
    <section class="stack" style="gap:8px"><h2 class="h2" style="margin:0">Thông báo mới về CTĐT, đề cương, đăng ký học tập</h2>${feedList(["ctdt", "decuong", "dangky", "quyche"], 8)}</section>
    </div>`;
  return {
    html,
    mount(root) {
      root.querySelector("#ver").addEventListener("change", (e) => {
        p.version = e.target.value;
        save();
        render();
      });
      root.querySelectorAll("[data-done]").forEach((c) =>
        c.addEventListener("change", () => {
          const code = c.dataset.done;
          p.done = c.checked ? [...new Set([...p.done, code])] : p.done.filter((x) => x !== code);
          save();
          render();
        }),
      );
      root.querySelector("[data-toplan]")?.addEventListener("click", () => {
        const plan = planOf(u);
        const avail = new Set(offeringsOf().map((o) => o.code));
        plan.courses = nextTermCourses(u).filter((c) => avail.has(c));
        plan.result = null;
        save();
      });
    },
  };
};

/* ===================== Ôn tập trắc nghiệm ===================== */
function qStats(u, code) {
  const st = ST();
  const byQ = {};
  for (const a of st.attempts.filter((x) => x.user === u.email && (!code || x.course === code)))
    for (const r of a.answers) (byQ[r.q] = byQ[r.q] || []).push(r.ok);
  const byTopic = {};
  for (const q of QBANK.filter((x) => !code || x.c === code)) {
    const res = byQ[q.id] || [];
    const t = (byTopic[`${q.c}|${q.topic}`] = byTopic[`${q.c}|${q.topic}`] || { c: q.c, topic: q.topic, ok: 0, n: 0 });
    // Câu gần đây nặng hơn: lấy tối đa 3 lần gần nhất
    for (const ok of res.slice(-3)) {
      t.n++;
      if (ok) t.ok++;
    }
  }
  return { byQ, topics: Object.values(byTopic) };
}
views["/on-tap"] = () => {
  const u = me();
  if (!u) return needLogin("/on-tap");
  const st = ST();
  const codes = Object.keys(QB_RAW);
  const code = codes.includes(params().get("hp")) ? params().get("hp") : codes.includes((upcoming(u, "exam", 30)[0] || {}).e?.course) ? upcoming(u, "exam", 30)[0].e.course : codes[0];
  const { byQ, topics } = qStats(u, code);
  const hist = st.attempts.filter((a) => a.user === u.email && a.course === code).slice(-8).reverse();
  const tried = topics.filter((t) => t.n);
  const weak = [...tried].sort((a, b) => a.ok / a.n - b.ok / b.n).filter((t) => t.ok / t.n < 0.7);
  const html =
    studyHead("Ôn tập trắc nghiệm", "ontap", `<p class="small muted" style="margin:0">Mỗi lượt 5 đến 10 câu, chấm ngay, ghi lại điểm mạnh, điểm yếu theo chủ đề. Câu sai được đưa vào flashcard để ôn lặp lại.</p>`) +
    `<div class="wrap stack" style="padding-block:20px;gap:24px">
    <div class="row" style="gap:6px">${codes.map((c) => `<a class="btn sm${c === code ? " ink" : ""}" href="#/on-tap?hp=${c}">${c}</a>`).join("")}</div>
    <div class="two" style="gap:16px;align-items:start">
     <section class="stack" style="gap:10px;min-width:0"><h2 class="h2" style="margin:0">${code} ${esc(course(code)?.name || "")}</h2>
      <form class="row" data-form="start" style="gap:8px"><label class="small" for="qn">Số câu</label><select class="select" id="qn" style="width:auto"><option>5</option><option selected>8</option><option>10</option></select><label class="check" style="margin:0"><input type="checkbox" id="qweak"${weak.length ? " checked" : ""}><span>Ưu tiên câu hay sai</span></label><button class="btn primary" type="submit">Bắt đầu</button></form>
      <div data-quizbox></div>
     </section>
     <section class="stack" style="gap:10px;min-width:0"><h2 class="h2" style="margin:0">Điểm mạnh, điểm yếu</h2>
      ${tried.length ? `<div class="tb" style="grid-template-columns:minmax(0,1fr)">${topics
        .map((t) => `<div style="padding:8px 12px"><div class="row" style="justify-content:space-between"><span class="small"><b>${esc(t.topic)}</b></span><span class="tiny muted">${t.n ? `${Math.round((t.ok / t.n) * 100)}% đúng` : "chưa làm"}</span></div><div class="bar" style="margin-top:4px"><i style="width:${t.n ? Math.round((t.ok / t.n) * 100) : 0}%;background:${t.n && t.ok / t.n < 0.6 ? "var(--stamp)" : "var(--ink)"}"></i></div></div>`)
        .join("")}</div>${weak.length ? `<p class="small" style="margin:0">Nên ôn thêm: ${weak.map((t) => `<b>${esc(t.topic)}</b>`).join(", ")}. ${examDocs(code, 2).map((d) => `<a href="#/tai-lieu/${d.slug}">${esc(d.title)}</a>`).join(", ")}</p>` : '<p class="small" style="margin:0">Bạn đang làm tốt các chủ đề đã luyện.</p>'}` : '<p class="small muted" style="margin:0">Làm một lượt để xem thống kê.</p>'}
      ${hist.length ? `<h3 class="head" style="margin:8px 0 0;font-size:15px">Các lượt gần đây</h3><ul class="tb" style="list-style:none;margin:0;padding:0">${hist.map((a) => `<li style="padding:6px 12px;display:flex;justify-content:space-between"><span class="small">${fmtTime(a.t)}</span><b class="code" style="font-size:18px">${a.score}/${a.answers.length}</b></li>`).join("")}</ul>` : ""}
      <p class="tiny muted" style="margin:0">Học phần khác chưa có ngân hàng câu hỏi: mở một tài liệu và dùng “Tạo 5 câu hỏi ôn tập” của Trợ lý AI.</p>
     </section></div></div>`;
  return {
    html,
    mount(root) {
      const box = root.querySelector("[data-quizbox]");
      root.querySelector('[data-form="start"]').addEventListener("submit", (e) => {
        e.preventDefault();
        const n = +root.querySelector("#qn").value;
        const preferWeak = root.querySelector("#qweak").checked;
        const pool = QBANK.filter((q) => q.c === code);
        const errRate = (q) => {
          const r = (byQ[q.id] || []).slice(-3);
          return r.length ? r.filter((x) => !x).length / r.length : 0.5;
        };
        const seed = Date.now() & 0xffff;
        const qs = (preferWeak ? shuffleSeeded(pool, seed).sort((a, b) => errRate(b) - errRate(a)) : shuffleSeeded(pool, seed)).slice(0, n);
        const shown = qs.map((q, i) => {
          const order = shuffleSeeded([0, 1, 2, 3], seed + i);
          return { q, order };
        });
        box.innerHTML = `<form class="stack" data-qform>${shown
          .map(({ q, order }, i) => `<fieldset class="qz" style="border:2px solid var(--line);background:var(--sheet);padding:10px 12px;margin:0"><legend class="head small">Câu ${i + 1} <span class="tiny muted">${esc(q.topic)}</span></legend><p style="margin:0 0 6px">${esc(q.q)}</p>${order.map((j) => `<label class="check" style="margin:4px 0"><input type="radio" name="q${i}" value="${j}"><span>${esc(q.opts[j])}</span></label>`).join("")}<p class="small" data-ex hidden style="margin:6px 0 0"></p></fieldset>`)
          .join("")}<div class="row"><button class="btn primary" type="submit">Chấm điểm</button></div></form>`;
        const f = box.querySelector("[data-qform]");
        f.addEventListener("submit", (ev) => {
          ev.preventDefault();
          const answers = shown.map(({ q }, i) => {
            const v = f.querySelector(`input[name=q${i}]:checked`);
            return { q: q.id, ok: !!v && +v.value === 0, picked: v ? +v.value : null };
          });
          const score = answers.filter((a) => a.ok).length;
          st.attempts.push({ user: u.email, course: code, t: Date.now(), score, answers });
          // Câu sai vào hàng ôn flashcard (đến hạn ngay)
          for (const a of answers) if (!a.ok) srsOf(u)[a.q] = { ...(srsOf(u)[a.q] || { ef: 2.5, reps: 0, interval: 0 }), due: Date.now() };
          save();
          render();
          toast(`Bạn đúng ${score}/${answers.length} câu. Câu sai đã vào hàng ôn flashcard.`);
          const nb = document.querySelector("[data-quizbox]");
          if (nb) {
            nb.innerHTML = `<div class="stack" style="gap:8px"><p class="head" style="margin:0;font-size:20px">Bạn đúng ${score}/${answers.length} câu</p>${shown
              .map(({ q }, i) => `<div style="border:2px solid ${answers[i].ok ? "var(--line)" : "var(--stamp)"};background:var(--sheet);padding:8px 12px"><p style="margin:0" class="small"><b>Câu ${i + 1}.</b> ${esc(q.q)}</p><p class="small" style="margin:4px 0 0">${answers[i].ok ? "Đúng." : `Chưa đúng${answers[i].picked !== null ? ` (bạn chọn “${esc(q.opts[answers[i].picked])}”)` : ""}.`} Đáp án: <b>${esc(q.opts[0])}</b>. ${esc(q.ex)}</p></div>`)
              .join("")}<div class="row"><a class="btn" href="#/flashcard?hp=${code}">Ôn câu sai bằng flashcard</a></div></div>`;
            translateTree(nb);
          }
        });
        translateTree(box);
      });
    },
  };
};

/* ===================== Flashcard, lặp lại ngắt quãng (SM-2) ===================== */
function srsOf(u) {
  const st = ST();
  st.srs[u.email] = st.srs[u.email] || {};
  return st.srs[u.email];
}
/** Thẻ = câu hỏi trong ngân hàng (mặt sau là đáp án, giải thích) và thẻ người dùng tự tạo. */
function cardsOf(u, code) {
  const own = ST().cards.filter((c) => c.user === u.email && (!code || c.c === code)).map((c) => ({ id: c.id, c: c.c, front: c.front, back: c.back, own: true }));
  const bank = QBANK.filter((q) => !code || q.c === code).map((q) => ({ id: q.id, c: q.c, front: q.q, back: `${q.opts[0]}. ${q.ex}` }));
  return [...own, ...bank];
}
/** SM-2: chất lượng 0-5. Dưới 3 thì học lại từ đầu (1 ngày); hệ số dễ không xuống dưới 1,3. */
function sm2(s, quality) {
  const x = { ef: 2.5, reps: 0, interval: 0, ...s };
  if (quality < 3) {
    x.reps = 0;
    x.interval = 1;
  } else {
    x.reps++;
    x.interval = x.reps === 1 ? 1 : x.reps === 2 ? 6 : Math.round(x.interval * x.ef);
  }
  x.ef = Math.max(1.3, x.ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  x.due = dayStart(Date.now()) + x.interval * D6;
  return x;
}
function dueCards(u, code) {
  const srs = srsOf(u);
  const now = Date.now();
  return cardsOf(u, code).filter((c) => !srs[c.id] || srs[c.id].due <= now);
}
views["/flashcard"] = () => {
  const u = me();
  if (!u) return needLogin("/flashcard");
  const st = ST();
  const codes = [...new Set([...Object.keys(QB_RAW), ...st.cards.filter((c) => c.user === u.email).map((c) => c.c)])];
  const code = codes.includes(params().get("hp")) ? params().get("hp") : "";
  const srs = srsOf(u);
  const all = cardsOf(u, code);
  const due = dueCards(u, code).sort((a, b) => (srs[a.id] ? 1 : 0) - (srs[b.id] ? 1 : 0) || (srs[a.id]?.due || 0) - (srs[b.id]?.due || 0));
  const learned = all.filter((c) => srs[c.id]?.reps >= 2).length;
  const card = due[0];
  const preview = (q) => {
    const n = sm2(srs[card.id], q).interval;
    return n <= 1 ? "1 ngày" : `${n} ngày`;
  };
  const html =
    studyHead("Flashcard", "fc", `<p class="small muted" style="margin:0">Lặp lại ngắt quãng theo thuật toán SM-2: thẻ nhớ tốt sẽ xuất hiện thưa dần, thẻ hay quên xuất hiện lại sớm.</p>`) +
    `<div class="wrap stack" style="padding-block:20px;gap:24px">
    <div class="row" style="gap:6px"><a class="btn sm${!code ? " ink" : ""}" href="#/flashcard">Tất cả</a>${codes.map((c) => `<a class="btn sm${c === code ? " ink" : ""}" href="#/flashcard?hp=${c}">${c}</a>`).join("")}</div>
    <div class="tb" style="grid-template-columns:repeat(3,1fr)"><div class="cell"><span class="l">Đến hạn hôm nay</span><span class="v code" style="font-size:28px;color:var(--stamp)">${due.length}</span></div><div class="cell"><span class="l">Đã thuộc</span><span class="v code" style="font-size:28px">${learned}</span></div><div class="cell"><span class="l">Tổng số thẻ</span><span class="v code" style="font-size:28px">${all.length}</span></div></div>
    <div class="two" style="gap:16px;align-items:start">
     <section class="stack" style="gap:12px;min-width:0">${card ? `<div class="fc-card" data-card><span class="tiny muted">${card.c} ${esc(course(card.c)?.name || "")}${card.own ? ", thẻ của bạn" : ""}</span><p class="head" style="margin:0;font-size:19px;line-height:1.35">${esc(card.front)}</p><div data-back hidden style="border-top:2px dashed var(--line);padding-top:10px"><p style="margin:0">${esc(card.back)}</p></div></div>
      <div data-flip><button class="btn primary lg block" type="button" data-show>Lật thẻ</button></div>
      <div data-grade hidden class="tb" style="grid-template-columns:repeat(4,1fr)">${[[1, "Quên"], [3, "Khó"], [4, "Nhớ"], [5, "Dễ"]].map(([q, l]) => `<button class="btn" style="border:0;flex-direction:column;height:auto;padding:8px" type="button" data-q="${q}"><b>${l}</b><span class="tiny muted">${preview(q)}</span></button>`).join("")}</div>` : `<div class="empty"><p class="head" style="margin:0">Hết thẻ đến hạn hôm nay</p><div class="small muted" style="margin-top:8px">Quay lại vào ngày mai, hoặc <a href="#/on-tap${code ? `?hp=${code}` : ""}">làm trắc nghiệm</a> để thêm câu sai vào hàng ôn.</div></div>`}</section>
     <form class="stack" data-form="card" style="border:2px solid var(--line);background:var(--sheet);padding:16px;gap:10px"><h2 class="h2" style="margin:0">Tạo thẻ mới</h2>
      <div class="field"><label for="fc-c">Học phần</label><select class="select" id="fc-c">${S.courses.map((c) => `<option value="${c.code}"${c.code === (code || "IT3011") ? " selected" : ""}>${c.code} ${esc(c.name)}</option>`).join("")}</select></div>
      <div class="field"><label for="fc-f">Mặt trước</label><textarea class="textarea" id="fc-f" style="min-height:56px" placeholder="Ví dụ: Độ phức tạp của sắp xếp trộn?"></textarea></div>
      <div class="field"><label for="fc-b">Mặt sau</label><textarea class="textarea" id="fc-b" style="min-height:56px" placeholder="O(n log n) trong mọi trường hợp"></textarea></div>
      <div><button class="btn ink" type="submit">Thêm thẻ</button></div></form></div></div>`;
  return {
    html,
    mount(root) {
      root.querySelector("[data-show]")?.addEventListener("click", () => {
        root.querySelector("[data-back]").hidden = false;
        root.querySelector("[data-flip]").hidden = true;
        root.querySelector("[data-grade]").hidden = false;
        root.querySelector("[data-grade] button")?.focus();
      });
      root.querySelectorAll("[data-q]").forEach((b) =>
        b.addEventListener("click", () => {
          srs[card.id] = sm2(srs[card.id], +b.dataset.q);
          save();
          render();
        }),
      );
      root.querySelector('[data-form="card"]').addEventListener("submit", (e) => {
        e.preventDefault();
        const front = root.querySelector("#fc-f").value.trim();
        const back = root.querySelector("#fc-b").value.trim();
        if (front.length < 3 || back.length < 1) return toast("Nhập đủ hai mặt của thẻ.");
        st.cards.push({ id: `own-${uid()}`, user: u.email, c: root.querySelector("#fc-c").value, front, back });
        save();
        toast("Đã thêm thẻ.");
        render();
      });
    },
  };
};

/* ===================== Pomodoro và phòng học chung ===================== */
const BOT_NAMES = ["Minh Anh (K68)", "Hoàng Nam (K67)", "Thu Trang (K69)", "Đức Huy (K68)"];
function seedRooms() {
  const now = Date.now();
  return [
    { id: "r-ctdl", name: "Ôn thi CTDL K68", course: "IT3011", focus: 25, brk: 5, owner: "nguyen.thu.ha@sis.hust.edu.vn", state: { phase: "focus", endsAt: now + 17 * 60e3, pausedLeft: null }, presence: {}, bots: BOT_NAMES.slice(0, 3), notes: [] },
    { id: "r-yen-lang", name: "Phòng tự học yên lặng", course: "", focus: 50, brk: 10, owner: "le.minh.quan@sis.hust.edu.vn", state: { phase: "idle", endsAt: null, pausedLeft: null }, presence: {}, bots: BOT_NAMES.slice(2), notes: [] },
  ];
}
function soloOf(u) {
  const st = ST();
  st.solo = st.solo || {};
  st.solo[u.email] = st.solo[u.email] || { id: `solo-${u.username}`, name: "Pomodoro của tôi", focus: 25, brk: 5, state: { phase: "idle", endsAt: null, pausedLeft: null }, count: 0 };
  return st.solo[u.email];
}
function timerLeft(t) {
  const s = t.state;
  if (s.phase === "idle") return t.focus * 60e3;
  if (s.pausedLeft !== null && s.pausedLeft !== undefined) return s.pausedLeft;
  return Math.max(0, s.endsAt - Date.now());
}
function fmtLeft(ms) {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
function timerAction(t, act) {
  const s = t.state;
  const now = Date.now();
  if (act === "start") Object.assign(s, { phase: "focus", endsAt: now + t.focus * 60e3, pausedLeft: null });
  else if (act === "pause" && s.phase !== "idle" && s.pausedLeft === null) s.pausedLeft = Math.max(0, s.endsAt - now);
  else if (act === "resume" && s.pausedLeft !== null) Object.assign(s, { endsAt: now + s.pausedLeft, pausedLeft: null });
  else if (act === "break") Object.assign(s, { phase: "break", endsAt: now + t.brk * 60e3, pausedLeft: null });
  else if (act === "reset") Object.assign(s, { phase: "idle", endsAt: null, pausedLeft: null });
}
let audioCtx = null;
function beep() {
  try {
    audioCtx = audioCtx || new AudioContext();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.15, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + 0.6);
  } catch {}
}
/** Hết một phiên: ghi thời gian tập trung (mỗi người một lần mỗi phiên), chuyển sang nghỉ hoặc dừng. */
function timerFinish(t, u, inRoom) {
  const s = t.state;
  if (s.phase === "idle" || s.pausedLeft !== null || s.endsAt > Date.now()) return false;
  const st = ST();
  if (s.phase === "focus") {
    const key = `${t.id}|${s.endsAt}|${u.email}`;
    if (!st.pomo.some((p) => p.key === key)) st.pomo.push({ key, user: u.email, room: inRoom ? t.id : null, minutes: t.focus, t: s.endsAt, course: t.course || "" });
    const ended = s.endsAt;
    Object.assign(s, { phase: "break", endsAt: ended + t.brk * 60e3, pausedLeft: null });
    if (s.endsAt <= Date.now()) Object.assign(s, { phase: "idle", endsAt: null });
    notifyTimer(u, `Xong ${t.focus} phút tập trung. Nghỉ ${t.brk} phút nhé.`);
  } else {
    Object.assign(s, { phase: "idle", endsAt: null, pausedLeft: null });
    notifyTimer(u, "Hết giờ nghỉ, bắt đầu phiên mới khi bạn sẵn sàng.");
  }
  save();
  return true;
}
function notifyTimer(u, text) {
  beep();
  toast(text);
  if (prefsOf(u).browser && "Notification" in window && Notification.permission === "granted") {
    try {
      new Notification("HUSTDOCU", { body: text, icon: "icons/icon-192.png" });
    } catch {}
  }
}
function focusMinutes(email, from) {
  return ST().pomo.filter((p) => p.user === email && p.t >= from).reduce((s, p) => s + p.minutes, 0);
}
function timerHtml(t, canControl) {
  const s = t.state;
  const label = s.phase === "focus" ? "Tập trung" : s.phase === "break" ? "Nghỉ" : "Sẵn sàng";
  const paused = s.pausedLeft !== null && s.phase !== "idle";
  return `<div class="stack" style="gap:10px;align-items:center;text-align:center;border:2px solid var(--line);background:${s.phase === "focus" ? "var(--sheet)" : "var(--wash)"};padding:20px">
   <span class="stamp" style="transform:none">${label}${paused ? ", tạm dừng" : ""}</span>
   <div class="code timer" data-timer="${t.id}" aria-live="off">${fmtLeft(timerLeft(t))}</div>
   <span class="tiny muted">${t.focus} phút tập trung, ${t.brk} phút nghỉ</span>
   ${canControl ? `<div class="row" style="gap:6px;justify-content:center">${s.phase === "idle" ? `<button class="btn primary" type="button" data-t="start">Bắt đầu</button>` : paused ? `<button class="btn primary" type="button" data-t="resume">Tiếp tục</button>` : `<button class="btn" type="button" data-t="pause">Tạm dừng</button>`}${s.phase === "focus" ? `<button class="btn" type="button" data-t="break">Nghỉ ngay</button>` : ""}${s.phase !== "idle" ? `<button class="btn ghost" type="button" data-t="reset">Đặt lại</button>` : ""}</div>` : ""}</div>`;
}
function weekChart(u) {
  const days = Array.from({ length: 7 }, (_, i) => dayStart(Date.now()) - (6 - i) * D6);
  const vals = days.map((d) => ST().pomo.filter((p) => p.user === u.email && p.t >= d && p.t < d + D6).reduce((s, p) => s + p.minutes, 0));
  const max = Math.max(25, ...vals);
  return `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;align-items:end;height:120px" role="img" aria-label="Số phút tập trung 7 ngày qua: ${vals.join(", ")}">${vals.map((v, i) => `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;justify-content:flex-end"><span class="tiny">${v || ""}</span><div style="width:100%;background:${i === 6 ? "var(--stamp)" : "var(--ink)"};height:${Math.round((v / max) * 80)}px;min-height:${v ? 2 : 0}px"></div><span class="tiny muted">${DOW_SHORT[(new Date(days[i]).getDay() + 6) % 7]}</span></div>`).join("")}</div>`;
}
let roomTicker = null;
function startTicker(get, u, inRoom) {
  clearInterval(roomTicker);
  let lastBeat = 0;
  roomTicker = setInterval(() => {
    const t = get();
    const el = t && document.querySelector(`[data-timer="${t.id}"]`);
    if (!el) return clearInterval(roomTicker);
    if (timerFinish(t, u, inRoom)) return render();
    el.textContent = fmtLeft(timerLeft(t));
    document.title = `${fmtLeft(timerLeft(t))} ${t.state.phase === "focus" ? "Tập trung" : t.state.phase === "break" ? "Nghỉ" : ""} | HUSTDOCU`;
    if (inRoom) {
      if (Date.now() - lastBeat > 10e3) {
        lastBeat = Date.now();
        t.presence[u.email] = Date.now();
        save();
      }
      const box = document.querySelector("[data-members]");
      if (box) box.innerHTML = membersHtml(t);
    }
  }, 1000);
}
function membersHtml(t) {
  const now = Date.now();
  const online = Object.entries(t.presence).filter(([, at]) => now - at < 30e3).map(([e]) => e);
  const status = t.state.phase === "focus" && t.state.pausedLeft === null ? "đang tập trung" : t.state.phase === "break" ? "đang nghỉ" : "đang chờ";
  return `<ul class="tb" style="list-style:none;margin:0;padding:0">${online
    .map((e) => `<li style="padding:6px 12px;display:flex;justify-content:space-between;gap:8px"><span><span class="avatar" style="width:24px;height:24px;font-size:11px;display:inline-flex;vertical-align:middle;margin-right:6px">${esc(initials(displayName(userBy(e) || { name: e })))}</span>${esc(displayName(userBy(e) || { name: e }))}${e === me()?.email ? " (bạn)" : ""}</span><span class="tiny muted">${status}</span></li>`)
    .join("")}${t.bots.map((b) => `<li style="padding:6px 12px;display:flex;justify-content:space-between;gap:8px"><span>${esc(b)} <span class="tiny muted">(mô phỏng)</span></span><span class="tiny muted">${status}</span></li>`).join("")}</ul><p class="tiny muted" style="margin:0">${online.length} người đang mở phòng này. Mở trang ở tab khác bằng tài khoản khác để thấy đồng hồ chạy cùng nhau.</p>`;
}
/** get() luôn lấy bản mới nhất: tab khác có thể vừa cập nhật dữ liệu (sự kiện storage nạp lại S). */
function bindTimer(root, get, u) {
  root.querySelectorAll("[data-t]").forEach((b) =>
    b.addEventListener("click", () => {
      const t = get();
      if (!t) return;
      timerAction(t, b.dataset.t);
      if (b.dataset.t === "start") beep();
      save();
      render();
    }),
  );
}
views["/hoc-chung"] = () => {
  const u = me();
  if (!u) return needLogin("/hoc-chung");
  const st = ST();
  const solo = soloOf(u);
  timerFinish(solo, u, false);
  const weekFrom = weekStart(Date.now());
  const html =
    studyHead("Pomodoro và học chung", "chung", `<p class="small muted" style="margin:0">Tuần này bạn đã tập trung <b>${focusMinutes(u.email, weekFrom)} phút</b>. Hôm nay: ${focusMinutes(u.email, dayStart(Date.now()))} phút.</p>`) +
    `<div class="wrap stack" style="padding-block:20px;gap:24px"><div class="two" style="gap:16px;align-items:start">
     <section class="stack" style="gap:12px;min-width:0"><h2 class="h2" style="margin:0">Học một mình</h2>${timerHtml(solo, true)}
      <form class="row" data-form="solo" style="gap:8px"><label class="small" for="sf">Tập trung</label><select class="select" id="sf" style="width:auto">${[25, 45, 50].map((m) => `<option${m === solo.focus ? " selected" : ""}>${m}</option>`).join("")}</select><label class="small" for="sb">Nghỉ</label><select class="select" id="sb" style="width:auto">${[5, 10, 15].map((m) => `<option${m === solo.brk ? " selected" : ""}>${m}</option>`).join("")}</select><span class="small">phút</span></form>
      <h3 class="head" style="margin:8px 0 0;font-size:15px">7 ngày qua (phút)</h3>${weekChart(u)}</section>
     <section class="stack" style="gap:12px;min-width:0"><h2 class="h2" style="margin:0">Phòng học chung</h2>
      <ul class="tb" style="list-style:none;margin:0;padding:0">${st.rooms
        .map((r) => {
          const n = Object.values(r.presence).filter((at) => Date.now() - at < 30e3).length + r.bots.length;
          return `<li><a href="#/hoc-chung/${r.id}" style="display:flex;justify-content:space-between;gap:12px;padding:10px 12px;text-decoration:none;color:var(--ink)"><span style="min-width:0"><b style="font-weight:600">${esc(r.name)}</b><span class="tiny muted" style="display:block">${r.course ? `${r.course}, ` : ""}${r.focus}/${r.brk} phút, ${n} người</span></span><span class="tiny" style="flex-shrink:0">${r.state.phase === "focus" ? "Đang tập trung" : r.state.phase === "break" ? "Đang nghỉ" : "Chờ bắt đầu"}</span></a></li>`;
        })
        .join("")}</ul>
      <form class="stack" data-form="room" style="border:2px solid var(--line);background:var(--sheet);padding:12px 16px;gap:10px"><h3 class="head" style="margin:0;font-size:15px">Tạo phòng</h3>
       <div class="field"><label for="rn">Tên phòng</label><input class="input" id="rn" maxlength="60" placeholder="Ví dụ: Ôn Giải tích tối thứ 5"></div>
       <div style="display:grid;gap:10px;grid-template-columns:repeat(3,minmax(0,1fr))"><div class="field"><label for="rc">Học phần</label><select class="select" id="rc"><option value="">Không gắn</option>${S.courses.map((c) => `<option value="${c.code}">${c.code}</option>`).join("")}</select></div><div class="field"><label for="rf">Tập trung</label><select class="select" id="rf"><option>25</option><option>45</option><option>50</option></select></div><div class="field"><label for="rb">Nghỉ</label><select class="select" id="rb"><option>5</option><option>10</option><option>15</option></select></div></div>
       <div><button class="btn ink" type="submit">Tạo và vào phòng</button></div></form></section></div></div>`;
  return {
    html,
    mount(root) {
      bindTimer(root, () => soloOf(u), u);
      startTicker(() => soloOf(u), u, false);
      root.querySelectorAll('[data-form="solo"] select').forEach((s) =>
        s.addEventListener("change", () => {
          const cur = soloOf(u);
          cur.focus = +root.querySelector("#sf").value;
          cur.brk = +root.querySelector("#sb").value;
          if (cur.state.phase === "idle") render();
          save();
        }),
      );
      root.querySelector('[data-form="room"]').addEventListener("submit", (e) => {
        e.preventDefault();
        const name = root.querySelector("#rn").value.trim();
        if (name.length < 3) return toast("Đặt tên phòng ít nhất 3 ký tự.");
        const r = { id: `r-${uid()}`, name, course: root.querySelector("#rc").value, focus: +root.querySelector("#rf").value, brk: +root.querySelector("#rb").value, owner: u.email, state: { phase: "idle", endsAt: null, pausedLeft: null }, presence: {}, bots: [], notes: [] };
        st.rooms.unshift(r);
        save();
        go(`#/hoc-chung/${r.id}`);
      });
    },
  };
};
views["/hoc-chung/:id"] = ({ id }) => {
  const u = me();
  if (!u) return needLogin(`/hoc-chung/${id}`);
  const st = ST();
  const r = st.rooms.find((x) => x.id === id);
  if (!r) return views.notfound();
  r.presence[u.email] = Date.now();
  timerFinish(r, u, true);
  const weekFrom = weekStart(Date.now());
  const board = [...new Set([...Object.keys(r.presence), u.email])]
    .map((e) => [displayName(userBy(e) || { name: e }), ST().pomo.filter((p) => p.user === e && p.room === r.id && p.t >= weekFrom).reduce((s, p) => s + p.minutes, 0)])
    .concat(r.bots.map((b, i) => [`${b} (mô phỏng)`, 50 + ((i * 37 + r.name.length * 13) % 140)]))
    .sort((a, b) => b[1] - a[1]);
  const html =
    studyHead(esc(r.name), "chung", `<p class="small muted" style="margin:0">${r.course ? `<a href="#/hoc-phan/${r.course}">${r.course} ${esc(course(r.course)?.name || "")}</a>. ` : ""}Đồng hồ chung: ai trong phòng bấm bắt đầu, tạm dừng hay nghỉ thì mọi người cùng thấy. <a href="#/hoc-chung">Về danh sách phòng</a></p>`) +
    `<div class="wrap stack" style="padding-block:20px;gap:24px"><div class="two" style="gap:16px;align-items:start">
     <section class="stack" style="gap:12px;min-width:0">${timerHtml(r, true)}
      <div class="stack" style="gap:6px"><h2 class="h2" style="margin:0">Mục tiêu phiên này</h2><form class="row" data-form="note" style="gap:6px;flex-wrap:nowrap"><label class="sr" for="rnote">Mục tiêu</label><input class="input" id="rnote" maxlength="120" placeholder="Ví dụ: làm xong 5 bài cây AVL"><button class="btn ink" type="submit">Ghi</button></form>
       ${r.notes.length ? `<ul class="tb" style="list-style:none;margin:0;padding:0">${r.notes.slice(-6).reverse().map((n) => `<li style="padding:6px 12px"><b class="small">${esc(displayName(userBy(n.by) || { name: n.by }))}:</b> <span class="small">${esc(n.text)}</span> <span class="tiny muted">${fmtTime(n.t)}</span></li>`).join("")}</ul>` : ""}</div></section>
     <section class="stack" style="gap:12px;min-width:0"><h2 class="h2" style="margin:0">Trong phòng</h2><div data-members>${membersHtml(r)}</div>
      <h2 class="h2" style="margin:8px 0 0">Bảng giờ học tuần này</h2><ol class="tb" style="list-style:none;margin:0;padding:0">${board.map(([n, m], i) => `<li style="padding:6px 12px;display:flex;justify-content:space-between"><span><b class="code" style="font-size:16px;margin-right:8px">${i + 1}</b>${esc(n)}</span><b class="code" style="font-size:16px">${m} phút</b></li>`).join("")}</ol></section></div></div>`;
  return {
    html,
    mount(root) {
      bindTimer(root, () => ST().rooms.find((x) => x.id === id), u);
      startTicker(() => ST().rooms.find((x) => x.id === id), u, true);
      root.querySelector('[data-form="note"]').addEventListener("submit", (e) => {
        e.preventDefault();
        const text = root.querySelector("#rnote").value.trim();
        if (!text) return;
        const room = ST().rooms.find((x) => x.id === id);
        room.notes.push({ by: u.email, text: text.slice(0, 120), t: Date.now() });
        if (room.notes.length > 30) room.notes.shift();
        save();
        render();
      });
    },
  };
};

/* ===================== Tổng quan học tập ===================== */
views["/hoc-tap"] = () => {
  const u = me();
  if (!u) return needLogin("/hoc-tap");
  loadFeed();
  studyTick();
  const now = Date.now();
  const today = occurrences(u, dayStart(now), dayStart(now) + D6).filter((o) => o.e.kind !== "deadline");
  const exams = upcoming(u, "exam", 30);
  const deadlines = upcoming(u, "deadline", 7);
  const due = dueCards(u, "").length;
  const recs = recommend(u, 8);
  const cell = (label, value, href, red) => `<a class="cell" href="${href}" style="text-decoration:none;color:var(--ink)"><span class="l">${label}</span><span class="v code" style="font-size:30px${red ? ";color:var(--stamp)" : ""}">${value}</span></a>`;
  const html =
    studyHead("Học tập", "hub", `<p class="small muted" style="margin:0">Lịch, ôn tập và gợi ý dành riêng cho bạn, dựa trên học phần theo dõi, chương trình đào tạo, lịch thi và những gì bạn hay xem.</p>`) +
    `<div class="wrap stack" style="padding-block:20px;gap:28px">
    <div class="tb" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">${cell("Lớp học hôm nay", today.filter((o) => o.e.kind === "class").length, "#/lich")}${cell(exams.length ? `Thi ${exams[0].e.course}` : "Lịch thi", exams.length ? countdown(exams[0].at).replace("Còn ", "") : "Trống", "#/lich#sap-thi", exams.length && daysUntil(exams[0].at) <= 7)}${cell("Hạn nộp 7 ngày tới", deadlines.length, "#/lich", deadlines.length > 0)}${cell("Flashcard đến hạn", due, "#/flashcard", due > 0)}${cell("Phút tập trung tuần này", focusMinutes(u.email, weekStart(now)), "#/hoc-chung")}</div>
    ${today.length ? `<section class="stack" style="gap:8px"><h2 class="h2" style="margin:0">Hôm nay</h2><ul class="tb" style="list-style:none;margin:0;padding:0">${today.map((o) => `<li style="padding:8px 12px;display:flex;gap:12px"><b class="code" style="font-size:16px;flex-shrink:0">${hm(o.e.start)}</b><span style="min-width:0">${esc(o.e.title)}${o.e.location ? ` <span class="tiny muted">${esc(o.e.location)}</span>` : ""}</span></li>`).join("")}</ul></section>` : ""}
    ${examPanel(u)}
    <section class="stack" style="gap:12px"><h2 class="h2" style="margin:0">Gợi ý tài liệu cho bạn</h2>${recs.length ? recCards(recs) : '<p class="small muted" style="margin:0">Theo dõi vài học phần hoặc xem một số tài liệu để nhận gợi ý.</p>'}<p class="tiny muted" style="margin:0">Gợi ý dựa trên: học phần bạn theo dõi, lịch thi sắp tới, chương trình đào tạo kỳ tới, tài liệu bạn xem và tải gần đây, và những gì người có cùng mối quan tâm đã tải.</p></section>
    <section class="stack" style="gap:8px"><h2 class="h2" style="margin:0">Thông báo mới từ trường</h2>${feedList(null, 6)}</section>
    <section class="stack" style="gap:8px"><h2 class="h2" style="margin:0">Công cụ</h2><div class="cards">${[
      ["#/lich", "Lịch học, lịch thi", "Nhập tay hoặc từ file, nhắc trước kỳ thi và hạn nộp"],
      ["#/xep-lich", "Xếp lịch đăng ký lớp", "Đọc file TKB, xếp tự động không trùng giờ"],
      ["#/ctdt", "Chương trình đào tạo", "Tiến độ tín chỉ, môn nên học kỳ tới"],
      ["#/on-tap", "Ôn tập trắc nghiệm", "Chấm điểm, thống kê điểm mạnh, điểm yếu"],
      ["#/flashcard", "Flashcard", "Lặp lại ngắt quãng theo SM-2"],
      ["#/hoc-chung", "Pomodoro, học chung", "Đếm giờ cùng bạn bè"],
    ].map(([h, t, d]) => `<a class="rec" href="${h}"><b class="head" style="font-size:16px">${t}</b><span class="small muted">${d}</span></a>`).join("")}</div></section>
    </div>`;
  return { html, mount: (root) => mountExamPanel(root, u) };
};

/* Bản dịch tiếng Anh cho giao diện giai đoạn 6 (nội dung học phần, câu hỏi giữ tiếng Việt) */
Object.assign(EN, {
  "Học tập": "Study", "Tổng quan": "Overview", "Lịch": "Calendar", "Xếp lịch": "Planner", "CTĐT": "Curriculum", "Ôn tập": "Practice", "Flashcard": "Flashcards", "Học chung": "Study rooms",
  "Lịch học, lịch thi": "Class and exam calendar", "Lịch học và lịch thi": "Class and exam calendar", "Sắp thi": "Upcoming exams", "Hạn nộp sắp tới": "Upcoming deadlines", "Đã xong": "Done",
  "Ôn trắc nghiệm": "Practice quiz", "Lập kế hoạch ôn": "Plan review", "Tài liệu nên xem trước khi thi": "Read before the exam", "Thêm vào lịch": "Add to calendar", "Thêm": "Add",
  "Lớp học": "Class", "Lịch thi": "Exam", "Hạn nộp": "Deadline", "Ngày": "Date", "Bắt đầu": "Start", "Kết thúc": "End", "Phòng, địa điểm": "Room, place",
  "Nhập, xuất file": "Import, export", "Chọn file": "Choose file", "File TKB mẫu": "Sample timetable", "File lịch thi mẫu": "Sample exam schedule", "Xuất .ics": "Export .ics", "Hoặc dán nội dung": "Or paste content", "Nhắc nhở": "Reminders",
  "Tuần này": "This week", "Trống": "Free", "Xóa khỏi lịch": "Remove from calendar",
  "Xếp lịch đăng ký lớp": "Class registration planner", "1. Danh sách lớp mở": "1. Class list", "2. Học phần muốn đăng ký": "2. Courses to register", "3. Ưu tiên": "3. Preferences",
  "Chọn file TKB": "Choose timetable file", "Tải file mẫu": "Download sample", "Dùng lại dữ liệu mẫu": "Use sample data", "Hoặc dán bảng": "Or paste a table", "Đọc bảng": "Read table",
  "Thêm tất cả": "Add all", "Dồn lịch, ít ngày lên trường": "Compact, fewer days on campus", "Tránh kíp 6:45": "Avoid 6:45 slot", "Tránh học tối": "Avoid evening classes", "Ngày muốn nghỉ hẳn:": "Days off:",
  "Xếp tự động": "Auto-schedule", "Kết quả": "Result", "Số ngày lên trường": "Days on campus", "Ngày nghỉ": "Days off", "Số lớp": "Classes", "Mã lớp": "Class ID", "Thứ": "Day", "Giờ": "Time", "Tuần": "Weeks", "Phòng": "Room",
  "Chép danh sách mã lớp": "Copy class IDs", "Chưa chọn học phần nào.": "No courses selected.",
  "Đã học": "Completed", "Phiên bản": "Version", "Kỳ tới nên học": "Suggested next term", "Xếp lịch cho các môn này": "Plan these courses", "Các học kỳ": "Terms",
  "Đánh dấu môn đã học để tính tiến độ và gợi ý môn kỳ tới.": "Tick completed courses to track progress and get next-term suggestions.",
  "Thông báo mới về CTĐT, đề cương, đăng ký học tập": "New notices on curriculum, syllabi, registration", "Thông báo mới từ trường": "Latest university notices",
  "Ôn tập trắc nghiệm": "Practice quiz", "Số câu": "Questions", "Ưu tiên câu hay sai": "Focus on missed questions", "Điểm mạnh, điểm yếu": "Strengths and weaknesses",
  "Các lượt gần đây": "Recent attempts", "Làm một lượt để xem thống kê.": "Take a quiz to see statistics.", "Bạn đang làm tốt các chủ đề đã luyện.": "You are doing well on practiced topics.", "Ôn câu sai bằng flashcard": "Review missed questions with flashcards",
  "Đến hạn hôm nay": "Due today", "Đã thuộc": "Learned", "Tổng số thẻ": "Total cards", "Lật thẻ": "Flip", "Quên": "Again", "Khó": "Hard", "Nhớ": "Good", "Dễ": "Easy",
  "Tạo thẻ mới": "New card", "Mặt trước": "Front", "Mặt sau": "Back", "Thêm thẻ": "Add card", "Hết thẻ đến hạn hôm nay": "No cards due today",
  "Pomodoro và học chung": "Pomodoro and study rooms", "Học một mình": "Solo", "Phòng học chung": "Study rooms", "Tạo phòng": "Create a room", "Tên phòng": "Room name", "Tập trung": "Focus", "Nghỉ": "Break",
  "Tạo và vào phòng": "Create and join", "Sẵn sàng": "Ready", "Tạm dừng": "Pause", "Tiếp tục": "Resume", "Nghỉ ngay": "Break now", "Đặt lại": "Reset", "7 ngày qua (phút)": "Last 7 days (minutes)",
  "Trong phòng": "In the room", "Bảng giờ học tuần này": "This week's study time", "Mục tiêu phiên này": "Session goal", "Ghi": "Post",
  "Lớp học hôm nay": "Classes today", "Hạn nộp 7 ngày tới": "Deadlines in 7 days", "Flashcard đến hạn": "Cards due", "Phút tập trung tuần này": "Focus minutes this week", "Hôm nay": "Today",
  "Gợi ý cho bạn": "Recommended for you", "Gợi ý tài liệu cho bạn": "Recommended documents", "Công cụ": "Tools", "Ngày mai": "Tomorrow",
});
EN_RX.push(
  [/^Còn (\d+) ngày$/, "$1 days left"],
  [/^Sắp thi (\S+), còn (\d+) ngày$/, "Exam in $1, $2 days left"],
  [/^Bạn theo dõi (\S+)$/, "You follow $1"],
  [/^Vì bạn hay xem (\S+)$/, "Because you often view $1"],
  [/^Phương án (\d+)$/, "Option $1"],
  [/^Học kỳ (\d+)$/, "Term $1"],
  [/^Bạn đúng (\d+)\/(\d+) câu$/, "You got $1/$2 right"],
  [/^Thi ([A-Z]{2,4}\d{4}[A-Z]?)$/, "Exam $1"],
  [/^(\d+) ngày$/, "$1 days"],
);
Object.assign(EN, { "Trong CTĐT kỳ tới của bạn": "In your next-term curriculum", "Đúng Viện của bạn": "From your school", "Người tải tài liệu giống bạn cũng tải": "People with similar downloads also got this" });
