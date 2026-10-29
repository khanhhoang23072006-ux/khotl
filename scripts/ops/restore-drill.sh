#!/usr/bin/env bash
# Diễn tập khôi phục: tải bản sao lưu mới nhất, kiểm tra checksum, giải mã, pg_restore vào một CSDL trống
# (RESTORE_DATABASE_URL) rồi kiểm tra dữ liệu. Thoát mã khác 0 nếu bất kỳ bước nào sai.
set -euo pipefail
: "${BACKUP_PASSPHRASE:?}" "${BACKUP_S3_ENDPOINT:?}" "${BACKUP_S3_BUCKET:?}" "${RESTORE_DATABASE_URL:?}"
MAX_AGE_HOURS="${BACKUP_MAX_AGE_HOURS:-36}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-packages/db/prisma/migrations}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}"
s3() { aws --endpoint-url "$BACKUP_S3_ENDPOINT" "$@"; }
summary() { echo "$*" | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"; }

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
start=$(date +%s)

read -r key modified < <(s3 s3api list-objects-v2 --bucket "$BACKUP_S3_BUCKET" --prefix db/daily/ \
  --query "sort_by(Contents[?ends_with(Key, '.dump.gpg')], &LastModified)[-1].[Key, LastModified]" --output text)
[ -n "${key:-}" ] && [ "$key" != "None" ] || { summary "❌ Không tìm thấy bản sao lưu nào"; exit 1; }
age_h=$(( ( $(date -u +%s) - $(date -u -d "$modified" +%s) ) / 3600 ))
summary "Bản sao lưu: \`$key\` (cách đây ${age_h} giờ)"
if [ "$age_h" -gt "$MAX_AGE_HOURS" ]; then summary "❌ Bản mới nhất cũ hơn ${MAX_AGE_HOURS} giờ: sao lưu hằng đêm có thể đã hỏng"; exit 1; fi

name="$(basename "$key")"
s3 s3 cp "s3://$BACKUP_S3_BUCKET/$key" "$work/$name" --no-progress
s3 s3 cp "s3://$BACKUP_S3_BUCKET/$key.sha256" "$work/$name.sha256" --no-progress
(cd "$work" && sha256sum -c "$name.sha256")
printf '%s' "$BACKUP_PASSPHRASE" > "$work/pass"
gpg --batch --pinentry-mode loopback --passphrase-file "$work/pass" -d "$work/$name" > "$work/db.dump"
pg_restore --list "$work/db.dump" > /dev/null

# Bản dump có lệnh CREATE EXTENSION; tạo trước cho chắc vì CSDL đích là CSDL trống
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -q -c 'CREATE EXTENSION IF NOT EXISTS vector; CREATE EXTENSION IF NOT EXISTS unaccent; CREATE EXTENSION IF NOT EXISTS pg_trgm;'
pg_restore --no-owner --no-acl --exit-on-error --single-transaction -d "$RESTORE_DATABASE_URL" "$work/db.dump" 2> "$work/restore.err" || {
  # Lỗi "already exists" của extension là vô hại; lỗi khác thì dừng
  if grep -v 'already exists' "$work/restore.err" | grep -qi error; then cat "$work/restore.err" >&2; summary "❌ pg_restore lỗi"; exit 1; fi
}

q() { psql "$RESTORE_DATABASE_URL" -At -v ON_ERROR_STOP=1 -c "$1"; }
expected=$(find "$MIGRATIONS_DIR" -mindepth 1 -maxdepth 1 -type d | wc -l)
applied=$(q "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL")
tables=$(q "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
users=$(q "SELECT count(*) FROM users")
docs=$(q "SELECT count(*) FROM documents")
courses=$(q "SELECT count(*) FROM courses")
q "SELECT 1 FROM documents LIMIT 1" > /dev/null
secs=$(( $(date +%s) - start ))
summary ""
summary "| Kiểm tra | Giá trị |"
summary "|---|---|"
summary "| Migration đã áp dụng / trong repo | $applied / $expected |"
summary "| Số bảng | $tables |"
summary "| Người dùng | $users |"
summary "| Tài liệu | $docs |"
summary "| Học phần | $courses |"
summary "| Thời gian khôi phục (RTO thử) | ${secs} giây |"
if [ "$applied" -lt 1 ] || [ "$tables" -lt 10 ]; then summary "❌ CSDL khôi phục thiếu bảng hoặc thiếu lịch sử migration"; exit 1; fi
if [ "$applied" -lt "$expected" ]; then summary "⚠️ Bản sao lưu cũ hơn migration mới nhất trong repo (bình thường nếu vừa thêm migration chưa deploy)"; fi
if [ "$users" -lt 1 ]; then summary "❌ Bảng users trống: bản sao lưu có thể là CSDL sai"; exit 1; fi
summary "✅ Khôi phục thành công"
