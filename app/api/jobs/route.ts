import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listJobs } from "@/lib/jobs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const jobs = listJobs(30).map((j) => ({
    id: j.id,
    tool: j.tool,
    target: j.target,
    status: j.status,
    created_at: j.created_at,
    finished_at: j.finished_at,
    error: j.error,
    hasResult: j.result !== null,
  }));

  return NextResponse.json({ jobs });
}
