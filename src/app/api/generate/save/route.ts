import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** POST { projectId, type, language, title, content, recommendationId? } */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, type, language, title, content, recommendationId } = await request.json();
  if (!projectId || !content) {
    return NextResponse.json({ error: "projectId and content required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("generated_content")
    .insert({
      user_id: user.id,
      project_id: projectId,
      recommendation_id: recommendationId ?? null,
      type: type ?? "custom",
      language: language ?? "en",
      title: title ?? "",
      content,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
