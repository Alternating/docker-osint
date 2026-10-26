export interface GeoHit {
  display_name: string;
  lat: string;
  lon: string;
  category: string;
  type: string;
  importance: number;
}

// Nominatim's usage policy allows at most 1 request/second; serialize and
// space out calls so a burst of address jobs can't get the IP blocked.
let nextSlot = 0;
async function rateSlot(): Promise<void> {
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + 1100;
  if (at > now) await new Promise((r) => setTimeout(r, at - now));
}

export async function nominatimSearch(query: string, limit = 5): Promise<GeoHit[]> {
  const q = query.trim();
  if (!q) throw new Error("empty address");

  await rateSlot();

  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=${limit}&q=${encodeURIComponent(q)}`,
    {
      headers: { "User-Agent": "Suron-OSINT/0.1 (self-hosted)" },
      signal: AbortSignal.timeout(15_000),
    }
  );

  if (!res.ok) {
    throw new Error(`nominatim responded ${res.status}`);
  }

  const raw = (await res.json()) as Array<Record<string, unknown>>;

  return raw.map((r) => ({
    display_name: String(r.display_name ?? ""),
    lat: String(r.lat ?? ""),
    lon: String(r.lon ?? ""),
    category: String(r.category ?? ""),
    type: String(r.type ?? ""),
    importance: Number(r.importance ?? 0),
  }));
}
