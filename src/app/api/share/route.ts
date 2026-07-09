import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { planLimits } from "@/lib/plans";

/** POST { projectId, expiresInDays? } → create share link. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
  if (!planLimits(profile?.plan).shareLinks) {
    return NextResponse.json(
      { error: "Shareable links are available on Starter and Pro plans.", code: "limit" },
      { status: 403 }
    );
  }

  const { projectId, expiresInDays } = await request.json();
  const expires_at = expiresInDays
    ? new Date(Date.now() + expiresInDays * 86400_000).toISOString()
    : null;

  const { data, error } = await supabase
    .from("share_links")
    .insert({ user_id: user.id, project_id: projectId, expires_at })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** DELETE { id } → revoke. */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await request.json();
  const { error } = await supabase.from("share_links").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
