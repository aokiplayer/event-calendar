import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";

const PRIVATE_IP_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,   // AWS メタデータ等のリンクローカル
  /^::1$/,         // IPv6 ループバック
  /^fc00:/i,       // IPv6 プライベート
  /^fe80:/i,       // IPv6 リンクローカル
];

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

  const hostname = parsed.hostname;
  if (PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(hostname))) {
    return false;
  }

  return true;
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

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; EventCalendarBot/1.0)" },
      signal: AbortSignal.timeout(5000),
      redirect: "follow",
    });

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
