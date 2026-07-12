"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PROJECT_COOKIE } from "@/lib/project";
import { generateDefaultPrompts } from "@/lib/scan/prompts";
import { planLimits } from "@/lib/plans";
import { resolveCompetitorInput } from "@/lib/competitors";

export async function switchProject(projectId: string) {
  const cookieStore = await cookies();
  cookieStore.set(PROJECT_COOKIE, projectId, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
}

export interface OnboardingState {
  error?: string;
  scanId?: string;
  projectId?: string;
}

export async function createProject(
  _prev: OnboardingState | null,
  formData: FormData
): Promise<OnboardingState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const rawWebsite = String(formData.get("website") ?? "").trim();
  const website = rawWebsite && !/^https?:\/\//i.test(rawWebsite) ? `https://${rawWebsite}` : rawWebsite;
  const industry = String(formData.get("industry") ?? "").trim();
  const country = String(formData.get("country") ?? "US");
  const language = String(formData.get("language") ?? "en");
  const target_market = String(formData.get("target_market") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const competitorNames = [1, 2, 3]
    .map((i) => String(formData.get(`competitor${i}`) ?? "").trim())
    .filter(Boolean);

  if (!name || !website || !industry) return { error: "Please fill in the required fields." };

  const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
  const limits = planLimits(profile?.plan);

  // plan limits count active projects only — archived ones don't block new work
  const { count: projectCount } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_demo", false)
    .is("archived_at", null);
  if ((projectCount ?? 0) >= limits.maxProjects) {
    return {
      error: `Your ${limits.label} plan includes ${limits.maxProjects} active project${limits.maxProjects > 1 ? "s" : ""}. Archive or delete a project in Settings, or upgrade to add more brands.`,
    };
  }

  const { data: project, error } = await supabase
    .from("projects")
    .insert({ user_id: user.id, name, website, industry, country, language, target_market, description })
    .select()
    .single();
  if (error || !project) return { error: error?.message ?? "Could not create project" };

  let resolvedNames = competitorNames;
  if (competitorNames.length) {
    const resolved = await Promise.all(
      competitorNames.slice(0, limits.maxCompetitors).map(resolveCompetitorInput)
    );
    resolvedNames = resolved.map((r) => r.name);
    await supabase.from("competitors").insert(
      resolved.map((r, i) => ({
        user_id: user.id,
        project_id: project.id,
        name: r.name,
        website: r.website,
        position: i,
      }))
    );
  }

  const prompts = generateDefaultPrompts({
    brand: name,
    industry,
    country,
    competitors: resolvedNames,
  });
  await supabase.from("prompts").insert(
    prompts.slice(0, limits.maxPrompts).map((p) => ({
      user_id: user.id,
      project_id: project.id,
      text: p.text,
      category: p.category,
    }))
  );

  const cookieStore = await cookies();
  cookieStore.set(PROJECT_COOKIE, project.id, { path: "/", maxAge: 60 * 60 * 24 * 365 });

  // the onboarding page kicks off the first scan via POST /api/scan
  return { projectId: project.id };
}

/**
 * Adds a market view for an existing brand: clones the project for another
 * country so it gets its own prompts, scans, history and reports. Markets
 * reuse the project infrastructure end-to-end — no parallel data model.
 */
export async function addMarket(projectId: string, country: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: source } = await supabase.from("projects").select("*").eq("id", projectId).single();
  if (!source) return { error: "Project not found" };
  if (source.user_id !== user.id) return { error: "Only the workspace owner can add markets." };

  // already tracking this country for the brand? just switch to it
  const { data: siblings } = await supabase
    .from("projects")
    .select("id, website, country")
    .eq("user_id", user.id)
    .eq("website", source.website)
    .is("archived_at", null);
  const existing = (siblings ?? []).find((p) => p.country === country);
  if (existing) {
    await switchProject(existing.id);
    return {};
  }

  const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
  const limits = planLimits(profile?.plan);
  const { count: projectCount } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_demo", false)
    .is("archived_at", null);
  if ((projectCount ?? 0) >= limits.maxProjects) {
    return {
      error: `Your ${limits.label} plan includes ${limits.maxProjects} active project${limits.maxProjects > 1 ? "s" : ""} (markets count as projects). Archive one in Settings or upgrade to monitor more countries.`,
    };
  }

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name: source.name,
      website: source.website,
      industry: source.industry,
      country,
      language: source.language,
      target_market: source.target_market,
      description: source.description,
    })
    .select()
    .single();
  if (error || !project) return { error: error?.message ?? "Could not create market" };

  // carry competitors over; prompts are regenerated for the new country
  const { data: competitors } = await supabase
    .from("competitors")
    .select("name, website, position")
    .eq("project_id", source.id)
    .order("position");
  if (competitors?.length) {
    await supabase.from("competitors").insert(
      competitors.map((c) => ({ ...c, user_id: user.id, project_id: project.id }))
    );
  }

  const prompts = generateDefaultPrompts({
    brand: source.name,
    industry: source.industry,
    country,
    competitors: (competitors ?? []).map((c) => c.name),
  });
  await supabase.from("prompts").insert(
    prompts.slice(0, limits.maxPrompts).map((p) => ({
      user_id: user.id,
      project_id: project.id,
      text: p.text,
      category: p.category,
    }))
  );

  const cookieStore = await cookies();
  cookieStore.set(PROJECT_COOKIE, project.id, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
  return {};
}

export async function addComment(projectId: string, body: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const text = body.trim();
  if (!text) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();
  await supabase.from("project_comments").insert({
    project_id: projectId,
    user_id: user.id,
    author_name: profile?.full_name || profile?.email || "Teammate",
    body: text.slice(0, 1000),
  });
  revalidatePath("/timeline");
}

export async function updateRecommendationStatus(id: string, status: "todo" | "in_progress" | "done") {
  const supabase = await createClient();
  await supabase
    .from("recommendations")
    .update({ status, completed_at: status === "done" ? new Date().toISOString() : null })
    .eq("id", id);
  revalidatePath("/optimize");
  revalidatePath("/improve");
  revalidatePath("/dashboard");
}
