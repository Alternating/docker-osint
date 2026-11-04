import { getApiKey } from "./settings";
import { hibpKeyStatus } from "./tools/hibp";

// A tester makes ONE lightweight authenticated request to confirm a stored
// credential is valid and active. It returns a short human-readable status
// line on success, or throws with the reason the connection is unusable.
type Tester = () => Promise<string>;

const UA = "Suron-OSINT/0.1 (self-hosted)";

async function testPwnedPasswords(): Promise<string> {
  // Free, keyless k-anonymity range API. "00000" is a valid 5-hex prefix.
  const res = await fetch("https://api.pwnedpasswords.com/range/00000", {
    headers: { "user-agent": UA, "Add-Padding": "true" },
    signal: AbortSignal.timeout(20_000),
  });
  // Add-Padding pads the body with synthetic rows, so don't report a count.
  if (!res.ok) throw new Error(`Pwned Passwords responded ${res.status}`);
  return "Range API reachable — free and keyless";
}

async function testLeakCheck(): Promise<string> {
  const key = getApiKey("leakcheck");
  if (!key) throw new Error("No API key is configured");

  // No balance-only endpoint exists; a guaranteed-miss query is the cheapest
  // validating call and still returns the remaining-quota field.
  const res = await fetch(
    "https://leakcheck.io/api/v2/query/suron-test-connection-00000?type=username&limit=1",
    {
      headers: { "X-API-Key": key, "user-agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    }
  );

  // 400 = "Invalid X-API-Key", 401 = "Missing X-API-Key" — but 400 can also be
  // a query validation error, so disambiguate from the body message.
  if (res.status === 400 || res.status === 401) {
    const body = await res.text().catch(() => "");
    throw new Error(
      body.toLowerCase().includes("key")
        ? "LeakCheck rejected the API key"
        : `LeakCheck rejected the request (${res.status})`
    );
  }
  if (!res.ok) throw new Error(`LeakCheck responded ${res.status}`);

  const data = (await res.json()) as { quota?: number };
  return `Active — ${data.quota ?? "?"} credits left`;
}

async function testEmailRep(): Promise<string> {
  const key = getApiKey("emailrep");
  if (!key) throw new Error("No API key is configured");

  const res = await fetch("https://emailrep.io/test-connection@example.com", {
    headers: { Key: key, "user-agent": UA },
    signal: AbortSignal.timeout(20_000),
  });

  if (res.status === 401) throw new Error("EmailRep rejected the API key");
  // A configured key that returns 429 is valid but throttled — not a failure.
  if (res.status === 429) {
    return "Key accepted, but the free-tier quota is exhausted — try again later";
  }
  if (!res.ok) throw new Error(`EmailRep responded ${res.status}`);

  const data = (await res.json()) as { reputation?: string };
  const remaining = res.headers.get("X-Rate-Limit-Daily-Remaining");
  return `Valid — reputation ${data.reputation ?? "unknown"}${
    remaining ? `, ${remaining} queries left today` : ""
  }`;
}

async function testTwilio(): Promise<string> {
  const key = getApiKey("twilio");
  if (!key) throw new Error("No API key is configured");

  const idx = key.indexOf(":");
  if (idx < 1 || idx === key.length - 1) {
    throw new Error("Twilio credential must be in the form AccountSID:AuthToken");
  }
  const sid = key.slice(0, idx);
  const token = key.slice(idx + 1);
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");

  // Basic Lookup (no Fields param) is free for any number; a fictional
  // 555-01XX number is fine — only the HTTP status proves the credentials.
  const res = await fetch(
    "https://lookups.twilio.com/v2/PhoneNumbers/+12025550123",
    {
      headers: { Authorization: `Basic ${auth}`, "user-agent": UA },
      signal: AbortSignal.timeout(20_000),
    }
  );

  if (res.status === 401) throw new Error("Twilio rejected the credentials");
  // 404 just means the fictional probe number didn't resolve — auth still
  // succeeded, which is all this test needs to prove.
  if (!res.ok && res.status !== 404) {
    throw new Error(`Twilio responded ${res.status}`);
  }
  return "Credentials valid — Lookup reachable";
}

async function testDeHashed(): Promise<string> {
  const key = getApiKey("dehashed");
  if (!key) throw new Error("No API key is configured");

  // v2 API: single token in a custom header. No free balance endpoint, so a
  // guaranteed-miss search is the cheapest validating call.
  const res = await fetch("https://api.dehashed.com/v2/search", {
    method: "POST",
    headers: {
      "Dehashed-Api-Key": key,
      Accept: "application/json",
      "Content-Type": "application/json",
      "user-agent": UA,
    },
    body: JSON.stringify({
      query: "email:suron-test-connection-00000@invalid.invalid",
      size: 1,
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error("DeHashed rejected the API key");
  }
  if (!res.ok) throw new Error(`DeHashed responded ${res.status}`);

  const data = (await res.json()) as { balance?: number };
  return `Active — ${data.balance ?? "?"} credits left`;
}

async function testIntelX(): Promise<string> {
  const key = getApiKey("intelx");
  if (!key) throw new Error("No API key is configured");

  // A key's host depends on its tier, so probe paid then free. The
  // authenticate/info endpoint is undocumented but the de-facto key check.
  const hosts = ["https://2.intelx.io", "https://free.intelx.io"];

  for (const host of hosts) {
    const res = await fetch(`${host}/authenticate/info`, {
      headers: { "x-key": key, "user-agent": UA },
      signal: AbortSignal.timeout(20_000),
    });
    if (res.ok) return `Valid key on ${host.replace("https://", "")}`;
    // Only 401 means "wrong tier, try the other host" — surface anything else
    // (e.g. a 403 IP restriction) rather than masking it as an invalid key.
    if (res.status !== 401) throw new Error(`IntelX responded ${res.status}`);
  }

  throw new Error("IntelX rejected the API key (tried paid and free instances)");
}

const TESTERS: Record<string, Tester> = {
  hibp: hibpKeyStatus,
  pwnedpasswords: testPwnedPasswords,
  leakcheck: testLeakCheck,
  emailrep: testEmailRep,
  twilio: testTwilio,
  dehashed: testDeHashed,
  intelx: testIntelX,
};

export async function testConnection(id: string): Promise<string> {
  const tester = TESTERS[id];
  if (!tester) throw new Error("No connection test is available for this provider yet");
  return tester();
}
