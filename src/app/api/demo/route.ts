import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { seedDemoProject } from "@/lib/demo";

/** POST → seed (or return) the demo project for the current user. */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const projectId = await seedDemoProject(user.id);
    return NextResponse.json({ projectId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Demo seed failed" },
      { status: 500 }
    );
  }
}
