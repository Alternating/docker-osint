import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  getPwnedMode,
  setPwnedMode,
  corpusCount,
  TOTAL_PREFIXES,
  getImportState,
  startImport,
  clearCorpus,
} from "@/lib/pwnedpasswords";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      mode: getPwnedMode(),
      corpusCount: corpusCount(),
      total: TOTAL_PREFIXES,
      import: getImportState(),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      action?: string;
      path?: string;
      mode?: string;
    };

    switch (body.action) {
      case "import": {
        const filePath = typeof body.path === "string" ? body.path.trim() : "";
        if (!filePath) {
          return NextResponse.json({ error: "path required" }, { status: 400 });
        }
        const r = startImport(filePath);
        if (!r.started) {
          return NextResponse.json(
            { error: r.error ?? "could not start import" },
            { status: 400 }
          );
        }
        return NextResponse.json({ started: true });
      }
      case "clear":
        if (getImportState().running) {
          return NextResponse.json(
            { error: "cannot clear while an import is running" },
            { status: 409 }
          );
        }
        clearCorpus();
        return NextResponse.json({ ok: true });
      case "mode": {
        if (body.mode !== "online" && body.mode !== "offline") {
          return NextResponse.json(
            { error: "mode must be online or offline" },
            { status: 400 }
          );
        }
        setPwnedMode(body.mode);
        return NextResponse.json({ ok: true, mode: body.mode });
      }
      default:
        return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
