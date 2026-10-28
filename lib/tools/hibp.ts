// HIBP's cheapest tier allows ~10 requests/min; space calls out like the
// Nominatim client does.
let nextSlot = 0;
async function rateSlot(): Promise<void> {
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + 6_500;
  if (at > now) await new Promise((r) => setTimeout(r, at - now));
}

export interface Breach {
  name: string;
  title: string;
  domain: string;
  breachDate: string;
  addedDate: string;
  pwnCount: number;
  dataClasses: string[];
  isVerified: boolean;
  isSensitive: boolean;
}

export function hibpConfigured(): boolean {
  return Boolean(process.env.HIBP_API_KEY);
}

export async function breachedAccount(email: string): Promise<Breach[] | null> {
  const key = process.env.HIBP_API_KEY;
  if (!key) return null;

  await rateSlot();

  const res = await fetch(
    `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`,
    {
      headers: {
        "hibp-api-key": key,
        "user-agent": "Suron-OSINT/0.1 (self-hosted)",
      },
      signal: AbortSignal.timeout(20_000),
    }
  );

  if (res.status === 404) return [];
  if (res.status === 401) throw new Error("HIBP rejected the API key");
  if (res.status === 429) throw new Error("HIBP rate limit hit — try again shortly");
  if (!res.ok) throw new Error(`HIBP responded ${res.status}`);

  const raw = (await res.json()) as Array<Record<string, unknown>>;

  return raw.map((item) => ({
    name: String(item.Name ?? ""),
    title: String(item.Title ?? ""),
    domain: String(item.Domain ?? ""),
    breachDate: String(item.BreachDate ?? ""),
    addedDate: String(item.AddedDate ?? ""),
    pwnCount: Number(item.PwnCount ?? 0),
    dataClasses: Array.isArray(item.DataClasses)
      ? (item.DataClasses as unknown[]).map((d) => String(d ?? ""))
      : [],
    isVerified: Boolean(item.IsVerified),
    isSensitive: Boolean(item.IsSensitive),
  }));
}
