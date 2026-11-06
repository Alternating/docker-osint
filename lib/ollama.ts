import { getSetting } from "@/lib/settings";

const DEFAULT_HOST = "http://localhost:11434";

export function getOllamaConfig(): { host: string; model: string } {
  const hostFromSetting = getSetting<string>("ollama.host", "").trim();
  const host = (hostFromSetting || process.env.OLLAMA_HOST?.trim() || DEFAULT_HOST).replace(
    /\/+$/,
    ""
  );
  const model =
    getSetting<string>("ollama.model", "").trim() || process.env.OLLAMA_MODEL?.trim() || "";

  return { host, model };
}

export function ollamaConfigured(): boolean {
  return getOllamaConfig().model !== "";
}

export async function ollamaGenerate(
  prompt: string,
  opts?: { system?: string; timeoutMs?: number }
): Promise<string> {
  const { host, model } = getOllamaConfig();
  if (!model) {
    throw new Error("No Ollama model is configured");
  }

  const messages = [
    ...(opts?.system ? [{ role: "system" as const, content: opts.system }] : []),
    { role: "user" as const, content: prompt },
  ];

  const response = await fetch(`${host}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages,
      options: { temperature: 0.2 },
    }),
    signal: AbortSignal.timeout(opts?.timeoutMs ?? 120_000),
  });

  if (!response.ok) {
    throw new Error(`Ollama responded ${response.status}`);
  }

  const data = (await response.json()) as { message?: { content?: string } };
  const content = (data.message?.content ?? "").trim();
  if (!content) {
    throw new Error("Ollama returned an empty response");
  }

  return content;
}

// Accepts an optional override so the Settings "Test" button can validate the
// host/model the user just typed, before they've saved it.
export async function ollamaStatus(override?: {
  host?: string;
  model?: string;
}): Promise<string> {
  const base = getOllamaConfig();
  const host = (override?.host?.trim() || base.host).replace(/\/+$/, "");
  const model = override?.model?.trim() || base.model;

  const response = await fetch(`${host}/api/tags`, {
    method: "GET",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Ollama responded ${response.status}`);
  }

  const data = (await response.json()) as { models?: Array<{ name?: string }> };
  const names = (data.models ?? []).map((m) => String(m.name ?? "")).filter(Boolean);

  if (!model) {
    return `Connected — ${names.length} model(s) installed`;
  }

  const installed = names.some((n) => n === model || n.startsWith(model + ":"));
  if (!installed) {
    throw new Error(
      `Connected, but model "${model}" is not installed (found: ${
        names.slice(0, 6).join(", ") || "none"
      })`
    );
  }

  return `Connected — model "${model}" is available`;
}
