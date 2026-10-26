import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { EMAIL_RE } from "@/lib/tools/holehe";
import { startJob } from "@/lib/jobs";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    if (
      typeof body.target !== "string" ||
      body.target.length > 254 ||
      !EMAIL_RE.test(body.target)
    ) {
      return NextResponse.json({ error: "invalid email" }, { status: 400 });
    }

    const id = startJob("email", body.target);
    return NextResponse.json({ id });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
