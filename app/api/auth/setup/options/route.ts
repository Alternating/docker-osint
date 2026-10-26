import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { hasUsers, timingSafeEqualStr, saveChallenge, rpConfig } from "@/lib/auth";

// In-memory brute-force throttle for the pre-setup window: this endpoint is
// internet-exposed via the tunnel and gates account creation.
let failedAttempts = 0;
let lockedUntil = 0;

export async function POST(req: NextRequest) {
  try {
    if (Date.now() < lockedUntil) {
      return NextResponse.json(
        { error: "too many attempts, try again shortly" },
        { status: 429 }
      );
    }
    const expected = process.env.SETUP_PASSWORD;
    if (!expected) {
      return NextResponse.json(
        { error: "SETUP_PASSWORD is not configured" },
        { status: 500 }
      );
    }
    if (hasUsers()) {
      return NextResponse.json({ error: "setup already completed" }, { status: 403 });
    }

    const body = (await req.json()) as { setupPassword?: string; username?: string };

    if (
      typeof body.setupPassword !== "string" ||
      !timingSafeEqualStr(body.setupPassword, expected)
    ) {
      failedAttempts += 1;
      if (failedAttempts >= 5) {
        lockedUntil = Date.now() + 60_000;
        failedAttempts = 0;
      }
      return NextResponse.json({ error: "invalid setup password" }, { status: 403 });
    }
    failedAttempts = 0;
    if (
      typeof body.username !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{1,31}$/.test(body.username)
    ) {
      return NextResponse.json({ error: "invalid username" }, { status: 400 });
    }

    const { rpName, rpID } = rpConfig();
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: body.username,
      attestationType: "none",
      authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
    });

    const key = crypto.randomUUID();
    saveChallenge(
      `setup:${key}`,
      options.challenge,
      JSON.stringify({ username: body.username })
    );

    const res = NextResponse.json(options);
    res.cookies.set("suron_challenge", key, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/api/auth",
      maxAge: 300,
    });
    return res;
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
