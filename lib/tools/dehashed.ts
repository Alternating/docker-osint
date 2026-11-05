import { getApiKey } from "@/lib/settings";

const UA = "Suron-OSINT/0.1 (self-hosted)";

export interface DeHashedHit {
  source: string; // database_name
  fields: string[]; // exposed data categories (field names only)
  hasPassword: boolean;
}

export interface DeHashedResult {
  total: number;
  balance: number | null; // remaining credits
  hits: DeHashedHit[];
}

// DeHashed v2 returns each field as an array (empty when absent), so an empty
// array must count as "not present" — Boolean([]) is true, which would
// otherwise flag data that isn't there.
function present(v: unknown): boolean {
  if (Array.isArray(v)) return v.length > 0;
  return v !== undefined && v !== null && v !== "";
}

export async function deHashedLookup(email: string): Promise<DeHashedResult | null> {
  const key = getApiKey("dehashed");
  if (!key) return null;

  const res = await fetch("https://api.dehashed.com/v2/search", {
    method: "POST",
    headers: {
      "Dehashed-Api-Key": key,
      Accept: "application/json",
      "Content-Type": "application/json",
      "user-agent": UA,
    },
    body: JSON.stringify({
      query: `email:"${email.replace(/(["\\])/g, "\\$1")}"`,
      size: 100,
    }),
    signal: AbortSignal.timeout(25_000),
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error("DeHashed rejected the API key");
  }
  if (!res.ok) throw new Error(`DeHashed responded ${res.status}`);

  const data = (await res.json()) as {
    balance?: number;
    total?: number;
    entries?: Array<Record<string, unknown>>;
    results?: Array<Record<string, unknown>>;
  };

  const entries = Array.isArray(data.entries)
    ? data.entries
    : Array.isArray(data.results)
      ? data.results
      : [];

  // Value-bearing keys whose PRESENCE becomes a category; values never stored.
  const VALUE_KEYS = [
    "password",
    "hashed_password",
    "username",
    "name",
    "email",
    "phone",
    "address",
    "ip_address",
    "vin",
    "social",
    "database_name",
  ];
  const CATEGORY_KEYS = VALUE_KEYS.filter((k) => k !== "database_name");

  const bySource = new Map<string, DeHashedHit>();
  for (const entry of entries) {
    const rawName = Array.isArray(entry.database_name)
      ? entry.database_name[0]
      : entry.database_name;
    const source = String(rawName ?? "DeHashed");
    const fields = CATEGORY_KEYS.filter((k) => present(entry[k]));
    const hasPassword = present(entry.password) || present(entry.hashed_password);

    const existing = bySource.get(source);
    if (existing) {
      existing.fields = Array.from(new Set([...existing.fields, ...fields]));
      existing.hasPassword = existing.hasPassword || hasPassword;
    } else {
      bySource.set(source, {
        source,
        fields: Array.from(new Set(fields)),
        hasPassword,
      });
    }
  }

  return {
    total: typeof data.total === "number" ? data.total : entries.length,
    balance: typeof data.balance === "number" ? data.balance : null,
    hits: Array.from(bySource.values()),
  };
}
