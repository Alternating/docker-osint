"use client";

import { useEffect, useRef, useState } from "react";

type ScanType = "username" | "domain" | "email" | "phone" | "name" | "address";

interface JobSummary {
  id: string;
  tool: string;
  target: string;
  status: string;
  created_at: number;
  finished_at: number | null;
  error: string | null;
}

interface SherlockResult {
  username: string;
  hits: { site: string; url: string }[];
  total: number;
}

type PhotonResult = Record<string, string[]>;

interface DorkLink {
  label: string;
  url: string;
  group: string;
}

interface HoleheHit {
  name: string;
  domain: string | null;
  exists: boolean | null;
  rateLimit: boolean | null;
  error: boolean;
}

interface BreachInfo {
  name: string;
  title: string;
  domain: string;
  breachDate: string;
  pwnCount: number;
  dataClasses: string[];
  isVerified: boolean;
}

interface LocalBreachHit {
  sourceId: string;
  name: string;
  format: string;
  hasExtra: boolean;
}

interface EmailRepResult {
  reputation: string;
  suspicious: boolean;
  references: number;
  flags: string[];
  profiles: string[];
}

interface LeakCheckHit {
  source: string;
  date: string | null;
  fields: string[];
  hasPassword: boolean;
}

interface LeakCheckResult {
  found: number;
  quota: number | null;
  hits: LeakCheckHit[];
}

interface DeHashedHit {
  source: string;
  fields: string[];
  hasPassword: boolean;
}

interface DeHashedResult {
  total: number;
  balance: number | null;
  hits: DeHashedHit[];
}

interface EmailResult {
  email: string;
  total: number;
  found: number;
  results: HoleheHit[];
  breaches: BreachInfo[] | null;
  breachError: string | null;
  localBreaches?: LocalBreachHit[];
  emailRep?: EmailRepResult | null;
  emailRepError?: string | null;
  leakCheck?: LeakCheckResult | null;
  leakCheckError?: string | null;
  deHashed?: DeHashedResult | null;
  deHashedError?: string | null;
  links: DorkLink[];
}

const SENSITIVE_CLASSES = new Set([
  "Passwords",
  "Social security numbers",
  "Credit cards",
  "Partial credit card data",
  "Bank account numbers",
  "Government issued IDs",
  "Security questions and answers",
]);

interface TwilioResult {
  valid: boolean;
  nationalFormat: string | null;
  lineType: string | null;
  carrier: string | null;
  callerName: string | null;
}

interface TrestleOwner {
  name: string;
  ageRange: string | null;
  addresses: string[];
}

interface TrestleResult {
  isValid: boolean;
  lineType: string | null;
  carrier: string | null;
  owners: TrestleOwner[];
}

interface PhoneResult {
  scan: {
    valid: boolean;
    possible: boolean;
    e164: string;
    international: string;
    national: string;
    region: string;
    location: string;
    carrier: string;
    timezones: string[];
    number_type: string;
  };
  twilio?: TwilioResult | null;
  twilioError?: string | null;
  trestle?: TrestleResult | null;
  trestleError?: string | null;
  links: DorkLink[];
}

interface PersonCandidate {
  name: string;
  age: number | null;
  addresses: string[];
  phones: string[];
  emails: string[];
  relatives: string[];
  locationMatch: boolean;
}

interface PeopleResult {
  candidates: PersonCandidate[];
  locationFilter: string | null;
}

interface NameResult {
  links: DorkLink[];
  people?: PeopleResult | null;
  peopleError?: string | null;
}

interface GeoHit {
  display_name: string;
  lat: string;
  lon: string;
  category: string;
  type: string;
}

interface AddressResult {
  geocode: GeoHit[];
  links: DorkLink[];
}

interface JobDetail extends JobSummary {
  started_at: number | null;
  result: unknown | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function detect(q: string): ScanType {
  const t = q.trim();
  if (EMAIL_RE.test(t)) return "email";
  const phoneCandidate = t.replace(/\s*(?:x|ext\.?)\s*\d+$/i, "");
  if (/^[+(]?\d[\d\s().-]{4,}$/.test(phoneCandidate)) return "phone";
  if (/\s/.test(t)) return /\d/.test(t) ? "address" : "name";
  if (/^https?:\/\//i.test(t) || t.includes(".")) return "domain";
  if (t.includes("'")) return "name";
  return "username";
}

const ENDPOINT: Record<
  ScanType,
  { path: string; body: (t: string) => Record<string, string>; verb: string }
> = {
  username: { path: "/api/scan/sherlock", body: (t) => ({ username: t }), verb: "Hunt username · Sherlock" },
  domain: { path: "/api/scan/photon", body: (t) => ({ url: t }), verb: "Crawl target · Photon" },
  email: { path: "/api/scan/email", body: (t) => ({ target: t }), verb: "Probe accounts · holehe" },
  phone: { path: "/api/scan/phone", body: (t) => ({ target: t }), verb: "Analyze number" },
  name: { path: "/api/scan/name", body: (t) => ({ target: t }), verb: "Forge dossier links" },
  address: { path: "/api/scan/address", body: (t) => ({ target: t }), verb: "Geocode & dossier" },
};

const MODES = ["auto", "username", "email", "phone", "name", "address", "domain"] as const;

function LinksSection({ links }: { links: DorkLink[] }) {
  if (!links?.length) return null;

  const groups: Record<string, DorkLink[]> = {};
  for (const link of links) {
    (groups[link.group] ??= []).push(link);
  }

  return (
    <div>
      {Object.entries(groups).map(([group, groupLinks]) => (
        <div key={group} className="mt-4">
          <h4 className="text-mist-400 text-xs uppercase tracking-wider mb-2">{group}</h4>
          <div className="flex flex-wrap gap-2">
            {groupLinks.map((link) => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-block rounded-lg border border-abyss-600 px-3 py-1.5 text-sm text-sigil-400 hover:border-sigil-500 transition"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function FieldChips({ fields }: { fields: string[] }) {
  if (!fields.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {fields.map((f) => (
        <span
          key={f}
          className={`text-xs px-2 py-0.5 rounded-md ${
            f === "password" || f === "hashed_password"
              ? "bg-ember-500/15 text-ember-400"
              : "bg-abyss-700 text-mist-400"
          }`}
        >
          {f}
        </span>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [mode, setMode] = useState<"auto" | ScanType>("auto");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openJob, setOpenJob] = useState<JobDetail | null>(null);
  // Mirrors openId so late-arriving fetches for a previously opened job
  // can't overwrite the currently open one.
  const openIdRef = useRef<string | null>(null);

  const [reportBusy, setReportBusy] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportMeta, setReportMeta] = useState<{ scansUsed: number; model: string } | null>(
    null
  );

  const effective: ScanType = mode === "auto" ? detect(query) : mode;

  const loadJobs = async () => {
    try {
      const res = await fetch("/api/jobs");
      if (!res.ok) return;
      const data = await res.json();
      setJobs(data.jobs ?? []);
    } catch {
      // ignore polling errors
    }
  };

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 3000);
    return () => clearInterval(interval);
  }, []);

  // Keep the expanded detail live while its job is still running.
  const openJobRunning = openJob === null || openJob.status === "running";
  useEffect(() => {
    if (!openId || !openJobRunning) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${openId}`);
        if (!res.ok) return;
        const data = (await res.json()) as JobDetail;
        if (data.id === openIdRef.current) setOpenJob(data);
      } catch {
        // ignore polling errors
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [openId, openJobRunning]);

  const openJobDetail = async (id: string) => {
    if (openId === id) {
      setOpenId(null);
      setOpenJob(null);
      openIdRef.current = null;
      return;
    }
    setOpenId(id);
    setOpenJob(null);
    openIdRef.current = id;
    try {
      const res = await fetch(`/api/jobs/${id}`);
      if (!res.ok) return;
      const data = (await res.json()) as JobDetail;
      if (data.id === openIdRef.current) setOpenJob(data);
    } catch {
      // ignore
    }
  };

  const closeDetail = () => {
    setOpenId(null);
    setOpenJob(null);
    openIdRef.current = null;
  };

  const generateReport = async () => {
    setReportBusy(true);
    setReportError(null);
    // Drop any previous report so a failed run can't leave stale text on screen.
    setReport(null);
    setReportMeta(null);
    try {
      const res = await fetch("/api/report", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setReportError(json.error ?? "Couldn't generate the report.");
        return;
      }
      setReport(json.report);
      setReportMeta({ scansUsed: json.scansUsed, model: json.model });
    } catch {
      setReportError("Network error");
    } finally {
      setReportBusy(false);
    }
  };

  const clearHistory = async () => {
    if (!window.confirm("Clear all finished search history? Running scans are kept.")) {
      return;
    }
    // Only the currently open detail that will actually be deleted should close;
    // a running scan is kept, so leave its live detail open.
    const openStatus = jobs.find((j) => j.id === openIdRef.current)?.status;
    try {
      const res = await fetch("/api/jobs", { method: "DELETE" });
      if (!res.ok) {
        setError("Couldn't clear history.");
        return;
      }
      if (openStatus && openStatus !== "running") closeDetail();
      // The report was synthesized from scans that no longer exist.
      setReport(null);
      setReportMeta(null);
      setReportError(null);
      await loadJobs();
    } catch {
      setError("Couldn't clear history.");
    }
  };

  const removeJob = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/jobs/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setError("Couldn't delete that search.");
        return;
      }
      if (openIdRef.current === id) closeDetail();
      await loadJobs();
    } catch {
      setError("Couldn't delete that search.");
    }
  };

  const startScan = async () => {
    if (!query.trim() || busy) return;
    setBusy(true);
    setError(null);

    try {
      const payload: Record<string, string> = ENDPOINT[effective].body(query.trim());
      if (effective === "name" && location.trim()) payload.location = location.trim();
      const res = await fetch(ENDPOINT[effective].path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Scan failed to start");
      } else {
        await loadJobs();
        setQuery("");
        setLocation("");
      }
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  };

  const renderDetail = (job: JobDetail) => {
    if (job.status === "running") {
      return <p className="text-mist-400 text-sm animate-pulse">The Eye is searching…</p>;
    }
    if (job.status === "error") {
      return <p className="text-ember-400 text-sm">{job.error ?? "Unknown error"}</p>;
    }
    if (job.result === null) {
      return <p className="text-mist-600 text-sm">No result payload</p>;
    }

    switch (job.tool) {
      case "sherlock": {
        const result = job.result as SherlockResult;
        return (
          <div>
            <p className="text-mist-400 text-xs mb-3">{result.hits.length} profiles found</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {result.hits.map((hit) => (
                <a
                  key={hit.site}
                  href={hit.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="block rounded-lg border border-abyss-600 px-3 py-2 text-sm text-sigil-400 hover:border-sigil-500 truncate"
                >
                  {hit.site}
                </a>
              ))}
            </div>
          </div>
        );
      }
      case "photon": {
        const result = job.result as PhotonResult;
        const entries = Object.entries(result).filter(
          ([, v]) => Array.isArray(v) && v.length > 0
        );
        if (entries.length === 0) {
          return <p className="text-mist-600 text-sm">Nothing captured.</p>;
        }
        return (
          <div>
            {entries.map(([key, values]) => (
              <details key={key} className="mt-2">
                <summary className="text-sm text-mist-400 cursor-pointer">
                  {key} · {values.length}
                </summary>
                <ul className="mt-2 max-h-64 overflow-auto space-y-1">
                  {values.map((v, i) => (
                    <li key={i} className="font-mono text-xs text-mist-100 break-all">
                      {v}
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        );
      }
      case "email": {
        const result = job.result as EmailResult;
        const found = result.results.filter((r) => r.exists === true);
        const rateLimited = result.results.filter((r) => r.rateLimit === true);
        return (
          <div>
            <p className="text-mist-400 text-xs mb-3">
              {result.found} of {result.total} sites report an account
            </p>
            {found.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {found.map((r) => (
                  <a
                    key={r.name}
                    href={r.domain ? `https://${r.domain}` : "#"}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="block rounded-lg border border-abyss-600 px-3 py-2 text-sm text-sigil-400 hover:border-sigil-500 truncate"
                  >
                    {r.name}
                  </a>
                ))}
              </div>
            )}
            {rateLimited.length > 0 && (
              <details className="mt-3">
                <summary className="text-sm text-mist-400 cursor-pointer">
                  rate-limited · {rateLimited.length}
                </summary>
                <ul className="mt-2 max-h-48 overflow-auto space-y-1">
                  {rateLimited.map((r) => (
                    <li key={r.name} className="font-mono text-xs text-mist-100">
                      {r.name}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <h4 className="text-mist-400 text-xs uppercase tracking-wider mt-5 mb-2">
              Breach exposure · Have I Been Pwned
            </h4>
            {result.breachError ? (
              <p className="text-ember-400 text-sm">{result.breachError}</p>
            ) : !result.breaches ? (
              <p className="text-mist-600 text-xs">
                Breach lookup is off — set HIBP_API_KEY to cross-reference known
                breaches.
              </p>
            ) : result.breaches.length === 0 ? (
              <p className="text-emerald-400 text-sm">
                No known breaches for this address.
              </p>
            ) : (
              <div className="space-y-3">
                {result.breaches.map((b) => (
                  <div
                    key={b.name}
                    className="rounded-lg border border-abyss-600 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-mist-100 text-sm">
                        {b.title}
                        {!b.isVerified && (
                          <span className="text-mist-600 text-xs ml-2">
                            unverified
                          </span>
                        )}
                      </span>
                      <span className="text-mist-600 text-xs shrink-0">
                        {b.breachDate} · {b.pwnCount.toLocaleString()} accounts
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {b.dataClasses.map((dc) => (
                        <span
                          key={dc}
                          className={`text-xs px-2 py-0.5 rounded-md ${
                            SENSITIVE_CLASSES.has(dc)
                              ? "bg-ember-500/15 text-ember-400"
                              : "bg-abyss-700 text-mist-400"
                          }`}
                        >
                          {dc}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(result.leakCheckError || result.leakCheck) && (
              <>
                <h4 className="text-mist-400 text-xs uppercase tracking-wider mt-5 mb-2">
                  Breach records · LeakCheck
                </h4>
                {result.leakCheckError ? (
                  <p className="text-ember-400 text-sm">{result.leakCheckError}</p>
                ) : result.leakCheck && result.leakCheck.hits.length === 0 ? (
                  <p className="text-emerald-400 text-sm">
                    No LeakCheck records for this address.
                  </p>
                ) : result.leakCheck ? (
                  <div className="space-y-3">
                    <p className="text-mist-600 text-xs">
                      {result.leakCheck.found} records across{" "}
                      {result.leakCheck.hits.length}{" "}
                      {result.leakCheck.hits.length === 1 ? "breach" : "breaches"}
                      {result.leakCheck.quota != null
                        ? ` · ${result.leakCheck.quota} credits left`
                        : ""}
                    </p>
                    {result.leakCheck.hits.map((h) => (
                      <div key={h.source} className="rounded-lg border border-abyss-600 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-mist-100 text-sm">{h.source}</span>
                          <span className="text-mist-600 text-xs shrink-0">
                            {h.date || ""}
                            {h.hasPassword ? " · password exposed" : ""}
                          </span>
                        </div>
                        <FieldChips fields={h.fields} />
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            )}

            {(result.deHashedError || result.deHashed) && (
              <>
                <h4 className="text-mist-400 text-xs uppercase tracking-wider mt-5 mb-2">
                  Breach records · DeHashed
                </h4>
                {result.deHashedError ? (
                  <p className="text-ember-400 text-sm">{result.deHashedError}</p>
                ) : result.deHashed && result.deHashed.hits.length === 0 ? (
                  <p className="text-emerald-400 text-sm">
                    No DeHashed records for this address.
                  </p>
                ) : result.deHashed ? (
                  <div className="space-y-3">
                    <p className="text-mist-600 text-xs">
                      {result.deHashed.total} records across{" "}
                      {result.deHashed.hits.length}{" "}
                      {result.deHashed.hits.length === 1 ? "source" : "sources"}
                      {result.deHashed.balance != null
                        ? ` · ${result.deHashed.balance} credits left`
                        : ""}
                    </p>
                    {result.deHashed.hits.map((h) => (
                      <div key={h.source} className="rounded-lg border border-abyss-600 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-mist-100 text-sm">{h.source}</span>
                          {h.hasPassword && (
                            <span className="text-ember-400 text-xs shrink-0">
                              password exposed
                            </span>
                          )}
                        </div>
                        <FieldChips fields={h.fields} />
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            )}

            {result.localBreaches && result.localBreaches.length > 0 && (
              <>
                <h4 className="text-mist-400 text-xs uppercase tracking-wider mt-5 mb-2">
                  Local breach lists
                </h4>
                <div className="space-y-2">
                  {result.localBreaches.map((hit) => (
                    <div
                      key={hit.sourceId}
                      className="flex items-center justify-between gap-3 rounded-lg border border-ember-500/40 bg-ember-500/5 p-3"
                    >
                      <span className="text-mist-100 text-sm">{hit.name}</span>
                      <span className="text-ember-400 text-xs shrink-0">
                        {hit.format === "combo" && hit.hasExtra
                          ? "password exposed"
                          : hit.hasExtra
                            ? "record present"
                            : "email present"}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {(result.emailRepError || result.emailRep) && (
              <>
                <h4 className="text-mist-400 text-xs uppercase tracking-wider mt-5 mb-2">
                  Email reputation · EmailRep
                </h4>
                {result.emailRepError ? (
                  <p className="text-ember-400 text-sm">{result.emailRepError}</p>
                ) : result.emailRep ? (
                  <div className="rounded-lg border border-abyss-600 p-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="text-mist-100">
                        Reputation:{" "}
                        <span
                          className={
                            result.emailRep.reputation === "high"
                              ? "text-emerald-400"
                              : result.emailRep.reputation === "medium"
                                ? "text-sigil-400"
                                : result.emailRep.reputation === "low"
                                  ? "text-ember-400"
                                  : "text-mist-400"
                          }
                        >
                          {result.emailRep.reputation}
                        </span>
                      </span>
                      {result.emailRep.suspicious && (
                        <span className="text-ember-400 text-xs">suspicious</span>
                      )}
                      <span className="text-mist-600 text-xs">
                        {result.emailRep.references} references
                      </span>
                    </div>
                    {result.emailRep.flags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {result.emailRep.flags.map((f) => (
                          <span
                            key={f}
                            className="text-xs px-2 py-0.5 rounded-md bg-ember-500/15 text-ember-400"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                    {result.emailRep.profiles.length > 0 && (
                      <p className="text-mist-400 text-xs">
                        Seen on: {result.emailRep.profiles.join(", ")}
                      </p>
                    )}
                  </div>
                ) : null}
              </>
            )}

            <LinksSection links={result.links} />
          </div>
        );
      }
      case "phone": {
        const { scan, links, twilio, twilioError, trestle, trestleError } =
          job.result as PhoneResult;
        const rows: [string, string][] = [
          ["E.164", scan.e164],
          ["International", scan.international],
          ["National", scan.national],
          ["Region", scan.region || "—"],
          ["Location", scan.location || "—"],
          ["Carrier", scan.carrier || "—"],
          ["Type", scan.number_type],
          ["Timezones", scan.timezones.join(", ") || "—"],
        ];
        return (
          <div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div className="flex flex-col">
                <span className="text-mist-600">Valid</span>
                <span className={scan.valid ? "text-emerald-400" : "text-ember-400"}>
                  {scan.valid ? "yes" : "no — possibly invalid"}
                </span>
              </div>
              {rows.map(([label, value]) => (
                <div key={label} className="flex flex-col">
                  <span className="text-mist-600">{label}</span>
                  <span className="text-mist-100 font-mono">{value}</span>
                </div>
              ))}
            </div>
            {(twilioError || twilio) && (
              <>
                <h4 className="text-mist-400 text-xs uppercase tracking-wider mt-5 mb-2">
                  Carrier &amp; line · Twilio
                </h4>
                {twilioError ? (
                  <p className="text-ember-400 text-sm">{twilioError}</p>
                ) : twilio && !twilio.valid ? (
                  <p className="text-mist-600 text-sm">
                    Twilio could not resolve this number.
                  </p>
                ) : twilio ? (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    {(
                      [
                        ["Line type", twilio.lineType],
                        ["Carrier", twilio.carrier],
                        ["Caller name", twilio.callerName],
                      ] as [string, string | null][]
                    ).map(([label, value]) => (
                      <div key={label} className="flex flex-col">
                        <span className="text-mist-600">{label}</span>
                        <span className="text-mist-100">{value || "—"}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            )}

            {(trestleError || trestle) && (
              <>
                <h4 className="text-mist-400 text-xs uppercase tracking-wider mt-5 mb-2">
                  Phone owners · Trestle
                </h4>
                {trestleError ? (
                  <p className="text-ember-400 text-sm">{trestleError}</p>
                ) : trestle && trestle.owners.length === 0 ? (
                  <p className="text-mist-600 text-sm">No owner records.</p>
                ) : trestle ? (
                  <div className="space-y-2">
                    {trestle.owners.map((o, i) => (
                      <div key={i} className="rounded-lg border border-abyss-600 p-3">
                        <span className="text-mist-100 text-sm">
                          {o.name}
                          {o.ageRange ? ` (${o.ageRange})` : ""}
                        </span>
                        {o.addresses.length > 0 && (
                          <p className="text-mist-400 text-xs mt-1">
                            {o.addresses.slice(0, 4).join(" · ")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            )}

            <LinksSection links={links} />
          </div>
        );
      }
      case "name": {
        const result = job.result as NameResult;
        return (
          <div>
            {(result.peopleError || result.people) && (
              <>
                <h4 className="text-mist-400 text-xs uppercase tracking-wider mb-2">
                  People records · Endato
                </h4>
                {result.peopleError ? (
                  <p className="text-ember-400 text-sm">{result.peopleError}</p>
                ) : result.people && result.people.candidates.length === 0 ? (
                  <p className="text-mist-600 text-sm">No people records matched.</p>
                ) : result.people ? (
                  <div className="space-y-3">
                    {result.people.locationFilter && (
                      <p className="text-mist-600 text-xs">
                        Ranked by match to “{result.people.locationFilter}”
                      </p>
                    )}
                    {result.people.candidates.map((c, i) => (
                      <div
                        key={i}
                        className={`rounded-lg border p-3 ${
                          c.locationMatch ? "border-sigil-500/50" : "border-abyss-600"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-mist-100 text-sm">
                            {c.name}
                            {c.age != null ? `, ${c.age}` : ""}
                          </span>
                          {c.locationMatch && (
                            <span className="text-sigil-400 text-xs shrink-0">
                              location match
                            </span>
                          )}
                        </div>
                        {c.addresses.length > 0 && (
                          <p className="text-mist-400 text-xs mt-1">
                            {c.addresses.slice(0, 4).join(" · ")}
                          </p>
                        )}
                        {c.relatives.length > 0 && (
                          <p className="text-mist-600 text-xs mt-1">
                            Relatives: {c.relatives.slice(0, 6).join(", ")}
                          </p>
                        )}
                        {(c.phones.length > 0 || c.emails.length > 0) && (
                          <p className="text-mist-600 text-xs mt-1">
                            {[...c.phones.slice(0, 3), ...c.emails.slice(0, 3)].join(" · ")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="mt-5" />
              </>
            )}
            <LinksSection links={result.links} />
          </div>
        );
      }
      case "address": {
        const result = job.result as AddressResult;
        return (
          <div>
            {result.geocode.length === 0 ? (
              <p className="text-mist-600 text-sm">No geocoding matches.</p>
            ) : (
              <div className="space-y-3">
                {result.geocode.map((hit, i) => (
                  <div key={i}>
                    <div className="text-mist-100 text-sm">{hit.display_name}</div>
                    <div className="text-mist-600 text-xs">
                      {hit.category}/{hit.type} · {hit.lat}, {hit.lon}
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${hit.lat}&mlon=${hit.lon}#map=17/${hit.lat}/${hit.lon}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-sigil-400 hover:underline ml-2"
                      >
                        view map
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <LinksSection links={result.links} />
          </div>
        );
      }
      default:
        return (
          <pre className="max-h-64 overflow-auto font-mono text-xs text-mist-100 whitespace-pre-wrap">
            {JSON.stringify(job.result, null, 2)}
          </pre>
        );
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl text-mist-100">The Eye turns toward…</h2>
        <p className="text-mist-400 text-sm mt-1">
          Usernames, emails, phone numbers, names, addresses, domains — the Eye sees all.
        </p>
      </div>

      <div className="card p-6">
        <div className="flex flex-wrap gap-2 mb-4">
          {MODES.map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-full border text-xs transition cursor-pointer ${
                mode === m
                  ? "border-sigil-500 text-sigil-400 bg-sigil-600/10"
                  : "border-abyss-600 text-mist-400 hover:border-sigil-500"
              }`}
            >
              {m === "auto"
                ? `Auto · ${effective}`
                : m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>

        <input
          type="text"
          className="input mb-4"
          placeholder="username, email, phone, name, address, or domain…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") startScan();
          }}
          disabled={busy}
        />

        {effective === "name" && (
          <input
            type="text"
            className="input mb-4"
            placeholder="City, State (optional — helps match the right person)"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            disabled={busy}
          />
        )}

        <button className="btn w-full" onClick={startScan} disabled={busy}>
          {busy ? "Scrying…" : ENDPOINT[effective].verb}
        </button>

        {error && <p className="mt-4 text-ember-400 text-sm">{error}</p>}
      </div>

      {jobs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm text-mist-400 uppercase tracking-wider">
              Security report
            </h3>
            <button
              onClick={generateReport}
              disabled={reportBusy}
              className="btn-ghost text-xs px-3 py-1.5"
            >
              {reportBusy ? "Generating…" : report ? "Regenerate" : "Generate"}
            </button>
          </div>
          {reportError && <p className="text-ember-400 text-sm mb-3">{reportError}</p>}
          {reportBusy && !report && (
            <div className="card p-6 text-mist-400 text-sm animate-pulse">
              The Eye is weighing your exposure… this can take a minute.
            </div>
          )}
          {report && (
            <div className="card p-6">
              {reportMeta && (
                <p className="text-mist-600 text-xs mb-3">
                  Synthesized from {reportMeta.scansUsed} scan
                  {reportMeta.scansUsed === 1 ? "" : "s"} · {reportMeta.model}
                </p>
              )}
              <pre className="whitespace-pre-wrap font-sans text-sm text-mist-100 leading-relaxed">
                {report}
              </pre>
            </div>
          )}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm text-mist-400 uppercase tracking-wider">
            Scrying history
          </h3>
          {jobs.some((j) => j.status !== "running") && (
            <button
              onClick={clearHistory}
              className="btn-ghost text-xs px-3 py-1.5"
            >
              Clear history
            </button>
          )}
        </div>
        {jobs.length === 0 ? (
          <div className="card p-8 text-center text-mist-600">
            Nothing scried yet. Begin a search above.
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <div key={job.id}>
                <div
                  className="card p-4 cursor-pointer hover:border-sigil-500 transition"
                  onClick={() => openJobDetail(job.id)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-2 h-2 shrink-0 rounded-full ${
                          job.status === "running"
                            ? "bg-sigil-400 animate-pulse"
                            : job.status === "done"
                              ? "bg-emerald-400"
                              : "bg-ember-500"
                        }`}
                      />
                      <span className="text-xs uppercase px-2 py-0.5 rounded-md bg-abyss-700 text-sigil-400">
                        {job.tool}
                      </span>
                      <span className="font-mono text-sm text-mist-100 truncate">
                        {job.target}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-mist-600 text-xs">
                        {new Date(job.created_at * 1000).toLocaleString()}
                      </span>
                      {job.status !== "running" && (
                        <button
                          onClick={(e) => removeJob(job.id, e)}
                          className="text-mist-600 hover:text-ember-400 transition-colors text-sm leading-none px-1"
                          title="Delete this search"
                          aria-label="Delete this search"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                  {job.error && (
                    <div className="mt-2 text-ember-400 text-xs">{job.error}</div>
                  )}
                </div>

                {openId === job.id && (
                  <div
                    className="card p-6 mt-2 border-sigil-500/40"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {!openJob ? (
                      <p className="text-mist-400 text-sm animate-pulse">Loading…</p>
                    ) : (
                      renderDetail(openJob)
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
