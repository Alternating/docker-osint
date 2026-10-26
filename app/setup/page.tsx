"use client";

import { startRegistration } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

export default function SetupPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    fetch("/api/auth/state")
      .then((res) => res.json())
      .then((json) => {
        if (!json.needsSetup) {
          router.replace("/login");
        }
      })
      .catch(() => {});
  }, [router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/setup/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setupPassword: password, username }),
      });
      const options = await res.json();
      if (!res.ok) throw new Error(options.error ?? "failed");
      const attestation = await startRegistration({ optionsJSON: options });
      const vr = await fetch("/api/auth/setup/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: attestation }),
      });
      const vj = await vr.json();
      if (!vr.ok || !vj.ok) throw new Error(vj.error ?? "verification failed");
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Setup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <div className="w-64 h-64 bg-sigil-500/20 blur-3xl rounded-full" />
      </div>
      <div className="z-10 flex flex-col items-center mb-8 text-center px-6">
        <svg width="64" height="64" viewBox="0 0 64 64" className="drop-shadow-lg">
          <circle cx="32" cy="32" r="28" stroke="#4f83ff" strokeWidth="1.5" fill="none" />
          <circle cx="32" cy="32" r="12" fill="#0d1526" />
          <ellipse cx="32" cy="32" rx="4" ry="10" fill="#ff8a3d" />
        </svg>
        <h1 className="mt-6 text-3xl tracking-widest font-semibold text-mist-100">
          FORGE THE FIRST KEY
        </h1>
        <p className="mt-2 text-mist-400 text-sm max-w-md">
          One-time setup: bind your account to a passkey. The setup password is never
          stored.
        </p>
      </div>

      <div className="card max-w-sm w-full p-8 z-10">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm text-mist-400 mb-1">Username</label>
            <input
              type="text"
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-mist-400 mb-1">Setup password</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="From your server configuration"
              required
            />
          </div>
          <button type="submit" className="btn w-full" disabled={busy}>
            {busy ? "Forging key…" : "Create account & register passkey"}
          </button>
        </form>
        {error && <p className="text-ember-400 text-sm mt-4 text-center">{error}</p>}
      </div>
    </div>
  );
}
