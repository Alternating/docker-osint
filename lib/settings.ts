import { getDb, now, type SettingRow } from "./db";

export interface ApiConnection {
  id: string;
  label: string;
  description: string;
  docsUrl: string;
  settingKey: string;
  envFallback?: string;
  testable: boolean;
  // Grouping shown in the UI ("Email & breach", "Phone", "Passwords").
  category: string;
  // Credentials that aren't a single opaque token (e.g. Twilio's
  // AccountSID:AuthToken) carry a hint shown as the input placeholder.
  keyFormat?: string;
  // Keyless connections (e.g. Pwned Passwords range API) have no key field —
  // the UI shows only status + a Test button.
  keyless?: boolean;
}

export const API_CONNECTIONS: ApiConnection[] = [
  {
    id: "hibp",
    label: "Have I Been Pwned",
    description:
      "Cross-references scanned emails against known breach corpora (v3 API).",
    docsUrl: "https://haveibeenpwned.com/API/Key",
    settingKey: "apikey.hibp",
    envFallback: "HIBP_API_KEY",
    testable: true,
    category: "Email & breach",
  },
  {
    id: "leakcheck",
    label: "LeakCheck",
    description:
      "Full breach records (email, username, phone) from LeakCheck's Pro API. ~$9.99/mo.",
    docsUrl: "https://leakcheck.io/",
    settingKey: "apikey.leakcheck",
    envFallback: "LEAKCHECK_API_KEY",
    testable: true,
    category: "Email & breach",
  },
  {
    id: "emailrep",
    label: "EmailRep",
    description:
      "Reputation and risk signals for an email address (Sublime Security). Maintenance mode — existing keys still work, but Sublime no longer issues new ones.",
    docsUrl: "https://emailrep.io/",
    settingKey: "apikey.emailrep",
    envFallback: "EMAILREP_API_KEY",
    testable: true,
    category: "Email & breach",
  },
  {
    id: "dehashed",
    label: "DeHashed",
    description:
      "Deep breach and credential search (v2 API). Testing spends a small search credit — there's no free balance check.",
    docsUrl: "https://www.dehashed.com/",
    settingKey: "apikey.dehashed",
    envFallback: "DEHASHED_API_KEY",
    testable: true,
    category: "Email & breach",
  },
  {
    id: "intelx",
    label: "Intelligence X",
    description: "Leak, darknet, and archive search across IntelX's corpus.",
    docsUrl: "https://intelx.io/",
    settingKey: "apikey.intelx",
    envFallback: "INTELX_API_KEY",
    testable: true,
    category: "Email & breach",
  },
  {
    id: "twilio",
    label: "Twilio Lookup",
    description:
      "Phone line-type, carrier, and caller-name enrichment for phone scans.",
    docsUrl: "https://www.twilio.com/docs/lookup/v2-api",
    settingKey: "apikey.twilio",
    envFallback: "TWILIO_LOOKUP_KEY",
    testable: true,
    category: "Phone",
    keyFormat: "AccountSID:AuthToken",
  },
  {
    id: "pwnedpasswords",
    label: "Pwned Passwords (k-anonymity)",
    description:
      "Free, keyless password-exposure checks via HIBP's range API. Test verifies connectivity; an offline local corpus can be imported later.",
    docsUrl: "https://haveibeenpwned.com/API/v3#PwnedPasswords",
    settingKey: "pwnedpasswords.mode",
    testable: true,
    category: "Passwords",
    keyless: true,
  },
];

export function getSetting<T>(key: string, fallback: T): T {
  const row = getDb()
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as SettingRow | undefined;

  if (!row) return fallback;

  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

export function setSetting(key: string, value: unknown): void {
  getDb()
    .prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)")
    .run(key, JSON.stringify(value), now());
}

export function deleteSetting(key: string): void {
  getDb().prepare("DELETE FROM settings WHERE key = ?").run(key);
}

export function getConnection(id: string): ApiConnection | undefined {
  return API_CONNECTIONS.find((conn) => conn.id === id);
}

export function getApiKey(connectionId: string): string | undefined {
  const conn = getConnection(connectionId);
  if (!conn) return undefined;

  const dbValue = getSetting<string>(conn.settingKey, "").trim();
  if (dbValue.length > 0) return dbValue;

  if (conn.envFallback) {
    const envValue = process.env[conn.envFallback]?.trim() ?? "";
    if (envValue.length > 0) return envValue;
  }

  return undefined;
}

export function maskSecret(secret: string | null | undefined): string | null {
  if (!secret || secret.trim().length === 0) return null;
  if (secret.length <= 4) return "••••";
  return "••••••" + secret.slice(-4);
}

export interface ConnectionStatus {
  id: string;
  configured: boolean;
  source: "db" | "env" | "none" | "keyless";
  masked: string | null;
}

export function connectionStatus(id: string): ConnectionStatus {
  const conn = getConnection(id);
  if (!conn) {
    return { id, configured: false, source: "none", masked: null };
  }

  if (conn.keyless) {
    return { id, configured: true, source: "keyless", masked: null };
  }

  const dbValue = getSetting<string>(conn.settingKey, "").trim();
  if (dbValue.length > 0) {
    return { id, configured: true, source: "db", masked: maskSecret(dbValue) };
  }

  if (conn.envFallback) {
    const envValue = process.env[conn.envFallback]?.trim() ?? "";
    if (envValue.length > 0) {
      // Don't echo any of an environment-provided key back to the client — the
      // "From environment" status already conveys that one is set server-side.
      return { id, configured: true, source: "env", masked: null };
    }
  }

  return { id, configured: false, source: "none", masked: null };
}
