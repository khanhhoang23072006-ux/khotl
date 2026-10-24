#!/usr/bin/env bash
# Chạy một lần khi tạo Codespace: cài công cụ xử lý PDF và thư viện.
set -euo pipefail
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
sudo apt-get update -qq
sudo apt-get install -y -qq poppler-utils >/dev/null
sudo corepack enable
corepack prepare pnpm@10.0.0 --activate
pnpm install --frozen-lockfile
