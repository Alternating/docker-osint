"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface Resource {
  name: string;
  url: string;
  description: string;
  category: string;
}

interface Cat {
  name: string;
  count: number;
}

export default function ResourceExplorer() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [results, setResults] = useState<Resource[]>([]);
  const [categories, setCategories] = useState<Cat[]>([]);
  const [stats, setStats] = useState<{ total: number; categories: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("q", q);
        if (category) params.set("category", category);
        const res = await fetch(`/api/resources?${params.toString()}`, { signal });
        const json = await res.json();
        setResults(json.results ?? []);
        setCategories(json.categories ?? []);
        setStats(json.stats ?? null);
        setLoading(false);
      } catch (e) {
        // an aborted request was superseded — leave state to the newer one
        if (e instanceof DOMException && e.name === "AbortError") return;
        setLoading(false);
      }
    },
    [q, category]
  );

  useEffect(() => {
    const controller = new AbortController();
    const debounce = setTimeout(() => load(controller.signal), 250);
    return () => {
      clearTimeout(debounce);
      controller.abort();
    };
  }, [load]);

  const visibleCategories = useMemo(() => {
    const all: Cat[] = [
      { name: "All", count: categories.reduce((acc, c) => acc + c.count, 0) },
      ...categories,
    ];
    return all;
  }, [categories]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl text-mist-100">Armory of the Eye</h2>
        <p className="text-mist-400 text-sm mt-1">
          {stats
            ? `${stats.total} curated OSINT resources across ${stats.categories} categories — from awesome-osint.`
            : "Loading…"}
        </p>
      </div>

      <input
        type="text"
        className="input"
        placeholder="Search the armory…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="flex flex-wrap gap-2">
        {visibleCategories.map((c) => {
          const value = c.name === "All" ? null : c.name;
          const selected = category === value;
          return (
            <button
              key={c.name}
              onClick={() => setCategory(value)}
              className={`px-3 py-1.5 rounded-full border text-xs transition ${
                selected
                  ? "border-sigil-500 text-sigil-400 bg-sigil-600/10"
                  : "border-abyss-600 text-mist-400 hover:border-sigil-500"
              }`}
            >
              {c.name} ({c.count})
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="card p-6 text-center text-mist-600 animate-pulse">
          Searching the armory…
        </div>
      ) : results.length === 0 ? (
        <div className="card p-6 text-center text-mist-600">
          Nothing found in the armory.
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((res, i) => (
            <div key={`${res.url}-${i}`} className="card p-4 flex flex-col gap-1">
              <div>
                <a
                  href={res.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sigil-400 hover:underline"
                >
                  {res.name}
                </a>
                <span className="text-xs text-mist-600 ml-2">{res.category}</span>
              </div>
              {res.description && (
                <p className="text-mist-400 text-sm">{res.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
