# 参加・登壇・気になるイベント情報

社内メンバーが参加・登壇するイベントを登録・共有するWebアプリ。

## 機能

- イベントの登録・編集・削除
- URL からタイトルを自動取得
- カレンダー（月表示）で一覧確認
- 登壇 / 参加の色分け表示
- 関連URL（レポート・登壇資料・動画など）の複数登録
- 簡易認証（全員共通のID/パスワード）

## 技術スタック

- [Next.js](https://nextjs.org/) (App Router)
- [PostgreSQL](https://www.postgresql.org/) + [Prisma](https://www.prisma.io/)
- [FullCalendar](https://fullcalendar.io/)
- [Tailwind CSS](https://tailwindcss.com/)
- [iron-session](https://github.com/vvo/iron-session)

## ローカル開発

### Docker だけで動かす（Node.js のインストール不要）

```bash
docker compose --profile app up    # DB と開発サーバーを起動 → http://localhost:3000（admin / password）
```

- 初回と `package-lock.json` が変わったときだけ、コンテナ内で `npm ci` が走る（`docker/app-entrypoint.sh`）
- 接続先はコンテナの環境変数でローカル DB に固定しているので、`.env` が本番を指していても本番には繋がらない
- 起動時に `prisma db push` をローカル DB にだけ流す
- `node_modules` と `.next` は名前付きボリュームに置き、ホストとは共有しない
- 任意のコマンド: `docker compose --profile app run --rm app npm run lint`
- 停止: `docker compose --profile app down`（DB のデータも消すなら `-v`）

### ホストの Node.js で動かす場合

#### 必要なもの

- Node.js 24.x
- Docker

#### 起動手順

```bash
# 1. 依存パッケージのインストール
npm install

# 2. 環境変数の設定
cp .env.example .env
# .env を編集してください

# 3. PostgreSQL 起動
docker compose up -d

# 4. DB の初期化
npx prisma db push
npx prisma generate

# 5. 開発サーバー起動
npm run dev
```

http://localhost:3000 にアクセス。

## 環境変数

`.env.example` をコピーして `.env` を作成し、各値を設定してください。

| 変数名 | 説明 |
|--------|------|
| `DATABASE_URL` | PostgreSQL の接続文字列 |
| `SITE_USERNAME` | ログインユーザー名 |
| `SITE_PASSWORD` | ログインパスワード |
| `SESSION_SECRET` | セッション暗号化キー（32文字以上） |
| `CONNPASS_API_KEY` | 任意。[connpass API v2](https://connpass.com/about/api/v2/) のキー。設定すると connpass の URL でもタイトルを自動取得する（未設定なら手入力） |

`SESSION_SECRET` の生成：

```bash
openssl rand -base64 32
```

## デプロイ

Vercel + Supabase を利用。

1. [Supabase](https://supabase.com/) でプロジェクトを作成し、接続文字列を取得
2. [Vercel](https://vercel.com/) に GitHub リポジトリを連携してデプロイ
3. Vercel の環境変数に上記を設定（`CONNPASS_API_KEY` は任意）
