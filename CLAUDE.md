@AGENTS.md

# イベントカレンダー

社内メンバーが参加・登壇するイベントを登録・共有するWebアプリ。

## 技術スタック

- **フレームワーク**: Next.js 16（App Router）+ TypeScript + Tailwind CSS
- **DB**: PostgreSQL（ローカルは Docker）+ Prisma 7 + `@prisma/adapter-pg`
- **バリデーション**: Zod
- **認証**: iron-session（固定ID/パスワード、全員共有）
- **カレンダーUI**: FullCalendar

## ローカル開発

```bash
docker compose up -d   # PostgreSQL 起動
npm run dev            # 開発サーバー起動 → http://localhost:3000
```

## 環境変数（.env）

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/event_calendar"
SITE_USERNAME="admin"
SITE_PASSWORD="password"
SESSION_SECRET="32文字以上のランダムな文字列"
```

## DB操作

```bash
npx prisma db push           # スキーマ変更を反映（開発用）
npx prisma generate          # Prismaクライアント再生成
npx prisma migrate dev       # マイグレーション作成（本番向け）
```

スキーマ変更後は必ず `prisma generate` を実行して開発サーバーを再起動すること。

## ディレクトリ構成

```
src/
  app/
    api/
      auth/         # ログイン・ログアウト API
      events/       # イベント CRUD API
      fetch-title/  # URL からタイトル取得 API
    login/          # ログインページ
    page.tsx        # カレンダーページ（メイン）
  components/
    EventFormModal.tsx    # イベント登録・編集フォーム
    EventDetailModal.tsx  # イベント詳細・削除
  lib/
    prisma.ts       # Prisma クライアント（シングルトン）
    session.ts      # iron-session 設定
    validation.ts   # Zod スキーマ（型の単一ソース）
    date-utils.ts   # 日付変換ユーティリティ（UTC 基準）
  types/
    event.ts        # 型定義（validation.ts から z.infer で推論）
  middleware.ts     # 認証ガード
```

## 重要な設計メモ

- **日付はすべて UTC で管理**。`date-utils.ts` の関数を使うこと（`new Date("YYYY-MM-DD")` はローカルTZで解釈されるため直接使わない）
- **FullCalendar の end は exclusive**。DB の endDate（inclusive）は `inclusiveToExclusiveDate()` で変換してから渡す
- **型の単一ソースは `validation.ts`**。`EventType` や `RelatedUrlType` は Zod スキーマから `z.infer<>` で推論し、`types/event.ts` に直書きしない
- **Prisma 7 の接続**は `accelerateUrl` ではなく `@prisma/adapter-pg` の `adapter` オプションを使う
- **スキーマ変更**は `prisma db push --accept-data-loss`（開発）または `prisma migrate dev`（本番）

## DBスキーマ概要

- `Event`: イベント本体（url, title, startDate, endDate, type, description）
- `RelatedUrl`: 関連URL（url, urlType）、Event に cascade 削除
- `EventType`: `SPEAKER`（登壇）/ `ATTENDEE`（参加）
- `RelatedUrlType`: `REPORT` / `SLIDES` / `VIDEO` / `OTHER`
