import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listJobs } from "@/lib/jobs";
import { buildSecurityReport } from "@/lib/report";
import { ollamaConfigured, getOllamaConfig } from "@/lib/ollama";

export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    if (!ollamaConfigured()) {
      return NextResponse.json(
        { error: "Configure a local AI model in Settings → Assistant first." },
        { status: 400 }
      );
    }

    const jobs = listJobs(50);
    try {
      const { report, scansUsed } = await buildSecurityReport(jobs);
      return NextResponse.json({
        report,
        scansUsed,
        model: getOllamaConfig().model,
      });
    } catch (e) {
      const msg = (e as Error).message;
      // "no findings" is a client-side condition; anything else is the Ollama
      // upstream being unreachable/slow/erroring.
      const status = msg.includes("No completed scans") ? 400 : 502;
      return NextResponse.json({ error: msg }, { status });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
