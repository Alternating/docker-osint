import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dataDir = process.env.SURON_DATA_DIR ?? path.join(process.cwd(), "data");

const g = globalThis as unknown as { __suronDb?: Database.Database };

export function getDb(): Database.Database {
  if (!g.__suronDb) {
    fs.mkdirSync(dataDir, { recursive: true });
    const db = new Database(path.join(dataDir, "suron.db"));
    db.pragma("journal_mode = WAL");

    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS credentials (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        public_key BLOB NOT NULL,
        counter INTEGER NOT NULL DEFAULT 0,
        transports TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS challenges (
        key TEXT PRIMARY KEY,
        challenge TEXT NOT NULL,
        data TEXT,
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        tool TEXT NOT NULL,
        target TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        started_at INTEGER,
        finished_at INTEGER,
        result TEXT,
        error TEXT
      );
    `);

    // Jobs run as in-process promises; anything still "running" after a
    // restart can never finish and must be marked failed.
    db.prepare(
      "UPDATE jobs SET status = 'error', finished_at = ?, error = 'interrupted by server restart' WHERE status = 'running'"
    ).run(now());

    g.__suronDb = db;
  }

  return g.__suronDb;
}

export function now(): number {
  return Math.floor(Date.now() / 1000);
}

export interface UserRow {
  id: number;
  username: string;
  created_at: number;
}

export interface CredentialRow {
  id: string;
  user_id: number;
  public_key: Buffer;
  counter: number;
  transports: string | null;
  created_at: number;
}

export interface SessionRow {
  token: string;
  user_id: number;
  created_at: number;
  expires_at: number;
}

export interface JobRow {
  id: string;
  tool: string;
  target: string;
  status: string;
  created_at: number;
  started_at: number | null;
  finished_at: number | null;
  result: string | null;
  error: string | null;
}
