"use client";

import { useEffect, useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";

interface Passkey {
  id: string;
  name: string | null;
  createdAt: number;
  lastUsedAt: number | null;
  transports: string[];
}

interface Conn {
  id: string;
  label: string;
  description: string;
  docsUrl: string;
  testable: boolean;
  configured: boolean;
  source: "db" | "env" | "none";
  masked: string | null;
}

interface Source {
  id: string;
  name: string;
  format: string;
  entry_count: number;
  note: string | null;
  created_at: number;
}

function PasskeysSection() {
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/settings/passkeys");
      if (!res.ok) throw new Error("Failed to load passkeys");
      const json = await res.json();
      setPasskeys(json.passkeys || []);
      setCount(json.count ?? 0);
      setError(null);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const addPasskey = async () => {
    if (!newName.trim()) {
      setError("Please provide a name for this passkey.");
      return;
    }
    try {
      setBusy(true);
      setError(null);

      const res1 = await fetch("/api/settings/passkeys/register/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      const options = await res1.json();
      if (!res1.ok) throw new Error(options.error ?? "Failed to register");

      const att = await startRegistration({ optionsJSON: options });

      const res2 = await fetch("/api/settings/passkeys/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: att }),
      });
      const verify = await res2.json();
      if (!res2.ok) throw new Error(verify.error ?? "Verification failed");

      setNewName("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to register passkey");
    } finally {
      setBusy(false);
    }
  };

  const toggleRename = (pk: Passkey) => {
    setRenameDrafts((prev) => {
      const next = { ...prev };
      if (pk.id in next) {
        delete next[pk.id];
      } else {
        next[pk.id] = pk.name ?? "";
      }
      return next;
    });
  };

  const renamePasskey = async (id: string, draft: string) => {
    if (!draft.trim()) {
      setError("A passkey name cannot be empty.");
      return;
    }
    try {
      const res = await fetch(`/api/settings/passkeys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draft }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Rename failed");
      }
      setRenameDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to rename passkey");
    }
  };

  const removePasskey = async (id: string) => {
    if (!window.confirm("Remove this passkey?")) return;
    try {
      const res = await fetch(`/api/settings/passkeys/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Failed to remove passkey");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove passkey");
    }
  };

  if (loading && passkeys.length === 0) {
    return (
      <div className="card p-6">
        <h3 className="text-lg text-mist-100">Passkeys</h3>
        <p className="text-mist-400 text-sm">Loading passkeys…</p>
      </div>
    );
  }

  return (
    <div className="card p-6 space-y-6">
      <div>
        <h3 className="text-lg text-mist-100">Passkeys</h3>
        <p className="text-mist-400 text-sm">
          Security keys and platform authenticators that can sign in to this account.
        </p>
      </div>

      {error && <p className="text-ember-400 text-sm">{error}</p>}

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <input
          className="input"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Name this passkey (e.g. YubiKey, Phone)"
        />
        <button className="btn whitespace-nowrap" disabled={busy} onClick={addPasskey}>
          {busy ? "Adding…" : "Add passkey"}
        </button>
      </div>

      <div className="space-y-3">
        {passkeys.length === 0 ? (
          <p className="text-mist-600 text-sm">No passkeys registered yet.</p>
        ) : (
          passkeys.map((pk) => {
            const renameOpen = pk.id in renameDrafts;
            return (
              <div
                key={pk.id}
                className="rounded-lg border border-abyss-600 p-3 space-y-2"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div>
                    <p className="text-mist-100 font-medium">
                      {pk.name ?? "Unnamed passkey"}
                    </p>
                    <p className="text-mist-600 text-xs mt-0.5">
                      Added {new Date(pk.createdAt * 1000).toLocaleDateString()}
                      {pk.lastUsedAt
                        ? ` · Last used ${new Date(
                            pk.lastUsedAt * 1000
                          ).toLocaleDateString()}`
                        : " · Never used"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button className="btn-ghost text-sm" onClick={() => toggleRename(pk)}>
                      {renameOpen ? "Cancel" : "Rename"}
                    </button>
                    <button
                      className="btn-ghost text-sm text-ember-400"
                      disabled={count <= 1}
                      onClick={() => removePasskey(pk.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {renameOpen && (
                  <div className="flex gap-2 items-center">
                    <input
                      className="input"
                      value={renameDrafts[pk.id] ?? ""}
                      onChange={(e) =>
                        setRenameDrafts((prev) => ({ ...prev, [pk.id]: e.target.value }))
                      }
                    />
                    <button
                      className="btn whitespace-nowrap"
                      onClick={() => renamePasskey(pk.id, renameDrafts[pk.id] ?? "")}
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
        {count <= 1 && passkeys.length > 0 && (
          <p className="text-mist-600 text-xs">
            Add another passkey before removing this one.
          </p>
        )}
      </div>
    </div>
  );
}

function ApiConnectionsSection() {
  const [conns, setConns] = useState<Conn[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, { ok: boolean; text: string }>>(
    {}
  );
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Failed to load connections");
      const json = await res.json();
      setConns(json.connections || []);
    } catch {
      // Leave the list empty; the section renders an empty-state line.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveKey = async (id: string) => {
    try {
      setBusy(id);
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, apiKey: drafts[id] ?? "" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
      setConns((prev) => prev.map((c) => (c.id === id ? { ...c, ...json.status } : c)));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setStatuses((prev) => ({ ...prev, [id]: { ok: true, text: "Saved." } }));
    } catch (e) {
      setStatuses((prev) => ({
        ...prev,
        [id]: { ok: false, text: e instanceof Error ? e.message : "Network error" },
      }));
    } finally {
      setBusy(null);
    }
  };

  const testKey = async (id: string) => {
    try {
      setBusy(id);
      const res = await fetch("/api/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (res.status >= 500) throw new Error(json.error ?? "Test failed");
      setStatuses((prev) => ({
        ...prev,
        [id]: { ok: Boolean(json.ok), text: json.message ?? json.error ?? "" },
      }));
    } catch (e) {
      setStatuses((prev) => ({
        ...prev,
        [id]: { ok: false, text: e instanceof Error ? e.message : "Network error" },
      }));
    } finally {
      setBusy(null);
    }
  };

  if (loading && conns.length === 0) {
    return (
      <div className="card p-6">
        <h3 className="text-lg text-mist-100">API Connections</h3>
        <p className="text-mist-400 text-sm">Loading connections…</p>
      </div>
    );
  }

  return (
    <div className="card p-6 space-y-4">
      <div>
        <h3 className="text-lg text-mist-100">API Connections</h3>
        <p className="text-mist-400 text-sm">
          Keys for third-party intelligence APIs. A key saved here overrides the server
          environment; leave the field blank and save to clear it and fall back to the
          deployment&apos;s configured key.
        </p>
      </div>

      {conns.length === 0 ? (
        <p className="text-mist-600 text-sm">No API connections available.</p>
      ) : (
        conns.map((conn) => {
          const status = statuses[conn.id];
          return (
            <div key={conn.id} className="rounded-lg border border-abyss-600 p-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2">
                <h4 className="text-mist-100">{conn.label}</h4>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs ${
                    conn.configured && conn.source === "db"
                      ? "text-emerald-400 bg-emerald-400/10"
                      : conn.configured && conn.source === "env"
                        ? "text-sigil-400 bg-sigil-400/10"
                        : "text-mist-600 bg-abyss-700"
                  }`}
                >
                  {conn.configured && conn.source === "db"
                    ? "Configured"
                    : conn.configured && conn.source === "env"
                      ? "From environment"
                      : "Not configured"}
                </span>
              </div>

              <p className="text-mist-400 text-sm mb-1">{conn.description}</p>
              <a
                href={conn.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sigil-400 text-xs mb-3 inline-block"
              >
                Get a key ↗
              </a>

              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <input
                  className="input"
                  type="password"
                  value={drafts[conn.id] ?? ""}
                  onChange={(e) =>
                    setDrafts((prev) => ({ ...prev, [conn.id]: e.target.value }))
                  }
                  placeholder="Paste API key (leave blank to clear override)"
                />
                <button
                  className="btn whitespace-nowrap"
                  disabled={busy === conn.id}
                  onClick={() => saveKey(conn.id)}
                >
                  {busy === conn.id ? "Working…" : "Save"}
                </button>
                {conn.testable && (
                  <button
                    className="btn-ghost whitespace-nowrap"
                    disabled={busy === conn.id}
                    onClick={() => testKey(conn.id)}
                  >
                    Test
                  </button>
                )}
              </div>

              {conn.masked && (
                <p className="text-mist-600 text-xs font-mono mt-2">
                  Current key: {conn.masked}
                </p>
              )}

              {status && (
                <p
                  className={`text-sm mt-2 ${
                    status.ok ? "text-emerald-400" : "text-ember-400"
                  }`}
                >
                  {status.text}
                </p>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function BreachImportsSection() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [name, setName] = useState<string>("");
  const [format, setFormat] = useState<string>("combo");
  const [note, setNote] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState<number>(0);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/settings/breaches");
      if (!res.ok) throw new Error("Failed to load breach sources");
      const json = await res.json();
      setSources(json.sources || []);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const importFile = async () => {
    if (!name.trim() || !file) {
      setError("Provide both a source name and a file.");
      return;
    }
    try {
      setBusy(true);
      setError(null);
      setSuccess(null);

      const formData = new FormData();
      formData.append("name", name);
      formData.append("format", format);
      formData.append("note", note);
      formData.append("file", file);

      const res = await fetch("/api/settings/breaches", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Import failed");

      setSuccess(`Imported ${Number(json.entryCount).toLocaleString()} entries.`);
      setName("");
      setFormat("combo");
      setNote("");
      setFile(null);
      setFileKey((k) => k + 1);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  };

  const deleteSource = async (id: string) => {
    if (!window.confirm("Delete this breach list?")) return;
    try {
      const res = await fetch(`/api/settings/breaches/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Failed to delete");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    }
  };

  if (loading && sources.length === 0) {
    return (
      <div className="card p-6">
        <h3 className="text-lg text-mist-100">Breach Imports</h3>
        <p className="text-mist-400 text-sm">Loading breach lists…</p>
      </div>
    );
  }

  return (
    <div className="card p-6 space-y-6">
      <div>
        <h3 className="text-lg text-mist-100">Breach Imports</h3>
        <p className="text-mist-400 text-sm">
          Import local breach/combo lists so email scans can be cross-referenced offline.
          Files are parsed into an indexed table; passwords are never shown — only whether
          a credential was present.
        </p>
      </div>

      {error && <p className="text-ember-400 text-sm">{error}</p>}
      {success && <p className="text-emerald-400 text-sm">{success}</p>}

      <div className="rounded-lg border border-abyss-600 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Source name (e.g. Collection #1)"
          />
          <select
            className="input"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
          >
            <option value="combo">Combo list (email:password)</option>
            <option value="email">Email list (one per line)</option>
            <option value="csv">CSV (email in first column)</option>
          </select>
        </div>
        <input
          className="input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
        />
        <input
          key={fileKey}
          type="file"
          className="text-mist-400 text-sm block"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button className="btn" disabled={busy} onClick={importFile}>
          {busy ? "Importing…" : "Import"}
        </button>
      </div>

      <div className="space-y-3">
        {sources.length === 0 ? (
          <p className="text-mist-600 text-sm">No breach lists imported yet.</p>
        ) : (
          sources.map((src) => (
            <div key={src.id} className="rounded-lg border border-abyss-600 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-mist-100 font-medium">{src.name}</p>
                  <p className="text-mist-600 text-xs mt-0.5">
                    {src.entry_count.toLocaleString()} entries · {src.format} · imported{" "}
                    {new Date(src.created_at * 1000).toLocaleDateString()}
                  </p>
                  {src.note && <p className="text-mist-400 text-xs mt-0.5">{src.note}</p>}
                </div>
                <button
                  className="btn-ghost text-sm text-ember-400 shrink-0"
                  onClick={() => deleteSource(src.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const TABS: { id: "passkeys" | "api" | "breaches"; label: string }[] = [
  { id: "passkeys", label: "Passkeys" },
  { id: "api", label: "API Connections" },
  { id: "breaches", label: "Breach Imports" },
];

export default function Settings() {
  const [tab, setTab] = useState<"passkeys" | "api" | "breaches">("passkeys");

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl text-mist-100">Settings</h2>
        <p className="text-mist-400 text-sm mt-1">
          Manage sign-in passkeys, intelligence API keys, and local breach imports.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-full border text-xs transition cursor-pointer ${
              tab === t.id
                ? "border-sigil-500 text-sigil-400 bg-sigil-600/10"
                : "border-abyss-600 text-mist-400 hover:border-sigil-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "passkeys" && <PasskeysSection />}
      {tab === "api" && <ApiConnectionsSection />}
      {tab === "breaches" && <BreachImportsSection />}
    </div>
  );
}
