# Quy tắc dự án (Project Rules & Guidelines)

## 1. Quy chuẩn Icon & Giao diện (BẮT BUỘC)
- **Tuyệt đối không dùng emoji hệ điều hành**: Không được sử dụng bất kỳ biểu tượng emoji có sẵn của OS hay emoji của AI (như 🎙️, 🔇, 📌, 👁️, 🔑, ✉️, v.v.) vào các thành phần giao diện (nút bấm, badge, thanh điều hướng, ô nhập liệu, thông báo toast, tiêu đề).
- **100% sử dụng icon Outline SVG**: Mọi icon trên toàn bộ website đều phải dùng định dạng vector outline SVG thuần (`stroke="currentColor"`, `stroke-width="2"` hoặc `2.2`, `fill="none"`, `stroke-linecap="round"`, `stroke-linejoin="round"`).
- **Khai báo tập trung**: Thêm icon mới vào đối tượng `const icon = { ... }` trong [index.html](file:///C:/Users/Asus/.gemini/antigravity-ide/scratch/khotl/index.html) để tái sử dụng thống nhất.
- **Phong cách thiết kế**: Giữ chuẩn phong cách retro-academic / brutalist tối giản, đường nét sắc sảo, icon đơn sắc tự động thích ứng theo màu chữ (`currentColor`) ở cả hai chế độ sáng/tối.

## 2. Quy trình làm việc & Triển khai
- Tự động thực hiện các yêu cầu mà không hỏi lại người dùng những xác nhận hiển nhiên.
- Sau khi chỉnh sửa, luôn kiểm tra cú pháp JS, kiểm thử hiển thị bằng Puppeteer, sau đó tự động triển khai lên máy chủ thông qua `deploy.bat` và đồng bộ lên repository GitHub `khanhhoang23072006-ux/khotl`.
