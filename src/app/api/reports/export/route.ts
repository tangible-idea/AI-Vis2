import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildMarkdownReport, buildCsvReport, type ReportData } from "@/lib/reports/build";

/** GET ?projectId=…&format=md|csv → downloads the latest report. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  const format = url.searchParams.get("format") ?? "md";
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const [{ data: project }, { data: snapshots }, { data: recs }, { data: competitors }] =
    await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase
        .from("snapshots")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(2),
      supabase
        .from("recommendations")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase.from("competitors").select("name").eq("project_id", projectId),
    ]);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const data: ReportData = {
    project,
    snapshot: snapshots?.[0] ?? null,
    previous: snapshots?.[1] ?? null,
    recommendations: recs ?? [],
    competitors: (competitors ?? []).map((c) => c.name),
  };

  const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  if (format === "csv") {
    return new Response(buildCsvReport(data), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slug}-ai-visibility.csv"`,
      },
    });
  }
  return new Response(buildMarkdownReport(data), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-ai-visibility.md"`,
    },
  });
}
