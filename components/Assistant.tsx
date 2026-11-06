"use client";

import { useEffect, useState } from "react";

export default function AssistantPanel() {
  const [host, setHost] = useState("");
  const [model, setModel] = useState("");
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadConfig = async () => {
    try {
      const res = await fetch("/api/settings/assistant");
      if (res.ok) {
        const json = (await res.json()) as {
          host?: string;
          model?: string;
          configured?: boolean;
        };
        setHost(json.host ?? "");
        setModel(json.model ?? "");
        setConfigured(Boolean(json.configured));
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/settings/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", host, model }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setMsg({ ok: false, text: json.error ?? "Failed to save" });
      } else {
        setMsg({ ok: true, text: "Saved." });
        await loadConfig();
      }
    } catch {
      setMsg({ ok: false, text: "Network error" });
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/settings/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", host, model }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };
      setMsg({ ok: Boolean(json.ok), text: json.message ?? json.error ?? "" });
    } catch {
      setMsg({ ok: false, text: "Network error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-6 space-y-4">
      <div>
        <h3 className="text-lg text-mist-100">AI assistant (local Ollama)</h3>
        <p className="text-mist-400 text-sm">
          Point Suron at a local Ollama server to generate plain-English security
          reports from your scan findings. Everything runs on your own machine — scan
          data never leaves your network.
        </p>
      </div>

      {loading ? (
        <p className="text-mist-400 text-sm">Loading…</p>
      ) : (
        <>
          <div>
            <label className="text-mist-400 text-sm block mb-1">Ollama host</label>
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="http://localhost:11434"
              className="input"
            />
          </div>

          <div>
            <label className="text-mist-400 text-sm block mb-1">Model</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. llama3.1 or qwen2.5"
              className="input"
            />
          </div>

          <div className="flex gap-3">
            <button className="btn" disabled={busy} onClick={save}>
              {busy ? "Working…" : "Save"}
            </button>
            <button className="btn-ghost" disabled={busy} onClick={test}>
              Test
            </button>
          </div>

          <p className="text-mist-600 text-xs">
            {configured
              ? "A model is configured; the Security report button on the dashboard is active."
              : "No model set yet — set one above to enable AI reports."}
          </p>

          {msg && (
            <p className={`text-sm ${msg.ok ? "text-emerald-400" : "text-ember-400"}`}>
              {msg.text}
            </p>
          )}
        </>
      )}
    </div>
  );
}
