import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  API_CONNECTIONS,
  getConnection,
  connectionStatus,
  setSetting,
  deleteSetting,
} from "@/lib/settings";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const connections = API_CONNECTIONS.map((conn) => {
      const s = connectionStatus(conn.id);
      return {
        id: conn.id,
        label: conn.label,
        description: conn.description,
        docsUrl: conn.docsUrl,
        testable: conn.testable,
        configured: s.configured,
        source: s.source,
        masked: s.masked,
      };
    });

    return NextResponse.json({ connections });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = (await req.json()) as { id?: string; apiKey?: string };

    if (typeof body.id !== "string") {
      return NextResponse.json({ error: "unknown connection" }, { status: 400 });
    }

    const conn = getConnection(body.id);
    if (!conn) {
      return NextResponse.json({ error: "unknown connection" }, { status: 400 });
    }

    const raw = typeof body.apiKey === "string" ? body.apiKey.trim() : "";

    if (raw === "") {
      deleteSetting(conn.settingKey);
    } else {
      setSetting(conn.settingKey, raw);
    }

    return NextResponse.json({ status: connectionStatus(conn.id) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
