import Link from "next/link";
import { requireProject } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";
import { planLimits } from "@/lib/plans";
import { Button, Card, CardHeader, Input, Label, PageHeader, Select } from "@/components/ui";
import { CONTENT_LANGUAGES, COUNTRIES, type Competitor, type Prompt } from "@/lib/types";
import { updateProject, addCompetitor, addPrompt, inviteMember } from "./actions";
import { PromptRows } from "./prompt-list";
import { CompetitorList } from "./competitor-list";
import { MemberList } from "./member-list";
import { ArchiveProjectButton, ArchivedProjects, DeleteProjectButton } from "./danger";
import { MonitoringToggle } from "./monitoring-toggle";
import { getT } from "@/lib/i18n/server";
import type { ProjectMember } from "@/lib/types";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { project, profile, userId } = await requireProject();
  const supabase = await createClient();
  const limits = planLimits(profile.plan);
  const isOwner = project.user_id === userId;
  const t = await getT();

  const [{ data: competitors }, { data: prompts }, { data: members }, { data: archived }] = await Promise.all([
    supabase
      .from("competitors")
      .select("*")
      .eq("project_id", project.id)
      .order("position")
      .order("created_at"),
    supabase.from("prompts").select("*").eq("project_id", project.id).order("created_at"),
    supabase
      .from("project_members")
      .select("*")
      .eq("project_id", project.id)
      .order("created_at"),
    supabase
      .from("projects")
      .select("id, name, country, archived_at")
      .eq("user_id", userId)
      .not("archived_at", "is", null)
      .order("archived_at", { ascending: false }),
  ]);
  const memberList = (members ?? []) as ProjectMember[];

  const competitorList = (competitors ?? []) as Competitor[];
  const promptList = (prompts ?? []) as Prompt[];
  const activePrompts = promptList.filter((p) => p.is_active).length;

  return (
    <>
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />

      <div className="stagger space-y-4">
        <Card>
          <CardHeader title={t("settings.project")} />
          <form action={updateProject} className="space-y-4 px-5 pb-5">
            <input type="hidden" name="projectId" value={project.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="s-name">{t("settings.companyBrand")}</Label>
                <Input id="s-name" name="name" defaultValue={project.name} required />
              </div>
              <div>
                <Label htmlFor="s-website">{t("settings.website")}</Label>
                <Input id="s-website" name="website" type="url" defaultValue={project.website} required />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="s-industry">{t("settings.industry")}</Label>
                <Input id="s-industry" name="industry" defaultValue={project.industry} required />
              </div>
              <div>
                <Label htmlFor="s-target">{t("settings.targetMarket")}</Label>
                <Input id="s-target" name="target_market" defaultValue={project.target_market ?? ""} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="s-country">{t("common.country")}</Label>
                <Select id="s-country" name="country" defaultValue={project.country}>
                  {COUNTRIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="s-language">{t("common.language")}</Label>
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
              {t("common.saveChanges")}
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader
            title={t("settings.competitors")}
            hint={t("settings.competitorsHint", {
              count: competitorList.length,
              max: limits.maxCompetitors,
              plan: limits.label,
            })}
          />
          <div className="space-y-4 px-5 pb-5">
            <CompetitorList projectId={project.id} competitors={competitorList} />
            {competitorList.length < limits.maxCompetitors ? (
              <form action={addCompetitor} className="flex gap-2">
                <input type="hidden" name="projectId" value={project.id} />
                <Input name="domain" placeholder="competitor.com" className="max-w-xs" />
                <Button type="submit" variant="secondary" size="sm" className="h-9.5">
                  {t("common.add")}
                </Button>
              </form>
            ) : (
              <p className="text-xs text-mid">
                {t("settings.competitorLimit")}{" "}
                <Link href="/billing" className="underline">
                  {t("settings.upgradeToTrackMore")}
                </Link>
              </p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title={t("settings.prompts")}
            hint={t("settings.promptsHint", {
              count: activePrompts,
              max: limits.maxPrompts,
              plan: limits.label,
            })}
          />
          <div className="space-y-4 px-5 pb-5">
            <PromptRows prompts={promptList} />
            {activePrompts < limits.maxPrompts ? (
              <form action={addPrompt} className="flex gap-2">
                <input type="hidden" name="projectId" value={project.id} />
                <Input name="text" placeholder='Add a prompt, e.g. "best CRM for startups"' />
                <Button type="submit" variant="secondary" size="sm" className="h-9.5">
                  {t("common.add")}
                </Button>
              </form>
            ) : (
              <p className="text-xs text-mid">
                {t("settings.promptLimit")}{" "}
                <Link href="/billing" className="underline">
                  {t("settings.upgradeToTrackMore")}
                </Link>
              </p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title={t("settings.team")}
            hint={
              limits.team
                ? t("settings.teamHint", {
                    count: memberList.length,
                    max: limits.maxTeamMembers,
                    plan: limits.label,
                  })
                : t("settings.teamLockedHint")
            }
          />
          <div className="space-y-4 px-5 pb-5">
            {limits.team ? (
              <>
                <MemberList members={memberList} canManage={isOwner} />
                {isOwner && memberList.length < limits.maxTeamMembers && (
                  <form action={inviteMember} className="flex flex-wrap gap-2">
                    <input type="hidden" name="projectId" value={project.id} />
                    <Input
                      name="email"
                      type="email"
                      placeholder="teammate@company.com"
                      className="max-w-xs"
                      required
                    />
                    <Select name="role" defaultValue="member" className="w-28">
                      <option value="member">{t("common.member")}</option>
                      <option value="viewer">{t("common.viewer")}</option>
                    </Select>
                    <Button type="submit" variant="secondary" size="sm" className="h-9.5">
                      {t("common.invite")}
                    </Button>
                  </form>
                )}
                {memberList.some((m) => !m.accepted_at) && (
                  <p className="text-xs text-ink-faint">{t("settings.pendingInvites")}</p>
                )}
              </>
            ) : (
              <p className="text-xs text-mid">
                {t("settings.teamLocked")}{" "}
                <Link href="/billing" className="underline">
                  {t("settings.upgradeToCollaborate")}
                </Link>
              </p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title={t("settings.monitoring")} hint={t("settings.monitoringHint")} />
          <div className="px-5 pb-5">
            {limits.totalScans == null ? (
              <MonitoringToggle projectId={project.id} enabled={project.auto_scan_enabled} />
            ) : (
              <p className="text-xs text-mid">
                {t("settings.monitoringLocked")}{" "}
                <Link href="/billing" className="underline">
                  {t("settings.upgradeToMonitor")}
                </Link>
              </p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title={t("settings.account")} />
          <div className="px-5 pb-5 text-sm text-ink-soft">
            <p>
              {profile.full_name || "—"} · {profile.email}
            </p>
            <p className="mt-1 text-xs text-ink-faint">
              {t("settings.planLabel")} <span className="font-medium uppercase">{profile.plan}</span>{" "}
              — {t("settings.manageOn")}{" "}
              <Link href="/billing" className="text-accent-strong underline">
                {t("nav.billing")}
              </Link>
            </p>
          </div>
        </Card>

        {isOwner && (archived?.length ?? 0) > 0 && (
          <Card>
            <CardHeader title={t("settings.archivedProjects")} hint={t("settings.archivedHint")} />
            <div className="px-5 pb-4">
              <ArchivedProjects projects={archived ?? []} />
            </div>
          </Card>
        )}

        {isOwner && (
          <Card className="border-poor/20">
            <CardHeader title={t("settings.dangerZone")} hint={t("settings.dangerHint")} />
            <div className="flex flex-wrap gap-2 px-5 pb-5">
              <ArchiveProjectButton projectId={project.id} name={project.name} />
              <DeleteProjectButton projectId={project.id} name={project.name} />
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
