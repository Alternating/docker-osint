"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/state")
      .then((res) => res.json())
      .then((json) => {
        if (json.needsSetup) {
          router.replace("/setup");
        } else if (json.authenticated) {
          router.replace("/");
        }
      })
      .catch(() => {});
  }, [router]);

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login/options", { method: "POST" });
      const options = await res.json();
      if (!res.ok) throw new Error(options.error ?? "failed");
      const assertion = await startAuthentication({ optionsJSON: options });
      const vr = await fetch("/api/auth/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: assertion }),
      });
      const vj = await vr.json();
      if (!vr.ok || !vj.ok) throw new Error(vj.error ?? "verification failed");
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <div className="w-64 h-64 bg-sigil-500/20 blur-3xl rounded-full" />
      </div>
      <div className="z-10 flex flex-col items-center mb-8">
        <svg width="64" height="64" viewBox="0 0 64 64" className="drop-shadow-lg">
          <circle cx="32" cy="32" r="28" stroke="#4f83ff" strokeWidth="1.5" fill="none" />
          <circle cx="32" cy="32" r="12" fill="#0d1526" />
          <ellipse cx="32" cy="32" rx="4" ry="10" fill="#ff8a3d" />
        </svg>
        <h1 className="mt-6 text-3xl tracking-widest font-semibold text-mist-100">SURON</h1>
        <p className="mt-2 text-mist-400 text-sm">
          The Eye sees all. Authenticate to enter.
        </p>
      </div>

      <div className="card max-w-sm w-full p-8 z-10">
        <button className="btn w-full" onClick={signIn} disabled={busy}>
          {busy ? "Waiting for passkey…" : "Sign in with passkey"}
        </button>
        {error && <p className="text-ember-400 text-sm mt-4 text-center">{error}</p>}
      </div>

      <div className="mt-8 text-mist-600 text-xs">Passkey-only access · Suron OSINT</div>
    </div>
  );
}
