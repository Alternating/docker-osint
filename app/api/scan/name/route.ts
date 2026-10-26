import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { startJob } from "@/lib/jobs";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const t = typeof body.target === "string" ? body.target.trim() : "";
    if (!/^[\p{L}][\p{L} .'-]{1,79}$/u.test(t)) {
      return NextResponse.json({ error: "invalid name" }, { status: 400 });
    }

    const id = startJob("name", t);
    return NextResponse.json({ id });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
