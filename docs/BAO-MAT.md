# Rà soát bảo mật HUSTDOCU (29/10/2026)

Phạm vi: bản đang chạy ở lofcreate.online (`index.html` + `api/*.php` trên hosting Apache), workflow GitHub Actions, và app Next.js trong `apps/`, `packages/` (chưa triển khai). Đối chiếu OWASP Top 10 (2021).

## Đã sửa

| Mức | Lỗi | OWASP | Cách sửa |
|---|---|---|---|
| Nghiêm trọng | Mật khẩu ứng dụng Gmail ghi thẳng trong `send_otp.yml` (repo công khai) | A02, A05 | Chuyển sang GitHub Secrets (`OTP_SMTP_USER`, `OTP_SMTP_PASS`). **Mật khẩu cũ phải thu hồi ở Google.** |
| Nghiêm trọng | Log Actions công khai in mã OTP và email người nhận | A09 | Không in, `core.setSecret` che giá trị |
| Nghiêm trọng | Email quản trị đăng nhập được bằng `999999`, `230706`, `admin123`, mật khẩu Gmail cũ, hoặc **bất kỳ mật khẩu ≥ 6 ký tự** | A07 | Bỏ hết; mã quản trị riêng đặt trong `api/config.php` trên hosting, so sánh an toàn, khóa 15 phút sau 5 lần sai |
| Nghiêm trọng | Tài khoản, mật khẩu FTP trong `deploy.bat` | A02, A05 | Đọc từ `deploy.local.bat` (không đưa lên GitHub). **Mật khẩu FTP cũ phải đổi.** |
| Cao | `send_otp.php` không giới hạn: ai cũng gửi được vô hạn email qua Gmail của bạn (spam, Gmail bị khóa) và xin mã mới liên tục để dò OTP | A04, A07 | Mỗi email 1 lần/60 giây và 5 lần/giờ, mỗi IP 15 lần/giờ |
| Cao | `verify_otp.php` không giới hạn theo IP | A07 | 30 lần/15 phút mỗi IP; so sánh mã bằng `hash_equals` |
| Cao | API mở CORS `*`: trang web khác gọi được API bằng trình duyệt người dùng | A01, A05 | Bỏ CORS; từ chối yêu cầu có `Origin` khác tên miền |
| Cao | `api/data/` (CSDL voice SQLite, file OTP) có thể tải trực tiếp nếu thiếu `.htaccess` | A01, A05 | `.htaccess` chặn truy cập đưa vào repo và `deploy.bat`; `api/data/*.db`, `*.json` không vào git |
| Trung bình | `voice_signal.php`: không giới hạn kích thước, loại tin, số người; lộ chi tiết lỗi CSDL | A04, A05 | Kiểm tra mã phòng/peer, danh sách loại tin cho phép, tối đa 32 KB/tin, 30 người/phòng, 600 yêu cầu/phút/IP; lỗi chỉ ghi log máy chủ |
| Trung bình | XSS phản chiếu ở `#/hoi-dap?hp=…` và XSS lưu trữ (kỳ học, nhật ký kiểm duyệt, mã học phần trong hỏi đáp) | A03 | Escape đúng chỗ; đã thử 59 trang với mọi tham số URL và dữ liệu chứa mã độc |
| Trung bình | Thiếu header bảo mật | A05 | `.htaccess` gốc: CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`; chặn đọc `config.php`, file ẩn, `.db`, `.bat`… |
| Trung bình | Workflow gửi OTP có quyền mặc định trên repo, tham số không kiểm tra (có thể chèn lệnh SMTP) | A01, A03 | `permissions: {}`; chỉ nhận email hợp lệ và mã 6 số |
| Cao (app Next.js) | 28 lỗ hổng phụ thuộc: tinypool (2 critical), nodemailer 7 (4 high), sharp 0.34 (3 high), vitest | A06 | nodemailer 10.0.13, sharp 0.35.4, vitest 4.1.12; `pnpm audit --prod`: 0 lỗ hổng; typecheck, test đều qua |

## Còn lại, cần quyết định

1. **Phân quyền đang nằm ở trình duyệt (A01, A04).** Bản web hiện tại lưu toàn bộ dữ liệu (tài khoản, vai trò, tài liệu, lượt tải) trong `localStorage` của từng máy. Ai mở công cụ nhà phát triển cũng tự cấp được quyền quản trị, cộng lượt tải cho chính mình. Không gây hại người khác (dữ liệu không dùng chung) nhưng không thể coi là bảo mật. Cách giải quyết đúng: chạy bản Next.js trong `apps/web` (đã có Better Auth, Postgres, kiểm tra quyền phía máy chủ, worker quét virus) trên một máy chủ thật.
2. **Đăng nhập OTP chưa tạo phiên phía máy chủ.** `verify_otp.php` trả về token nhưng không ai kiểm tra token đó. Hệ quả giống mục 1.
3. **Trợ lý AI gọi thẳng api.anthropic.com bằng khóa người dùng tự nhập**, lưu trong `localStorage`. Chấp nhận được vì là khóa riêng của từng người, nhưng nếu có XSS thì khóa bị lộ; CSP đã giới hạn nơi được gửi dữ liệu.
4. **E2E trên CI đỏ** từ khi bỏ tài liệu mẫu (1c3509e), không liên quan bảo mật nhưng làm mất tín hiệu kiểm thử.
5. **HTTPS**: bật chứng chỉ (Let's Encrypt trong trang hosting) rồi bỏ dấu `#` ở dòng `Strict-Transport-Security` trong `.htaccess`.

## Việc chủ web phải tự làm

- Thu hồi mật khẩu ứng dụng Gmail cũ (myaccount.google.com/apppasswords).
- Đổi mật khẩu FTP trong trang quản lý hosting, điền vào `deploy.local.bat`.
- Thêm `$ADMIN_PASSCODE = '…';` vào `api/config.php` trên hosting.
- Chạy `deploy.bat`, mở thử web: nếu báo lỗi 500, xóa `.htaccess` ở thư mục gốc trên hosting (hosting không cho một số lệnh) rồi báo lại.

## Cách kiểm tra lại

- XSS: dùng Playwright mở mọi trang với tham số URL và dữ liệu lưu chứa `<img onerror>`.
- API: chạy `php -S` cục bộ, thử gọi khác tên miền (403), vượt giới hạn (429), mã sai, tin quá lớn, loại tin lạ.
- Phụ thuộc: `pnpm audit --prod`.
