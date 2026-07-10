"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { planLimits } from "@/lib/plans";
import { resolveCompetitorInput } from "@/lib/competitors";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function updateProject(formData: FormData) {
  const { supabase } = await requireUser();
  const projectId = String(formData.get("projectId"));
  await supabase
    .from("projects")
    .update({
      name: String(formData.get("name") ?? "").trim(),
      website: String(formData.get("website") ?? "").trim(),
      industry: String(formData.get("industry") ?? "").trim(),
      country: String(formData.get("country") ?? "US"),
      language: String(formData.get("language") ?? "en"),
      target_market: String(formData.get("target_market") ?? "").trim() || null,
    })
    .eq("id", projectId);
  revalidatePath("/", "layout");
}

export async function addCompetitor(formData: FormData) {
  const { supabase, user } = await requireUser();
  const projectId = String(formData.get("projectId"));
  const input = String(formData.get("domain") ?? formData.get("name") ?? "").trim();
  if (!input) return;

  const [{ data: profile }, { count }] = await Promise.all([
    supabase.from("profiles").select("plan").eq("id", user.id).single(),
    supabase
      .from("competitors")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
  ]);
  if ((count ?? 0) >= planLimits(profile?.plan).maxCompetitors) return;

  const resolved = await resolveCompetitorInput(input);
  await supabase.from("competitors").insert({
    user_id: user.id,
    project_id: projectId,
    name: resolved.name,
    website: resolved.website,
    position: count ?? 0,
  });
  revalidatePath("/settings");
}

export async function reorderCompetitors(projectId: string, orderedIds: string[]) {
  const { supabase } = await requireUser();
  await Promise.all(
    orderedIds.map((id, position) =>
      supabase.from("competitors").update({ position }).eq("id", id).eq("project_id", projectId)
    )
  );
  revalidatePath("/settings");
}

export async function removeCompetitor(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("competitors").delete().eq("id", id);
  revalidatePath("/settings");
}

export async function addPrompt(formData: FormData) {
  const { supabase, user } = await requireUser();
  const projectId = String(formData.get("projectId"));
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return;

  const [{ data: profile }, { count }] = await Promise.all([
    supabase.from("profiles").select("plan").eq("id", user.id).single(),
    supabase
      .from("prompts")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("is_active", true),
  ]);
  if ((count ?? 0) >= planLimits(profile?.plan).maxPrompts) return;

  await supabase
    .from("prompts")
    .insert({ user_id: user.id, project_id: projectId, text, category: "custom" });
  revalidatePath("/settings");
}

export async function togglePrompt(id: string, isActive: boolean) {
  const { supabase } = await requireUser();
  await supabase.from("prompts").update({ is_active: isActive }).eq("id", id);
  revalidatePath("/settings");
}

export async function removePrompt(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("prompts").delete().eq("id", id);
  revalidatePath("/settings");
}

export async function deleteProject(projectId: string) {
  const { supabase } = await requireUser();
  await supabase.from("projects").delete().eq("id", projectId);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
