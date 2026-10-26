import { spawn } from "child_process";

export const PHONE_RE = /^[+(]?\d[\d\s().-]{4,24}$/;

export interface PhoneScan {
  input: string;
  valid: boolean;
  possible: boolean;
  e164: string;
  international: string;
  national: string;
  country_code: number;
  region: string;
  location: string;
  carrier: string;
  timezones: string[];
  number_type: string;
}

export async function runPhoneScan(
  number: string,
  opts?: { region?: string; timeoutMs?: number }
): Promise<PhoneScan> {
  const n = number.trim();
  if (!PHONE_RE.test(n)) {
    throw new Error("invalid phone number");
  }

  const python = process.env.PYTHON_BIN ?? "python3";
  const script = process.env.PHONE_SCRIPT ?? "/opt/suron-scripts/phone_scan.py";
  const region = opts?.region ?? "US";
  const timeoutMs = opts?.timeoutMs ?? 20_000;

  return new Promise((resolve, reject) => {
    const child = spawn(python, [script, n, region], {
      stdio: ["ignore", "pipe", "pipe"],
    });
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
      reject(new Error(`failed to start phone scan: ${err.message}`));
    });

    child.on("close", (code) => {
      clearTimeout(killTimer);
      if (timedOut) {
        reject(new Error("phone scan timed out"));
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
        reject(new Error(`phone scan failed (exit ${code}): ${msg}`));
        return;
      }

      try {
        const parsed = JSON.parse(stdout) as { error?: string } & PhoneScan;
        if (parsed.error) {
          reject(new Error(parsed.error));
          return;
        }
        resolve(parsed);
      } catch {
        reject(new Error("phone scan produced unreadable output"));
      }
    });
  });
}
