#!/bin/sh
# app コンテナの起動前処理（docker-compose.yml の app サービスから呼ばれる）
# - package-lock.json が変わったときだけ npm ci する（毎回だと遅いため）
# - Prisma クライアントを生成する（DB には接続しない）
set -e

stamp=node_modules/.package-lock.sha256
current=$(sha256sum package-lock.json | cut -d' ' -f1)
if [ ! -f "$stamp" ] || [ "$(cat "$stamp")" != "$current" ]; then
  echo "[entrypoint] package-lock.json が変わったので npm ci を実行します"
  npm ci --no-audit --no-fund
  echo "$current" > "$stamp"
fi

npx prisma generate >/dev/null

exec "$@"
