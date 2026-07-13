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
