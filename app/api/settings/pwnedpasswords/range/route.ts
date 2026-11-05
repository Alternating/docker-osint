import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getPwnedMode, localRange, onlineRange } from "@/lib/pwnedpasswords";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const prefix = (req.nextUrl.searchParams.get("prefix") ?? "").toUpperCase();
    if (!/^[0-9A-F]{5}$/.test(prefix)) {
      return NextResponse.json(
        { error: "prefix must be 5 hex characters" },
        { status: 400 }
      );
    }

    const mode = getPwnedMode();

    if (mode === "offline") {
      // Empty string when the corpus lacks this prefix (e.g. not fully built);
      // the client treats a non-match / empty range as "not found".
      const body = localRange(prefix);
      return NextResponse.json({ mode, body: body ?? "" });
    }

    try {
      const body = await onlineRange(prefix);
      return NextResponse.json({ mode, body });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 502 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
