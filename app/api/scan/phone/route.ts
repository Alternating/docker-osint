import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { PHONE_RE } from "@/lib/tools/phone";
import { startJob } from "@/lib/jobs";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const target = typeof body.target === "string" ? body.target.trim() : "";
    if (!PHONE_RE.test(target)) {
      return NextResponse.json({ error: "invalid phone number" }, { status: 400 });
    }

    const id = startJob("phone", target);
    return NextResponse.json({ id });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
