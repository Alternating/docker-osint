import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import readline from "readline";
import { setImmediate as yieldTick } from "timers/promises";
import { getSetting, setSetting } from "./settings";

const dataDir = process.env.SURON_DATA_DIR ?? path.join(process.cwd(), "data");

// 16^5 five-hex-char prefixes cover the whole SHA-1 keyspace.
export const TOTAL_PREFIXES = 1_048_576;

const UA = "Suron-OSINT/0.1 (self-hosted)";

// The corpus is huge (tens of GB), so it lives in its own DB file rather than
// bloating suron.db and its WAL.
const g = globalThis as unknown as { __suronPwnedDb?: Database.Database };

function getPwnedDb(): Database.Database {
  if (!g.__suronPwnedDb) {
    fs.mkdirSync(dataDir, { recursive: true });
    const db = new Database(path.join(dataDir, "pwned.db"));
    db.pragma("journal_mode = WAL");
    db.exec(
      "CREATE TABLE IF NOT EXISTS pwned_ranges (prefix TEXT PRIMARY KEY, body TEXT NOT NULL)"
    );
    g.__suronPwnedDb = db;
  }
  return g.__suronPwnedDb;
}

export function corpusCount(): number {
  const row = getPwnedDb()
    .prepare("SELECT COUNT(*) AS c FROM pwned_ranges")
    .get() as { c: number };
  return row.c;
}

// Returns the stored range body ("SUFFIX:COUNT" CRLF lines) for a prefix.
export function localRange(prefix: string): string | null {
  const row = getPwnedDb()
    .prepare("SELECT body FROM pwned_ranges WHERE prefix = ?")
    .get(prefix.toUpperCase()) as { body: string } | undefined;
  return row ? row.body : null;
}

export async function onlineRange(prefix: string): Promise<string> {
  const res = await fetch(
    `https://api.pwnedpasswords.com/range/${prefix.toUpperCase()}`,
    {
      headers: { "user-agent": UA, "Add-Padding": "true" },
      signal: AbortSignal.timeout(20_000),
    }
  );
  if (!res.ok) throw new Error(`Pwned Passwords responded ${res.status}`);
  return res.text();
}

export type PwnedMode = "online" | "offline";

export function getPwnedMode(): PwnedMode {
  return getSetting<string>("pwnedpasswords.mode", "online") === "offline"
    ? "offline"
    : "online";
}

export function setPwnedMode(mode: PwnedMode): void {
  setSetting("pwnedpasswords.mode", mode === "offline" ? "offline" : "online");
}

export function clearCorpus(): void {
  getPwnedDb().exec(
    "DROP TABLE IF EXISTS pwned_ranges; CREATE TABLE pwned_ranges (prefix TEXT PRIMARY KEY, body TEXT NOT NULL);"
  );
}

export interface ImportState {
  running: boolean;
  processed: number; // prefixes written so far
  error: string | null;
  startedAt: number | null;
  finishedAt: number | null;
}

let importState: ImportState = {
  running: false,
  processed: 0,
  error: null,
  startedAt: null,
  finishedAt: null,
};

export function getImportState(): ImportState {
  return importState;
}

// Kicks off a background import from a server-side file produced by the
// official PwnedPasswordsDownloader (lines "FULLSHA1:COUNT", sorted by hash).
// Returns immediately; progress is polled via getImportState().
export function startImport(filePath: string): { started: boolean; error?: string } {
  if (importState.running) {
    return { started: false, error: "an import is already running" };
  }
  // Confine imports to the data directory so an authenticated request can't
  // read (or probe for) arbitrary server paths.
  const resolved = path.resolve(filePath);
  const root = path.resolve(dataDir);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    return {
      started: false,
      error: "import file must be inside the data directory (SURON_DATA_DIR)",
    };
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(resolved);
  } catch {
    return { started: false, error: "file not found" };
  }
  if (!stat.isFile()) return { started: false, error: "path is not a file" };

  importState = {
    running: true,
    processed: 0,
    error: null,
    startedAt: Math.floor(Date.now() / 1000),
    finishedAt: null,
  };
  void runImport(resolved);
  return { started: true };
}

async function runImport(filePath: string): Promise<void> {
  const db = getPwnedDb();
  // Start from empty so a re-import can't double-append onto a prior corpus,
  // then append on conflict so a prefix that appears in more than one (e.g.
  // non-contiguous) block merges instead of overwriting — overwriting would be
  // a silent false negative for a genuinely breached password.
  db.exec(
    "DROP TABLE IF EXISTS pwned_ranges; CREATE TABLE pwned_ranges (prefix TEXT PRIMARY KEY, body TEXT NOT NULL);"
  );
  const insert = db.prepare(
    "INSERT INTO pwned_ranges (prefix, body) VALUES (?, ?) " +
      "ON CONFLICT(prefix) DO UPDATE SET body = body || char(13) || char(10) || excluded.body"
  );
  const flush = db.transaction((rows: Array<[string, string]>) => {
    for (const [p, b] of rows) insert.run(p, b);
  });

  // Each prefix groups ~800-1000 lines; 1000 prefixes per flush keeps the
  // transient buffer to a few tens of MB and the sync write bursts short.
  const BATCH = 1000;

  try {
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath),
      crlfDelay: Infinity,
    });

    let curPrefix: string | null = null;
    let curLines: string[] = [];
    let pending: Array<[string, string]> = [];

    for await (const raw of rl) {
      const line = raw.trim().toUpperCase();
      // Expect a 40-hex SHA-1 then ":" then the count.
      if (line.length < 42 || line[40] !== ":") continue;

      const prefix = line.slice(0, 5);
      const rest = line.slice(5); // "SUFFIX:COUNT" — the range-API body line

      if (prefix !== curPrefix) {
        if (curPrefix !== null) {
          pending.push([curPrefix, curLines.join("\r\n")]);
          if (pending.length >= BATCH) {
            flush(pending);
            importState = {
              ...importState,
              processed: importState.processed + pending.length,
            };
            pending = [];
            await yieldTick(); // let other requests breathe between write bursts
          }
        }
        curPrefix = prefix;
        curLines = [];
      }
      curLines.push(rest);
    }

    if (curPrefix !== null) pending.push([curPrefix, curLines.join("\r\n")]);
    if (pending.length) {
      flush(pending);
      importState = {
        ...importState,
        processed: importState.processed + pending.length,
      };
    }

    importState = {
      ...importState,
      running: false,
      finishedAt: Math.floor(Date.now() / 1000),
    };
  } catch (err) {
    importState = {
      ...importState,
      running: false,
      error: err instanceof Error ? err.message : String(err),
      finishedAt: Math.floor(Date.now() / 1000),
    };
  }
}
