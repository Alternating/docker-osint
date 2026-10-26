import crypto from "crypto";
import { cookies } from "next/headers";
import { getDb, now, type UserRow } from "./db";

export const SESSION_COOKIE = "suron_session";
const SESSION_TTL = 7 * 24 * 3600;

export function rpConfig(): { rpID: string; rpName: string; origin: string } {
  const rpID = process.env.RP_ID ?? "localhost";
  return {
    rpID,
    rpName: "Suron",
    origin:
      process.env.RP_ORIGIN ??
      (rpID === "localhost" ? "http://localhost:3000" : `https://${rpID}`),
  };
}

export async function createSession(userId: number): Promise<void> {
  const token = crypto.randomBytes(32).toString("hex");
  const db = getDb();

  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now());
  db.prepare(
    "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
  ).run(token, userId, now(), now() + SESSION_TTL);

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

export async function getSessionUser(): Promise<UserRow | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = getDb()
    .prepare(
      "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?"
    )
    .get(token, now()) as UserRow | undefined;

  return row ?? null;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
  }
  store.delete(SESSION_COOKIE);
}

export function saveChallenge(key: string, challenge: string, data?: string): void {
  const db = getDb();
  db.prepare("DELETE FROM challenges WHERE expires_at <= ?").run(now());
  db.prepare(
    "INSERT OR REPLACE INTO challenges (key, challenge, data, expires_at) VALUES (?, ?, ?, ?)"
  ).run(key, challenge, data ?? null, now() + 300);
}

export function takeChallenge(
  key: string
): { challenge: string; data: string | null } | null {
  const db = getDb();
  const row = db
    .prepare("SELECT challenge, data FROM challenges WHERE key = ? AND expires_at > ?")
    .get(key, now()) as { challenge: string; data: string | null } | undefined;

  if (!row) return null;
  db.prepare("DELETE FROM challenges WHERE key = ?").run(key);
  return row;
}

export function hasUsers(): boolean {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS count FROM users")
    .get() as { count: number };
  return row.count > 0;
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  // Hashing first makes lengths equal, so no early-exit length leak.
  const bufA = crypto.createHash("sha256").update(a).digest();
  const bufB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(bufA, bufB);
}
