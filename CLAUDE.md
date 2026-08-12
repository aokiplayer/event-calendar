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

本番（Vercel）では上記に加えて `CRON_SECRET` も設定すること（後述）。

## DB操作

```bash
npx prisma db push           # スキーマ変更を反映（開発用）
npx prisma generate          # Prismaクライアント再生成
npx prisma migrate dev       # マイグレーション作成（本番向け）
```

スキーマ変更後は必ず `prisma generate` を実行して開発サーバーを再起動すること。

### ⚠️ `db push` / `migrate` を安易に実行しないこと

2つの問題があり、上記コマンドはそのままでは危険：

1. **`.env` の `DATABASE_URL` が本番 Supabase を指している**（`...pooler.supabase.com:6543`）。ローカル Postgres の URL は残っていないため、`db push` を叩くと本番に DDL が流れる。しかも 6543 はトランザクションプーラで、Prisma の `migrate` / `db push` は直結（5432）を要求するため、アドバイザリロックが効かずハングや中途半端な適用が起きうる
2. **`prisma/migrations/` が schema.prisma とドリフトしている**。`init` には既に存在しない `reportUrl` カラムがあり、`RelatedUrl` テーブルを作るマイグレーションが存在しない（`db push` で適用され記録されなかった）。`db push` は差分全体を見るため、本番に `reportUrl` が残っていれば `DROP COLUMN` を含む破壊的差分になる

**当面は、追加専用の DDL を Supabase の SQL エディタ（直結セッション）で手で流し、ローカルでは `prisma generate` だけ実行する**（`generate` は schema.prisma を読むだけで DB に接続しない）。`--accept-data-loss` は破壊的差分を承認するフラグなので使わない。

適用済みの手書き DDL：

```sql
-- 2026-08-12 種別「情報」と投稿者名を追加（2文を別々に実行すること）
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'INFO';
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "postedBy" TEXT;
```

Postgres は同一トランザクション内で追加した enum 値をそのトランザクション内で*使う*ことを禁じる。追加するだけなら問題ないが、念のため実行を分ける。`ADD COLUMN`（NOT NULL・DEFAULT なし）はカタログ更新のみでテーブル書き換えが起きず、既存行は NULL になる。

本来は `prisma migrate diff --from-empty --to-url` で本番からベースラインを作り直し、`prisma migrate resolve --applied` で既適用扱いにしてドリフトを解消すべき（未対応）。

### 本番を踏まずに動作確認する

`docker compose up -d` でローカル Postgres を立て、`.env.local` で `DATABASE_URL` を上書きする（`.env` は触らない）。

**`.env.local` を置いても Prisma CLI は `.env`＝本番を向いたまま**なので、ローカルに流すときは `--url` で接続先を明示すること。

```bash
npx prisma db push --url "postgresql://postgres:postgres@localhost:5432/event_calendar"
```

構成図・環境変数の解決経路・本番との差分の一覧は [docs/development-environment.md](docs/development-environment.md) を参照。

## ディレクトリ構成

```
src/
  app/
    api/
      auth/         # ログイン・ログアウト API
      events/       # イベント CRUD API
      fetch-title/  # URL からタイトル取得 API
      keepalive/    # Supabase 停止防止用（Vercel Cron から呼び出し）
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

## Supabase 停止防止（Vercel Cron Job）

Supabase 無料プランは7日間アクセスがないと DB が停止する。`vercel.json` に設定した Cron Job が毎日 0 時（UTC）に `/api/keepalive` を叩き、`prisma.event.count()` で DB への疎通を維持する。

エンドポイントは `CRON_SECRET` 環境変数で保護されており、`Authorization: Bearer <CRON_SECRET>` ヘッダーがない場合は 401 を返す。Vercel はクロン実行時にこのヘッダーを自動付与する。

**Vercel に設定が必要な環境変数:**

```
CRON_SECRET="openssl rand -hex 32 で生成したランダム文字列"
```

## セキュリティ上の注意点

### Supabase の Row Level Security（RLS）

Supabase は `public` スキーマの全テーブルを PostgREST 経由で自動的に REST API 公開する。RLS が無効なテーブルは `anon` キーだけで直接 SELECT/INSERT/UPDATE/DELETE が可能になり、アプリ側の iron-session 認証（POST/PUT/DELETE はログイン必須）を完全にバイパスできてしまう（Supabase の "Table is publicly accessible" 警告はこれを指す）。

`Event` / `RelatedUrl` の両テーブルは RLS を有効化済み（ポリシーは意図的に未設定＝デフォルト全拒否）。Prisma（`DATABASE_URL`）はテーブルオーナー権限で接続しているため RLS の影響を受けず、アプリの動作に影響はない。マイグレーションは `prisma/migrations/20260729043429_enable_row_level_security/`。

**新しいテーブルを追加した場合は、必ず同様に RLS を有効化すること。** そうしないと同じ形で公開されてしまう。

### fetch-title API の SSRF 対策

`/api/fetch-title` はユーザー指定の URL を fetch してタイトルを取得するため、SSRF（Server-Side Request Forgery）のリスクがある。以下の対策をしている。

1. **`isSafeUrl()`** — プライベート IP・ループバック・リンクローカルアドレス（CGNAT・IPv4-mapped IPv6 なども含む）へのリクエストを弾く
2. **`resolvesToPrivateAddress()`** — `isSafeUrl()` はホスト名の文字列しか見ておらず、「一見安全な外部ドメインだが名前解決すると内部/プライベートIPを指す」DNS リバインディングをすり抜けられる。`dns.lookup()` で実際の名前解決結果を検証してから fetch する
3. **`redirect: "error"`** — HTTP リダイレクトを一切追わない。`redirect: "follow"` にすると、攻撃者が外部 URL からプライベート IP へリダイレクトさせることで上記チェックをバイパスできるため禁止

この設定を変更する場合は SSRF リスクを十分に考慮すること。

## DBスキーマ概要

- `Event`: イベント本体（url, title, startDate, endDate, type, description, postedBy）
- `RelatedUrl`: 関連URL（url, urlType）、Event に cascade 削除
- `EventType`: `SPEAKER`（登壇）/ `ATTENDEE`（参加）/ `INFO`（情報）
- `RelatedUrlType`: `REPORT` / `SLIDES` / `VIDEO` / `OTHER`

`INFO` は「自分は参加しないが面白そうなイベント」を共有するための種別。参加のコミットなしで投稿できるようにして、投稿のハードルを下げる目的で追加した。

`postedBy` は投稿者名（nullable）。認証は全員共有の固定ID/パスワードで identity を持たないため、フォームの自由入力にして `localStorage`（キー `event-calendar.postedBy`）に記憶する方式にしている。**編集時は localStorage を参照せず、書き込みも新規作成時のみ**（他人の投稿を編集したときに名前が入れ替わるのを防ぐため）。

種別ごとのラベルと色は `src/types/event.ts` の `EVENT_TYPE_LABELS` / `EVENT_TYPE_COLORS` に集約してある。**新しい種別を追加するときは三項演算子で分岐せずこの定数に追加すること**（`Record<EventType, ...>` なので漏れがあれば型エラーになる）。色は FullCalendar が hex を要求するため 16 進数で一元管理し、Tailwind のクラスは併用しない。
