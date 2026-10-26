import { spawn } from "child_process";
import fs from "fs";
import path from "path";

export interface PhotonResult {
  internal: string[];
  external: string[];
  scripts: string[];
  files: string[];
  endpoints: string[];
  fuzzable: string[];
  intel: string[];
  robots: string[];
  failed: string[];
  custom: string[];
  keys: string[];
}

const PHOTON_KEYS: (keyof PhotonResult)[] = [
  "internal",
  "external",
  "scripts",
  "files",
  "endpoints",
  "fuzzable",
  "intel",
  "robots",
  "failed",
  "custom",
  "keys",
];

export function validateTargetUrl(raw: string): string {
  let urlStr = raw.trim();
  if (!/^https?:\/\//i.test(urlStr)) {
    urlStr = "https://" + urlStr;
  }

  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    throw new Error("invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("only http/https targets are allowed");
  }
  if (!url.hostname) {
    throw new Error("hostname required");
  }
  return url.href;
}

export async function runPhoton(
  target: string,
  opts: { outDir: string; level?: number; timeoutMs?: number }
): Promise<PhotonResult> {
  const url = validateTargetUrl(target);
  // Photon's -l is argparse type=int; a fractional value exits 2 with usage text.
  const level = Math.min(
    3,
    Math.max(1, Number.isFinite(opts.level) ? Math.round(opts.level as number) : 2)
  );
  const photonPath = process.env.PHOTON_PATH ?? "/opt/suron-tools/photon/photon.py";
  const python = process.env.PYTHON_BIN ?? "python3";
  const timeoutMs = opts.timeoutMs ?? 300_000;
  const outDir = opts.outDir;

  // Photon creates outDir itself with os.mkdir (not makedirs): the parent must
  // exist and outDir itself must not, or it crashes.
  fs.mkdirSync(path.dirname(outDir), { recursive: true });
  fs.rmSync(outDir, { recursive: true, force: true });

  return new Promise((resolve, reject) => {
    const child = spawn(
      python,
      [
        photonPath,
        "-u",
        url,
        "-l",
        String(level),
        "-t",
        "10",
        "--timeout",
        "10",
        "-o",
        outDir,
        "--export=json",
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    );

    let stderr = "";
    let timedOut = false;

    child.stdout.on("data", () => {});
    child.stderr.on("data", (d) => (stderr += d.toString()));

    const killTimer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.on("error", (err) => {
      clearTimeout(killTimer);
      reject(new Error(`failed to start photon: ${err.message}`));
    });

    child.on("close", (code) => {
      clearTimeout(killTimer);

      if (timedOut) {
        reject(new Error("photon timed out"));
        return;
      }
      if (code !== 0) {
        const clean = stderr.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");
        reject(new Error(`photon failed (exit ${code}): ${clean.slice(-300)}`));
        return;
      }

      try {
        const raw = JSON.parse(
          fs.readFileSync(path.join(outDir, "exported.json"), "utf-8")
        ) as Record<string, string[]>;
        const result = {} as PhotonResult;
        for (const key of PHOTON_KEYS) {
          result[key] = Array.isArray(raw[key]) ? raw[key] : [];
        }
        resolve(result);
      } catch (err) {
        reject(new Error(`photon produced no readable exported.json: ${String(err)}`));
      }
    });
  });
}
