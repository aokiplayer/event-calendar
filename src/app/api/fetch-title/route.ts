import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

const PRIVATE_IP_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,   // AWS メタデータ等のリンクローカル
  /^0\./,          // "現在のネットワーク"
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT 100.64.0.0/10
  /^::1$/,         // IPv6 ループバック
  /^::$/,          // IPv6 unspecified
  /^f[cd][0-9a-f]{2}:/i, // IPv6 プライベート fc00::/7
  /^fe80:/i,       // IPv6 リンクローカル
];

function isPrivateAddress(hostname: string): boolean {
  // IPv4-mapped IPv6 (::ffff:127.0.0.1 等) は内側の IPv4 部分を検証する
  const mapped = hostname.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  const target = mapped ? mapped[1] : hostname;
  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(target));
}

function isSafeUrl(urlString: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }

  if (isPrivateAddress(parsed.hostname)) {
    return false;
  }

  return true;
}

// DNS リバインディング対策: isSafeUrl() はホスト名の文字列しか見ておらず、
// 「一見安全な外部ドメインだが名前解決すると内部/プライベートIPを指す」ケースを
// すり抜けられる。fetch() が使うのと同じ名前解決結果を事前に検証する。
// （名前解決から実際の fetch までの間に DNS 応答が切り替わる極小の TOCTOU
// ウィンドウは残るが、静的な悪意ある DNS レコードによる攻撃は防げる）
async function resolvesToPrivateAddress(hostname: string): Promise<boolean> {
  if (isIP(hostname)) {
    return isPrivateAddress(hostname);
  }

  try {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    return addresses.some((a) => isPrivateAddress(a.address));
  } catch {
    // 名前解決できない場合は安全側に倒して拒否
    return true;
  }
}

// Content-Encoding は "gzip, br" のように複数指定できるので、トークン単位で見る
function hasBrotliEncoding(contentEncoding: string | null): boolean {
  if (!contentEncoding) return false;
  return contentEncoding
    .split(",")
    .some((token) => token.trim().toLowerCase() === "br");
}

export async function GET(req: NextRequest) {
  const authRes = NextResponse.next();
  const session = await getIronSession<SessionData>(req, authRes, sessionOptions);
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  if (!isSafeUrl(url)) {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  const hostname = new URL(url).hostname;
  if (await resolvesToPrivateAddress(hostname)) {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; EventCalendarBot/1.0)",
        // br を要求しない（まともなサーバーはこれで br を返さなくなる）
        "Accept-Encoding": "gzip, deflate",
      },
      signal: AbortSignal.timeout(5000),
      redirect: "error",
    });

    // CVE-2026-111497（Node.js の Brotli デコーダの境界外書き込み）対策の多重防御。
    // fetch() は Content-Encoding: br を本文の読み出し時に自動展開するため、
    // 攻撃者のサイトが要求を無視して br を返してきた場合は本文を読まずに捨てる。
    // 根本対策は修正済みランタイム（engines で Node 24.x を指定）への更新。
    if (hasBrotliEncoding(res.headers.get("content-encoding"))) {
      await res.body?.cancel();
      return NextResponse.json({ title: "" });
    }

    if (!res.ok) {
      return NextResponse.json({ title: "" });
    }

    const html = await res.text();
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = match ? match[1].trim() : "";
    return NextResponse.json({ title });
  } catch {
    return NextResponse.json({ title: "" });
  }
}
