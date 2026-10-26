"use client";

import { useEffect, useState } from "react";

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

interface JobDetail extends JobSummary {
  started_at: number | null;
  result: SherlockResult | PhotonResult | null;
}

export default function Dashboard() {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openJob, setOpenJob] = useState<JobDetail | null>(null);

  const looksLikeUrl = (q: string) => q.includes(".");

  const loadJobs = async () => {
    try {
      const res = await fetch("/api/jobs");
      const json = await res.json();
      setJobs(json.jobs ?? []);
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
        setOpenJob(await res.json());
      } catch {
        // ignore polling errors
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [openId, openJobRunning]);

  const startScan = async (tool: "sherlock" | "photon") => {
    if (!query.trim() || busy) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch(`/api/scan/${tool}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          tool === "sherlock" ? { username: query.trim() } : { url: query.trim() }
        ),
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

  const openJobDetail = async (id: string) => {
    if (openId === id) {
      setOpenId(null);
      setOpenJob(null);
      return;
    }
    setOpenId(id);
    setOpenJob(null);
    try {
      const res = await fetch(`/api/jobs/${id}`);
      if (!res.ok) return;
      setOpenJob(await res.json());
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl text-mist-100">The Eye turns toward…</h2>
        <p className="text-mist-400 text-sm mt-1">
          Search a username across 400+ sites, or crawl a target domain.
        </p>
      </div>

      <div className="card p-6">
        <input
          type="text"
          className="input mb-4"
          placeholder="username or domain…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              startScan(looksLikeUrl(query) ? "photon" : "sherlock");
            }
          }}
          disabled={busy}
        />
        <div className="flex gap-3">
          <button
            onClick={() => startScan("sherlock")}
            className="btn flex-1"
            disabled={busy}
          >
            Hunt username · Sherlock
          </button>
          <button
            onClick={() => startScan("photon")}
            className="btn-ghost flex-1"
            disabled={busy}
          >
            Crawl target · Photon
          </button>
        </div>
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
                  <div className="card p-6 mt-2 border-sigil-500/40">
                    {!openJob ? (
                      <p className="text-mist-400 text-sm animate-pulse">Loading…</p>
                    ) : openJob.status === "running" ? (
                      <p className="text-mist-400 text-sm animate-pulse">
                        The Eye is searching…
                      </p>
                    ) : openJob.status === "error" ? (
                      <p className="text-ember-400 text-sm">
                        {openJob.error ?? "Unknown error"}
                      </p>
                    ) : openJob.result === null ? (
                      <p className="text-mist-600 text-sm">No result payload</p>
                    ) : openJob.tool === "sherlock" ? (
                      <div>
                        <p className="text-mist-400 text-xs mb-3">
                          {(openJob.result as SherlockResult).hits.length} profiles found
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {(openJob.result as SherlockResult).hits.map((hit) => (
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
                    ) : (
                      <div>
                        {Object.entries(openJob.result as PhotonResult)
                          .filter(([, arr]) => Array.isArray(arr) && arr.length > 0)
                          .map(([key, arr]) => (
                            <details key={key} className="mt-2">
                              <summary className="text-sm text-mist-400 cursor-pointer">
                                {key} · {arr.length}
                              </summary>
                              <ul className="mt-2 max-h-64 overflow-auto space-y-1">
                                {arr.map((item, i) => (
                                  <li
                                    key={i}
                                    className="font-mono text-xs text-mist-100 break-all"
                                  >
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </details>
                          ))}
                      </div>
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
