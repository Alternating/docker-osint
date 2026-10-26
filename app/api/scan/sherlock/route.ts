import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { USERNAME_RE } from "@/lib/tools/sherlock";
import { startJob } from "@/lib/jobs";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    if (typeof body.username !== "string" || !USERNAME_RE.test(body.username)) {
      return NextResponse.json({ error: "invalid username" }, { status: 400 });
    }

    const id = startJob("sherlock", body.username);
    return NextResponse.json({ id });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
