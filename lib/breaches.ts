import crypto from "crypto";
import { getDb, now, type BreachSourceRow } from "./db";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type BreachFormat = "email" | "combo" | "csv";

export function parseLines(
  content: string,
  format: BreachFormat
): { email: string; extra: string | null }[] {
  const lines = content.split(/\r?\n/);
  // Index into `result` by email so a later row that carries a credential can
  // upgrade an earlier email-only row for the same address.
  const index = new Map<string, number>();
  const result: { email: string; extra: string | null }[] = [];
  let headerChecked = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") continue;

    // CSV: skip a leading header row whose first cell isn't an email.
    if (format === "csv" && !headerChecked) {
      headerChecked = true;
      const firstCell = trimmed.split(",").shift()?.trim() ?? "";
      if (!EMAIL_RE.test(firstCell.toLowerCase())) continue;
    }

    let email: string;
    let extra: string | null = null;

    if (format === "email") {
      email = trimmed;
    } else if (format === "combo") {
      const idx = trimmed.indexOf(":");
      if (idx === -1) {
        email = trimmed;
      } else {
        email = trimmed.slice(0, idx);
        extra = trimmed.slice(idx + 1);
      }
    } else {
      // csv
      const idx = trimmed.indexOf(",");
      if (idx === -1) {
        email = trimmed;
      } else {
        email = trimmed.slice(0, idx);
        extra = trimmed.slice(idx + 1);
      }
    }

    email = email.toLowerCase().trim();
    if (!EMAIL_RE.test(email)) continue;

    extra = extra?.trim() ?? null;
    if (extra === "") extra = null;

    const existing = index.get(email);
    if (existing === undefined) {
      index.set(email, result.length);
      result.push({ email, extra });
    } else if (extra && !result[existing].extra) {
      result[existing].extra = extra;
    }
  }

  return result;
}

export function importBreach(opts: {
  name: string;
  format: BreachFormat;
  note?: string | null;
  content: string;
}): { id: string; entryCount: number } {
  const entries = parseLines(opts.content, opts.format);

  if (entries.length > 2_000_000) {
    throw new Error("breach file too large");
  }

  const id = crypto.randomUUID();
  const db = getDb();

  const tx = db.transaction(() => {
    db.prepare(
      "INSERT INTO breach_sources (id, name, format, entry_count, note, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(id, opts.name, opts.format, entries.length, opts.note ?? null, now());

    // Only a presence flag is stored — never the plaintext credential, so the
    // DB can't become a secondary leak of the very passwords it tracks.
    const insertEntry = db.prepare(
      "INSERT INTO breach_entries (source_id, email, has_extra) VALUES (?, ?, ?)"
    );
    for (const entry of entries) {
      insertEntry.run(id, entry.email, entry.extra ? 1 : 0);
    }
  });

  tx();

  return { id, entryCount: entries.length };
}

export function listBreachSources(): BreachSourceRow[] {
  return getDb()
    .prepare("SELECT * FROM breach_sources ORDER BY created_at DESC")
    .all() as BreachSourceRow[];
}

export function deleteBreachSource(id: string): boolean {
  if (!/^[0-9a-f-]{36}$/.test(id)) return false;

  const db = getDb();
  let changes = 0;
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM breach_entries WHERE source_id = ?").run(id);
    changes = db.prepare("DELETE FROM breach_sources WHERE id = ?").run(id).changes;
  });
  tx();
  return changes > 0;
}

export interface BreachHit {
  sourceId: string;
  name: string;
  format: string;
  hasExtra: boolean;
}

export function lookupEmail(email: string): BreachHit[] {
  const normalized = email.toLowerCase().trim();
  if (!EMAIL_RE.test(normalized)) return [];

  const rows = getDb()
    .prepare(
      `SELECT s.id AS sourceId, s.name AS name, s.format AS format,
              MAX(e.has_extra) AS hasExtra
       FROM breach_entries e
       JOIN breach_sources s ON s.id = e.source_id
       WHERE e.email = ?
       GROUP BY s.id, s.name, s.format`
    )
    .all(normalized) as {
    sourceId: string;
    name: string;
    format: string;
    hasExtra: number;
  }[];

  return rows.map((row) => ({
    sourceId: row.sourceId,
    name: row.name,
    format: row.format,
    hasExtra: row.hasExtra === 1,
  }));
}
