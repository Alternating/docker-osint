import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const db = getDb();
    const { c } = db
      .prepare("SELECT COUNT(*) AS c FROM credentials WHERE user_id = ?")
      .get(user.id) as { c: number };
    if (c <= 1) {
      return NextResponse.json(
        { error: "cannot remove your only passkey" },
        { status: 400 }
      );
    }

    const info = db
      .prepare("DELETE FROM credentials WHERE id = ? AND user_id = ?")
      .run(id, user.id);
    if (info.changes === 0) {
      return NextResponse.json({ error: "passkey not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = (await req.json()) as { name?: string };

    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }

    const info = getDb()
      .prepare("UPDATE credentials SET name = ? WHERE id = ? AND user_id = ?")
      .run(body.name.trim().slice(0, 64), id, user.id);

    if (info.changes === 0) {
      return NextResponse.json({ error: "passkey not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
