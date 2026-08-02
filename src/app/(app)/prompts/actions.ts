"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { planLimits } from "@/lib/plans";
import { promptHash } from "@/lib/scan/runner";
import type { PromptCategory } from "@/lib/types";

export interface PromptDraft {
  text: string;
  category: PromptCategory;
}

/**
 * Saves accepted Prompt Explorer drafts (manual or topic-generated) in one
 * batch: duplicates of already-tracked prompts are skipped and the plan's
 * active-prompt limit is enforced. Returns how many were added.
 */
export async function addPrompts(
  projectId: string,
  topic: string | null,
  drafts: PromptDraft[]
): Promise<{ added: number; skipped: number; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const cleaned = drafts
    .map((d) => ({ text: d.text.trim().slice(0, 200), category: d.category }))
    .filter((d) => d.text.length > 3);
  if (!cleaned.length) return { added: 0, skipped: 0 };

  const [{ data: profile }, { data: existing }] = await Promise.all([
    supabase.from("profiles").select("plan").eq("id", user.id).single(),
    supabase.from("prompts").select("text, is_active").eq("project_id", projectId),
  ]);
  const limits = planLimits(profile?.plan);
  const activeCount = (existing ?? []).filter((p) => p.is_active).length;

  const seen = new Set((existing ?? []).map((p) => promptHash(p.text)));
  const fresh = cleaned.filter((d) => {
    const h = promptHash(d.text);
    if (seen.has(h)) return false;
    seen.add(h);
    return true;
  });

  const room = Math.max(0, limits.maxPrompts - activeCount);
  if (room === 0) {
    return {
      added: 0,
      skipped: fresh.length,
      error: `Your ${limits.label} plan includes ${limits.maxPrompts} active prompts. Pause or delete prompts, or upgrade to track more.`,
    };
  }

  const toInsert = fresh.slice(0, room);
  if (toInsert.length) {
    const { error } = await supabase.from("prompts").insert(
      toInsert.map((d) => ({
        user_id: user.id,
        project_id: projectId,
        text: d.text,
        category: d.category,
        topic: topic?.trim() || null,
      }))
    );
    if (error) return { added: 0, skipped: cleaned.length, error: error.message };
  }

  revalidatePath("/prompts");
  revalidatePath("/settings");
  return { added: toInsert.length, skipped: cleaned.length - toInsert.length };
}

export interface BulkResult {
  changed: number;
  error?: string;
}

/**
 * Pauses or resumes several prompts at once. Resuming is capped by the plan's
 * active-prompt limit — the same rule `togglePrompt` applies to a single row,
 * evaluated once for the whole batch instead of row by row.
 */
export async function bulkSetPromptsActive(
  projectId: string,
  ids: string[],
  isActive: boolean
): Promise<BulkResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!ids.length) return { changed: 0 };

  let allowed = ids;
  if (isActive) {
    const [{ data: profile }, { count }] = await Promise.all([
      supabase.from("profiles").select("plan").eq("id", user.id).single(),
      supabase
        .from("prompts")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("is_active", true),
    ]);
    const limits = planLimits(profile?.plan);
    const room = Math.max(0, limits.maxPrompts - (count ?? 0));
    if (room === 0) {
      return {
        changed: 0,
        error: `Your ${limits.label} plan includes ${limits.maxPrompts} active prompts. Pause or delete prompts, or upgrade to track more.`,
      };
    }
    allowed = ids.slice(0, room);
  }

  const { error } = await supabase
    .from("prompts")
    .update({ is_active: isActive })
    .eq("project_id", projectId)
    .in("id", allowed);
  if (error) return { changed: 0, error: error.message };

  revalidatePath("/prompts");
  revalidatePath("/settings");
  return {
    changed: allowed.length,
    error:
      allowed.length < ids.length
        ? `Resumed ${allowed.length} of ${ids.length} — the rest would exceed your active-prompt limit.`
        : undefined,
  };
}

/** Deletes several prompts at once. Scoped to the project so ids can't leak across projects. */
export async function bulkRemovePrompts(projectId: string, ids: string[]): Promise<BulkResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!ids.length) return { changed: 0 };

  const { error } = await supabase
    .from("prompts")
    .delete()
    .eq("project_id", projectId)
    .in("id", ids);
  if (error) return { changed: 0, error: error.message };

  revalidatePath("/prompts");
  revalidatePath("/settings");
  return { changed: ids.length };
}
