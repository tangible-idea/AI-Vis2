import Link from "next/link";
import { requireProject } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";
import { planLimits } from "@/lib/plans";
import { Button, Card, CardHeader, Input, Label, PageHeader, Select } from "@/components/ui";
import { CONTENT_LANGUAGES, type Competitor, type Prompt } from "@/lib/types";
import { updateProject, addCompetitor, addPrompt } from "./actions";
import { PromptRows, CompetitorRows } from "./prompt-list";
import { DeleteProjectButton } from "./danger";

export const metadata = { title: "Settings" };

const COUNTRIES = ["US", "KR", "JP", "SG", "GB", "DE", "AU", "CA", "TH", "VN", "ID", "MY"];

export default async function SettingsPage() {
  const { project, profile } = await requireProject();
  const supabase = await createClient();
  const limits = planLimits(profile.plan);

  const [{ data: competitors }, { data: prompts }] = await Promise.all([
    supabase.from("competitors").select("*").eq("project_id", project.id).order("created_at"),
    supabase.from("prompts").select("*").eq("project_id", project.id).order("created_at"),
  ]);

  const competitorList = (competitors ?? []) as Competitor[];
  const promptList = (prompts ?? []) as Prompt[];
  const activePrompts = promptList.filter((p) => p.is_active).length;

  return (
    <>
      <PageHeader title="Settings" subtitle="Project, prompts and competitors" />

      <div className="stagger space-y-4">
        <Card>
          <CardHeader title="Project" />
          <form action={updateProject} className="space-y-4 px-5 pb-5">
            <input type="hidden" name="projectId" value={project.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="s-name">Company / brand</Label>
                <Input id="s-name" name="name" defaultValue={project.name} required />
              </div>
              <div>
                <Label htmlFor="s-website">Website</Label>
                <Input id="s-website" name="website" type="url" defaultValue={project.website} required />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="s-industry">Industry</Label>
                <Input id="s-industry" name="industry" defaultValue={project.industry} required />
              </div>
              <div>
                <Label htmlFor="s-target">Target market</Label>
                <Input id="s-target" name="target_market" defaultValue={project.target_market ?? ""} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="s-country">Country</Label>
                <Select id="s-country" name="country" defaultValue={project.country}>
                  {COUNTRIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="s-language">Language</Label>
                <Select id="s-language" name="language" defaultValue={project.language}>
                  {CONTENT_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <Button type="submit" variant="secondary" size="sm">
              Save changes
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader
            title="Competitors"
            hint={`${competitorList.length} of ${limits.maxCompetitors} on your ${limits.label} plan`}
          />
          <div className="space-y-4 px-5 pb-5">
            <CompetitorRows competitors={competitorList} />
            {competitorList.length < limits.maxCompetitors ? (
              <form action={addCompetitor} className="flex gap-2">
                <input type="hidden" name="projectId" value={project.id} />
                <Input name="name" placeholder="Add competitor…" className="max-w-xs" />
                <Button type="submit" variant="secondary" size="sm" className="h-9.5">
                  Add
                </Button>
              </form>
            ) : (
              <p className="text-xs text-mid">
                Competitor limit reached —{" "}
                <Link href="/billing" className="underline">
                  upgrade
                </Link>{" "}
                to track more.
              </p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Scan prompts"
            hint={`${activePrompts} active of ${limits.maxPrompts} on your ${limits.label} plan — these are the questions we ask every engine`}
          />
          <div className="space-y-4 px-5 pb-5">
            <PromptRows prompts={promptList} />
            {activePrompts < limits.maxPrompts ? (
              <form action={addPrompt} className="flex gap-2">
                <input type="hidden" name="projectId" value={project.id} />
                <Input name="text" placeholder='Add a prompt, e.g. "best CRM for startups"' />
                <Button type="submit" variant="secondary" size="sm" className="h-9.5">
                  Add
                </Button>
              </form>
            ) : (
              <p className="text-xs text-mid">
                Prompt limit reached —{" "}
                <Link href="/billing" className="underline">
                  upgrade
                </Link>{" "}
                to track more.
              </p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Account" />
          <div className="px-5 pb-5 text-sm text-ink-soft">
            <p>
              {profile.full_name || "—"} · {profile.email}
            </p>
            <p className="mt-1 text-xs text-ink-faint">
              Plan: <span className="font-medium uppercase">{profile.plan}</span> — manage on{" "}
              <Link href="/billing" className="text-accent-strong underline">
                Billing
              </Link>
            </p>
          </div>
        </Card>

        <Card className="border-poor/20">
          <CardHeader title="Danger zone" hint="Deletes the project with all scans and content" />
          <div className="px-5 pb-5">
            <DeleteProjectButton projectId={project.id} name={project.name} />
          </div>
        </Card>
      </div>
    </>
  );
}
