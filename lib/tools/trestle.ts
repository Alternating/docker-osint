import { getApiKey } from "@/lib/settings";

const UA = "Suron-OSINT/0.1 (self-hosted)";

export interface TrestleOwner {
  name: string;
  ageRange: string | null;
  addresses: string[];
}

export interface TrestleResult {
  isValid: boolean;
  lineType: string | null;
  carrier: string | null;
  owners: TrestleOwner[];
}

export async function trestleReversePhone(e164: string): Promise<TrestleResult | null> {
  // Returns null when no key configured. Throws on API error.
  const key = getApiKey("trestle");
  if (!key) return null;

  const res = await fetch(
    `https://api.trestleiq.com/3.2/phone?phone=${encodeURIComponent(e164)}`,
    {
      headers: { "x-api-key": key, "user-agent": UA },
      signal: AbortSignal.timeout(20_000),
    }
  );

  if (res.status === 401 || res.status === 403) {
    throw new Error("Trestle rejected the API key");
  }
  if (!res.ok) throw new Error(`Trestle responded ${res.status}`);

  const data = (await res.json()) as {
    is_valid?: boolean;
    line_type?: string | null;
    carrier?: string | null;
    owners?: Array<{
      name?: string;
      firstname?: string;
      lastname?: string;
      age_range?: string | null;
      current_addresses?: Array<Record<string, unknown>>;
      historical_addresses?: Array<Record<string, unknown>>;
    }>;
  };

  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  const fmtAddr = (a: Record<string, unknown>): string =>
    [
      str(a.street_line_1),
      str(a.street_line_2),
      str(a.city),
      str(a.state_code),
      str(a.postal_code),
    ]
      .filter(Boolean)
      .join(", ");

  const owners: TrestleOwner[] = (data.owners ?? []).map((o) => {
    const name = str(o.name) || [str(o.firstname), str(o.lastname)].filter(Boolean).join(" ");
    const addrs = [
      ...(Array.isArray(o.current_addresses) ? o.current_addresses : []),
      ...(Array.isArray(o.historical_addresses) ? o.historical_addresses : []),
    ]
      .map(fmtAddr)
      .filter(Boolean);
    return {
      name: name || "(unknown)",
      ageRange: o.age_range ?? null,
      addresses: Array.from(new Set(addrs)),
    };
  });

  return {
    isValid: Boolean(data.is_valid),
    lineType: data.line_type ?? null,
    carrier: data.carrier ?? null,
    owners,
  };
}
