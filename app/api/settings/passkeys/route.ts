import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const rows = getDb()
      .prepare(
        "SELECT id, name, created_at, last_used_at, transports FROM credentials WHERE user_id = ? ORDER BY created_at ASC"
      )
      .all(user.id) as {
      id: string;
      name: string | null;
      created_at: number;
      last_used_at: number | null;
      transports: string | null;
    }[];

    const passkeys = rows.map((r) => ({
      id: r.id,
      name: r.name,
      createdAt: r.created_at,
      lastUsedAt: r.last_used_at,
      transports: r.transports ? (JSON.parse(r.transports) as string[]) : [],
    }));

    return NextResponse.json({ passkeys, count: passkeys.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
