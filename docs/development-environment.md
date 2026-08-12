# 開発・検証環境と本番環境

このドキュメントは、**ローカルで安全に動作確認するための環境の作り方**と、**本番環境との違い**をまとめたもの。

書いた動機は単純で、このリポジトリは長らく「ローカル開発サーバーが本番 DB に直接繋がっている」状態だったため。カレンダーを開くだけなら害はないが、イベントを1件作れば本番に残るし、`prisma db push` を叩けば本番にスキーマ変更が流れる。2026-08-12 に種別「情報」と投稿者名を追加した際、この構成のまま検証するのは危険だったのでローカル DB を立てた。その手順と注意点を残す。

---

## 1. 全体像

### 本番（Vercel + Supabase）

```mermaid
flowchart LR
    Browser[ブラウザ] -->|HTTPS| Vercel["Vercel<br/>Next.js 16"]
    Vercel -->|"Prisma + @prisma/adapter-pg<br/>DATABASE_URL"| Pooler["Supavisor<br/>トランザクションプーラ<br/>:6543"]
    Pooler --> PG[("Supabase<br/>PostgreSQL")]
    Cron["Vercel Cron<br/>毎日 0:00 UTC"] -->|"Bearer CRON_SECRET"| Keepalive["/api/keepalive"]
    Keepalive --> Vercel
    PostgREST["Supabase 自動生成<br/>REST API"] -.->|"RLS で全拒否"| PG
```

- Prisma はテーブルオーナー権限で接続するため RLS の影響を受けない。`anon` キー経由の PostgREST だけが遮断される（詳細は [row-level-security.md](./row-level-security.md)）
- Supabase 無料プランは7日間アクセスがないと DB が停止するため、Cron で `/api/keepalive` を叩いて疎通を維持している

### ローカル検証環境

```mermaid
flowchart LR
    Browser[ブラウザ] -->|http://localhost:3000| Dev["next dev<br/>:3000"]
    Dev -->|"DATABASE_URL<br/>(.env.local が優先)"| Local[("Docker<br/>postgres:16-alpine<br/>localhost:5432")]
    Prod[("本番 Supabase")]
    Dev -.->|繋がない| Prod
```

ポイントは **`.env` を書き換えずに `.env.local` を足すだけ**で切り替わること。`.env` は本番の値のまま残るので、うっかりコミットして壊す事故が起きない。

---

## 2. ⚠️ 最大の落とし穴：Next.js と Prisma CLI で `DATABASE_URL` の解決先が違う

`.env.local` を置いても、**`npx prisma db push` は本番を向いたまま**。理由は環境変数の読み込み経路が別だから。

```mermaid
flowchart TB
    subgraph runtime["Next.js ランタイム（next dev / next build）"]
        direction TB
        R1[".env.local"] -->|優先| R2[".env"]
        R2 --> RESULT1["→ localhost:5432<br/>ローカル DB ✅"]
    end
    subgraph cli["Prisma CLI（db push / migrate）"]
        direction TB
        C1["prisma.config.ts"] --> C2["import 'dotenv/config'"]
        C2 --> C3[".env のみ<br/>.env.local は読まない"]
        C3 --> RESULT2["→ pooler.supabase.com:6543<br/>本番 DB ⚠️"]
    end
```

実測して確認済み：

```console
$ node -e 'require("dotenv/config"); console.log(process.env.DATABASE_URL)'
postgresql://postgres.xxxx:***@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres   ← 本番
```

`prisma.config.ts` が `datasource.url: process.env["DATABASE_URL"]` を `dotenv/config` 経由で解決しているためで、dotenv は `.env.local` を読まない。

### 対策：Prisma CLI には必ず接続先を明示する

```bash
npx prisma db push --url "postgresql://postgres:postgres@localhost:5432/event_calendar"
```

`--url` を付ければ設定ファイル側の URL を上書きできる。**ローカルに対して Prisma CLI を叩くときは必ずこれを付ける。**

インライン環境変数でも上書きできる（dotenv は既に設定済みの変数を上書きしないため）。

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/event_calendar" npx prisma db push
```

ただし `--url` の方が意図が読み取りやすく、履歴に残ったときの誤読も起きにくいので推奨。

---

## 3. ローカル検証環境の構築手順

### 3-1. Postgres を起動

```bash
docker compose up -d
```

`docker-compose.yml` の内容は `postgres:16-alpine` / user `postgres` / password `postgres` / DB `event_calendar` / ポート 5432。データは名前付きボリューム `postgres_data` に残るので、コンテナを消してもデータは消えない。完全に作り直したいときは `docker compose down -v`。

### 3-2. スキーマを流す

```bash
npx prisma db push --url "postgresql://postgres:postgres@localhost:5432/event_calendar"
```

**ローカルは使い捨てなので `db push` を使ってよい。** 本番に対しては使わない（理由は次章）。

### 3-3. `.env.local` を作る

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/event_calendar"
```

`.gitignore` は `.env*` を無視するのでコミットされない。Next.js の読み込み順は `.env.local` > `.env` なので、これだけで dev サーバーの接続先が切り替わる。

### 3-4. 起動

```bash
npm run dev
```

### 3-5. 動作確認用のデータを入れる

ローカルは空なので、必要なら既存データを模したレコードを入れる。既存データの回帰を見たいときは、**新しく足したカラムが NULL の行**を用意するのが重要（本番の既存行と同じ状態を再現するため）。

```sql
INSERT INTO "Event" (id,url,title,"startDate","endDate",type,description,"createdAt","updatedAt")
VALUES ('seed-1','https://example.com/a','既存の登壇イベント','2026-08-19','2026-08-19','SPEAKER',NULL,now(),now());
```

### 3-6. 本番に戻す

`.env.local` を削除して dev サーバーを再起動するだけ。`.env` は触っていないので元の状態に戻る。

```bash
rm .env.local
```

---

## 4. スキーマ変更をどう適用するか

**ローカルと本番で手順がまったく違う。** ここを間違えると本番のデータが壊れる。

```mermaid
flowchart TB
    Start["schema.prisma を編集"] --> Gen["npx prisma generate<br/>（DB に接続しない）"]
    Gen --> Branch{"適用先は？"}
    Branch -->|ローカル| L["npx prisma db push --url ...localhost..."]
    Branch -->|本番| P["Supabase SQL エディタで<br/>追加専用の DDL を手で流す"]
    L --> Done["dev サーバー再起動"]
    P --> Done
```

### なぜ本番には `db push` / `migrate` を使わないのか

理由は3つある。

| # | 問題 | 何が起きるか |
|---|------|--------------|
| 1 | `.env` が本番を指している | 何も考えず `db push` を叩くと本番に DDL が流れる |
| 2 | ポート 6543 はトランザクションプーラ | Prisma の `migrate` / `db push` は直結（5432）を要求する。アドバイザリロックが効かず、ハングや中途半端な適用が起きうる |
| 3 | `prisma/migrations/` がドリフトしている | `db push` は差分全体を見るため、意図しない `DROP COLUMN` を含む破壊的差分になりうる |

3 について補足すると、`prisma/migrations/20260326052106_init/` は現在の `schema.prisma` と一致していない。

- `init` には既に存在しない `reportUrl` カラムがある
- `RelatedUrl` テーブルと `RelatedUrlType` enum を作るマイグレーションが存在しない（過去に `db push` で適用され、マイグレーションとして記録されなかった）
- にもかかわらず後続の `20260729043429_enable_row_level_security/` は `RelatedUrl` に対して `ALTER TABLE` している

つまり **このマイグレーション履歴は、空の DB に対して `migrate deploy` すると途中で失敗する**。`migrate dev` を叩くとドリフトを検出して「リセットするか？」と聞いてくるが、本番に対してこれを承認したら全データが消える。

なお 2026-08-12 時点で本番に `reportUrl` は残っていないことを確認済み。ただし上記 1・2 の問題は解消していないので、`db push` は依然として使わない。

### 本番への適用手順（現行）

Supabase の SQL エディタ（直結セッション、プーラを経由しない）で、**追加専用の DDL を手で流す**。

```sql
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'INFO';
```

```sql
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "postedBy" TEXT;
```

守るべきルール：

- **`ALTER TYPE ... ADD VALUE` と、その値を使う文は実行を分ける。** Postgres は同一トランザクション内で追加した enum 値をそのトランザクション内で*使う*ことを禁じる（追加するだけなら問題ない）
- **`ADD COLUMN` は NOT NULL・DEFAULT なしにする。** カタログ更新のみで済みテーブル書き換えが起きないため、既存行への影響がゼロになる（既存行は NULL）
- **`--accept-data-loss` は使わない。** 破壊的差分を承認するフラグであり、今回避けたい事故そのもの
- **新しいテーブルを追加したら RLS を有効化する。** カラム追加は既存テーブルの RLS 設定を引き継ぐので不要
- **enum 値の追加は巻き戻せない。** Postgres に `DROP VALUE` 相当の構文はない（カラム追加は `DROP COLUMN` で戻せる）

### デプロイ順序

```mermaid
sequenceDiagram
    participant Dev as 開発者
    participant SB as Supabase
    participant GH as GitHub
    participant V as Vercel
    Dev->>SB: 1. DDL を適用（先）
    SB-->>Dev: 成功を確認
    Dev->>GH: 2. コード変更を push
    GH->>V: 3. ビルド（prisma generate && next build）
    V-->>Dev: デプロイ完了
```

**DDL が先。** enum 値が DB に無い状態で新コードが `INFO` を POST すると `invalid input value for enum EventType` で 500 になる。

逆に、旧コードが動いている状態で DDL を先に当てるのは安全。Prisma は明示的なカラムリストで SELECT するため、生成クライアントが知らない `postedBy` を見に行くことはない。

なお Vercel のビルドは `prisma generate && next build`（`package.json` の `build`）であり、**`prisma migrate deploy` は含まれない**。ドリフトしたマイグレーションがデプロイ時に実行されることはない。`src/generated/prisma` は gitignore されているが、ビルド時に `schema.prisma` から再生成されるので問題ない。

---

## 5. 本番とローカルの違い一覧

| 項目 | ローカル | 本番 |
|---|---|---|
| ホスティング | `next dev`（Turbopack）localhost:3000 | Vercel |
| DB | Docker `postgres:16-alpine` | Supabase PostgreSQL |
| 接続 | 直結 localhost:5432 | Supavisor トランザクションプーラ :6543 |
| `DATABASE_URL` の出所 | `.env.local` | Vercel の環境変数 |
| RLS | `db push` で作ったテーブルには**設定されない** | `Event` / `RelatedUrl` で有効（ポリシー無し＝全拒否） |
| PostgREST | 存在しない | Supabase が自動公開（RLS で遮断済み） |
| Cron / keepalive | 動かない | 毎日 0:00 UTC に `/api/keepalive` |
| `CRON_SECRET` | 不要 | 必須 |
| Cookie の `secure` | false（`NODE_ENV !== "production"`） | true |
| スキーマ変更 | `db push --url ...localhost...` | SQL エディタで手書き DDL |

RLS の行が地味に効いてくる。**ローカルで `db push` して作ったテーブルは RLS が無効**なので、「ローカルで動いたから大丈夫」は RLS に関しては成り立たない。新しいテーブルを追加したときは、本番側で `ENABLE ROW LEVEL SECURITY` を忘れないこと。

認証まわりはローカルと本番で構造は同じ（全員共有の固定 ID / パスワード、iron-session）。ただし `.env` の初期値は `admin` / `password` なので、本番の Vercel 側では必ず別の値にしておくこと。

---

## 6. 今後やるべきこと（未対応）

### 6-1. `.env` をローカル向けに戻す

本来 `.env` は `.env.example` と同じくローカルを指すべきで、本番の接続文字列が開発者のマシンに置かれている状態自体が良くない。`.env.local` による回避は検証時の応急処置であり、恒久対応ではない。

### 6-2. マイグレーション履歴のベースラインを作り直す

本番の実スキーマから履歴を作り直せば、以後は手書き DDL を卒業できる。

```bash
# 1. 本番の実スキーマから init を作り直す
npx prisma migrate diff --from-empty --to-url "<本番の直結URL:5432>" --script > prisma/migrations/<timestamp>_baseline/migration.sql

# 2. 既に適用済みとして記録する（DB は変更されない）
npx prisma migrate resolve --applied <timestamp>_baseline
```

注意点として、`--to-url` には**プーラ（6543）ではなく直結（5432）の URL** を使うこと。また既存の2つのマイグレーションディレクトリの扱い（削除するか残すか）を決める必要がある。

これが済めば `migrate dev` / `migrate deploy` が正常に使えるようになり、本章の「手書き DDL」の運用は不要になる。

---

## 関連ドキュメント

- [row-level-security.md](./row-level-security.md) — RLS の仕組みと、なぜこのプロジェクトで必要なのか
- [2026-07-29-security-fixes.md](./2026-07-29-security-fixes.md) — RLS 未設定と SSRF の対応記録
- [../CLAUDE.md](../CLAUDE.md) — プロジェクト全体のガイド
