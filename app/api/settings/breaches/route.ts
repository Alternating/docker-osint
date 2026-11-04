import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listBreachSources, importBreach, type BreachFormat } from "@/lib/breaches";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    return NextResponse.json({ sources: listBreachSources() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const form = await req.formData();
    const name = String(form.get("name") ?? "").trim();
    const format = String(form.get("format") ?? "");
    const noteRaw = form.get("note");
    const note = noteRaw ? String(noteRaw).trim() || null : null;
    const file = form.get("file");

    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

    const VALID = ["email", "combo", "csv"];
    if (!VALID.includes(format)) {
      return NextResponse.json({ error: "invalid format" }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }

    const content = await file.text();
    if (content.length > 25_000_000) {
      return NextResponse.json({ error: "file too large (25MB max)" }, { status: 413 });
    }

    try {
      const { id, entryCount } = importBreach({
        name: name.slice(0, 128),
        format: format as BreachFormat,
        note,
        content,
      });
      return NextResponse.json({ id, entryCount });
    } catch (e) {
      const msg = (e as Error).message;
      const status = msg === "breach file too large" ? 413 : 400;
      return NextResponse.json({ error: msg }, { status });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
