# Quy tắc dự án (Project Rules & Guidelines)

## 1. Quy chuẩn Icon & Giao diện (BẮT BUỘC)
- **Tuyệt đối không dùng emoji hệ điều hành**: Không được sử dụng bất kỳ biểu tượng emoji có sẵn của OS hay emoji của AI (như 🎙️, 🔇, 📌, 👁️, 🔑, ✉️, v.v.) vào các thành phần giao diện (nút bấm, badge, thanh điều hướng, ô nhập liệu, thông báo toast, tiêu đề).
- **100% sử dụng icon Outline SVG**: Mọi icon trên toàn bộ website đều phải dùng định dạng vector outline SVG thuần (`stroke="currentColor"`, `stroke-width="2"` hoặc `2.2`, `fill="none"`, `stroke-linecap="round"`, `stroke-linejoin="round"`).
- **Khai báo tập trung**: Thêm icon mới vào đối tượng `const icon = { ... }` trong [index.html](file:///C:/Users/Asus/.gemini/antigravity-ide/scratch/khotl/index.html) để tái sử dụng thống nhất.
- **Phong cách thiết kế**: Giao diện "Trang truyện" (manga): giấy trắng, viền mực đen 3px, góc vuông, chấm lưới (screentone), bóng cứng lệch cho nút chính. Màu: đen, trắng, đỏ HUST `#D7263D`, vàng `#FFE14D`; nền tối là bản đảo ngược. Chữ: Anton (tiêu đề, mã học phần), Be Vietnam Pro (nội dung), Patrick Hand (lời thoại, lời dẫn). Token ở khối CSS "TRANG TRUYỆN" cuối `<style>`. Không dùng gradient, bo tròn lớn hay bóng mờ.
- **Minh họa**: Hai nhân vật nét manga (bạn nữ tóc dài, bạn nam đeo kính) vẽ bằng SVG trong `mangaArt(kind)` ở index.html; khung minh họa luôn nền trắng ở cả hai chế độ. Đây là hình minh họa, không phải icon; icon giao diện vẫn theo quy tắc outline SVG ở trên.

## 2. Quy trình làm việc & Triển khai
- Tự động thực hiện các yêu cầu mà không hỏi lại người dùng những xác nhận hiển nhiên.
- Sau khi chỉnh sửa, luôn kiểm tra cú pháp JS, kiểm thử hiển thị bằng Puppeteer, sau đó tự động triển khai lên máy chủ thông qua `deploy.bat` và đồng bộ lên repository GitHub `khanhhoang23072006-ux/khotl`.
