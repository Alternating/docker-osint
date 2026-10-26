import { NextRequest, NextResponse } from "next/server";
import {
  verifyRegistrationResponse,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { hasUsers, rpConfig, takeChallenge, createSession } from "@/lib/auth";
import { getDb, now } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    if (hasUsers()) {
      return NextResponse.json({ error: "setup already completed" }, { status: 403 });
    }

    const key = req.cookies.get("suron_challenge")?.value;
    const saved =
      key && /^[0-9a-f-]{36}$/.test(key) ? takeChallenge(`setup:${key}`) : null;
    if (!saved?.data) {
      return NextResponse.json({ error: "no pending setup challenge" }, { status: 400 });
    }

    const { username } = JSON.parse(saved.data) as { username: string };
    const { rpID, origin } = rpConfig();
    const body = (await req.json()) as { response: RegistrationResponseJSON };

    const verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: saved.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: "passkey verification failed" }, { status: 400 });
    }

    const cred = verification.registrationInfo.credential;
    const db = getDb();
    const tx = db.transaction(() => {
      const info = db
        .prepare("INSERT INTO users (username, created_at) VALUES (?, ?)")
        .run(username, now());
      const userId = Number(info.lastInsertRowid);

      db.prepare(
        "INSERT INTO credentials (id, user_id, public_key, counter, transports, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(
        cred.id,
        userId,
        Buffer.from(cred.publicKey),
        cred.counter,
        cred.transports ? JSON.stringify(cred.transports) : null,
        now()
      );

      return userId;
    });

    const userId = tx();
    await createSession(userId);
    const res = NextResponse.json({ ok: true });
    res.cookies.delete("suron_challenge");
    return res;
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
