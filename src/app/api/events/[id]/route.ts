import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { eventSchema } from "@/lib/validation";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const event = await prisma.event.findUnique({
    where: { id },
    include: { relatedUrls: true },
  });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(event);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { url, title, startDate, endDate, type, description, relatedUrls } = parsed.data;

  const event = await prisma.event.update({
    where: { id },
    data: {
      url,
      title,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      type,
      description: description ?? null,
      relatedUrls: {
        deleteMany: {},
        create: relatedUrls.map((r) => ({ url: r.url, urlType: r.urlType })),
      },
    },
    include: { relatedUrls: true },
  });
  return NextResponse.json(event);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.event.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
