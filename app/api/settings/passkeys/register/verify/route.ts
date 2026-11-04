import { NextRequest, NextResponse } from "next/server";
import {
  verifyRegistrationResponse,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { getSessionUser, rpConfig, takeChallenge } from "@/lib/auth";
import { getDb, now } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const key = req.cookies.get("suron_reg_challenge")?.value;
    const saved =
      key && /^[0-9a-f-]{36}$/.test(key) ? takeChallenge(`reg:${key}`) : null;
    if (!saved?.data) {
      return NextResponse.json(
        { error: "no pending passkey registration" },
        { status: 400 }
      );
    }

    const { userId, name } = JSON.parse(saved.data) as {
      userId: number;
      name: string | null;
    };
    // The challenge is bound to the session that started it.
    if (userId !== user.id) {
      return NextResponse.json({ error: "session mismatch" }, { status: 403 });
    }

    const { rpID, origin } = rpConfig();
    const body = (await req.json()) as { response: RegistrationResponseJSON };

    const verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: saved.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { error: "passkey verification failed" },
        { status: 400 }
      );
    }

    const cred = verification.registrationInfo.credential;
    const db = getDb();

    const already = db
      .prepare("SELECT 1 FROM credentials WHERE id = ?")
      .get(cred.id);
    if (already) {
      return NextResponse.json(
        { error: "this passkey is already registered" },
        { status: 409 }
      );
    }

    db.prepare(
      "INSERT INTO credentials (id, user_id, public_key, counter, transports, created_at, name) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(
      cred.id,
      user.id,
      Buffer.from(cred.publicKey),
      cred.counter,
      cred.transports ? JSON.stringify(cred.transports) : null,
      now(),
      name
    );

    const res = NextResponse.json({ ok: true });
    res.cookies.delete("suron_reg_challenge");
    return res;
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
