import crypto from "crypto";
import path from "path";
import { getDb, now, type JobRow } from "./db";
import { runSherlock } from "./tools/sherlock";
import { runPhoton } from "./tools/photon";
import { runHolehe } from "./tools/holehe";
import { runPhoneScan } from "./tools/phone";
import { nominatimSearch } from "./tools/nominatim";
import { breachedAccount, type Breach } from "./tools/hibp";
import { emailDorks, phoneDorks, nameDorks, addressDorks } from "./tools/dorks";

const DATA_DIR = process.env.SURON_DATA_DIR ?? path.join(process.cwd(), "data");

export type JobTool = "sherlock" | "photon" | "email" | "phone" | "name" | "address";

async function runTool(tool: JobTool, target: string, outDir: string, params?: { level?: number }) {
  switch (tool) {
    case "sherlock":
      return runSherlock(target, { outDir });
    case "photon":
      return runPhoton(target, { level: params?.level, outDir });
    case "email": {
      const holehe = await runHolehe(target);
      // Breach lookup failing shouldn't sink the whole email scan.
      let breaches: Breach[] | null = null;
      let breachError: string | null = null;
      try {
        breaches = await breachedAccount(target);
      } catch (err) {
        breachError = err instanceof Error ? err.message : String(err);
      }
      return { ...holehe, breaches, breachError, links: emailDorks(target) };
    }
    case "phone":
      return { scan: await runPhoneScan(target), links: phoneDorks(target) };
    case "name":
      return { links: nameDorks(target) };
    case "address":
      return { geocode: await nominatimSearch(target), links: addressDorks(target) };
  }
}

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
      const result = await runTool(tool, target, outDir, params);

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
      // A throw here would leave the fire-and-forget IIFE with an unhandled
      // rejection, which kills the process on modern Node — never let the
      // bookkeeping write escape.
      try {
        db.prepare(
          "UPDATE jobs SET status = 'error', finished_at = ?, error = ? WHERE id = ?"
        ).run(now(), msg.slice(0, 1000), id);
      } catch (writeErr) {
        console.error("failed to record job failure", id, writeErr);
      }
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
