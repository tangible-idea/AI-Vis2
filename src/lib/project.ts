import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Profile, Project } from "./types";

export interface AppContext {
  userId: string;
  profile: Profile;
  projects: Project[];
  project: Project | null;
}

const PROJECT_COOKIE = "sightline_pid";

/** Loads the session, profile, project list and active project (via cookie). */
export async function getAppContext(): Promise<AppContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // claim any pending workspace invites for this email so shared projects
  // appear in the switcher (RLS lets invitees update their own invite rows)
  if (user.email) {
    await supabase
      .from("project_members")
      .update({ user_id: user.id, accepted_at: new Date().toISOString() })
      .eq("email", user.email.toLowerCase())
      .is("user_id", null);
  }

  const [{ data: profile }, { data: projects }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("projects").select("*").order("created_at"),
  ]);

  const cookieStore = await cookies();
  const pid = cookieStore.get(PROJECT_COOKIE)?.value;
  const list = projects ?? [];
  const project = list.find((p) => p.id === pid) ?? list[0] ?? null;

  return {
    userId: user.id,
    profile: (profile ?? { id: user.id, email: user.email, full_name: "", plan: "free", created_at: "" }) as Profile,
    projects: list,
    project,
  };
}

/** Like getAppContext but bounces to onboarding when no project exists. */
export async function requireProject(): Promise<AppContext & { project: Project }> {
  const ctx = await getAppContext();
  if (!ctx.project) redirect("/onboarding");
  return ctx as AppContext & { project: Project };
}

export { PROJECT_COOKIE };
