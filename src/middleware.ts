import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ログインページ・認証API・閲覧系は保護しない
  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    (pathname === "/" && req.method === "GET") ||
    (pathname === "/api/events" && req.method === "GET") ||
    (pathname.startsWith("/api/events/") && req.method === "GET");

  if (isPublic) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);

  if (!session.isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
