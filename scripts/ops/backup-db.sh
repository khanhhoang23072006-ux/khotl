#!/usr/bin/env bash
# Sao lưu CSDL: pg_dump (định dạng custom) -> mã hoá AES256 bằng gpg -> tải lên bucket sao lưu (S3/R2).
# Bản ngày giữ BACKUP_DAILY_DAYS ngày; bản đầu tháng chép thêm vào monthly/ và giữ BACKUP_MONTHLY_DAYS ngày.
# Cần: BACKUP_DATABASE_URL, BACKUP_PASSPHRASE, BACKUP_S3_ENDPOINT, BACKUP_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
set -euo pipefail
: "${BACKUP_DATABASE_URL:?}" "${BACKUP_PASSPHRASE:?}" "${BACKUP_S3_ENDPOINT:?}" "${BACKUP_S3_BUCKET:?}"
DAILY_DAYS="${BACKUP_DAILY_DAYS:-14}"
MONTHLY_DAYS="${BACKUP_MONTHLY_DAYS:-400}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}"
s3() { aws --endpoint-url "$BACKUP_S3_ENDPOINT" "$@"; }

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
stamp="$(date -u +%Y%m%dT%H%MZ)"
name="khotl-db-$stamp.dump.gpg"
pass="$work/pass"
printf '%s' "$BACKUP_PASSPHRASE" > "$pass"

echo "pg_dump..."
pg_dump --format=custom --compress=6 --no-owner --no-acl "$BACKUP_DATABASE_URL" \
  | gpg --batch --yes --pinentry-mode loopback --passphrase-file "$pass" \
        --symmetric --cipher-algo AES256 --compress-algo none -o "$work/$name"
size="$(stat -c %s "$work/$name")"
# Một bản dump rỗng/hỏng thường dưới vài KB: dừng để không ghi đè cảm giác "đã có sao lưu"
if [ "$size" -lt 2048 ]; then echo "Bản sao lưu quá nhỏ ($size byte), dừng." >&2; exit 1; fi
(cd "$work" && sha256sum "$name" > "$name.sha256")

s3 s3 cp "$work/$name" "s3://$BACKUP_S3_BUCKET/db/daily/$name" --no-progress
s3 s3 cp "$work/$name.sha256" "s3://$BACKUP_S3_BUCKET/db/daily/$name.sha256" --no-progress
if [ "$(date -u +%d)" = "01" ]; then
  s3 s3 cp "$work/$name" "s3://$BACKUP_S3_BUCKET/db/monthly/$name" --no-progress
  s3 s3 cp "$work/$name.sha256" "s3://$BACKUP_S3_BUCKET/db/monthly/$name.sha256" --no-progress
fi

prune() { # prune <prefix> <days>: xoá bản cũ hơn <days> ngày, không bao giờ xoá bản vừa tạo
  local days="$2" cutoff keys key
  if [ "$days" -lt 1 ]; then days=1; fi
  cutoff="$(date -u -d "-$days days" +%Y-%m-%dT%H:%M:%S)"
  keys="$(s3 s3api list-objects-v2 --bucket "$BACKUP_S3_BUCKET" --prefix "$1" \
    --query "Contents[?LastModified<'$cutoff'].Key" --output text)"
  for key in $keys; do
    [ "$key" = "None" ] && continue
    case "$key" in *"$name"*) continue ;; esac
    echo "Xoá bản cũ: $key"
    s3 s3 rm "s3://$BACKUP_S3_BUCKET/$key" --only-show-errors
  done
}
prune db/daily/ "$DAILY_DAYS"
prune db/monthly/ "$MONTHLY_DAYS"

echo "name=$name" >> "${GITHUB_OUTPUT:-/dev/null}"
echo "size=$size" >> "${GITHUB_OUTPUT:-/dev/null}"
echo "Xong: $name ($size byte)"
