import { getApiKey } from "@/lib/settings";

const UA = "Suron-OSINT/0.1 (self-hosted)";

export interface EmailRepResult {
  reputation: string; // "high" | "medium" | "low" | "none"
  suspicious: boolean;
  references: number;
  flags: string[]; // human-readable risk flags that are TRUE
  profiles: string[]; // sites/services where the email is registered
}

export async function emailRepLookup(email: string): Promise<EmailRepResult | null> {
  // Returns null when no key is configured (feature simply off). Throws on API error.
  const key = getApiKey("emailrep");
  if (!key) return null;

  const res = await fetch(`https://emailrep.io/${encodeURIComponent(email)}`, {
    headers: { Key: key, "user-agent": UA },
    signal: AbortSignal.timeout(20_000),
  });

  if (res.status === 401) throw new Error("EmailRep rejected the API key");
  if (res.status === 429) throw new Error("EmailRep rate limit reached");
  if (!res.ok) throw new Error(`EmailRep responded ${res.status}`);

  const data = (await res.json()) as {
    reputation?: string;
    suspicious?: boolean;
    references?: number;
    details?: Record<string, unknown>;
  };
  const details = data.details ?? {};

  // Map known boolean risk signals (only include those that are true).
  const FLAG_LABELS: Record<string, string> = {
    blacklisted: "blacklisted",
    malicious_activity: "malicious activity",
    malicious_activity_recent: "recent malicious activity",
    credentials_leaked: "credentials leaked",
    credentials_leaked_recent: "credentials leaked recently",
    data_breach: "in a data breach",
    spoofable: "spoofable",
    spam: "sends spam",
    suspicious_tld: "suspicious TLD",
  };
  const flags: string[] = [];
  for (const [k, label] of Object.entries(FLAG_LABELS)) {
    if (details[k] === true) flags.push(label);
  }

  const profiles = Array.isArray(details.profiles)
    ? (details.profiles as unknown[]).map((p) => String(p))
    : [];

  return {
    reputation: String(data.reputation ?? "none"),
    suspicious: Boolean(data.suspicious),
    references: Number(data.references ?? 0),
    flags,
    profiles,
  };
}
