// Kiểm tra bộ phân tích bằng HTML mẫu (không gọi mạng): node scripts/fetch-hust.test.mjs
import assert from "node:assert/strict";
import { parseList, tagsFor } from "./fetch-hust.mjs";

const html = `<ul>
<li><a href="/DisplayWeb/DisplayKehoach?kehoach=30244">[DTDH] ĐĂNG KÝ KẾ HOẠCH HỌC TẬP CHO HỌC KỲ 2 NĂM HỌC 2026-2027 (20262) 01.10.2026</a></li>
<li><div class="d">6/10/2026</div><a href="/DisplayWeb/DisplayBaiViet?baiviet=51639&amp;x=1"><b>[ĐTĐH] Quyết định mức học phí các chương trình đào tạo</b></a></li>
<li><a href="/DisplayWeb/DisplayBaiViet?baiviet=51639&amp;x=1"><img src="a.png"></a></li>
<li><a href="/Other">bỏ qua</a></li></ul>`;
const items = parseList(html, "test");
assert.equal(items.length, 2);
assert.equal(items[0].url, "https://ctt.hust.edu.vn/DisplayWeb/DisplayKehoach?kehoach=30244");
assert.equal(items[0].date, "2026-10-01");
assert.equal(items[1].title, "[ĐTĐH] Quyết định mức học phí các chương trình đào tạo");
assert.equal(items[1].date, "2026-10-06");
assert.deepEqual(tagsFor(items[0].title), ["dangky"]);
assert.deepEqual(tagsFor(items[1].title), ["ctdt", "hocphi"]);
assert.deepEqual(tagsFor("Cập nhật đề cương học phần IT3011"), ["decuong"]);
console.log("fetch-hust: ok");
