import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getJob } from "@/lib/jobs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const job = getJob(id);
  if (!job) {
    return NextResponse.json({ error: "job not found" }, { status: 404 });
  }

  let result: unknown = null;
  if (job.result) {
    try {
      result = JSON.parse(job.result);
    } catch {
      result = null;
    }
  }

  return NextResponse.json({
    id: job.id,
    tool: job.tool,
    target: job.target,
    status: job.status,
    created_at: job.created_at,
    started_at: job.started_at,
    finished_at: job.finished_at,
    error: job.error,
    result,
  });
}
