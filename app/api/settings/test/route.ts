import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getConnection } from "@/lib/settings";
import { hibpKeyStatus } from "@/lib/tools/hibp";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { id?: string };
    const conn = typeof body.id === "string" ? getConnection(body.id) : undefined;

    if (!conn || !conn.testable) {
      return NextResponse.json(
        { error: "unknown or non-testable connection" },
        { status: 400 }
      );
    }

    if (conn.id === "hibp") {
      try {
        const message = await hibpKeyStatus();
        return NextResponse.json({ ok: true, message });
      } catch (e) {
        // 200 so the client renders the failure reason inline.
        return NextResponse.json({ ok: false, error: (e as Error).message });
      }
    }

    return NextResponse.json({ error: "no tester for this connection" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
