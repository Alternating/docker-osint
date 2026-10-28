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

interface EmailResult {
  email: string;
  total: number;
  found: number;
  results: HoleheHit[];
  breaches: BreachInfo[] | null;
  breachError: string | null;
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
  links: DorkLink[];
}

interface NameResult {
  links: DorkLink[];
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

export default function Dashboard() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"auto" | ScanType>("auto");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openJob, setOpenJob] = useState<JobDetail | null>(null);
  // Mirrors openId so late-arriving fetches for a previously opened job
  // can't overwrite the currently open one.
  const openIdRef = useRef<string | null>(null);

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

  const startScan = async () => {
    if (!query.trim() || busy) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch(ENDPOINT[effective].path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ENDPOINT[effective].body(query.trim())),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Scan failed to start");
      } else {
        await loadJobs();
        setQuery("");
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
            <LinksSection links={result.links} />
          </div>
        );
      }
      case "phone": {
        const { scan, links } = job.result as PhoneResult;
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
            <LinksSection links={links} />
          </div>
        );
      }
      case "name": {
        const result = job.result as NameResult;
        return <LinksSection links={result.links} />;
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

        <button className="btn w-full" onClick={startScan} disabled={busy}>
          {busy ? "Scrying…" : ENDPOINT[effective].verb}
        </button>

        {error && <p className="mt-4 text-ember-400 text-sm">{error}</p>}
      </div>

      <div>
        <h3 className="text-sm text-mist-400 uppercase tracking-wider mb-3">
          Scrying history
        </h3>
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
                    <span className="text-mist-600 text-xs shrink-0">
                      {new Date(job.created_at * 1000).toLocaleString()}
                    </span>
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
