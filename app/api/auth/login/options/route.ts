import crypto from "crypto";
import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { saveChallenge, rpConfig } from "@/lib/auth";

export async function POST() {
  try {
    const options = await generateAuthenticationOptions({
      rpID: rpConfig().rpID,
      userVerification: "preferred",
    });

    // Per-client challenge key: a fixed key would let anyone clobber a
    // pending login by hitting this unauthenticated endpoint.
    const key = crypto.randomUUID();
    saveChallenge(`login:${key}`, options.challenge);

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
