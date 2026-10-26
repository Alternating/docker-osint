import { NextResponse } from "next/server";
import { hasUsers, getSessionUser } from "@/lib/auth";

export async function GET() {
  try {
    const needsSetup = !hasUsers();
    const authenticated = (await getSessionUser()) !== null;
    return NextResponse.json({ needsSetup, authenticated });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
