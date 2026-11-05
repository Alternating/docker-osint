import { getApiKey } from "@/lib/settings";

const UA = "Suron-OSINT/0.1 (self-hosted)";

export interface LeakCheckHit {
  source: string; // breach name
  date: string | null; // breach date if provided
  fields: string[]; // exposed data categories (field names only)
  hasPassword: boolean;
}

export interface LeakCheckResult {
  found: number;
  quota: number | null; // remaining credits
  hits: LeakCheckHit[];
}

export async function leakCheckLookup(email: string): Promise<LeakCheckResult | null> {
  const key = getApiKey("leakcheck");
  if (!key) return null;

  const res = await fetch(
    `https://leakcheck.io/api/v2/query/${encodeURIComponent(email)}?type=email`,
    {
      headers: { "X-API-Key": key, "user-agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    }
  );

  if (res.status === 400 || res.status === 401) {
    const body = await res.text().catch(() => "");
    throw new Error(
      body.toLowerCase().includes("key")
        ? "LeakCheck rejected the API key"
        : `LeakCheck rejected the request (${res.status})`
    );
  }
  if (!res.ok) throw new Error(`LeakCheck responded ${res.status}`);

  const data = (await res.json()) as {
    found?: number;
    quota?: number;
    result?: Array<Record<string, unknown>>;
  };
  const result = Array.isArray(data.result) ? data.result : [];

  // Known value-bearing keys whose PRESENCE we report as a category (never the value).
  const VALUE_KEYS = [
    "password",
    "username",
    "first_name",
    "last_name",
    "name",
    "phone",
    "address",
    "ip",
    "dob",
    "zip",
    "country",
  ];

  // Merge rows by source so each breach appears once.
  const bySource = new Map<string, LeakCheckHit>();
  for (const item of result) {
    const rawSource = item.source;
    const source =
      typeof rawSource === "string"
        ? rawSource
        : rawSource && typeof rawSource === "object"
          ? String((rawSource as Record<string, unknown>).name ?? "LeakCheck")
          : "LeakCheck";
    const date =
      (rawSource && typeof rawSource === "object"
        ? ((rawSource as Record<string, unknown>).breach_date as string | undefined)
        : undefined) ??
      (typeof item.date === "string" ? item.date : undefined) ??
      null;

    // Prefer an explicit `fields` array; otherwise derive from present value keys.
    let fields: string[];
    if (Array.isArray(item.fields)) {
      fields = (item.fields as unknown[]).map((f) => String(f));
    } else {
      fields = VALUE_KEYS.filter((k) => {
        const v = item[k];
        return v !== undefined && v !== null && v !== "";
      });
    }
    const hasPassword = Boolean(item.password) || fields.includes("password");

    const existing = bySource.get(source);
    if (existing) {
      existing.fields = Array.from(new Set([...existing.fields, ...fields]));
      existing.hasPassword = existing.hasPassword || hasPassword;
      if (!existing.date && date) existing.date = date;
    } else {
      bySource.set(source, {
        source,
        date,
        fields: Array.from(new Set(fields)),
        hasPassword,
      });
    }
  }

  return {
    found: typeof data.found === "number" ? data.found : result.length,
    quota: typeof data.quota === "number" ? data.quota : null,
    hits: Array.from(bySource.values()),
  };
}
