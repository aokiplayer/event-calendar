import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { eventSchema } from "@/lib/validation";

export async function GET() {
  const events = await prisma.event.findMany({
    orderBy: { startDate: "asc" },
    include: { relatedUrls: true },
  });
  return NextResponse.json(events);
}

export async function POST(req: NextRequest) {
  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { url, title, startDate, endDate, type, description, relatedUrls } = parsed.data;

  const event = await prisma.event.create({
    data: {
      url,
      title,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      type,
      description: description ?? null,
      relatedUrls: {
        create: relatedUrls.map((r) => ({ url: r.url, urlType: r.urlType })),
      },
    },
    include: { relatedUrls: true },
  });

  return NextResponse.json(event, { status: 201 });
}
