#!/usr/bin/env bash
# Chạy mỗi khi mở Codespace: bật hạ tầng, tạo dữ liệu mẫu, build và chạy web + worker.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -n "${CODESPACE_NAME:-}" ]; then
  APP_URL="https://${CODESPACE_NAME}-3000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
else
  APP_URL="http://localhost:3000"
fi

if [ ! -f .env ]; then
  cp .env.example .env
  secret=$(openssl rand -base64 32)
  sed -i "s#^BETTER_AUTH_SECRET=.*#BETTER_AUTH_SECRET=${secret}#" .env
  sed -i "s#^CLAMAV_HOST=.*#CLAMAV_HOST=#" .env
fi
# Trình duyệt chỉ vào được cổng 3000, nên kho file đi qua đường /s3 của chính web
sed -i "s#^APP_URL=.*#APP_URL=${APP_URL}#; s#^BETTER_AUTH_URL=.*#BETTER_AUTH_URL=${APP_URL}#; s#^S3_PUBLIC_ENDPOINT=.*#S3_PUBLIC_ENDPOINT=${APP_URL}/s3#" .env
grep -q '^S3_PROXY_TARGET=' .env || echo "S3_PROXY_TARGET=http://localhost:8333" >> .env

echo "==> Bật Postgres, kho file, hộp thư, Redis"
docker compose -f infra/compose/docker-compose.dev.yml up -d postgres s3 mailpit redis
until docker compose -f infra/compose/docker-compose.dev.yml exec -T postgres pg_isready -U khotl >/dev/null 2>&1; do sleep 1; done
until curl -s -o /dev/null http://localhost:8333; do sleep 1; done

echo "==> Tạo bảng và dữ liệu mẫu"
pnpm db:migrate
pnpm db:seed

echo "==> Build web (khoảng 1 phút)"
pnpm --filter @khotl/web build
rm -rf apps/web/.next/standalone/apps/web/.next/static apps/web/.next/standalone/apps/web/public
cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static
cp -r apps/web/public apps/web/.next/standalone/apps/web/public

pnpm --filter @khotl/worker start > /tmp/khotl-worker.log 2>&1 &

cat <<MSG

==================================================================
 Web:      ${APP_URL}
 Mã đăng nhập (OTP): mở cổng 8025 trong tab "Ports"
 Tài khoản demo: sv.demo@sis.hust.edu.vn, kdv.demo@hust.edu.vn,
                 admin.demo@hust.edu.vn
==================================================================

MSG
PORT=3000 HOSTNAME=0.0.0.0 node --env-file=.env apps/web/.next/standalone/apps/web/server.js
