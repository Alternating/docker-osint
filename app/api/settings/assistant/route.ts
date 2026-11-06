import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getOllamaConfig, ollamaStatus } from "@/lib/ollama";
import { setSetting } from "@/lib/settings";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { host, model } = getOllamaConfig();
    return NextResponse.json({ host, model, configured: model !== "" });
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
      host?: string;
      model?: string;
    };

    if (body.action === "save") {
      const host = typeof body.host === "string" ? body.host.trim() : "";
      const model = typeof body.model === "string" ? body.model.trim() : "";

      if (host && !/^https?:\/\//i.test(host)) {
        return NextResponse.json(
          { error: "host must start with http:// or https://" },
          { status: 400 }
        );
      }

      setSetting("ollama.host", host);
      setSetting("ollama.model", model);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "test") {
      try {
        // Test what's in the form, not just the saved config.
        const message = await ollamaStatus({ host: body.host, model: body.model });
        return NextResponse.json({ ok: true, message });
      } catch (e) {
        // 200 so the client renders the failure reason inline.
        return NextResponse.json({ ok: false, error: (e as Error).message });
      }
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
