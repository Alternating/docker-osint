import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { searchResources, resourceStats, allCategories } from "@/lib/resources";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q") ?? "";
  const category = req.nextUrl.searchParams.get("category");

  let results = searchResources(q, 2000);
  if (category) {
    results = results.filter((r) => r.category === category);
  }
  results = results.slice(0, 200);

  return NextResponse.json({
    stats: resourceStats(),
    categories: allCategories(),
    results,
  });
}
