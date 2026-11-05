import crypto from "crypto";
import path from "path";
import { getDb, now, type JobRow } from "./db";
import { runSherlock } from "./tools/sherlock";
import { runPhoton } from "./tools/photon";
import { runHolehe } from "./tools/holehe";
import { runPhoneScan } from "./tools/phone";
import { nominatimSearch } from "./tools/nominatim";
import { breachedAccount } from "./tools/hibp";
import { emailRepLookup } from "./tools/emailrep";
import { leakCheckLookup } from "./tools/leakcheck";
import { deHashedLookup } from "./tools/dehashed";
import { twilioLookup } from "./tools/twilio";
import { lookupEmail, type BreachHit } from "./breaches";
import { emailDorks, phoneDorks, nameDorks, addressDorks } from "./tools/dorks";

const DATA_DIR = process.env.SURON_DATA_DIR ?? path.join(process.cwd(), "data");

export type JobTool = "sherlock" | "photon" | "email" | "phone" | "name" | "address";

// Wraps a provider call so one failing API never sinks the whole scan; the
// error travels alongside the (null) data for the UI to surface.
async function settle<T>(
  p: Promise<T>
): Promise<{ data: T | null; error: string | null }> {
  try {
    return { data: await p, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : String(err) };
  }
}

async function runTool(tool: JobTool, target: string, outDir: string, params?: { level?: number }) {
  switch (tool) {
    case "sherlock":
      return runSherlock(target, { outDir });
    case "photon":
      return runPhoton(target, { level: params?.level, outDir });
    case "email": {
      // holehe (the core probe) runs concurrently with the external enrichment.
      // holehe is NOT settled — if it throws the whole scan fails, as before —
      // while each enrichment is key-gated (null when unset) and fail-soft.
      const [holehe, hibp, emailRep, leakCheck, deHashed] = await Promise.all([
        runHolehe(target),
        settle(breachedAccount(target)),
        settle(emailRepLookup(target)),
        settle(leakCheckLookup(target)),
        settle(deHashedLookup(target)),
      ]);
      // Locally imported breach lists are offline, so a miss here is still
      // just an empty list rather than a reason to fail the scan.
      let localBreaches: BreachHit[] = [];
      try {
        localBreaches = lookupEmail(target);
      } catch {
        localBreaches = [];
      }
      return {
        ...holehe,
        breaches: hibp.data,
        breachError: hibp.error,
        emailRep: emailRep.data,
        emailRepError: emailRep.error,
        leakCheck: leakCheck.data,
        leakCheckError: leakCheck.error,
        deHashed: deHashed.data,
        deHashedError: deHashed.error,
        localBreaches,
        links: emailDorks(target),
      };
    }
    case "phone": {
      const scan = await runPhoneScan(target);
      // Twilio needs E.164; fall back to the raw target if parsing failed.
      const twilio = await settle(twilioLookup(scan.e164 || target));
      return {
        scan,
        twilio: twilio.data,
        twilioError: twilio.error,
        links: phoneDorks(target),
      };
    }
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
