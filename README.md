# HUSTDOCU

Nơi sinh viên Đại học Bách khoa Hà Nội chia sẻ, tìm kiếm tài liệu học tập. Mọi tài liệu đều qua kiểm tra tự động (định dạng, trùng lặp, mã độc, nội dung) rồi đến kiểm duyệt viên trước khi công khai.

Trạng thái: **Giai đoạn 1 (MVP)**: tìm kiếm, xem, tải, tải lên, kiểm duyệt, quản trị danh mục. Cộng đồng, chat, AI, PWA đầy đủ thuộc các giai đoạn sau.

## Cấu trúc

```
apps/web          Next.js 16 (App Router): giao diện, server action, API
apps/worker       Tiến trình nền: quét virus, kiểm tra file, tạo ảnh xem trước, trích văn bản, gửi email
packages/db       Prisma 7: schema, migration (kèm SQL tìm kiếm tiếng Việt), seed
packages/core     Logic thuần: chuẩn hoá tiếng Việt, kỳ học, phân quyền, hạn mức, chấm rủi ro, validator
packages/adapters Kho file S3, gửi mail SMTP, rate limit Redis
e2e               Kiểm thử đầu-cuối bằng Playwright
infra             Docker Compose và Dockerfile
```

Luồng tải lên: trình duyệt xin URL ký sẵn → PUT file thẳng lên kho S3 → gửi thông tin tài liệu → web ghi `Document` (PROCESSING) và `DocumentVersion` (QUEUED) trong một transaction → worker nhận việc bằng `FOR UPDATE SKIP LOCKED` → qua kiểm tra thì vào hàng chờ kiểm duyệt.

## Xem nhanh giao diện

Bản demo một trang: https://khanhhoang23072006-ux.github.io/khotl/

Một file HTML duy nhất (`demo/index.html`), dữ liệu mẫu nhúng sẵn (10 Viện, 40 học phần, hơn 50 tài liệu), chạy hoàn toàn trên trình duyệt: tìm kiếm không dấu, đăng nhập bằng mã (hiện trong hộp thư demo), tải lên với kiểm tra tự động (định dạng thật, trùng SHA-256, mẫu virus EICAR, điểm rủi ro), hàng chờ kiểm duyệt, báo cáo vi phạm, quản trị học phần và phân quyền. Thanh trên cùng có nút vào nhanh bằng tài khoản Sinh viên, Kiểm duyệt viên, Quản trị. Dữ liệu thay đổi chỉ lưu trên máy người dùng.

Sửa `demo/template.html` rồi chạy `pnpm demo:build`; workflow `pages.yml` tự đăng lại khi push lên `main` (cần bật một lần: Settings → Pages → Source: GitHub Actions).

## Dùng thử ngay trên trình duyệt (GitHub Codespaces)

[![Mở trong GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/khanhhoang23072006-ux/khotl?quickstart=1)

Bấm nút trên, chờ khoảng 5 phút lần đầu (cài thư viện, tạo dữ liệu mẫu, build). Khi terminal hiện khung "Web: https://…", trang web tự mở ở tab mới. Mã đăng nhập OTP xem ở tab **Ports → cổng 8025** (hộp thư Mailpit). Lần sau mở lại Codespace chỉ mất khoảng 1 phút.

## Chạy trên máy

Cần Node.js 22.12 trở lên, pnpm 10 (`corepack enable`), Docker.

```bash
cp .env.example .env          # sửa BETTER_AUTH_SECRET: openssl rand -base64 32
pnpm install
pnpm infra:up                 # Postgres, SeaweedFS (S3), Mailpit, Redis, ClamAV
pnpm db:migrate               # tạo bảng, hàm tìm kiếm, ràng buộc
pnpm db:seed                  # 10 Viện, 40 học phần, ~60 tài liệu mẫu, 3 tài khoản demo
pnpm dev                      # web http://localhost:3000 + worker
```

Worker cần `pdftoppm`/`pdftotext` (gói `poppler-utils`) để tạo ảnh xem trước và trích văn bản, và LibreOffice để chuyển DOCX/PPTX/XLSX. Nếu máy không có, chạy worker trong Docker:

```bash
docker compose -f infra/compose/docker-compose.dev.yml --profile worker up -d --build
pnpm --filter @khotl/web dev  # chỉ chạy web trên máy
```

Mã đăng nhập (OTP) được gửi tới Mailpit: mở http://localhost:8025 để đọc.

Chạy toàn bộ bằng Docker (không cần Node trên máy): `docker compose -f infra/compose/docker-compose.dev.yml --profile app up -d --build`.

### Tài khoản demo

| Email | Vai trò |
| --- | --- |
| `sv.demo@sis.hust.edu.vn` | Sinh viên (đã hoàn thiện hồ sơ, K68 SOICT) |
| `kdv.demo@hust.edu.vn` | Kiểm duyệt viên toàn hệ thống |
| `admin.demo@hust.edu.vn` | Quản trị viên |

Đăng nhập bằng mã OTP (xem trong Mailpit). Tắt tài khoản demo khi chạy thật: `SEED_DEMO_USERS=false`.

## Kịch bản demo Giai đoạn 1

1. Mở trang chủ khi chưa đăng nhập: số liệu, tài liệu mới duyệt, học phần nhiều tài liệu.
2. Tìm `giai tich` (không dấu): kết quả có dấu, từ khoá được gạch chân đỏ, có đoạn trích nội dung file. Thử `giai tihc` (gõ sai) để thấy kết quả gần đúng, `"de thi" -slide` để thấy cú pháp nâng cao. Gõ `MI11` trong ô tìm kiếm để thấy gợi ý học phần.
3. Mở một tài liệu: khách chỉ xem ảnh 3 trang đầu, nút tải yêu cầu đăng nhập.
4. Đăng nhập `sv.demo@sis.hust.edu.vn` → đọc toàn bộ bằng trình xem PDF, tải file, báo cáo vi phạm.
5. Vào **Tải lên**: chọn PDF, chọn học phần, loại, tiêu đề, xác nhận bản quyền → gửi. Vào **Tài liệu của tôi**: trạng thái chuyển từ "Đang kiểm tra" sang "Chờ duyệt" khi worker xong.
6. Đăng xuất, đăng nhập `kdv.demo@hust.edu.vn` → **Kiểm duyệt**: xem kết quả kiểm tra tự động, điểm rủi ro, duyệt hoặc yêu cầu sửa (chọn lý do mẫu). Người đăng nhận thông báo trên web và email (Mailpit).
7. Nếu yêu cầu sửa: sinh viên vào **Tài liệu của tôi → Sửa và gửi lại**, có thể thay file.
8. Đăng nhập `admin.demo@hust.edu.vn` → **Quản trị**: thêm học phần, nhập CSV, giao vai trò kiểm duyệt viên theo Viện.
9. Thử tải lên file trùng với tài liệu mẫu, file đổi đuôi (ví dụ `.exe` đổi thành `.pdf`): bị từ chối tự động kèm lý do.
10. Đổi ngôn ngữ (VI/EN) và nền sáng/tối ở đầu trang hoặc chân trang.

## Biến môi trường

Đặt trong `.env` ở thư mục gốc (web, worker và Prisma cùng đọc). Xem `.env.example` để có giá trị mẫu.

| Biến | Bắt buộc | Ý nghĩa |
| --- | --- | --- |
| `APP_URL` | có | Địa chỉ web, vd `https://kho.example.com` |
| `DATABASE_URL` | có | Postgres 16 có extension `unaccent`, `pg_trgm`, `vector` |
| `BETTER_AUTH_SECRET` | có | Khoá bí mật ≥ 32 ký tự (ký cookie phiên và token upload) |
| `BETTER_AUTH_URL` | có | Thường bằng `APP_URL` |
| `ALLOWED_EMAIL_DOMAINS` | có | Domain email được đăng ký, mặc định `sis.hust.edu.vn,hust.edu.vn` |
| `ADMIN_EMAILS` | không | Email được cấp quyền quản trị ở lần đăng nhập đầu |
| `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` | không | Đăng nhập Microsoft Entra; để trống thì chỉ dùng OTP |
| `S3_ENDPOINT` | có | Địa chỉ kho S3 mà server dùng |
| `S3_PUBLIC_ENDPOINT` | có | Địa chỉ kho mà trình duyệt dùng (upload/tải trực tiếp, CSP) |
| `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | có | Thông tin kho |
| `S3_FORCE_PATH_STYLE` | có | `true` với SeaweedFS/MinIO, `false` với R2/S3 thật |
| `SMTP_URL`, `MAIL_FROM` | có | Gửi mail (Mailpit khi dev; Resend/SES qua SMTP khi chạy thật). Để trống `SMTP_URL` thì in mail ra console |
| `REDIS_URL` | nên có | Rate limit dùng chung giữa nhiều instance; trống thì dùng bộ nhớ trong tiến trình |
| `CLAMAV_HOST`, `CLAMAV_PORT` | nên có | ClamAV (clamd) để quét virus |
| `CLAMAV_REQUIRED` | không | `true`: không quét được thì từ chối file (bật khi chạy thật) |
| `WORKER_CONCURRENCY` | không | Số tài liệu worker xử lý song song, mặc định 2 |
| `UPLOAD_MAX_MB`, `UPLOAD_ZIP_MAX_MB` | không | Dung lượng tối đa, mặc định 50 và 100 MB |
| `GUEST_PREVIEW_PAGES` | không | Số trang khách xem được, mặc định 3 |
| `SEED_DEMO_USERS` | không | `false` để seed không tạo tài khoản và tài liệu demo |
| `AUTH_RATE_LIMIT` | không | `off` chỉ khi chạy e2e |
| `S3_PROXY_TARGET` | không | Cho trình duyệt dùng kho file qua `/s3` của web (Codespaces); khi đó `S3_PUBLIC_ENDPOINT` = `APP_URL/s3` |

## Kiểm thử

```bash
pnpm typecheck
pnpm lint
pnpm test            # unit test: core, adapters, worker, web
pnpm --filter @khotl/web test:int   # test tích hợp sổ lượt tải, cần DATABASE_URL đã migrate
pnpm e2e             # cần web + worker + hạ tầng đang chạy, dữ liệu đã seed
```

CI (GitHub Actions) chạy cả ba job: kiểm tra mã, migration trên Postgres thật, và e2e với web, worker, Postgres, SeaweedFS, Mailpit thật.

## Hạn mức tải xuống và lượt thưởng

- Mỗi sinh viên có 10 lượt tải miễn phí mỗi ngày, làm mới lúc 00:00 giờ Việt Nam. Khách chỉ xem bản xem trước, không tải được.
- Hết lượt miễn phí thì dùng lượt thưởng. Lượt thưởng có được khi tài liệu mình đăng được **duyệt** (+5), khi tài liệu đạt mỗi mốc 20 lượt tải (+1), khi đăng cho học phần có dưới 5 tài liệu (+3), và khi bình luận được 5 lượt thích (+1). Mỗi ngày kiếm tối đa 30 lượt thưởng. Lượt thưởng cộng dồn và hết hạn sau 90 ngày, lô sắp hết hạn được dùng trước.
- Tài liệu bị gỡ thì lượt đã nhận nhờ nó bị thu hồi. Nếu đã tiêu hết thì ghi nợ, lần thưởng sau trừ nợ trước.
- Tải lại cùng tài liệu trong 24 giờ không bị trừ. Xem trực tuyến không bị trừ. Tài liệu nhiều file (ZIP) tính 1 lượt. Người đăng tải tài liệu của mình và kiểm duyệt viên tải để duyệt đều không bị trừ.
- Kiểm tra và trừ lượt nằm trong một transaction, có khóa dòng `download_quotas` của người dùng (`SELECT … FOR UPDATE`), nên bấm tải nhiều lần cùng lúc không trừ trùng.
- Chống gian lận:
  - chặn file trùng SHA-256 và nội dung gần giống (SimHash, lệch ≤ 3 bit), từ chối tài liệu trống;
  - một thiết bị dùng từ 3 tài khoản trong 30 ngày thì khóa nhận thưởng các tài khoản đó;
  - bị gỡ vì vi phạm 3 lần thì khóa nhận thưởng;
  - giới hạn số lần gọi API tải mỗi giờ theo tài khoản, IP và thiết bị;
  - link tải dùng một lần, hết hạn sau 60 giây.
- Bảng: `download_quotas`, `credit_ledger` (sổ cái, mọi lần cộng hoặc trừ), `download_tokens`, `device_sightings`. Cấu hình nằm trong `system_settings` (khóa `downloads.credits`), sửa ở **Quản trị → Lượt tải**, có hiệu lực ngay, không cần deploy lại.
- Trang cho người dùng: thanh lượt ở header, hộp thoại khi hết lượt, trang **Lịch sử lượt tải** (`/luot-tai`).

## Triển khai

**Tự host bằng Docker**: `infra/docker/Dockerfile.web` (Next.js standalone) và `infra/docker/Dockerfile.worker` (kèm poppler, LibreOffice). Compose profile `app` chạy migration, web, worker. Đặt reverse proxy (Caddy/Nginx) có HTTPS phía trước web và kho file.

**Vercel + dịch vụ quản lý**:

- Web trên Vercel: Root Directory `apps/web`, Install Command `pnpm install`, Build Command `pnpm --filter @khotl/web build`.
- Postgres có `pgvector` và `unaccent` (Neon hoặc Supabase), chạy `pnpm db:migrate` từ máy hoặc CI.
- Kho file Cloudflare R2 (`S3_FORCE_PATH_STYLE=false`), cấu hình CORS cho domain web trên dashboard R2 (cho phép `GET`, `PUT`, `HEAD`).
- Redis: Upstash (`rediss://…`). Email: Resend hoặc SES qua SMTP.
- Worker không chạy được trên Vercel (cần tiến trình chạy liên tục, poppler, LibreOffice): chạy image `Dockerfile.worker` trên một VM nhỏ, Fly.io hoặc Railway, trỏ cùng `DATABASE_URL` và kho file.
- Header CSP lấy địa chỉ kho từ `S3_PUBLIC_ENDPOINT` lúc build, nên đặt biến này trong môi trường build.

## Quyết định kỹ thuật so với đề bài

- **Next.js 16** thay vì 14: bản ổn định hiện tại; `proxy.ts` thay cho middleware.
- **Better Auth** thay cho NextAuth/Auth.js: dự án Auth.js đã chuyển về Better Auth và chỉ còn bảo trì; Better Auth có sẵn đăng nhập OTP qua email, Microsoft Entra, rate limit, adapter Prisma.
- **SeaweedFS** thay cho MinIO khi dev/tự host: MinIO bản cộng đồng đã ngừng phát hành image. Ứng dụng chỉ dùng API S3 nên đổi sang R2/S3 thật chỉ là đổi biến môi trường.
- **Hàng đợi trên Postgres** (bảng `document_versions`, `SKIP LOCKED`) thay vì BullMQ/Redis: tạo tài liệu và xếp việc nằm trong cùng transaction nên không mất việc; Redis chỉ còn dùng cho rate limit.
- **Tìm kiếm** bằng Postgres full-text (`unaccent` + `pg_trgm`), chưa cần Meilisearch/Typesense ở quy mô hiện tại.
- **Giao diện** theo hướng "Khung tên" (khung tên bản vẽ kỹ thuật): component tự viết theo mẫu shadcn (cva + tailwind-merge), chưa cần Radix ở Giai đoạn 1.

## Giới hạn đã biết của Giai đoạn 1

- Thông báo lỗi kiểm tra dữ liệu ở form (từ zod) mới có tiếng Việt.
- Chưa có OCR cho PDF scan (chỉ đánh dấu "không có lớp chữ" để kiểm duyệt viên biết).
- Bình luận, đánh giá, theo dõi học phần, chat, AI, PWA offline: Giai đoạn 2 đến 5.
