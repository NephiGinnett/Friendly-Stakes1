import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const challenge = await prisma.challenge.findUnique({
    where: { id: parseInt(params.id) },
    include: {
      creator: { select: { id: true, username: true } },
      target: { select: { id: true, username: true } },
      acceptedBy: { select: { id: true, username: true } },
      votes: { include: { user: { select: { id: true, username: true } } } },
    },
  });

  if (!challenge) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(challenge);
}
