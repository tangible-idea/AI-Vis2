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
      logo_url: String(formData.get("logo_url") ?? "").trim() || null,
    })
    .eq("id", projectId);
  revalidatePath("/", "layout");
}

/** White-label branding (Pro): company identity shown on exported reports. */
export async function updateBranding(formData: FormData) {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
  if (!planLimits(profile?.plan).whiteLabel) return;

  await supabase
    .from("organizations")
    .update({
      name: String(formData.get("company_name") ?? "").trim(),
      website: String(formData.get("company_website") ?? "").trim() || null,
      logo_url: String(formData.get("company_logo") ?? "").trim() || null,
    })
    .eq("owner_id", user.id);
  revalidatePath("/settings");
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
  const { supabase, user } = await requireUser();

  // resuming counts toward the plan's active-prompt limit
  if (isActive) {
    const { data: prompt } = await supabase.from("prompts").select("project_id").eq("id", id).single();
    if (!prompt) return;
    const [{ data: profile }, { count }] = await Promise.all([
      supabase.from("profiles").select("plan").eq("id", user.id).single(),
      supabase
        .from("prompts")
        .select("id", { count: "exact", head: true })
        .eq("project_id", prompt.project_id)
        .eq("is_active", true),
    ]);
    if ((count ?? 0) >= planLimits(profile?.plan).maxPrompts) return;
  }

  await supabase.from("prompts").update({ is_active: isActive }).eq("id", id);
  revalidatePath("/settings");
  revalidatePath("/prompts");
}

export async function removePrompt(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("prompts").delete().eq("id", id);
  revalidatePath("/settings");
  revalidatePath("/prompts");
}

export async function inviteMember(formData: FormData) {
  const { supabase, user } = await requireUser();
  const projectId = String(formData.get("projectId"));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role")) === "viewer" ? "viewer" : "member";
  if (!email || !email.includes("@")) return;

  const [{ data: profile }, { count }] = await Promise.all([
    supabase.from("profiles").select("plan").eq("id", user.id).single(),
    supabase
      .from("project_members")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
  ]);
  const limits = planLimits(profile?.plan);
  if (!limits.team || (count ?? 0) >= limits.maxTeamMembers) return;

  // RLS restricts inserts to the workspace owner
  await supabase.from("project_members").insert({
    project_id: projectId,
    email,
    role,
    invited_by: user.id,
  });
  revalidatePath("/settings");
}

export async function removeMember(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("project_members").delete().eq("id", id);
  revalidatePath("/settings");
}

/** Monitoring configuration: opt a project in or out of weekly scheduled scans. */
export async function setAutoScan(projectId: string, enabled: boolean) {
  const { supabase, user } = await requireUser();
  await supabase
    .from("projects")
    .update({ auto_scan_enabled: enabled })
    .eq("id", projectId)
    .eq("user_id", user.id);
  revalidatePath("/settings");
}

export async function deleteProject(projectId: string) {
  const { supabase } = await requireUser();
  await supabase.from("projects").delete().eq("id", projectId);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/** Archives a project: data is kept, but it leaves the working set and no longer counts toward plan limits. */
export async function archiveProject(projectId: string) {
  const { supabase, user } = await requireUser();
  await supabase
    .from("projects")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("user_id", user.id);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/** Restores an archived project, subject to the plan's active-project limit. */
export async function restoreProject(projectId: string): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();

  const [{ data: profile }, { count }] = await Promise.all([
    supabase.from("profiles").select("plan").eq("id", user.id).single(),
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_demo", false)
      .is("archived_at", null),
  ]);
  const limits = planLimits(profile?.plan);
  if ((count ?? 0) >= limits.maxProjects) {
    return {
      error: `Your ${limits.label} plan includes ${limits.maxProjects} active project${limits.maxProjects > 1 ? "s" : ""}. Archive another project or upgrade to restore this one.`,
    };
  }

  await supabase
    .from("projects")
    .update({ archived_at: null })
    .eq("id", projectId)
    .eq("user_id", user.id);
  revalidatePath("/", "layout");
  return {};
}
