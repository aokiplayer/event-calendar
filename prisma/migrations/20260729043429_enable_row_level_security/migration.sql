-- Supabase は public スキーマの全テーブルを PostgREST 経由で自動公開する。
-- RLS が無効なテーブルは anon キーだけで直接 SELECT/INSERT/UPDATE/DELETE が可能になり、
-- アプリ側の iron-session 認証（POST/PUT/DELETE はログイン必須）を完全にバイパスできてしまう。
-- ここではポリシーを一切追加せず「デフォルト拒否」にすることで、
-- Supabase の anon/authenticated ロール経由のアクセスをすべて遮断する。
-- Prisma（DATABASE_URL）はテーブルオーナー権限で直接接続するため RLS の影響を受けず、
-- アプリの動作はこれまで通り。

ALTER TABLE "Event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RelatedUrl" ENABLE ROW LEVEL SECURITY;
