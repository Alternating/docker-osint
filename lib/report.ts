import type { JobRow } from "./db";
import { ollamaGenerate } from "./ollama";

// Loose view of the stored job results we know how to summarize. Everything is
// optional/defensive — results are our own JSON but may predate newer fields.
interface ScanResult {
  results?: Array<{ name?: string; exists?: boolean | null }>;
  breaches?: Array<{ title?: string; breachDate?: string; dataClasses?: string[] }> | null;
  localBreaches?: Array<{ name?: string; hasExtra?: boolean }>;
  emailRep?: { reputation?: string; suspicious?: boolean; flags?: string[] } | null;
  leakCheck?: {
    hits?: Array<{ source?: string; hasPassword?: boolean; fields?: string[] }>;
  } | null;
  deHashed?: {
    hits?: Array<{ source?: string; hasPassword?: boolean; fields?: string[] }>;
  } | null;
  hits?: Array<{ site?: string }>;
  scan?: {
    valid?: boolean;
    e164?: string;
    region?: string;
    carrier?: string;
    number_type?: string;
  };
  twilio?: {
    lineType?: string | null;
    carrier?: string | null;
    callerName?: string | null;
  } | null;
}

function cap(items: string[], n = 15): string[] {
  return items.length > n ? [...items.slice(0, n), `…and ${items.length - n} more`] : items;
}

// Turns one completed scan into a compact, factual findings block, or null when
// the scan has nothing exposure-relevant to report (e.g. dork-only name scans).
export function digestJob(job: JobRow): string | null {
  if (job.status !== "done" || !job.result) return null;

  let r: ScanResult;
  try {
    r = JSON.parse(job.result) as ScanResult;
  } catch {
    return null;
  }

  const lines: string[] = [];

  switch (job.tool) {
    case "email": {
      const sites = (r.results ?? [])
        .filter((x) => x.exists === true)
        .map((x) => x.name)
        .filter((n): n is string => Boolean(n));
      if (sites.length) lines.push(`Accounts found on: ${cap(sites).join(", ")}`);

      for (const b of (r.breaches ?? []).slice(0, 20)) {
        const classes = (b.dataClasses ?? []).join(", ");
        lines.push(
          `HIBP breach "${b.title ?? "?"}"${b.breachDate ? ` (${b.breachDate})` : ""}${
            classes ? ` — exposed: ${classes}` : ""
          }`
        );
      }
      for (const h of (r.leakCheck?.hits ?? []).slice(0, 20)) {
        lines.push(
          `LeakCheck: "${h.source ?? "unknown source"}"${
            h.hasPassword ? " — PASSWORD exposed" : ""
          }${h.fields?.length ? ` (${h.fields.join(", ")})` : ""}`
        );
      }
      for (const h of (r.deHashed?.hits ?? []).slice(0, 20)) {
        lines.push(
          `DeHashed: "${h.source ?? "unknown source"}"${
            h.hasPassword ? " — PASSWORD exposed" : ""
          }${h.fields?.length ? ` (${h.fields.join(", ")})` : ""}`
        );
      }
      for (const h of r.localBreaches ?? []) {
        lines.push(`Local breach list "${h.name}"${h.hasExtra ? " — PASSWORD present" : ""}`);
      }
      if (r.emailRep) {
        lines.push(
          `EmailRep reputation: ${r.emailRep.reputation ?? "unknown"}${
            r.emailRep.suspicious ? " (suspicious)" : ""
          }${r.emailRep.flags?.length ? ` — flags: ${r.emailRep.flags.join(", ")}` : ""}`
        );
      }
      break;
    }
    case "sherlock": {
      const sites = (r.hits ?? [])
        .map((h) => h.site)
        .filter((s): s is string => Boolean(s));
      if (sites.length) {
        lines.push(`Username found on ${sites.length} site(s): ${cap(sites).join(", ")}`);
      }
      break;
    }
    case "phone": {
      if (r.scan) {
        lines.push(
          `Number ${r.scan.e164 ?? job.target}: ${r.scan.valid ? "valid" : "invalid"}${
            r.scan.region ? `, region ${r.scan.region}` : ""
          }${r.scan.carrier ? `, carrier ${r.scan.carrier}` : ""}${
            r.scan.number_type ? `, type ${r.scan.number_type}` : ""
          }`
        );
      }
      if (r.twilio) {
        lines.push(
          `Twilio: line type ${r.twilio.lineType ?? "?"}, carrier ${
            r.twilio.carrier ?? "?"
          }${r.twilio.callerName ? `, caller name ${r.twilio.callerName}` : ""}`
        );
      }
      break;
    }
    default:
      // name / address / domain scans are dork/geocode dossiers, not exposure data.
      return null;
  }

  if (lines.length === 0) return null;
  return `${job.tool.toUpperCase()} scan of "${job.target}":\n${lines
    .map((l) => `  - ${l}`)
    .join("\n")}`;
}

const SYSTEM_PROMPT = `You are a personal digital-security analyst. The user has scanned their OWN email addresses, usernames, and phone numbers for exposure and pasted the findings below. Write a concise, prioritized, plain-text action report telling them what to fix and why.

Rules:
- Use ONLY the findings provided. Never invent breaches, sites, passwords, or data not listed.
- Organize into these sections, omitting any that would be empty: "CRITICAL", "HIGH", "RECOMMENDED", and a short "GOOD SIGNS".
- Treat exposed/reused passwords and sensitive data (passwords, SSNs, credit cards, bank accounts) as CRITICAL.
- For each item, name the specific breach/site/identifier and give one concrete action (e.g. "change this password everywhere you reused it", "enable 2FA on X", "request removal from broker Y").
- Be brief: short bullets that start with "- ". No tables, no "#" markdown headers, no preamble, no sign-off. Start directly with the first section label on its own line.`;

export async function buildSecurityReport(
  jobs: JobRow[]
): Promise<{ report: string; scansUsed: number }> {
  const digests = jobs
    .map(digestJob)
    .filter((d): d is string => d !== null);

  if (digests.length === 0) {
    throw new Error("No completed scans with findings to report on yet");
  }

  const prompt = `Findings from my OSINT self-scans:\n\n${digests.join(
    "\n\n"
  )}\n\nWrite my security report now.`;

  const report = await ollamaGenerate(prompt, {
    system: SYSTEM_PROMPT,
    timeoutMs: 180_000,
  });

  return { report, scansUsed: digests.length };
}
