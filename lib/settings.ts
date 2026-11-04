import { getDb, now, type SettingRow } from "./db";

export interface ApiConnection {
  id: string;
  label: string;
  description: string;
  docsUrl: string;
  settingKey: string;
  envFallback?: string;
  testable: boolean;
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
  source: "db" | "env" | "none";
  masked: string | null;
}

export function connectionStatus(id: string): ConnectionStatus {
  const conn = getConnection(id);
  if (!conn) {
    return { id, configured: false, source: "none", masked: null };
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
