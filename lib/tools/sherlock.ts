import { spawn } from "child_process";
import fs from "fs";

export const USERNAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export interface SherlockHit {
  site: string;
  url: string;
}

export interface SherlockResult {
  username: string;
  hits: SherlockHit[];
  total: number;
}

export async function runSherlock(
  username: string,
  opts?: { timeoutMs?: number; outDir?: string }
): Promise<SherlockResult> {
  if (!USERNAME_RE.test(username)) {
    throw new Error("invalid username");
  }

  const bin = process.env.SHERLOCK_BIN ?? "sherlock";
  const timeoutMs = opts?.timeoutMs ?? 300_000;

  // Sherlock always writes <username>.txt; without --folderoutput it lands in
  // the server's cwd (and fails outright on a read-only rootfs).
  const args = ["--no-color", "--print-found", "--timeout", "10", "--local"];
  if (opts?.outDir) {
    fs.mkdirSync(opts.outDir, { recursive: true });
    args.push("--folderoutput", opts.outDir);
  }
  args.push("--", username);

  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });

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
      reject(new Error(`failed to start sherlock: ${err.message}`));
    });

    // "close" (not "exit") guarantees stdout/stderr are fully flushed.
    child.on("close", (code) => {
      clearTimeout(killTimer);

      if (timedOut) {
        reject(new Error("sherlock timed out"));
        return;
      }
      if (code !== 0) {
        reject(new Error(`sherlock failed (exit ${code}): ${stderr.slice(-300)}`));
        return;
      }

      const hits: SherlockHit[] = [];
      for (const line of stdout.split("\n")) {
        const m = line.match(/^\[\+\](?:\s\[\d+ms\])?\s(.+?):\s(\S+)$/);
        if (m) hits.push({ site: m[1], url: m[2] });
      }

      const footer = stdout.match(/Search completed with (\d+) results/);
      const total = footer ? parseInt(footer[1], 10) : hits.length;

      resolve({ username, hits, total });
    });
  });
}
