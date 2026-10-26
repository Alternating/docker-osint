import { spawn } from "child_process";

export const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export interface HoleheHit {
  name: string;
  domain: string | null;
  method: string | null;
  exists: boolean | null;
  rateLimit: boolean | null;
  frequent_rate_limit: boolean | null;
  emailrecovery: string | null;
  phoneNumber: string | null;
  others: Record<string, string> | null;
  error: boolean;
}

export interface HoleheResult {
  email: string;
  total: number;
  found: number;
  results: HoleheHit[];
}

export async function runHolehe(
  email: string,
  opts?: { timeoutMs?: number }
): Promise<HoleheResult> {
  if (!EMAIL_RE.test(email) || email.length > 254) {
    throw new Error("invalid email");
  }

  const python = process.env.PYTHON_BIN ?? "python3";
  const script = process.env.HOLEHE_SCRIPT ?? "/opt/suron-scripts/holehe_scan.py";
  const timeoutMs = opts?.timeoutMs ?? 180_000;

  return new Promise((resolve, reject) => {
    const child = spawn(python, [script, email], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    const killTimer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.on("error", (err) => {
      clearTimeout(killTimer);
      reject(new Error(`failed to start holehe: ${err.message}`));
    });

    child.on("close", (code) => {
      clearTimeout(killTimer);
      if (timedOut) {
        reject(new Error("holehe timed out"));
        return;
      }
      if (code !== 0) {
        let msg = stderr.slice(-300);
        try {
          const p = JSON.parse(stdout) as { error?: string };
          if (p.error) msg = p.error;
        } catch {
          // fall back to stderr
        }
        reject(new Error(`holehe failed (exit ${code}): ${msg}`));
        return;
      }

      try {
        const parsed = JSON.parse(stdout) as { error?: string } & HoleheResult;
        if (parsed.error) {
          reject(new Error(parsed.error));
          return;
        }
        resolve(parsed);
      } catch {
        reject(new Error("holehe produced unreadable output"));
      }
    });
  });
}
