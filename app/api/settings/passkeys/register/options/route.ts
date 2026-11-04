import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { getSessionUser, saveChallenge, rpConfig } from "@/lib/auth";
import { getDb, type CredentialRow } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as { name?: string };
    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim().slice(0, 64)
        : null;

    // Don't let the admin register the same authenticator twice.
    const existing = getDb()
      .prepare("SELECT * FROM credentials WHERE user_id = ?")
      .all(user.id) as CredentialRow[];

    const { rpName, rpID } = rpConfig();
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: user.username,
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "preferred",
      },
      excludeCredentials: existing.map((c) => ({
        id: c.id,
        transports: c.transports ? JSON.parse(c.transports) : undefined,
      })),
    });

    const key = crypto.randomUUID();
    saveChallenge(
      `reg:${key}`,
      options.challenge,
      JSON.stringify({ userId: user.id, name })
    );

    const res = NextResponse.json(options);
    res.cookies.set("suron_reg_challenge", key, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/api/settings/passkeys",
      maxAge: 300,
    });
    return res;
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
