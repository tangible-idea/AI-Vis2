"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PROJECT_COOKIE } from "@/lib/project";
import { generateDefaultPrompts } from "@/lib/scan/prompts";
import { planLimits } from "@/lib/plans";

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
  const website = String(formData.get("website") ?? "").trim();
  const industry = String(formData.get("industry") ?? "").trim();
  const country = String(formData.get("country") ?? "US");
  const language = String(formData.get("language") ?? "en");
  const target_market = String(formData.get("target_market") ?? "").trim() || null;
  const competitorNames = [1, 2, 3]
    .map((i) => String(formData.get(`competitor${i}`) ?? "").trim())
    .filter(Boolean);

  if (!name || !website || !industry) return { error: "Please fill in the required fields." };

  const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
  const limits = planLimits(profile?.plan);

  const { data: project, error } = await supabase
    .from("projects")
    .insert({ user_id: user.id, name, website, industry, country, language, target_market })
    .select()
    .single();
  if (error || !project) return { error: error?.message ?? "Could not create project" };

  if (competitorNames.length) {
    await supabase.from("competitors").insert(
      competitorNames.slice(0, limits.maxCompetitors).map((n) => ({
        user_id: user.id,
        project_id: project.id,
        name: n,
      }))
    );
  }

  const prompts = generateDefaultPrompts({
    brand: name,
    industry,
    country,
    competitors: competitorNames,
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
