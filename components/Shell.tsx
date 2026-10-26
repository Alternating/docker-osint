"use client";

import Link from "next/link";
import { ReactNode } from "react";

interface ShellProps {
  username: string;
  children: ReactNode;
}

export default function Shell({ username, children }: ShellProps) {
  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 backdrop-blur bg-abyss-950/80 border-b border-abyss-600">
        <div className="mx-auto max-w-5xl px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#4f83ff" strokeWidth="1.5" />
                  <ellipse cx="12" cy="12" rx="3" ry="7" fill="#ff8a3d" />
                </svg>
                <Link href="/" className="tracking-widest font-semibold text-lg ml-2">
                  SURON
                </Link>
              </div>
              <div className="flex gap-6 ml-4">
                <Link
                  href="/"
                  className="text-mist-400 hover:text-mist-100 text-sm transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  href="/resources"
                  className="text-mist-400 hover:text-mist-100 text-sm transition-colors"
                >
                  Resources
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-mist-600 text-sm">{username}</span>
              <button
                onClick={handleSignOut}
                className="btn-ghost px-3 py-1.5 text-sm"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}
