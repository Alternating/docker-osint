import crypto from "crypto";
import path from "path";
import { getDb, now, type JobRow } from "./db";
import { runSherlock } from "./tools/sherlock";
import { runPhoton } from "./tools/photon";

const DATA_DIR = process.env.SURON_DATA_DIR ?? path.join(process.cwd(), "data");

export type JobTool = "sherlock" | "photon";

export function startJob(
  tool: JobTool,
  target: string,
  params?: { level?: number }
): string {
  const id = crypto.randomUUID();
  const db = getDb();

  db.prepare(
    "INSERT INTO jobs (id, tool, target, status, created_at, started_at) VALUES (?, ?, ?, 'running', ?, ?)"
  ).run(id, tool, target, now(), now());

  void (async () => {
    try {
      const outDir = path.join(DATA_DIR, "jobs", id);
      const result =
        tool === "sherlock"
          ? await runSherlock(target, { outDir })
          : await runPhoton(target, { level: params?.level, outDir });

      let resultStr = JSON.stringify(result);
      if (resultStr.length > 2_000_000) {
        resultStr = JSON.stringify(result, (_key, value) =>
          Array.isArray(value) && value.length > 2000 ? value.slice(0, 2000) : value
        );
      }

      db.prepare(
        "UPDATE jobs SET status = 'done', finished_at = ?, result = ? WHERE id = ?"
      ).run(now(), resultStr, id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      db.prepare(
        "UPDATE jobs SET status = 'error', finished_at = ?, error = ? WHERE id = ?"
      ).run(now(), msg.slice(0, 1000), id);
    }
  })();

  return id;
}

export function getJob(id: string): JobRow | null {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const row = getDb().prepare("SELECT * FROM jobs WHERE id = ?").get(id) as
    | JobRow
    | undefined;
  return row ?? null;
}

export function listJobs(limit = 20): JobRow[] {
  return getDb()
    .prepare("SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?")
    .all(limit) as JobRow[];
}
