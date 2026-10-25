/* ===================== Giai đoạn 8: kiểm duyệt nâng cao và an toàn nền tảng ===================== */
/* AI hỗ trợ kiểm duyệt (nhãn chất lượng, trùng nội dung, đạo văn, dấu hiệu bản quyền); hàng chờ thông minh và tự duyệt
   theo ngưỡng; cộng tác viên kiểm duyệt; kháng nghị; quy trình gỡ bỏ theo yêu cầu; báo cáo minh bạch. Dữ liệu trong S.mod. */
const D8 = 86400e3;
const MOD_DEFAULTS = { autoApprove: true, minTrust: 2, maxRisk: 20, minQuality: 70, examDays: 21, ctvPairApprove: true, ctvMaxRisk: 40 };
function MD() {
  if (!S.mod) S.mod = seedMod();
  S.mod.settings = { ...MOD_DEFAULTS, ...(S.mod.settings || {}) };
  return S.mod;
}
const SAMPLE_TEXT = {
  net: "Mô hình OSI gồm bảy tầng: vật lý, liên kết dữ liệu, mạng, giao vận, phiên, trình diễn và ứng dụng. Tầng giao vận cung cấp truyền dữ liệu giữa hai tiến trình, với hai giao thức chính là TCP và UDP. TCP thiết lập kết nối bằng bắt tay ba bước gồm SYN, SYN-ACK và ACK, sau đó truyền tin cậy nhờ số thứ tự và báo nhận. UDP không thiết lập kết nối, phù hợp với ứng dụng thời gian thực như gọi thoại và trò chơi trực tuyến. Tầng mạng phụ trách định tuyến gói tin giữa các mạng, địa chỉ IPv4 dài ba mươi hai bit và thường viết dưới dạng bốn số thập phân. Mạng có tiền tố /24 có hai trăm năm mươi tư địa chỉ host dùng được vì phải trừ địa chỉ mạng và địa chỉ quảng bá. DNS phân giải tên miền thành địa chỉ IP, còn DHCP cấp phát địa chỉ IP tự động cho máy trong mạng. ARP ánh xạ địa chỉ IP sang địa chỉ MAC trong cùng một mạng cục bộ.",
  netCopy: "TỔNG HỢP ÔN THI MẠNG MÁY TÍNH. Mô hình OSI gồm bảy tầng: vật lý, liên kết dữ liệu, mạng, giao vận, phiên, trình diễn và ứng dụng. Tầng giao vận cung cấp truyền dữ liệu giữa hai tiến trình, với hai giao thức chính là TCP và UDP. TCP thiết lập kết nối bằng bắt tay ba bước gồm SYN, SYN-ACK và ACK, sau đó truyền tin cậy nhờ số thứ tự và báo nhận. UDP không thiết lập kết nối, phù hợp với ứng dụng thời gian thực như gọi thoại và trò chơi trực tuyến. DNS phân giải tên miền thành địa chỉ IP, còn DHCP cấp phát địa chỉ IP tự động cho máy trong mạng. Tải bản đầy đủ tại bit.ly/onthi-mmt hoặc tailieu123.example.com, nhắn Zalo để mua đề có đáp án.",
  ctdl: "Đề thi cuối kỳ Cấu trúc dữ liệu và giải thuật, thời gian chín mươi phút, được dùng một tờ A4 viết tay. Câu 1: cài đặt danh sách liên kết đơn và viết hàm đảo ngược danh sách trong thời gian tuyến tính, không dùng thêm bộ nhớ. Câu 2: dùng ngăn xếp kiểm tra một xâu ngoặc có hợp lệ hay không, phân tích độ phức tạp. Câu 3: chèn lần lượt các khóa 30, 20, 10, 25, 28, 40 vào cây AVL rỗng, vẽ cây sau mỗi lần quay. Câu 4: cho đồ thị có trọng số, chạy thuật toán Dijkstra từ đỉnh A và lập bảng khoảng cách sau mỗi bước. Đáp án và thang điểm: câu 1 hai điểm, câu 2 hai điểm, câu 3 ba điểm, câu 4 ba điểm. Lời giải chi tiết ở trang cuối.",
  book: "GIÁO TRÌNH GIẢI TÍCH 1. © 2019 Nhà xuất bản ABC (mẫu). Bản quyền thuộc tác giả và nhà xuất bản. ISBN 978-604-00-0000-0. Không được sao chép, phát tán dưới mọi hình thức khi chưa được sự đồng ý bằng văn bản. Chương 1: Giới hạn và liên tục. Định nghĩa giới hạn của dãy số, các định lý về giới hạn, giới hạn hàm số, hàm số liên tục và các tính chất của hàm liên tục trên đoạn đóng. Chương 2: Đạo hàm và vi phân, quy tắc L'Hôpital, khai triển Taylor.",
};
function seedMod() {
  const now = Date.now();
  const em = (u) => `${u}@sis.hust.edu.vn`;
  const md = { settings: { ...MOD_DEFAULTS }, recs: [], applications: [], appeals: [], takedowns: [], autoLog: [] };
  // Gán nội dung chữ thật cho vài tài liệu để demo phát hiện trùng nội dung, đạo văn, bản quyền
  const net = S.docs.find((d) => d.status === "APPROVED" && d.course === "IT3080");
  if (net) net.text = SAMPLE_TEXT.net;
  for (const d of S.docs.filter((x) => x.status === "PENDING_REVIEW")) {
    if (d.course === "IT3080") d.text = SAMPLE_TEXT.netCopy;
    if (d.course === "IT3011") d.text = SAMPLE_TEXT.ctdl;
  }
  if (!S.docs.some((d) => d.id === "p-book")) {
    S.docs.push({ id: "p-book", slug: "giao-trinh-giai-tich-1-ban-scan-p8", title: "Giáo trình Giải tích 1 (bản scan đầy đủ)", description: "Scan nguyên cuốn giáo trình cho các bạn K70.", type: "TEXTBOOK", status: "PENDING_REVIEW", course: "MI1111", term: "20251", uploader: em("pham.ngoc.mai"), kind: "PDF", sizeKb: 48200, pages: 286, downloads: 0, views: 0, ratingCount: 0, ratingSum: 0, publishedAt: null, createdAt: now - 20 * 3600e3, anonymous: false, tags: ["giáo trình"], risk: 35, text: SAMPLE_TEXT.book, checks: { format: { s: "pass", d: "PDF, khớp đuôi file" }, duplicate: { s: "pass", d: "Không có bản trùng SHA-256" }, virus: { s: "pass", d: "Không phát hiện mã độc" }, integrity: { s: "pass", d: "286 trang, mở được" }, content: { s: "pass", d: "Điểm rủi ro 35/100", reasons: ["Tài liệu rất dài"] } }, logs: [{ t: now - 20 * 3600e3 + 60e3, a: "AUTO_CHECK_PASSED", meta: "Điểm rủi ro 35" }] });
  }
  // Tài liệu mẫu có thời điểm gửi trùng thời điểm duyệt: lùi thời điểm gửi vài giờ để báo cáo thời gian duyệt có nghĩa
  S.docs.forEach((d, i) => {
    if (d.status === "APPROVED" && d.publishedAt && d.createdAt >= d.publishedAt) {
      d.createdAt = d.publishedAt - (3 + ((i * 17) % 50)) * 3600e3;
      (d.logs || []).forEach((l) => l.a === "AUTO_CHECK_PASSED" && (l.t = d.createdAt + 60e3));
    }
  });
  // Lịch sử từ chối, gỡ (dữ liệu mẫu) cho báo cáo minh bạch
  const hist = [["Ảnh chụp mờ đề giữa kỳ Vật lý", "PH1110", "REJECT", "File mờ, thiếu trang"], ["Tài liệu tổng hợp (link ngoài)", "IT3040", "REJECT", "Chứa liên kết bán tài liệu"], ["Đề cương bản cũ", "SSH1111", "REQUEST_CHANGES", "Sai học kỳ"], ["Slide copy từ trang khác", "IT3090", "REJECT", "Trùng tài liệu đã có"], ["Bài giải sai đáp án", "MI1121", "REQUEST_CHANGES", "Đáp án câu 3 sai"], ["Giáo trình scan nguyên cuốn", "CH1012", "REJECT", "Vi phạm bản quyền sách in"]];
  hist.forEach(([title, c, a, reason], i) => {
    const t = now - (8 + i * 23) * D8;
    S.docs.push({ id: `h${i}`, slug: `lich-su-${i}`, title, description: "", type: "NOTES", status: a === "REJECT" ? "REJECTED" : "CHANGES_REQUESTED", course: c, term: null, uploader: em(["tran.duc.anh", "pham.ngoc.mai", "le.minh.quan"][i % 3]), kind: "PDF", sizeKb: 900, pages: 2, downloads: 0, views: 0, ratingCount: 0, ratingSum: 0, publishedAt: null, createdAt: t, reviewNote: reason, tags: [], risk: 40, checks: {}, logs: [{ t: t + (5 + i * 7) * 3600e3, a, by: "kdv.demo@hust.edu.vn", reason }, { t: t + 60e3, a: "AUTO_CHECK_PASSED" }] });
  });
  // Nguyễn Thu Hà là cộng tác viên kiểm duyệt (sinh viên tình nguyện) với lịch sử đề xuất
  const ha = userBy(em("nguyen.thu.ha"));
  if (ha && !ha.roles.some((r) => r.key === "VOLUNTEER")) ha.roles.push({ key: "VOLUNTEER", faculty: "SOICT" });
  const pastDocs = S.docs.filter((d) => d.status === "APPROVED").slice(0, 24);
  pastDocs.forEach((d, i) => md.recs.push({ id: uid(), doc: d.id, by: em("nguyen.thu.ha"), rec: i % 9 === 4 ? "REJECT" : "APPROVE", reason: "", t: now - (i + 2) * D8, final: "APPROVE", agree: i % 9 !== 4 }));
  md.applications.push({ id: uid(), by: em("tran.duc.anh"), faculties: ["SOICT"], motivation: "Em muốn giúp kho tài liệu sạch hơn, đặc biệt các môn chuyên ngành CNTT năm 2, 3.", hours: 3, t: now - 2 * D8, status: "OPEN" });
  // Một yêu cầu gỡ bỏ đang xử lý (để xem quy trình)
  const victim = S.docs.find((d) => d.status === "APPROVED" && d.type === "SLIDE");
  if (victim)
    md.takedowns.push({ id: "GB-0001", doc: victim.id, claimant: { name: "TS. Nguyễn Văn A (mẫu)", email: "nguyenvana@hust.edu.vn", role: "Giảng viên, tác giả slide", org: "Trường CNTT&TT" }, verified: true, details: "Slide bài giảng do tôi biên soạn, chỉ phát cho lớp trên hệ thống học tập của trường, không đồng ý đăng công khai.", evidence: "https://example.com/bai-giang", status: "REVIEWING", t: now - 26 * 3600e3, timeline: [{ t: now - 26 * 3600e3, by: "Người yêu cầu", action: "Gửi yêu cầu", note: "Email @hust.edu.vn đã xác minh" }, { t: now - 20 * 3600e3, by: "kdv.demo@hust.edu.vn", action: "Bắt đầu xem xét", note: "Đối chiếu với trang môn học" }] });
  return md;
}
const isCtv = (u) => !!u?.roles?.some((r) => r.key === "VOLUNTEER");

/* ----- Trích chữ PDF (pdf.js nạp khi cần) ----- */
let pdfjsLoading = null;
function loadPdfjs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  pdfjsLoading =
    pdfjsLoading ||
    new Promise((ok, fail) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      s.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        ok(window.pdfjsLib);
      };
      s.onerror = () => fail(new Error("Không tải được pdf.js"));
      document.head.appendChild(s);
    });
  return pdfjsLoading;
}
async function extractPdfText(blob, maxPages = 30) {
  try {
    const lib = await loadPdfjs();
    const pdf = await lib.getDocument({ data: await blob.arrayBuffer() }).promise;
    const parts = [];
    for (let i = 1; i <= Math.min(pdf.numPages, maxPages); i++) {
      const page = await pdf.getPage(i);
      const c = await page.getTextContent();
      parts.push(c.items.map((x) => x.str).join(" "));
    }
    return { text: parts.join("\n"), pages: pdf.numPages };
  } catch {
    return { text: "", pages: null };
  }
}

/* ----- Phân tích ----- */
function docText(d) {
  if (d.text) return d.text;
  if (d.uploaded) return "";
  return "";
}
function words(text) {
  return norm(text)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1);
}
function shingles(text, k = 3) {
  const w = words(text);
  const set = new Set();
  for (let i = 0; i + k <= w.length; i++) set.add(w.slice(i, i + k).join(" "));
  return set;
}
function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}
function sentences(text) {
  return text
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => words(s).length >= 8);
}
const COPYRIGHT_SIGNALS = [
  [/©|\(c\)\s*\d{4}|copyright|all rights reserved/i, 30, "Có ký hiệu hoặc câu khẳng định bản quyền"],
  [/bản quyền thuộc|giữ bản quyền/i, 25, "Ghi “bản quyền thuộc” tác giả hoặc đơn vị khác"],
  [/nhà xuất bản|\bnxb\b|isbn/i, 25, "Có thông tin nhà xuất bản hoặc mã ISBN (sách in)"],
  [/không được (sao chép|phát tán|in ấn)|cấm sao chép/i, 20, "Có lời cấm sao chép, phát tán"],
  [/lưu hành nội bộ/i, 15, "Ghi “lưu hành nội bộ”"],
  [/studocu|scribd|chegg|coursehero|123doc|tailieu\.vn|tailieu123/i, 20, "Có dấu vết từ trang chia sẻ tài liệu khác"],
  [/bản scan|scan nguyên cuốn|nguyên cuốn|toàn bộ giáo trình/i, 15, "Có vẻ là bản sao nguyên cuốn sách, giáo trình"],
];
/**
 * Phân tích một tài liệu (chạy trên trình duyệt, không gửi dữ liệu đi đâu):
 * - nhãn chất lượng: số trang, độ dài chữ, tiêu đề và mô tả đủ ý, đề thi có đáp án, rủi ro thấp;
 * - trùng nội dung: độ giống Jaccard trên cụm 3 từ đã bỏ dấu, ngưỡng 0,6;
 * - đạo văn: tỉ lệ câu (từ 8 từ trở lên) trùng nguyên văn với tài liệu khác, ngưỡng 30%;
 * - dấu hiệu bản quyền: các mẫu câu trong COPYRIGHT_SIGNALS và tiêu đề, loại tài liệu.
 * Chỉ so với tài liệu có chữ thật (file tải lên đã trích chữ, hoặc tài liệu mẫu được gán nội dung).
 */
function analyzeDoc(d) {
  const text = docText(d);
  const meta = `${d.title} ${d.description || ""}`;
  // Chất lượng
  let q = 40;
  const qr = [];
  const pages = d.pages || 0;
  if (pages >= 3) (q += 10), qr.push(`${pages} trang`);
  else qr.push("Ít trang");
  if (text) {
    const n = words(text).length;
    if (n >= 120) (q += 15), qr.push(`${n} từ nội dung`);
    else (q -= 10), qr.push("Nội dung chữ ngắn");
  } else if (d.uploaded) qr.push("Không trích được chữ (có thể là ảnh scan)");
  else q += 10;
  if (/[A-Z]{2,4}\d{4}|\b20\d{3}\b|giữa kỳ|cuối kỳ|chương/i.test(d.title)) (q += 10), qr.push("Tiêu đề rõ học phần, kỳ hoặc chương");
  if ((d.description || "").length >= 30) (q += 5), qr.push("Có mô tả");
  if (d.type?.startsWith("EXAM") && /đáp án|lời giải|thang điểm/i.test(`${meta} ${text}`)) (q += 10), qr.push("Đề thi có đáp án");
  if ((d.risk || 0) >= 60) (q -= 20), qr.push("Điểm rủi ro cao");
  q = Math.max(0, Math.min(100, q));
  const quality = { score: q, label: q >= 70 ? "Tốt" : q >= 50 ? "Khá" : "Cần xem kỹ", reasons: qr };
  // Trùng nội dung và đạo văn
  const dup = [];
  const plag = [];
  if (text) {
    const sh = shingles(text);
    const mine = sentences(text);
    const normS = (s) => words(s).join(" ");
    for (const o of S.docs) {
      if (o.id === d.id || !["APPROVED", "PENDING_REVIEW"].includes(o.status)) continue;
      const ot = docText(o);
      if (!ot) continue;
      const sim = jaccard(sh, shingles(ot));
      if (sim >= 0.6) dup.push({ doc: o.id, sim });
      const theirs = new Set(sentences(ot).map(normS));
      const hit = mine.filter((s) => theirs.has(normS(s)));
      const ratio = mine.length ? hit.length / mine.length : 0;
      if (ratio >= 0.3) plag.push({ doc: o.id, ratio, samples: hit.slice(0, 2) });
    }
    dup.sort((a, b) => b.sim - a.sim);
    plag.sort((a, b) => b.ratio - a.ratio);
  }
  // Bản quyền
  let cs = 0;
  const signals = [];
  for (const [re, w, why] of COPYRIGHT_SIGNALS)
    if (re.test(`${meta} ${text}`)) {
      cs += w;
      signals.push(why);
    }
  if (d.type === "TEXTBOOK" && pages >= 150) (cs += 20), signals.push(`Giáo trình ${pages} trang, nhiều khả năng là sách in`);
  const copyright = { score: Math.min(100, cs), level: cs >= 50 ? "Cao" : cs >= 25 ? "Trung bình" : "Thấp", signals };
  const flags = [];
  if (dup.length) flags.push("Trùng nội dung");
  if (plag.length) flags.push("Nghi đạo văn");
  if (copyright.level !== "Thấp") flags.push(`Bản quyền: ${copyright.level.toLowerCase()}`);
  if (quality.label === "Cần xem kỹ") flags.push("Chất lượng thấp");
  d.ai = { t: Date.now(), quality, dup, plag, copyright, flags, claude: d.ai?.claude || null };
  return d.ai;
}
function aiOf(d) {
  return d.ai && Date.now() - d.ai.t < 6 * 3600e3 ? d.ai : analyzeDoc(d);
}
/** Nhận xét thêm bằng Claude (khi người dùng đã thêm khóa API ở Trợ lý AI). */
async function claudeReview(d) {
  const st = aiSettings();
  if (!st.key) throw new Error("Chưa có khóa API Claude. Thêm ở trang Trợ lý AI.");
  const text = (docText(d) || docContent(d).flat().join(" ")).slice(0, 6000);
  const raw = await callClaude(
    "Bạn hỗ trợ kiểm duyệt tài liệu học tập của sinh viên Đại học Bách khoa Hà Nội. Chỉ trả về JSON hợp lệ, không thêm chữ nào khác.",
    `Đánh giá tài liệu sau. Trả về JSON {"chat_luong":"Tốt|Khá|Kém","nhan_xet":"1-2 câu","ban_quyen":"Thấp|Trung bình|Cao","ly_do_ban_quyen":"1 câu","de_xuat":"Duyệt|Yêu cầu sửa|Từ chối"}.\n\nTiêu đề: ${d.title}\nLoại: ${TYPES[d.type]}\nMô tả: ${d.description || ""}\nNội dung (trích): ${text}`,
    600,
  );
  const j = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
  d.ai = { ...aiOf(d), claude: { ...j, t: Date.now() } };
  save();
  return j;
}

/* ----- Hàng chờ thông minh ----- */
function examDaysFor(code) {
  let best = null;
  const now = Date.now();
  for (const e of S.study?.events || []) {
    if (e.kind !== "exam" || e.course !== code || !e.date) continue;
    const days = Math.round((Date.parse(e.date) - now) / D8);
    if (days >= 0 && (best === null || days < best)) best = days;
  }
  return best;
}
/** Độ ưu tiên = uy tín người đăng + học phần sắp thi + thời gian chờ + số người theo dõi + rủi ro thấp. */
function smartPriority(d) {
  const set = MD().settings;
  const up = userBy(d.uploader);
  const why = [];
  let p = (up?.trust || 0) * 8;
  if ((up?.trust || 0) >= 2) why.push("Người đăng uy tín");
  const ex = examDaysFor(d.course);
  if (ex !== null && ex <= set.examDays) {
    p += Math.round(40 * (1 - ex / (set.examDays + 1)));
    why.push(`Sắp thi ${d.course}, còn ${ex} ngày`);
  } else if (typeof currentEvent === "function" && currentEvent() && ((currentEvent().id.startsWith("gk") && d.type === "EXAM_MIDTERM") || (currentEvent().id.startsWith("ck") && d.type === "EXAM_FINAL"))) {
    p += 20;
    why.push("Đề thi đúng mùa thi");
  }
  const hours = (Date.now() - d.createdAt) / 3600e3;
  p += Math.min(20, Math.round(hours / 3));
  if (hours >= 48) why.push(`Chờ ${Math.round(hours / 24)} ngày`);
  const followers = Object.values(S.follows).filter((l) => l.includes(d.course)).length;
  p += Math.min(10, followers * 2);
  if (followers >= 2) why.push(`${followers} người theo dõi học phần`);
  if ((d.risk || 0) < 20) p += 5;
  d.priority = p;
  d.priorityWhy = why;
  return p;
}
/** Đủ điều kiện tự duyệt: người đăng đủ uy tín, rủi ro thấp, chất lượng tốt, không cờ trùng, đạo văn, bản quyền. */
function autoEligible(d) {
  const set = MD().settings;
  const up = userBy(d.uploader);
  const ai = aiOf(d);
  const why = [];
  if ((up?.trust || 0) < set.minTrust) why.push(`bậc uy tín ${up?.trust || 0} < ${set.minTrust}`);
  if ((d.risk || 0) > set.maxRisk) why.push(`rủi ro ${d.risk} > ${set.maxRisk}`);
  if (ai.quality.score < set.minQuality) why.push(`chất lượng ${ai.quality.score} < ${set.minQuality}`);
  if (ai.flags.some((f) => f !== "Chất lượng thấp")) why.push(ai.flags.join(", ").toLowerCase());
  if (up?.violations) why.push("người đăng từng bị gỡ tài liệu");
  if (typeof crSet === "function" && S.credits?.locked?.[d.uploader]) why.push("tài khoản đang bị khóa thưởng");
  return { ok: !why.length, why };
}
/** Duyệt không qua người (tự duyệt theo ngưỡng hoặc hai cộng tác viên cùng đề xuất), ghi rõ trong nhật ký. */
function systemApprove(d, how) {
  if (d.status !== "PENDING_REVIEW") return false;
  d.status = "APPROVED";
  d.reviewNote = null;
  d.publishedAt = Date.now();
  d.logs.unshift({ t: Date.now(), a: "AUTO_APPROVE", reason: how });
  const credits = typeof crReward === "function" ? crReward(d, "hệ thống") : 0;
  if (typeof cmApproved === "function") cmApproved(d);
  const up = userBy(d.uploader);
  if (up) {
    up.approved++;
    up.reputation += 10;
    up.trust = trustFrom(up.approved, up.violations || 0);
    checkBadges(up);
  }
  for (const [email, list] of Object.entries(S.follows)) if (list.includes(d.course) && email !== d.uploader) S.notifications.unshift({ id: uid(), to: email, type: "NEW_DOCUMENT_IN_FOLLOWED_COURSE", title: d.title, link: `#/tai-lieu/${d.slug}`, t: Date.now(), read: false });
  notify(d.uploader, "DOCUMENT_APPROVED", d, { credits, link: `#/tai-lieu/${d.slug}`, reason: how });
  MD().autoLog.push({ doc: d.id, how, t: Date.now() });
  return true;
}
/** Gọi sau khi tài liệu qua kiểm tra tự động lúc tải lên: trích chữ, phân tích, tự duyệt nếu đủ ngưỡng. */
async function modAfterUpload(d, file, u) {
  if (d.kind === "PDF" && file) {
    toast("Đang trích chữ và phân tích nội dung…");
    const r = await Promise.race([extractPdfText(file), new Promise((ok) => setTimeout(() => ok({ text: "", pages: null }), 8000))]);
    if (r.text) d.text = r.text.slice(0, 200000);
    if (r.pages) d.pages = r.pages;
  }
  const ai = analyzeDoc(d);
  if (ai.dup.length || ai.plag.length) {
    d.checks = d.checks || {};
    d.checks.similar = { s: "warn", d: ai.dup.length ? `Giống ${Math.round(ai.dup[0].sim * 100)}% “${S.docs.find((x) => x.id === ai.dup[0].doc)?.title}”` : `${Math.round(ai.plag[0].ratio * 100)}% câu trùng với “${S.docs.find((x) => x.id === ai.plag[0].doc)?.title}”` };
  }
  if (d.status === "PENDING_REVIEW" && !isMod(u) && MD().settings.autoApprove && autoEligible(d).ok) systemApprove(d, "Tự duyệt: người đăng uy tín, rủi ro thấp, chất lượng tốt, không có cờ AI");
}

/* ===================== Giao diện kiểm duyệt mở rộng ===================== */
function aiPanel(d, u) {
  const ai = aiOf(d);
  const docT = (id) => S.docs.find((x) => x.id === id);
  const link = (o) => (isMod(u) && o.status === "PENDING_REVIEW" ? `#/kiem-duyet/${o.id}` : `#/tai-lieu/${o.slug}`);
  const lv = { Tốt: "low", Khá: "medium", "Cần xem kỹ": "high" }[ai.quality.label];
  return `<section class="stack" data-aipanel style="gap:6px"><div class="row" style="justify-content:space-between;align-items:center"><h3 class="head small" style="margin:0">AI hỗ trợ kiểm duyệt</h3><span class="row" style="gap:4px"><button class="btn sm ghost" type="button" data-reai>Phân tích lại</button><button class="btn sm" type="button" data-claude>Hỏi Claude</button></span></div>
   <div class="tb" style="grid-template-columns:minmax(0,1fr)">
    <div style="padding:8px 12px"><b class="small">Chất lượng: </b><span class="risk-${lv}" style="padding:1px 6px;font-weight:700">${ai.quality.label} ${ai.quality.score}/100</span><span class="tiny muted" style="display:block">${ai.quality.reasons.map(esc).join("; ")}</span></div>
    <div style="padding:8px 12px"><b class="small">Trùng nội dung: </b>${ai.dup.length ? ai.dup.slice(0, 3).map((x) => `<a href="${link(docT(x.doc))}">${esc(docT(x.doc)?.title || "")}</a> <b style="color:var(--stamp)">${Math.round(x.sim * 100)}%</b>`).join(", ") : '<span class="small">Không thấy tài liệu giống quá 60%</span>'}</div>
    <div style="padding:8px 12px"><b class="small">Đạo văn: </b>${ai.plag.length ? ai.plag.slice(0, 2).map((x) => `<span class="small"><b style="color:var(--stamp)">${Math.round(x.ratio * 100)}% câu</b> trùng với <a href="${link(docT(x.doc))}">${esc(docT(x.doc)?.title || "")}</a></span>${x.samples.map((s) => `<blockquote class="tiny" style="margin:4px 0 0;border-left:3px solid var(--stamp);padding-left:8px">“${esc(s.slice(0, 180))}”</blockquote>`).join("")}`).join("") : `<span class="small">${docText(d) ? "Không thấy câu trùng nguyên văn đáng kể" : "Chưa có nội dung chữ để so"}</span>`}</div>
    <div style="padding:8px 12px"><b class="small">Bản quyền: </b><span class="risk-${{ Thấp: "low", "Trung bình": "medium", Cao: "high" }[ai.copyright.level]}" style="padding:1px 6px;font-weight:700">${ai.copyright.level}</span>${ai.copyright.signals.length ? `<ul class="tiny" style="margin:4px 0 0;padding-left:18px">${ai.copyright.signals.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</div>
    ${ai.claude ? `<div style="padding:8px 12px;background:var(--wash)"><b class="small">Claude:</b> <span class="small">chất lượng ${esc(ai.claude.chat_luong)}, bản quyền ${esc(ai.claude.ban_quyen)}, đề xuất <b>${esc(ai.claude.de_xuat)}</b>. ${esc(ai.claude.nhan_xet || "")} ${esc(ai.claude.ly_do_ban_quyen || "")}</span></div>` : ""}
   </div><p class="tiny muted" style="margin:0">AI chỉ gợi ý, người kiểm duyệt quyết định. Phân tích chạy ngay trên trình duyệt; “Hỏi Claude” gửi tiêu đề và đoạn trích tới Claude bằng khóa API của bạn.</p></section>`;
}
function mountAiPanel(root, d) {
  root.querySelector("[data-reai]")?.addEventListener("click", () => {
    analyzeDoc(d);
    save();
    render();
  });
  root.querySelector("[data-claude]")?.addEventListener("click", async (e) => {
    e.target.disabled = true;
    e.target.textContent = tr("Đang hỏi…");
    try {
      await claudeReview(d);
      render();
    } catch (err) {
      toast(err.message);
      e.target.disabled = false;
      e.target.textContent = tr("Hỏi Claude");
    }
  });
}
function recsHtml(d) {
  const recs = MD().recs.filter((r) => r.doc === d.id && !r.final);
  if (!recs.length) return "";
  const L = { APPROVE: "Duyệt", REJECT: "Từ chối", REQUEST_CHANGES: "Yêu cầu sửa" };
  return `<section class="stack" style="gap:6px"><h3 class="head small" style="margin:0">Đề xuất của cộng tác viên</h3><ul class="tb" style="list-style:none;margin:0;padding:0">${recs.map((r) => `<li style="padding:6px 12px"><b>${L[r.rec]}</b> <span class="tiny muted">${esc(displayName(userBy(r.by) || { name: r.by }))}, đúng ${Math.round(ctvStats(r.by).rate * 100)}% trước đây, ${fmtTime(r.t)}</span>${r.reason ? `<span class="small" style="display:block">${esc(r.reason)}</span>` : ""}</li>`).join("")}</ul></section>`;
}
// Hàng chờ: tính lại độ ưu tiên thông minh và gắn nhãn AI, lý do ưu tiên, khả năng tự duyệt
const _queueView = views["/kiem-duyet"];
views["/kiem-duyet"] = () => {
  MD();
  S.docs.filter((d) => d.status === "PENDING_REVIEW").forEach(smartPriority);
  const out = _queueView();
  const mount0 = out.mount;
  const u = me();
  const eligible = S.docs.filter((d) => d.status === "PENDING_REVIEW" && canModerate(u, d) && autoEligible(d).ok);
  out.html = out.html.replace('<div class="stack">', `<div class="stack">${eligible.length && isAdmin(u) ? `<p class="note" style="margin:0">${eligible.length} tài liệu đủ điều kiện tự duyệt theo ngưỡng hiện tại. <button class="btn sm ink" type="button" data-autoall>Tự duyệt ${eligible.length} tài liệu</button></p>` : ""}<p class="tiny muted" style="margin:0">Xếp theo độ ưu tiên: học phần sắp thi, người đăng uy tín, thời gian chờ, số người theo dõi. <a href="#/kiem-duyet/cai-dat">Cài đặt</a></p>`);
  out.mount = (root) => {
    mount0?.(root);
    for (const d of S.docs.filter((x) => x.status === "PENDING_REVIEW")) {
      const a = root.querySelector(`a[href="#/kiem-duyet/${d.id}"]`);
      if (!a) continue;
      const ai = aiOf(d);
      const chips = [`<span class="why" style="border-color:var(--line);color:var(--ink)">AI: ${ai.quality.label}</span>`, ...ai.flags.filter((f) => f !== "Chất lượng thấp").map((f) => `<span class="why">${esc(f)}</span>`), ...(d.priorityWhy || []).map((w) => `<span class="why" style="border-color:var(--pencil);color:var(--pencil)">${esc(w)}</span>`)];
      if (autoEligible(d).ok) chips.push('<span class="why" style="border-color:var(--ink);color:var(--ink)">Đủ điều kiện tự duyệt</span>');
      if (MD().recs.some((r) => r.doc === d.id && !r.final)) chips.push('<span class="why" style="border-color:var(--ink);color:var(--ink)">Có đề xuất CTV</span>');
      a.insertAdjacentHTML("beforeend", `<span class="row" style="gap:4px">${chips.join("")}</span>`);
    }
    root.querySelector("[data-autoall]")?.addEventListener("click", () => {
      const n = eligible.filter((d) => systemApprove(d, `Tự duyệt theo ngưỡng (bấm bởi ${displayName(u)})`)).length;
      save();
      toast(`Đã tự duyệt ${n} tài liệu.`);
      render();
    });
    translateTree(root);
  };
  return out;
};
// Chi tiết: thêm bảng AI, đề xuất CTV
const _detailView = views["/kiem-duyet/:id"];
views["/kiem-duyet/:id"] = (args) => {
  MD();
  const out = _detailView(args);
  const d = S.docs.find((x) => x.id === args.id);
  if (!d || !out.html.includes("Kiểm tra tự động")) return out;
  const mount0 = out.mount;
  out.html = out.html.replace('<section><h3 class="head small" style="margin-bottom:4px">Kiểm tra tự động</h3>', `${aiPanel(d, me())}${recsHtml(d)}<section><h3 class="head small" style="margin-bottom:4px">Kiểm tra tự động</h3>`);
  out.mount = (root) => {
    mount0?.(root);
    mountAiPanel(root, d);
  };
  return out;
};
// Khi kiểm duyệt viên quyết định: chấm đề xuất của cộng tác viên (đúng nếu trùng quyết định cuối)
const _decide = decide;
decide = function (ids, decision, reason, note) {
  const n = _decide(ids, decision, reason, note);
  for (const id of ids) resolveRecs(id, decision);
  save();
  return n;
};
function resolveRecs(docId, decision) {
  for (const r of MD().recs.filter((x) => x.doc === docId && !x.final)) {
    r.final = decision;
    r.agree = r.rec === decision;
    const s = ctvStats(r.by);
    const cu = userBy(r.by);
    // Tự tạm dừng khi độ chính xác thấp
    if (cu && s.resolved >= 10 && s.rate < 0.6 && !cu.ctvPaused) {
      cu.ctvPaused = true;
      S.notifications.unshift({ id: uid(), to: r.by, type: "SPACE", title: "Quyền cộng tác viên kiểm duyệt tạm dừng vì tỉ lệ đề xuất đúng dưới 60%. Liên hệ kiểm duyệt viên để được hướng dẫn thêm.", link: "#/cong-tac-vien", t: Date.now(), read: false });
    }
  }
}

/* ===================== Cộng tác viên kiểm duyệt ===================== */
function ctvStats(email) {
  const list = MD().recs.filter((r) => r.by === email);
  const resolved = list.filter((r) => r.final);
  const agree = resolved.filter((r) => r.agree).length;
  return { total: list.length, resolved: resolved.length, agree, rate: resolved.length ? agree / resolved.length : 0, open: list.length - resolved.length };
}
function ctvFaculties(u) {
  return u.roles.filter((r) => r.key === "VOLUNTEER").map((r) => r.faculty);
}
function ctvQueue(u) {
  const set = MD().settings;
  const facs = ctvFaculties(u);
  return S.docs.filter((d) => d.status === "PENDING_REVIEW" && d.uploader !== u.email && facs.includes(course(d.course)?.faculty) && (d.risk || 0) <= set.ctvMaxRisk && aiOf(d).copyright.level !== "Cao" && !MD().recs.some((r) => r.doc === d.id && r.by === u.email));
}
views["/cong-tac-vien"] = () => {
  const u = me();
  const md = MD();
  const mine = u && md.applications.find((a) => a.by === u.email && a.status === "OPEN");
  const ctv = isCtv(u);
  const s = u ? ctvStats(u.email) : null;
  const req = u ? [[(u.trust || 0) >= 1, "Bậc uy tín từ 1"], [(u.approved || 0) >= 3, "Có từ 3 tài liệu được duyệt"], [!(u.violations || 0), "Chưa từng bị gỡ tài liệu vì vi phạm"]] : [];
  const okAll = req.every((r) => r[0]);
  return {
    html:
      pageHead("Cộng tác viên kiểm duyệt", "Chương trình sinh viên tình nguyện", "") +
      `<div class="wrap stack" style="max-width:860px;padding-block:24px;gap:20px">
      <section class="stack" style="gap:8px"><h2 class="h2" style="margin:0">Cộng tác viên làm gì</h2><ul style="margin:0;padding-left:20px;line-height:1.7"><li>Xem tài liệu chờ duyệt <b>rủi ro thấp</b> thuộc Viện mình, đề xuất Duyệt, Yêu cầu sửa hoặc Từ chối.</li><li>Đề xuất không có hiệu lực ngay: kiểm duyệt viên xem và quyết định. Khi bật cài đặt, hai cộng tác viên cùng đề xuất duyệt một tài liệu rủi ro thấp, không có cờ AI thì tài liệu được tự duyệt.</li><li>Không thấy tài liệu có dấu hiệu bản quyền cao, không gỡ tài liệu, không xử lý báo cáo hay yêu cầu gỡ bỏ.</li><li>Chất lượng được đo bằng tỉ lệ đề xuất trùng quyết định cuối. Dưới 60% (sau 10 đề xuất) thì tạm dừng quyền; từ 90% (sau 30 đề xuất) được ưu tiên xét làm kiểm duyệt viên.</li></ul></section>
      ${!u ? `<p class="note" style="margin:0"><a href="#/dang-nhap?next=%2Fcong-tac-vien">Đăng nhập</a> để đăng ký.</p>` : ctv ? `<section class="stack" style="gap:8px"><h2 class="h2" style="margin:0">Bạn là cộng tác viên${u.ctvPaused ? " (đang tạm dừng)" : ""}</h2><div class="tb" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr))"><div class="cell"><span class="l">Đề xuất</span><span class="v code" style="font-size:28px">${s.total}</span></div><div class="cell"><span class="l">Đã có kết quả</span><span class="v code" style="font-size:28px">${s.resolved}</span></div><div class="cell"><span class="l">Tỉ lệ đúng</span><span class="v code" style="font-size:28px;color:${s.rate >= 0.9 ? "var(--stamp)" : "var(--ink)"}">${Math.round(s.rate * 100)}%</span></div><div class="cell"><span class="l">Đang chờ</span><span class="v code" style="font-size:28px">${ctvQueue(u).length}</span></div></div>${u.ctvPaused ? "" : '<div><a class="btn primary" href="#/ctv">Mở hàng chờ cộng tác viên</a></div>'}</section>` : mine ? `<p class="note" style="margin:0">Đã gửi đơn ngày ${fmtDate(mine.t)}, đang chờ kiểm duyệt viên xét.</p>` : `<section class="stack" style="gap:10px;border:2px solid var(--line);background:var(--sheet);padding:16px"><h2 class="h2" style="margin:0">Đăng ký</h2><ul class="tb" style="list-style:none;margin:0;padding:0">${req.map(([ok, l]) => `<li style="padding:6px 12px">${ok ? "✓" : "✗"} ${l}</li>`).join("")}</ul>${okAll ? `<form class="stack" data-form="apply" style="gap:10px"><div class="field"><label for="ap-m">Vì sao bạn muốn tham gia</label><textarea class="textarea" id="ap-m" maxlength="600" style="min-height:72px"></textarea></div><div class="field"><label for="ap-h">Số giờ mỗi tuần có thể dành</label><select class="select" id="ap-h" style="width:auto"><option>1</option><option selected>2</option><option>3</option><option>5</option></select></div><label class="check"><input type="checkbox" id="ap-ok"><span>Tôi đã đọc quy định kiểm duyệt và cam kết giữ kín thông tin người đăng.</span></label><div><button class="btn primary" type="submit">Gửi đơn</button></div></form>` : '<p class="small muted" style="margin:0">Bạn chưa đủ điều kiện. Đóng góp thêm tài liệu chất lượng rồi quay lại nhé.</p>'}</section>`}</div>`,
    mount(root) {
      root.querySelector('[data-form="apply"]')?.addEventListener("submit", (e) => {
        e.preventDefault();
        const m = root.querySelector("#ap-m").value.trim();
        if (m.length < 20) return toast("Viết ít nhất 20 ký tự.");
        if (!root.querySelector("#ap-ok").checked) return toast("Cần xác nhận cam kết.");
        md.applications.push({ id: uid(), by: u.email, faculties: [u.faculty || "SOICT"], motivation: m, hours: +root.querySelector("#ap-h").value, t: Date.now(), status: "OPEN" });
        save();
        toast("Đã gửi đơn.");
        render();
      });
    },
  };
};
views["/ctv"] = () => {
  const u = me();
  if (!u) return needLogin("/ctv");
  if (!isCtv(u) || u.ctvPaused) return views["/cong-tac-vien"]();
  const list = ctvQueue(u);
  return {
    html:
      pageHead("Hàng chờ cộng tác viên", `Tài liệu rủi ro thấp thuộc ${ctvFaculties(u).map((f) => faculty(f)?.shortName).join(", ")}`, "") +
      `<div class="wrap stack" style="max-width:900px;padding-block:20px;gap:12px">${list.length ? list.map((d) => `<a class="rec" style="border:2px solid var(--line)" href="#/ctv/${d.id}"><b style="font-weight:600">${esc(d.title)}</b><span class="tiny muted">${d.course}, ${TYPES[d.type]}, rủi ro ${d.risk || 0}/100, AI: ${aiOf(d).quality.label}</span></a>`).join("") : empty("Không còn tài liệu nào cho bạn lúc này.")}<p class="small muted" style="margin:0">Tỉ lệ đề xuất đúng của bạn: ${Math.round(ctvStats(u.email).rate * 100)}%.</p></div>`,
  };
};
views["/ctv/:id"] = ({ id }) => {
  const u = me();
  if (!u) return needLogin(`/ctv/${id}`);
  const d = ctvQueue(u).find((x) => x.id === id);
  if (!isCtv(u) || u.ctvPaused || !d) return views.notfound();
  return {
    html:
      `<div class="wrap" style="padding-block:20px"><a class="small" href="#/ctv">Về hàng chờ</a><div class="two wide" style="margin-top:8px"><div class="stack" style="min-width:0">${d.uploaded ? `<div class="viewer"><div data-file-preview class="pages" style="display:block"></div></div>` : `<div class="viewer"><div class="pages"><div style="width:100%;display:flex;flex-direction:column;gap:8px">${renderPages(d, Math.min(3, d.pages || 1))}</div></div></div>`}</div>
      <aside class="stack" style="gap:16px"><div class="stack" style="gap:4px"><h1 class="head" style="font-size:20px">${esc(d.title)}</h1><span class="small muted">${d.course} ${esc(course(d.course)?.name || "")}, ${TYPES[d.type]}. Tên người đăng được ẩn với cộng tác viên.</span>${d.description ? `<p class="small" style="margin:0">${esc(d.description)}</p>` : ""}</div>${aiPanel(d, u)}
      <form class="stack" data-form="rec" style="border:2px solid var(--line);background:var(--sheet);padding:12px 16px;gap:10px"><h2 class="h2" style="margin:0">Đề xuất của bạn</h2>${[["APPROVE", "Duyệt"], ["REQUEST_CHANGES", "Yêu cầu sửa"], ["REJECT", "Từ chối"]].map(([k, l], i) => `<label class="check"><input type="radio" name="rec" value="${k}"${i ? "" : " checked"}><span>${l}</span></label>`).join("")}<div class="field"><label for="rec-r">Lý do (bắt buộc khi không duyệt)</label><textarea class="textarea" id="rec-r" style="min-height:56px">${""}</textarea></div><div><button class="btn primary" type="submit">Gửi đề xuất</button></div></form></aside></div></div>`,
    mount(root) {
      if (d.uploaded) mountUploadedPreview(root, d);
      mountAiPanel(root, d);
      root.querySelector('[data-form="rec"]').addEventListener("submit", (e) => {
        e.preventDefault();
        const rec = root.querySelector("input[name=rec]:checked").value;
        const reason = root.querySelector("#rec-r").value.trim();
        if (rec !== "APPROVE" && reason.length < 5) return toast("Ghi lý do để kiểm duyệt viên tham khảo.");
        const md = MD();
        md.recs.push({ id: uid(), doc: d.id, by: u.email, rec, reason, t: Date.now() });
        d.logs.unshift({ t: Date.now(), a: "NOTE", by: u.email, reason: `Cộng tác viên đề xuất: ${{ APPROVE: "duyệt", REJECT: "từ chối", REQUEST_CHANGES: "yêu cầu sửa" }[rec]}${reason ? `. ${reason}` : ""}` });
        // Hai cộng tác viên khác nhau cùng đề xuất duyệt tài liệu rủi ro thấp, không có cờ AI: tự duyệt
        const approvers = new Set(md.recs.filter((r) => r.doc === d.id && !r.final && r.rec === "APPROVE").map((r) => r.by));
        if (md.settings.ctvPairApprove && approvers.size >= 2 && (d.risk || 0) <= 20 && !aiOf(d).flags.length) {
          systemApprove(d, "Hai cộng tác viên cùng đề xuất duyệt");
          resolveRecs(d.id, "APPROVE");
        }
        save();
        toast("Đã gửi đề xuất.");
        go("#/ctv");
      });
    },
  };
};
views["/kiem-duyet/cong-tac-vien"] = () => {
  const u = me();
  if (!isMod(u)) return views.notfound();
  const md = MD();
  const ctvs = S.users.filter(isCtv);
  const apps = md.applications.filter((a) => a.status === "OPEN");
  return {
    html: `<div class="wrap stack" style="padding-block:20px;gap:20px">${modTabs("ctv")}
     <section class="stack" style="gap:8px"><h2 class="h2" style="margin:0">Đơn đăng ký (${apps.length})</h2>${apps.length ? `<ul class="tb" style="list-style:none;margin:0;padding:0">${apps.map((a) => { const x = userBy(a.by); return `<li style="padding:10px 12px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><span style="min-width:0;flex:1 1 300px">${userLink(x)} <span class="tiny muted">${faculty(x?.faculty)?.shortName || ""}, ${x?.approved || 0} tài liệu được duyệt, bậc uy tín ${x?.trust || 0}, ${a.hours} giờ/tuần</span><span class="small" style="display:block">${esc(a.motivation)}</span></span><span class="row" style="gap:6px"><button class="btn sm primary" type="button" data-appok="${a.id}">Nhận</button><button class="btn sm" type="button" data-appno="${a.id}">Từ chối</button></span></li>`; }).join("")}</ul>` : '<p class="small muted" style="margin:0">Không có đơn mới.</p>'}</section>
     <section class="stack" style="gap:8px"><h2 class="h2" style="margin:0">Cộng tác viên</h2><div style="overflow-x:auto"><table class="t" style="min-width:560px"><thead><tr><th>Cộng tác viên</th><th class="num">Đề xuất</th><th class="num">Tỉ lệ đúng</th><th>Trạng thái</th><th></th></tr></thead><tbody>${ctvs.map((x) => { const s = ctvStats(x.email); return `<tr><td>${userLink(x)} <span class="tiny muted">${ctvFaculties(x).join(", ")}</span></td><td class="num">${s.total}</td><td class="num"><b>${Math.round(s.rate * 100)}%</b> <span class="tiny muted">(${s.agree}/${s.resolved})</span></td><td>${x.ctvPaused ? "Tạm dừng" : s.resolved >= 30 && s.rate >= 0.9 ? "Nên xét làm KDV" : "Đang hoạt động"}</td><td class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn sm" type="button" data-pause="${x.email}">${x.ctvPaused ? "Mở lại" : "Tạm dừng"}</button><button class="btn sm ghost" type="button" data-revoke="${x.email}">Thu hồi</button></td></tr>`; }).join("")}</tbody></table></div></section></div>`,
    mount(root) {
      const done = (m) => (save(), toast(m), render());
      root.querySelectorAll("[data-appok]").forEach((b) =>
        b.addEventListener("click", () => {
          const a = md.applications.find((x) => x.id === b.dataset.appok);
          a.status = "ACCEPTED";
          const x = userBy(a.by);
          if (x && !isCtv(x)) x.roles.push({ key: "VOLUNTEER", faculty: a.faculties[0] });
          S.notifications.unshift({ id: uid(), to: a.by, type: "SPACE", title: "Bạn đã trở thành cộng tác viên kiểm duyệt", link: "#/ctv", t: Date.now(), read: false });
          S.audit.unshift({ t: Date.now(), by: u.email, action: "ctv.accept", detail: a.by });
          done("Đã nhận cộng tác viên.");
        }),
      );
      root.querySelectorAll("[data-appno]").forEach((b) => b.addEventListener("click", () => ((md.applications.find((x) => x.id === b.dataset.appno).status = "REJECTED"), done("Đã từ chối đơn."))));
      root.querySelectorAll("[data-pause]").forEach((b) => b.addEventListener("click", () => { const x = userBy(b.dataset.pause); x.ctvPaused = !x.ctvPaused; done(x.ctvPaused ? "Đã tạm dừng." : "Đã mở lại."); }));
      root.querySelectorAll("[data-revoke]").forEach((b) => b.addEventListener("click", () => { const x = userBy(b.dataset.revoke); x.roles = x.roles.filter((r) => r.key !== "VOLUNTEER"); S.audit.unshift({ t: Date.now(), by: u.email, action: "ctv.revoke", detail: x.email }); done("Đã thu hồi quyền."); }));
    },
  };
};
views["/kiem-duyet/cai-dat"] = () => {
  const u = me();
  if (!isMod(u)) return views.notfound();
  const set = MD().settings;
  const canEdit = isAdmin(u);
  const auto = MD().autoLog.slice(-8).reverse();
  return {
    html: `<div class="wrap stack" style="padding-block:20px;gap:20px">${modTabs("set")}
     <form class="stack" data-form="modset" style="border:2px solid var(--line);background:var(--sheet);padding:16px;gap:12px"><h2 class="h2" style="margin:0">Tự duyệt theo ngưỡng</h2>${canEdit ? "" : '<p class="small muted" style="margin:0">Chỉ quản trị viên sửa được.</p>'}
      <label class="check"><input type="checkbox" id="ms-auto"${set.autoApprove ? " checked" : ""}${canEdit ? "" : " disabled"}><span>Tự duyệt tài liệu của người dùng uy tín khi đủ mọi điều kiện dưới đây</span></label>
      <div style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
       <div class="field"><label for="ms-trust">Bậc uy tín tối thiểu (0 đến 3)</label><input class="input" id="ms-trust" type="number" min="0" max="3" value="${set.minTrust}"${canEdit ? "" : " disabled"}></div>
       <div class="field"><label for="ms-risk">Điểm rủi ro tối đa</label><input class="input" id="ms-risk" type="number" min="0" max="100" value="${set.maxRisk}"${canEdit ? "" : " disabled"}></div>
       <div class="field"><label for="ms-q">Điểm chất lượng AI tối thiểu</label><input class="input" id="ms-q" type="number" min="0" max="100" value="${set.minQuality}"${canEdit ? "" : " disabled"}></div>
       <div class="field"><label for="ms-exam">Ưu tiên học phần thi trong (ngày)</label><input class="input" id="ms-exam" type="number" min="1" max="60" value="${set.examDays}"${canEdit ? "" : " disabled"}></div>
       <div class="field"><label for="ms-ctvr">Cộng tác viên thấy tài liệu rủi ro tối đa</label><input class="input" id="ms-ctvr" type="number" min="0" max="100" value="${set.ctvMaxRisk}"${canEdit ? "" : " disabled"}></div></div>
      <label class="check"><input type="checkbox" id="ms-pair"${set.ctvPairApprove ? " checked" : ""}${canEdit ? "" : " disabled"}><span>Hai cộng tác viên cùng đề xuất duyệt tài liệu rủi ro thấp, không có cờ AI thì tự duyệt</span></label>
      <p class="small muted" style="margin:0">Luôn cần thêm: không có cờ trùng nội dung, đạo văn hay bản quyền; người đăng chưa từng bị gỡ tài liệu và không bị khóa thưởng. Mọi lần tự duyệt ghi trong nhật ký tài liệu và báo cáo minh bạch.</p>
      ${canEdit ? '<div><button class="btn primary" type="submit">Lưu cài đặt</button></div>' : ""}</form>
     <section class="stack" style="gap:8px"><h2 class="h2" style="margin:0">Tự duyệt gần đây</h2>${auto.length ? `<ul class="tb" style="list-style:none;margin:0;padding:0">${auto.map((a) => { const d = S.docs.find((x) => x.id === a.doc); return `<li style="padding:6px 12px"><a href="#/tai-lieu/${d?.slug}">${esc(d?.title || a.doc)}</a> <span class="tiny muted">${esc(a.how)}, ${fmtTime(a.t)}</span></li>`; }).join("")}</ul>` : '<p class="small muted" style="margin:0">Chưa có.</p>'}</section></div>`,
    mount(root) {
      root.querySelector('[data-form="modset"]').addEventListener("submit", (e) => {
        e.preventDefault();
        const n = (id, min, max) => Math.max(min, Math.min(max, Math.trunc(+root.querySelector(id).value) || 0));
        const before = { ...set };
        Object.assign(MD().settings, { autoApprove: root.querySelector("#ms-auto").checked, minTrust: n("#ms-trust", 0, 3), maxRisk: n("#ms-risk", 0, 100), minQuality: n("#ms-q", 0, 100), examDays: n("#ms-exam", 1, 60), ctvMaxRisk: n("#ms-ctvr", 0, 100), ctvPairApprove: root.querySelector("#ms-pair").checked });
        S.audit.unshift({ t: Date.now(), by: u.email, action: "moderation.settings", detail: Object.keys(MD().settings).filter((k) => MD().settings[k] !== before[k]).map((k) => `${k}: ${before[k]} → ${MD().settings[k]}`).join(", ") || "không đổi" });
        save();
        toast("Đã lưu cài đặt.");
        render();
      });
    },
  };
};

/* ===================== Kháng nghị ===================== */
/** Quyết định gần nhất có thể kháng nghị (từ chối hoặc gỡ) */
function lastDecision(d) {
  return (d.logs || []).find((l) => ["REJECT", "REMOVE", "AUTO_REJECTED"].includes(l.a));
}
function appealOf(d) {
  const ld = lastDecision(d);
  return ld && MD().appeals.find((a) => a.doc === d.id && a.decisionT === ld.t);
}
views["/khang-nghi/:id"] = ({ id }) => {
  const u = me();
  if (!u) return needLogin(`/khang-nghi/${id}`);
  const d = S.docs.find((x) => x.id === id);
  if (!d || d.uploader !== u.email || !["REJECTED", "REMOVED"].includes(d.status)) return views.notfound();
  const ld = lastDecision(d);
  const ap = appealOf(d);
  return {
    html:
      pageHead("Kháng nghị quyết định", esc(d.title), "") +
      `<div class="wrap stack" style="max-width:760px;padding-block:24px;gap:16px">
      <div class="tb" style="grid-template-columns:minmax(0,1fr)"><div style="padding:10px 12px"><span class="badge ${d.status}">${STATUS[d.status]}</span><p class="small" style="margin:6px 0 0"><b>Lý do:</b> ${esc(d.reviewNote || ld?.reason || "")}</p><p class="tiny muted" style="margin:4px 0 0">${ld ? `${fmtTime(ld.t)}, ${ld.by ? "bởi kiểm duyệt viên" : "kiểm tra tự động"}` : ""}</p></div></div>
      ${ap ? `<div class="note${ap.status === "OVERTURNED" ? "" : ap.status === "UPHELD" ? " red" : ""}" style="margin:0"><b>${{ OPEN: "Đang xem xét", UPHELD: "Giữ nguyên quyết định", OVERTURNED: "Đã chấp nhận kháng nghị" }[ap.status]}</b>. Gửi ngày ${fmtTime(ap.t)}.${ap.response ? `<span style="display:block;margin-top:4px">Phản hồi: ${esc(ap.response)}</span>` : ""}</div>` : `<form class="stack" data-form="appeal" style="border:2px solid var(--line);background:var(--sheet);padding:16px;gap:10px"><p class="small" style="margin:0">Mỗi quyết định được kháng nghị một lần. Kháng nghị do một kiểm duyệt viên <b>khác</b> người đã quyết định xem xét, thường trong 3 ngày. Nếu bị gỡ vì yêu cầu bản quyền, hãy nêu căn cứ bạn có quyền chia sẻ.</p><div class="field"><label for="ap-r">Vì sao bạn cho rằng quyết định chưa đúng <span class="req">*</span></label><textarea class="textarea" id="ap-r" maxlength="2000" style="min-height:120px"></textarea></div><div class="field"><label for="ap-e">Đường dẫn minh chứng (không bắt buộc)</label><input class="input" id="ap-e" placeholder="https://"></div><div><button class="btn primary" type="submit">Gửi kháng nghị</button></div></form>`}</div>`,
    mount(root) {
      root.querySelector('[data-form="appeal"]')?.addEventListener("submit", (e) => {
        e.preventDefault();
        const reason = root.querySelector("#ap-r").value.trim();
        if (reason.length < 30) return toast("Trình bày ít nhất 30 ký tự.");
        MD().appeals.push({ id: `KN-${uid().slice(0, 5).toUpperCase()}`, doc: d.id, by: u.email, reason, evidence: root.querySelector("#ap-e").value.trim(), t: Date.now(), status: "OPEN", decisionT: ld?.t || 0, decidedBy: ld?.by || null, takedown: d.takedownCase || null });
        d.logs.unshift({ t: Date.now(), a: "NOTE", by: u.email, reason: `Người đăng kháng nghị: ${reason.slice(0, 120)}` });
        save();
        toast("Đã gửi kháng nghị.");
        render();
      });
    },
  };
};
// "Tài liệu của tôi": thêm nút kháng nghị cho tài liệu bị từ chối hoặc gỡ
const _mineView = views["/tai-lieu-cua-toi"];
views["/tai-lieu-cua-toi"] = () => {
  const out = _mineView();
  const u = me();
  if (!u) return out;
  const mount0 = out.mount;
  out.mount = (root) => {
    mount0?.(root);
    for (const d of S.docs.filter((x) => x.uploader === u.email && ["REJECTED", "REMOVED"].includes(x.status) && lastDecision(x))) {
      const box = root.querySelector(`a[href="#/tai-lieu/${d.slug}"]`)?.parentElement;
      if (!box) continue;
      const ap = appealOf(d);
      box.insertAdjacentHTML("beforeend", `<a class="small" href="#/khang-nghi/${d.id}" style="font-weight:600">${ap ? { OPEN: "Kháng nghị đang xem xét", UPHELD: "Kháng nghị: giữ nguyên", OVERTURNED: "Kháng nghị được chấp nhận" }[ap.status] : "Kháng nghị quyết định này"}</a>`);
    }
    translateTree(root);
  };
  return out;
};
/** Lật lại quyết định: từ chối thì duyệt; bị gỡ thì khôi phục, trả lại uy tín và lượt thưởng đã thu hồi. */
function overturn(d, mod, response) {
  const up = userBy(d.uploader);
  if (d.status === "REJECTED") {
    d.status = "PENDING_REVIEW";
    systemApprove(d, `Kháng nghị được chấp nhận: ${response}`);
    d.logs[0].a = "APPEAL_OVERTURN";
    d.logs[0].by = mod.email;
  } else if (d.status === "REMOVED") {
    d.status = "APPROVED";
    d.reviewNote = null;
    d.logs.unshift({ t: Date.now(), a: "APPEAL_OVERTURN", by: mod.email, reason: response });
    if (up) {
      up.approved++;
      up.reputation += 20;
      up.violations = Math.max(0, (up.violations || 0) - 1);
      up.trust = trustFrom(up.approved, up.violations);
    }
    const back = (S.credits?.ledger || []).filter((e) => e.doc === d.id && e.type === "REVOKE").reduce((s, e) => s - e.amount, 0);
    if (back > 0 && typeof crGrant === "function") crGrant(d.uploader, "ADJUSTMENT", back, { note: "Hoàn lại lượt thưởng sau kháng nghị", doc: d.id, actor: mod.email });
    notify(d.uploader, "DOCUMENT_APPROVED", d, { reason: `Tài liệu được khôi phục sau kháng nghị. ${response}`, link: `#/tai-lieu/${d.slug}` });
  }
}
views["/kiem-duyet/khang-nghi"] = () => {
  const u = me();
  if (!isMod(u)) return views.notfound();
  const list = MD().appeals.slice().sort((a, b) => (a.status === "OPEN" ? 0 : 1) - (b.status === "OPEN" ? 0 : 1) || b.t - a.t);
  return {
    html: `<div class="wrap stack" style="padding-block:20px;gap:12px">${modTabs("ap")}<p class="small muted" style="margin:0">Người đã ra quyết định ban đầu không xử lý kháng nghị của quyết định đó (trừ quản trị viên).</p>
     ${list.length ? list.map((a) => { const d = S.docs.find((x) => x.id === a.doc); const same = a.decidedBy === u.email && !isAdmin(u); return `<article class="stack" style="border:2px solid ${a.status === "OPEN" ? "var(--stamp)" : "var(--line)"};background:var(--sheet);padding:12px 16px;gap:6px"><div class="row" style="justify-content:space-between;gap:8px"><b>${a.id}: <a href="#/tai-lieu/${d?.slug}">${esc(d?.title || "")}</a></b><span class="tiny muted">${fmtTime(a.t)}, ${{ OPEN: "đang mở", UPHELD: "giữ nguyên", OVERTURNED: "đã lật lại" }[a.status]}</span></div><span class="small"><b>Quyết định ban đầu:</b> ${esc(d?.reviewNote || "")} <span class="tiny muted">(${a.decidedBy ? esc(displayName(userBy(a.decidedBy) || { name: a.decidedBy })) : "tự động"})</span></span><span class="small"><b>Người đăng trình bày:</b> ${esc(a.reason)}${a.evidence ? ` <a href="${esc(a.evidence)}" target="_blank" rel="noopener">minh chứng</a>` : ""}</span>${a.response ? `<span class="small"><b>Phản hồi:</b> ${esc(a.response)}</span>` : ""}
      ${a.status === "OPEN" ? (same ? '<p class="tiny" style="margin:0;color:var(--stamp)">Bạn là người ra quyết định ban đầu, cần kiểm duyệt viên khác xử lý.</p>' : `<div class="field"><label for="apr-${a.id}">Phản hồi gửi người đăng</label><textarea class="textarea" id="apr-${a.id}" style="min-height:56px"></textarea></div><div class="row" style="gap:6px"><button class="btn primary sm" type="button" data-over="${a.id}">Chấp nhận, lật lại quyết định</button><button class="btn sm" type="button" data-uphold="${a.id}">Giữ nguyên</button></div>`) : ""}</article>`; }).join("") : empty("Chưa có kháng nghị nào.")}</div>`,
    mount(root) {
      const act = (id, over) => {
        const a = MD().appeals.find((x) => x.id === id);
        const response = root.querySelector(`#apr-${id}`).value.trim();
        if (response.length < 5) return toast("Ghi phản hồi cho người đăng.");
        const d = S.docs.find((x) => x.id === a.doc);
        a.status = over ? "OVERTURNED" : "UPHELD";
        a.response = response;
        a.handledBy = u.email;
        a.handledAt = Date.now();
        if (over) overturn(d, u, response);
        else {
          d.logs.unshift({ t: Date.now(), a: "APPEAL_UPHELD", by: u.email, reason: response });
          S.notifications.unshift({ id: uid(), to: a.by, type: "QA", title: `Kháng nghị “${d.title}”: giữ nguyên quyết định. ${response}`, link: `#/khang-nghi/${d.id}`, t: Date.now(), read: false });
        }
        if (a.takedown) {
          const c = MD().takedowns.find((x) => x.id === a.takedown);
          c?.timeline.push({ t: Date.now(), by: u.email, action: over ? "Khôi phục sau phản đối của người đăng" : "Giữ nguyên việc gỡ sau phản đối", note: response });
        }
        S.audit.unshift({ t: Date.now(), by: u.email, action: over ? "appeal.overturn" : "appeal.uphold", detail: `${a.id}: ${d.title}` });
        save();
        toast("Đã xử lý kháng nghị.");
        render();
      };
      root.querySelectorAll("[data-over]").forEach((b) => b.addEventListener("click", () => act(b.dataset.over, true)));
      root.querySelectorAll("[data-uphold]").forEach((b) => b.addEventListener("click", () => act(b.dataset.uphold, false)));
    },
  };
};

/* ===================== Yêu cầu gỡ bỏ từ giảng viên, tác giả ===================== */
const TD_STATUS = { NEW: "Mới nhận", REVIEWING: "Đang xem xét", NEED_INFO: "Cần bổ sung", REMOVED: "Đã gỡ", REJECTED: "Không gỡ" };
views["/go-tai-lieu"] = () => ({
  html:
    pageHead("Yêu cầu gỡ tài liệu", "Dành cho tác giả, giảng viên, chủ sở hữu bản quyền", '<p style="margin:0;max-width:680px">Không cần tài khoản. Bạn nhận một mã hồ sơ để theo dõi. Thời gian phản hồi: trong 1 ngày làm việc với yêu cầu từ email trường đã xác minh, 3 ngày với các trường hợp khác. Mọi bước xử lý đều được ghi lại.</p>') +
    `<div class="wrap" style="max-width:820px;padding-block:24px" data-tk><form class="stack" data-form="td" style="border:2px solid var(--line);background:var(--sheet);padding:16px;gap:12px">
    <div style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
     <div class="field"><label for="td-n">Họ và tên <span class="req">*</span></label><input class="input" id="td-n" autocomplete="name"></div>
     <div class="field"><label for="td-m">Email liên hệ <span class="req">*</span></label><input class="input" id="td-m" type="email" autocomplete="email"><span class="hint">Email @hust.edu.vn được xác minh bằng mã gửi về hộp thư và xử lý ưu tiên.</span></div>
     <div class="field"><label for="td-r">Bạn là <span class="req">*</span></label><select class="select" id="td-r"><option>Giảng viên, tác giả bài giảng</option><option>Tác giả sách, giáo trình</option><option>Nhà xuất bản, đơn vị giữ bản quyền</option><option>Người được ủy quyền</option><option>Khác</option></select></div>
     <div class="field"><label for="td-o">Đơn vị</label><input class="input" id="td-o" placeholder="Ví dụ: Trường CNTT&TT"></div></div>
    <div class="field"><label for="td-u">Đường dẫn tài liệu <span class="req">*</span></label><input class="input" id="td-u" value="${esc(params().get("url") || "")}"><span class="hint">Có dạng …#/tai-lieu/ten-tai-lieu</span></div>
    <div class="field"><label for="td-d">Mô tả tác phẩm gốc và lý do <span class="req">*</span></label><textarea class="textarea" id="td-d" style="min-height:120px"></textarea></div>
    <div class="field"><label for="td-e">Minh chứng (đường dẫn bản gốc, trang môn học…)</label><input class="input" id="td-e" placeholder="https://"></div>
    <div data-otp></div>
    <label class="check"><input type="checkbox" id="td-c1"><span>Tôi tin chắc việc chia sẻ tài liệu này chưa được tôi hoặc người giữ bản quyền cho phép.</span></label>
    <label class="check"><input type="checkbox" id="td-c2"><span>Thông tin tôi cung cấp là chính xác. Tôi đồng ý để thông tin liên hệ được chuyển cho người đăng nếu họ phản đối.</span></label>
    <p class="err" data-err role="alert" hidden></p><div><button class="btn primary" type="submit">Gửi yêu cầu</button></div></form>
    <form class="row" data-form="track" style="gap:6px;margin-top:16px;max-width:420px;flex-wrap:nowrap"><label class="sr" for="td-code">Mã hồ sơ</label><input class="input" id="td-code" placeholder="Tra cứu hồ sơ, ví dụ GB-0001"><button class="btn" type="submit">Tra cứu</button></form></div>`,
  mount(root) {
    let otp = null;
    let verified = false;
    const form = root.querySelector('[data-form="td"]');
    const err = form.querySelector("[data-err]");
    const fail = (m) => ((err.textContent = tr(m)), (err.hidden = false));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = (id) => root.querySelector(id).value.trim();
      const email = v("#td-m").toLowerCase();
      if (v("#td-n").length < 2) return fail("Nhập họ và tên.");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Email không hợp lệ.");
      const m = v("#td-u").match(/tai-lieu\/([a-z0-9-]+)/i);
      const d = m && S.docs.find((x) => x.slug === m[1].toLowerCase() && ["APPROVED", "HELD"].includes(x.status));
      if (!d) return fail("Không tìm thấy tài liệu đang công khai theo đường dẫn này.");
      if (v("#td-d").length < 30) return fail("Mô tả ít nhất 30 ký tự.");
      if (!root.querySelector("#td-c1").checked || !root.querySelector("#td-c2").checked) return fail("Cần xác nhận hai cam kết.");
      // Email trường: xác minh bằng mã (bản demo hiện mã ngay trên trang)
      if (/@(sis\.)?hust\.edu\.vn$/.test(email) && !verified) {
        if (!otp) {
          otp = String(Math.floor(100000 + Math.random() * 900000));
          root.querySelector("[data-otp]").innerHTML = `<div class="note" style="margin:0">Đã gửi mã xác minh tới ${esc(email)}. <span class="tiny muted">(Bản demo: mã là <b>${otp}</b>)</span><div class="field" style="margin-top:6px"><label for="td-otp">Mã xác minh</label><input class="input" id="td-otp" inputmode="numeric" maxlength="6" style="max-width:160px"></div></div>`;
          translateTree(root.querySelector("[data-otp]"));
          return;
        }
        if (root.querySelector("#td-otp").value.trim() !== otp) return fail("Mã xác minh không đúng.");
        verified = true;
      }
      const md = MD();
      const id = `GB-${String(md.takedowns.length + 1).padStart(4, "0")}`;
      const c = { id, doc: d.id, claimant: { name: v("#td-n"), email, role: v("#td-r"), org: v("#td-o") }, verified, details: v("#td-d"), evidence: v("#td-e"), status: "NEW", t: Date.now(), timeline: [{ t: Date.now(), by: "Người yêu cầu", action: "Gửi yêu cầu", note: verified ? "Email trường đã xác minh, xử lý ưu tiên" : "Email ngoài trường" }] };
      md.takedowns.push(c);
      S.users.filter(isMod).forEach((x) => S.notifications.unshift({ id: uid(), to: x.email, type: "SPACE", title: `Yêu cầu gỡ ${id}: ${d.title}`, link: `#/kiem-duyet/go-bo/${id}`, t: Date.now(), read: false }));
      save();
      root.querySelector("[data-tk]").innerHTML = `<div class="note" style="margin:0"><b>Đã nhận yêu cầu. Mã hồ sơ: <span class="code" style="font-size:20px">${id}</span></b><span style="display:block;margin-top:4px">Lưu mã này để tra cứu tại <a href="#/go-tai-lieu/${id}">trang hồ sơ</a>. ${verified ? "Email trường đã xác minh: phản hồi trong 1 ngày làm việc." : "Phản hồi trong 3 ngày làm việc."}</span></div>`;
      translateTree(root);
    });
    root.querySelector('[data-form="track"]').addEventListener("submit", (e) => {
      e.preventDefault();
      go(`#/go-tai-lieu/${encodeURIComponent(root.querySelector("#td-code").value.trim().toUpperCase())}`);
    });
  },
});
function timelineHtml(c) {
  return `<ol style="list-style:none;margin:0;padding:0;border:2px solid var(--line);background:var(--sheet)">${c.timeline
    .slice()
    .reverse()
    .map((x) => `<li style="padding:8px 12px;border-bottom:1px solid var(--grid)"><span class="tiny muted">${fmtTime(x.t)}</span> <b class="small">${esc(x.action)}</b> <span class="tiny muted">${esc(/@/.test(x.by) ? "Kiểm duyệt viên" : x.by)}</span>${x.note ? `<span class="small" style="display:block">${esc(x.note)}</span>` : ""}</li>`)
    .join("")}</ol>`;
}
views["/go-tai-lieu/:code"] = ({ code }) => {
  const c = MD().takedowns.find((x) => x.id === decodeURIComponent(code));
  if (!c) return { html: `<div class="wrap" style="max-width:640px;padding-block:48px"><p class="note red">Không tìm thấy hồ sơ ${esc(decodeURIComponent(code))}.</p><a class="btn" href="#/go-tai-lieu">Gửi yêu cầu mới</a></div>` };
  const d = S.docs.find((x) => x.id === c.doc);
  return { html: pageHead(`Hồ sơ ${c.id}`, "Yêu cầu gỡ tài liệu", `<p style="margin:0">Trạng thái: <b>${TD_STATUS[c.status]}</b></p>`) + `<div class="wrap stack" style="max-width:760px;padding-block:24px;gap:12px"><p class="small" style="margin:0">Tài liệu: <b>${esc(d?.title || "")}</b> (${d ? STATUS[d.status] : ""})</p>${timelineHtml(c)}<p class="tiny muted" style="margin:0">Trang này không cần đăng nhập. Ghi chú nội bộ của kiểm duyệt viên không hiển thị ở đây.</p></div>` };
};
views["/kiem-duyet/go-bo"] = () => {
  const u = me();
  if (!isMod(u)) return views.notfound();
  const list = MD().takedowns.slice().sort((a, b) => (["NEW", "REVIEWING", "NEED_INFO"].includes(a.status) ? 0 : 1) - (["NEW", "REVIEWING", "NEED_INFO"].includes(b.status) ? 0 : 1) || (b.verified - a.verified) || a.t - b.t);
  return {
    html: `<div class="wrap stack" style="padding-block:20px;gap:12px">${modTabs("td")}${list.length ? `<table class="t"><thead><tr><th>Hồ sơ</th><th>Tài liệu</th><th>Người yêu cầu</th><th>Trạng thái</th><th>Hạn phản hồi</th></tr></thead><tbody>${list
      .map((c) => {
        const d = S.docs.find((x) => x.id === c.doc);
        const due = c.t + (c.verified ? 1 : 3) * D8;
        const open = ["NEW", "REVIEWING", "NEED_INFO"].includes(c.status);
        return `<tr><td><a href="#/kiem-duyet/go-bo/${c.id}" class="code" style="font-size:16px">${c.id}</a></td><td>${esc(d?.title || "")}</td><td>${esc(c.claimant.name)}<span class="tiny muted" style="display:block">${esc(c.claimant.role)}${c.verified ? ", email trường đã xác minh" : ""}</span></td><td>${TD_STATUS[c.status]}</td><td${open && due < Date.now() ? ' style="color:var(--stamp);font-weight:700"' : ""}>${open ? fmtTime(due) : "–"}</td></tr>`;
      })
      .join("")}</tbody></table>` : empty("Không có yêu cầu gỡ bỏ.")}</div>`,
  };
};
views["/kiem-duyet/go-bo/:id"] = ({ id }) => {
  const u = me();
  if (!isMod(u)) return views.notfound();
  const c = MD().takedowns.find((x) => x.id === id);
  if (!c) return views.notfound();
  const d = S.docs.find((x) => x.id === c.doc);
  const open = ["NEW", "REVIEWING", "NEED_INFO"].includes(c.status);
  return {
    html: `<div class="wrap stack" style="padding-block:20px;gap:16px">${modTabs("td")}<a class="small" href="#/kiem-duyet/go-bo">Về danh sách</a>
     <div class="two" style="gap:16px;align-items:start"><section class="stack" style="gap:10px;min-width:0"><h2 class="h2" style="margin:0">Hồ sơ ${c.id}: ${TD_STATUS[c.status]}</h2>
      <div class="tb" style="grid-template-columns:minmax(0,1fr)"><div style="padding:8px 12px"><span class="tiny muted">Tài liệu</span><br><a href="#/tai-lieu/${d?.slug}"><b>${esc(d?.title || "")}</b></a> <span class="tiny muted">${d ? STATUS[d.status] : ""}, người đăng ${esc(displayName(userBy(d?.uploader) || { name: "?" }))}</span></div>
       <div style="padding:8px 12px"><span class="tiny muted">Người yêu cầu</span><br>${esc(c.claimant.name)}, ${esc(c.claimant.role)}${c.claimant.org ? `, ${esc(c.claimant.org)}` : ""}<br><span class="small">${esc(c.claimant.email)} ${c.verified ? '<b style="color:var(--stamp)">(email trường đã xác minh)</b>' : "(chưa xác minh)"}</span></div>
       <div style="padding:8px 12px"><span class="tiny muted">Nội dung</span><p class="small" style="margin:2px 0 0;white-space:pre-line">${esc(c.details)}</p>${c.evidence ? `<a class="small" href="${esc(c.evidence)}" target="_blank" rel="noopener">Minh chứng</a>` : ""}</div></div>
      ${d ? aiPanel(d, u) : ""}</section>
      <section class="stack" style="gap:10px;min-width:0"><h2 class="h2" style="margin:0">Xử lý</h2>${open ? `<div class="field"><label for="td-note">Ghi chú (người yêu cầu thấy ở trang hồ sơ; khi gỡ, đây là lý do gửi người đăng)</label><textarea class="textarea" id="td-note" style="min-height:64px"></textarea></div>
       <div class="row" style="gap:6px">${c.status === "NEW" ? '<button class="btn sm" type="button" data-td="REVIEWING">Bắt đầu xem xét</button>' : ""}${d?.status === "APPROVED" ? '<button class="btn sm" type="button" data-td="HOLD">Tạm ẩn trong lúc xem xét</button>' : d?.status === "HELD" ? '<button class="btn sm" type="button" data-td="UNHOLD">Bỏ tạm ẩn</button>' : ""}<button class="btn sm" type="button" data-td="NEED_INFO">Yêu cầu bổ sung</button><button class="btn sm primary" type="button" data-td="REMOVED">Gỡ tài liệu</button><button class="btn sm ink" type="button" data-td="REJECTED">Không gỡ</button></div>` : '<p class="small muted" style="margin:0">Hồ sơ đã đóng. Người đăng có thể kháng nghị nếu tài liệu bị gỡ.</p>'}
      <h3 class="head small" style="margin:8px 0 0">Nhật ký hồ sơ</h3>${timelineHtml(c)}</section></div></div>`,
    mount(root) {
      root.querySelectorAll("[data-td]").forEach((b) =>
        b.addEventListener("click", () => {
          const act = b.dataset.td;
          const note = root.querySelector("#td-note").value.trim();
          if (["NEED_INFO", "REMOVED", "REJECTED"].includes(act) && note.length < 5) return toast("Ghi chú lý do trước khi xử lý.");
          const label = { REVIEWING: "Bắt đầu xem xét", HOLD: "Tạm ẩn tài liệu trong lúc xem xét", UNHOLD: "Bỏ tạm ẩn", NEED_INFO: "Yêu cầu bổ sung thông tin", REMOVED: "Gỡ tài liệu", REJECTED: "Không gỡ" }[act];
          if (act === "HOLD") {
            d.heldFrom = d.status;
            d.status = "HELD";
            d.logs.unshift({ t: Date.now(), a: "NOTE", by: u.email, reason: `Tạm ẩn theo yêu cầu gỡ ${c.id}` });
          } else if (act === "UNHOLD") {
            d.status = d.heldFrom || "APPROVED";
          } else if (act === "REMOVED") {
            if (d.status === "HELD") d.status = d.heldFrom || "APPROVED";
            d.takedownCase = c.id;
            removeDoc(d, `Gỡ theo yêu cầu bản quyền (hồ sơ ${c.id}): ${note}`, null);
            c.status = "REMOVED";
          } else if (act === "REJECTED") {
            if (d.status === "HELD") d.status = d.heldFrom || "APPROVED";
            c.status = "REJECTED";
          } else c.status = act;
          c.timeline.push({ t: Date.now(), by: u.email, action: label, note });
          S.audit.unshift({ t: Date.now(), by: u.email, action: `takedown.${act.toLowerCase()}`, detail: `${c.id}: ${d.title}` });
          save();
          toast(`Đã cập nhật hồ sơ ${c.id}.`);
          render();
        }),
      );
    },
  };
};

/* ===================== Báo cáo minh bạch hằng tháng ===================== */
function monthKey(t) {
  return new Date(t + 7 * 3600e3).toISOString().slice(0, 7);
}
function median(a) {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
}
function transparency(months = 6) {
  const now = Date.now();
  const keys = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now + 7 * 3600e3);
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - i);
    keys.push(d.toISOString().slice(0, 7));
  }
  const rows = Object.fromEntries(keys.map((k) => [k, { k, submitted: 0, approved: 0, auto: 0, rejected: 0, changes: 0, autoRejected: 0, removed: 0, reviewHours: [], takedowns: 0, takedownRemoved: 0, appeals: 0, overturned: 0, ctvRecs: 0 }]));
  for (const d of S.docs) {
    if (rows[monthKey(d.createdAt)]) rows[monthKey(d.createdAt)].submitted++;
    let first = null;
    for (const l of [...(d.logs || [])].reverse()) {
      const r = rows[monthKey(l.t)];
      if (!r) continue;
      if (l.a === "APPROVE") r.approved++;
      if (l.a === "AUTO_APPROVE") (r.approved++, r.auto++);
      if (l.a === "REJECT") r.rejected++;
      if (l.a === "REQUEST_CHANGES") r.changes++;
      if (l.a === "AUTO_REJECTED") r.autoRejected++;
      if (l.a === "REMOVE") r.removed++;
      if (!first && ["APPROVE", "AUTO_APPROVE", "REJECT", "REQUEST_CHANGES"].includes(l.a)) {
        first = l;
        r.reviewHours.push((l.t - d.createdAt) / 3600e3);
      }
    }
  }
  for (const c of MD().takedowns) {
    const r = rows[monthKey(c.t)];
    if (r) {
      r.takedowns++;
      if (c.status === "REMOVED") r.takedownRemoved++;
    }
  }
  for (const a of MD().appeals) {
    const r = rows[monthKey(a.t)];
    if (r) {
      r.appeals++;
      if (a.status === "OVERTURNED") r.overturned++;
    }
  }
  for (const x of MD().recs) if (rows[monthKey(x.t)]) rows[monthKey(x.t)].ctvRecs++;
  return keys.map((k) => rows[k]);
}
views["/minh-bach"] = () => {
  MD();
  const rows = transparency(6);
  const cur = rows[rows.length - 1];
  const fmtH = (h) => (h ? `${h < 10 ? h.toFixed(1).replace(".", ",") : Math.round(h)} giờ` : "–");
  const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
  const max = Math.max(1, ...rows.map((r) => r.approved + r.rejected + r.changes));
  const mName = (k) => `Tháng ${+k.slice(5)}/${k.slice(0, 4)}`;
  return {
    html:
      pageHead("Báo cáo minh bạch", "Kiểm duyệt trên HUSTDOCU, cập nhật tự động hằng tháng", '<p style="margin:0;max-width:720px">Số liệu tính từ nhật ký kiểm duyệt: mỗi lần duyệt, từ chối, gỡ, tự duyệt, kháng nghị và yêu cầu gỡ bỏ đều được ghi lại. Thời gian duyệt tính từ lúc gửi tới quyết định đầu tiên.</p>') +
      `<div class="wrap stack" style="padding-block:24px;gap:24px">
      <div class="tb" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">${[["Được duyệt tháng này", cur.approved], ["Trong đó tự duyệt", cur.auto], ["Bị từ chối", cur.rejected + cur.autoRejected], ["Bị gỡ", cur.removed], ["Thời gian duyệt trung bình", fmtH(avg(cur.reviewHours))], ["Trung vị", fmtH(median(cur.reviewHours))]].map(([l, v]) => `<div class="cell"><span class="l">${l}</span><span class="v code" style="font-size:28px">${v}</span></div>`).join("")}</div>
      <section class="stack" style="gap:8px"><h2 class="h2" style="margin:0">Quyết định theo tháng</h2><div style="display:grid;grid-template-columns:repeat(${rows.length},minmax(0,1fr));gap:8px;align-items:end;height:180px" role="img" aria-label="Biểu đồ số quyết định theo tháng">${rows
        .map((r) => `<div style="display:flex;flex-direction:column;justify-content:flex-end;height:100%;gap:2px"><span class="tiny" style="text-align:center">${r.approved + r.rejected + r.changes}</span><div title="Từ chối ${r.rejected}" style="background:var(--stamp);height:${(r.rejected / max) * 130}px"></div><div title="Yêu cầu sửa ${r.changes}" style="background:var(--pencil);height:${(r.changes / max) * 130}px"></div><div title="Duyệt ${r.approved}" style="background:var(--ink);height:${(r.approved / max) * 130}px"></div><span class="tiny muted" style="text-align:center">${+r.k.slice(5)}/${r.k.slice(2, 4)}</span></div>`)
        .join("")}</div><div class="row" style="gap:12px">${[["var(--ink)", "Duyệt"], ["var(--pencil)", "Yêu cầu sửa"], ["var(--stamp)", "Từ chối"]].map(([c, l]) => `<span class="tiny"><span style="display:inline-block;width:12px;height:12px;background:${c};vertical-align:-2px"></span> ${l}</span>`).join("")}</div></section>
      <div style="overflow-x:auto"><table class="t" style="min-width:860px"><thead><tr><th>Tháng</th><th class="num">Gửi lên</th><th class="num">Duyệt</th><th class="num">Tự duyệt</th><th class="num">Yêu cầu sửa</th><th class="num">Từ chối</th><th class="num">Từ chối tự động</th><th class="num">Bị gỡ</th><th class="num">TG duyệt TB</th><th class="num">Trung vị</th><th class="num">Yêu cầu gỡ</th><th class="num">Kháng nghị (lật lại)</th><th class="num">Đề xuất CTV</th></tr></thead><tbody>${rows
        .slice()
        .reverse()
        .map((r) => `<tr><td>${mName(r.k)}</td><td class="num">${r.submitted}</td><td class="num"><b>${r.approved}</b></td><td class="num">${r.auto}</td><td class="num">${r.changes}</td><td class="num">${r.rejected}</td><td class="num">${r.autoRejected}</td><td class="num">${r.removed}</td><td class="num">${fmtH(avg(r.reviewHours))}</td><td class="num">${fmtH(median(r.reviewHours))}</td><td class="num">${r.takedowns}${r.takedownRemoved ? ` (${r.takedownRemoved} gỡ)` : ""}</td><td class="num">${r.appeals}${r.appeals ? ` (${r.overturned})` : ""}</td><td class="num">${r.ctvRecs}</td></tr>`)
        .join("")}</tbody></table></div>
      <div class="row" style="gap:6px"><button class="btn" type="button" data-csv>Tải số liệu (CSV)</button></div>
      <p class="small muted" style="margin:0">Không công bố thông tin cá nhân của người đăng hay người yêu cầu. Bản demo tính trên dữ liệu mẫu trong trình duyệt.</p></div>`,
    mount(root) {
      root.querySelector("[data-csv]").addEventListener("click", () => {
        const head = "thang,gui_len,duyet,tu_duyet,yeu_cau_sua,tu_choi,tu_choi_tu_dong,bi_go,tg_duyet_tb_gio,trung_vi_gio,yeu_cau_go,yeu_cau_go_da_go,khang_nghi,khang_nghi_lat_lai,de_xuat_ctv";
        const lines = rows.map((r) => [r.k, r.submitted, r.approved, r.auto, r.changes, r.rejected, r.autoRejected, r.removed, avg(r.reviewHours).toFixed(1), median(r.reviewHours).toFixed(1), r.takedowns, r.takedownRemoved, r.appeals, r.overturned, r.ctvRecs].join(","));
        downloadText("hustdocu-minh-bach.csv", `${head}\n${lines.join("\n")}`, "text/csv");
      });
    },
  };
};

/* Bản dịch tiếng Anh cho giao diện giai đoạn 8 */
Object.assign(EN, {
  "AI hỗ trợ kiểm duyệt": "AI moderation assist", "Phân tích lại": "Re-analyze", "Hỏi Claude": "Ask Claude", "Đang hỏi…": "Asking…", "Chất lượng: ": "Quality: ", "Trùng nội dung: ": "Duplicate content: ", "Đạo văn: ": "Plagiarism: ", "Bản quyền: ": "Copyright: ",
  "Tốt": "Good", "Khá": "Fair", "Cần xem kỹ": "Needs review", "Thấp": "Low", "Cao": "High",
  "Đề xuất của cộng tác viên": "Volunteer recommendations", "Kháng nghị": "Appeals", "Yêu cầu gỡ": "Takedowns", "Cộng tác viên": "Volunteers", "Cài đặt": "Settings", "Minh bạch": "Transparency",
  "Cộng tác viên kiểm duyệt": "Volunteer moderators", "Hàng chờ cộng tác viên": "Volunteer queue", "Đề xuất của bạn": "Your recommendation", "Gửi đề xuất": "Send recommendation", "Gửi đơn": "Apply", "Đăng ký": "Apply",
  "Kháng nghị quyết định": "Appeal a decision", "Kháng nghị quyết định này": "Appeal this decision", "Gửi kháng nghị": "Send appeal", "Giữ nguyên": "Uphold", "Chấp nhận, lật lại quyết định": "Accept, overturn",
  "Yêu cầu gỡ tài liệu": "Takedown request", "Gửi yêu cầu": "Send request", "Tra cứu": "Look up", "Bắt đầu xem xét": "Start review", "Tạm ẩn trong lúc xem xét": "Hide during review", "Bỏ tạm ẩn": "Unhide", "Yêu cầu bổ sung": "Request more info", "Không gỡ": "Do not remove", "Nhật ký hồ sơ": "Case history", "Xử lý": "Actions",
  "Báo cáo minh bạch": "Transparency report", "Quyết định theo tháng": "Decisions by month", "Tải số liệu (CSV)": "Download data (CSV)", "Tự duyệt theo ngưỡng": "Threshold auto-approval", "Tự duyệt gần đây": "Recent auto-approvals", "Tạm ẩn": "Hidden",
});

/* Tài liệu mẫu có nội dung chữ thật (gán ở trên): xem trước và trợ lý AI dùng đúng nội dung đó */
const _docContent = docContent;
docContent = function (doc) {
  if (!doc.text || doc.uploaded) return _docContent(doc);
  const lines = [];
  for (const sent of doc.text.split(/(?<=[.!?:])\s+/)) {
    let cur = "";
    for (const w of sent.split(/\s+/)) {
      if ((cur + " " + w).length > 92) {
        lines.push(cur);
        cur = w;
      } else cur = cur ? `${cur} ${w}` : w;
    }
    if (cur) lines.push(cur);
  }
  const pages = [];
  for (let i = 0; i < lines.length; i += pages.length ? 18 : 12) pages.push(lines.slice(i, i + (pages.length ? 18 : 12)));
  return pages;
};
