"use client";

import { useEffect, useState } from "react";

async function sha1Upper(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

interface Status {
  mode: "online" | "offline";
  corpusCount: number;
  total: number;
  import: {
    running: boolean;
    processed: number;
    error: string | null;
    startedAt: number | null;
    finishedAt: number | null;
  };
}

interface CheckResult {
  count: number;
  mode: string;
}

export default function PwnedPasswordsPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [pw, setPw] = useState("");
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [checkBusy, setCheckBusy] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [importPath, setImportPath] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadStatus = async () => {
    try {
      const res = await fetch("/api/settings/pwnedpasswords");
      if (!res.ok) return;
      setStatus((await res.json()) as Status);
    } catch {
      // ignore polling errors
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  // Poll only while an import is running — the status query counts a table
  // that can hold a million rows, so there's no sense hitting it when idle.
  const importRunning = status?.import.running ?? false;
  useEffect(() => {
    if (!importRunning) return;
    const id = setInterval(loadStatus, 2500);
    return () => clearInterval(id);
  }, [importRunning]);

  const runCheck = async () => {
    if (!pw) return;
    setCheckBusy(true);
    setCheckError(null);
    setCheck(null);

    try {
      const hash = await sha1Upper(pw);
      const prefix = hash.slice(0, 5);
      const suffix = hash.slice(5);
      const res = await fetch(`/api/settings/pwnedpasswords/range?prefix=${prefix}`);
      const json = (await res.json()) as { mode?: string; body?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "lookup failed");

      const body = json.body ?? "";
      if (json.mode === "offline" && body === "") {
        throw new Error(
          "The offline corpus has no data for this prefix — is it fully imported?"
        );
      }

      let count = 0;
      for (const line of body.split(/\r?\n/)) {
        if (!line.trim()) continue;
        const [sfx, cnt] = line.split(":");
        if (sfx === suffix) {
          count = parseInt(cnt, 10) || 0;
          break;
        }
      }
      setCheck({ count, mode: json.mode ?? "online" });
    } catch (e) {
      setCheckError(e instanceof Error ? e.message : "lookup failed");
    } finally {
      setPw(""); // never keep the plaintext around, even on failure
      setCheckBusy(false);
    }
  };

  const setMode = async (mode: "online" | "offline") => {
    try {
      const res = await fetch("/api/settings/pwnedpasswords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mode", mode }),
      });
      const json = await res.json();
      setActionMsg(
        res.ok
          ? { ok: true, text: `Mode set to ${mode}` }
          : { ok: false, text: json.error ?? "Failed to set mode" }
      );
    } catch {
      setActionMsg({ ok: false, text: "Network error" });
    } finally {
      await loadStatus();
    }
  };

  const startImport = async () => {
    if (!importPath.trim()) {
      setActionMsg({ ok: false, text: "Enter a file path." });
      return;
    }
    setActionBusy(true);
    try {
      const res = await fetch("/api/settings/pwnedpasswords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import", path: importPath }),
      });
      const json = await res.json();
      setActionMsg(
        res.ok
          ? { ok: true, text: "Import started." }
          : { ok: false, text: json.error ?? "Import failed" }
      );
    } catch {
      setActionMsg({ ok: false, text: "Network error" });
    } finally {
      setActionBusy(false);
      await loadStatus();
    }
  };

  const clearCorpus = async () => {
    if (!window.confirm("Delete the offline corpus?")) return;
    setActionBusy(true);
    try {
      const res = await fetch("/api/settings/pwnedpasswords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear" }),
      });
      const json = await res.json();
      setActionMsg(
        res.ok
          ? { ok: true, text: "Corpus cleared." }
          : { ok: false, text: json.error ?? "Clear failed" }
      );
    } catch {
      setActionMsg({ ok: false, text: "Network error" });
    } finally {
      setActionBusy(false);
      await loadStatus();
    }
  };

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-full border text-xs transition cursor-pointer ${
      active
        ? "border-sigil-500 text-sigil-400 bg-sigil-600/10"
        : "border-abyss-600 text-mist-400 hover:border-sigil-500"
    }`;

  return (
    <div className="card p-6 space-y-6">
      <div>
        <h3 className="text-lg text-mist-100">Password exposure (Pwned Passwords)</h3>
        <p className="text-mist-400 text-sm">
          Check whether a password appears in HIBP&apos;s Pwned Passwords corpus. Your
          password is hashed in your browser — only the first 5 characters of the hash
          ever leave this device.
        </p>
      </div>

      <div className="rounded-lg border border-abyss-600 p-4 space-y-3">
        <h4 className="text-mist-100">Check a password</h4>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <input
            type="password"
            className="input"
            placeholder="Enter a password to check"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !checkBusy) runCheck();
            }}
          />
          <button
            className="btn whitespace-nowrap"
            disabled={checkBusy || !pw}
            onClick={runCheck}
          >
            {checkBusy ? "Checking…" : "Check"}
          </button>
        </div>

        {checkError && <p className="text-ember-400 text-sm">{checkError}</p>}
        {check &&
          (check.count > 0 ? (
            <p className="text-ember-400 text-sm">
              Found in {check.count.toLocaleString()} breaches — do not use this
              password. ({check.mode})
            </p>
          ) : (
            <p className="text-emerald-400 text-sm">
              Not found in the Pwned Passwords corpus. ({check.mode})
            </p>
          ))}
      </div>

      <div className="rounded-lg border border-abyss-600 p-4 space-y-3">
        <h4 className="text-mist-100">Offline corpus</h4>

        {status && (
          <div className="space-y-1">
            <p className="text-mist-600 text-xs">
              {status.corpusCount.toLocaleString()} / {status.total.toLocaleString()}{" "}
              prefixes imported
            </p>
            {status.import.running && (
              <p className="text-sigil-400 text-sm animate-pulse">
                Importing… {status.import.processed.toLocaleString()} prefixes written
              </p>
            )}
            {status.import.error && (
              <p className="text-ember-400 text-xs">{status.import.error}</p>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-mist-400 text-sm mr-1">Lookup mode:</span>
          <button className={chip(status?.mode === "online")} onClick={() => setMode("online")}>
            Online
          </button>
          <button
            className={chip(status?.mode === "offline")}
            onClick={() => setMode("offline")}
          >
            Offline
          </button>
        </div>

        <p className="text-mist-600 text-xs">
          Offline mode is fully air-gapped. Download the corpus with the official
          PwnedPasswordsDownloader (tens of GB), place the file where the server can read
          it, then enter its path and import.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <input
            type="text"
            className="input"
            placeholder="/data/pwnedpasswords.txt"
            value={importPath}
            onChange={(e) => setImportPath(e.target.value)}
          />
          <button
            className="btn whitespace-nowrap"
            disabled={actionBusy || (status?.import.running ?? false)}
            onClick={startImport}
          >
            Import from file
          </button>
        </div>

        <button
          className="btn-ghost text-sm text-ember-400"
          disabled={actionBusy || (status?.import.running ?? false)}
          onClick={clearCorpus}
        >
          Clear corpus
        </button>

        {actionMsg && (
          <p className={`text-sm ${actionMsg.ok ? "text-emerald-400" : "text-ember-400"}`}>
            {actionMsg.text}
          </p>
        )}
      </div>
    </div>
  );
}
