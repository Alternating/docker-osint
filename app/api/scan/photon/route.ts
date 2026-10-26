import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { validateTargetUrl } from "@/lib/tools/photon";
import { startJob } from "@/lib/jobs";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    let normalized: string;
    try {
      normalized = validateTargetUrl(String(body.url ?? ""));
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "invalid url" },
        { status: 400 }
      );
    }

    const level = typeof body.level === "number" ? body.level : undefined;
    const id = startJob("photon", normalized, { level });
    return NextResponse.json({ id });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
