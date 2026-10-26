import { NextRequest, NextResponse } from "next/server";
import {
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import { takeChallenge, createSession, rpConfig } from "@/lib/auth";
import { getDb, type CredentialRow } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const key = req.cookies.get("suron_challenge")?.value;
    const saved =
      key && /^[0-9a-f-]{36}$/.test(key) ? takeChallenge(`login:${key}`) : null;
    if (!saved) {
      return NextResponse.json({ error: "no pending login challenge" }, { status: 400 });
    }

    const body = (await req.json()) as { response: AuthenticationResponseJSON };
    const db = getDb();
    const row = db
      .prepare("SELECT * FROM credentials WHERE id = ?")
      .get(body.response.id) as CredentialRow | undefined;

    if (!row) {
      return NextResponse.json({ error: "unknown passkey" }, { status: 404 });
    }

    const { rpID, origin } = rpConfig();
    const verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: saved.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: row.id,
        publicKey: new Uint8Array(row.public_key),
        counter: row.counter,
        transports: row.transports ? JSON.parse(row.transports) : undefined,
      },
    });

    if (!verification.verified) {
      return NextResponse.json({ error: "authentication failed" }, { status: 401 });
    }

    db.prepare("UPDATE credentials SET counter = ? WHERE id = ?").run(
      verification.authenticationInfo.newCounter,
      row.id
    );
    await createSession(row.user_id);
    const res = NextResponse.json({ ok: true });
    res.cookies.delete("suron_challenge");
    return res;
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
