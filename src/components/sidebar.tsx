"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Radar,
  Wand2,
  TrendingUp,
  Flame,
  FileText,
  CreditCard,
  Settings,
  LogOut,
  Link2,
  History,
  BarChart3,
  MessagesSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Plan, Project } from "@/lib/types";
import { switchProject } from "@/app/(app)/actions";
import { logout } from "@/app/(auth)/actions";
import { LegalLinks } from "@/components/legal-links";
import { ProjectSwitcher, type SwitcherProject } from "@/components/project-switcher";
import { useT } from "@/lib/i18n";

/** Navigation mirrors the product journey: Measure → Optimize → Improve → Share. */
const NAV_GROUPS: { labelKey: string | null; items: { href: string; labelKey: string; icon: typeof Radar }[] }[] = [
  {
    labelKey: "nav.groupMeasure",
    items: [
      { href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
      { href: "/monitor", labelKey: "nav.monitor", icon: Radar },
      { href: "/prompts", labelKey: "nav.prompts", icon: MessagesSquare },
      { href: "/sources", labelKey: "nav.sources", icon: Link2 },
    ],
  },
  {
    labelKey: "nav.groupOptimize",
    items: [
      { href: "/trends", labelKey: "nav.trends", icon: Flame },
      { href: "/optimize", labelKey: "nav.optimize", icon: Wand2 },
    ],
  },
  {
    labelKey: "nav.groupImprove",
    items: [
      { href: "/timeline", labelKey: "nav.timeline", icon: History },
      { href: "/improve", labelKey: "nav.improve", icon: TrendingUp },
      { href: "/benchmarks", labelKey: "nav.benchmarks", icon: BarChart3 },
    ],
  },
  {
    labelKey: "nav.groupShare",
    items: [{ href: "/reports", labelKey: "nav.reports", icon: FileText }],
  },
  // Organization: account-level concerns (billing, settings, team lives in
  // Settings until it needs its own page)
  {
    labelKey: "nav.groupOrganization",
    items: [
      { href: "/billing", labelKey: "nav.billing", icon: CreditCard },
      { href: "/settings", labelKey: "nav.settings", icon: Settings },
    ],
  },
];

const NAV = NAV_GROUPS.flatMap((g) => g.items);

export function Sidebar({
  projects,
  switcherProjects,
  activeProjectId,
  plan,
  planLabel,
  maxProjects,
  canCreate,
  mockMode,
}: {
  projects: Project[];
  switcherProjects: SwitcherProject[];
  activeProjectId: string | null;
  plan: Plan;
  planLabel: string;
  maxProjects: number;
  canCreate: boolean;
  mockMode: boolean;
}) {
  const pathname = usePathname();
  const t = useT();
  const [switching, startSwitch] = useTransition();
  const active = projects.find((p) => p.id === activeProjectId);
  const onSwitch = (id: string) => startSwitch(() => switchProject(id));

  // brands with several market views show their country to stay distinguishable
  const nameCounts = new Map<string, number>();
  for (const p of projects) nameCounts.set(p.name, (nameCounts.get(p.name) ?? 0) + 1);
  const projectLabel = (p: Project) =>
    `${p.name}${(nameCounts.get(p.name) ?? 0) > 1 ? ` · ${p.country}` : ""}${p.is_demo ? " (demo)" : ""}`;

  return (
    <>
      {/* desktop sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-line bg-surface md:flex">
        <div className="flex items-center gap-2 px-4 pt-5 pb-4">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-ink text-xs font-bold text-paper">
            S
          </span>
          <span className="font-display text-lg leading-none">Sightline</span>
        </div>

        {switcherProjects.length > 0 && (
          <div className="mx-3 mb-3">
            <ProjectSwitcher
              projects={switcherProjects}
              activeProjectId={activeProjectId}
              canCreate={canCreate}
              planLabel={planLabel}
              maxProjects={maxProjects}
            />
          </div>
        )}

        <nav className="flex-1 space-y-3 overflow-y-auto px-3">
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.labelKey ?? gi}>
              {group.labelKey && (
                <p className="mb-0.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                  {t(group.labelKey)}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map(({ href, labelKey, icon: Icon }) => {
                  const isActive = pathname.startsWith(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                        isActive
                          ? "bg-accent-soft text-accent-strong"
                          : "text-ink-soft hover:bg-hover hover:text-ink"
                      )}
                    >
                      <Icon className="h-4 w-4" strokeWidth={1.8} />
                      {t(labelKey)}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="space-y-2 border-t border-line px-3 py-3">
          {mockMode && (
            <p className="rounded-md bg-mid-soft px-2 py-1 text-[10px] font-medium leading-tight text-mid">
              {t("nav.mockMode")}
            </p>
          )}
          <div className="flex items-center justify-between px-1">
            <span className="rounded-full bg-hover px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
              {plan}
            </span>
            <button
              onClick={() => logout()}
              className="flex cursor-pointer items-center gap-1 text-[11px] text-ink-faint hover:text-ink"
            >
              <LogOut className="h-3 w-3" /> {t("common.logOut")}
            </button>
          </div>
        </div>
        {active && (
          <p className="truncate border-t border-line px-4 py-2 text-[10px] text-ink-faint">
            {active.website}
          </p>
        )}
        <LegalLinks className="border-t border-line px-4 py-2 text-[10px] text-ink-faint" />
      </aside>

      {/* mobile top bar */}
      <div className="no-print sticky top-0 z-30 border-b border-line bg-surface md:hidden">
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-ink text-[10px] font-bold text-paper">
              S
            </span>
            <span className="font-display">Sightline</span>
          </span>
          {projects.length > 0 && (
            <select
              value={activeProjectId ?? ""}
              onChange={(e) => onSwitch(e.target.value)}
              disabled={switching}
              className={cn(
                "max-w-[45%] truncate rounded-md border border-line bg-paper px-2 py-1 text-xs",
                switching && "animate-pulse opacity-60"
              )}
              aria-label={t("nav.switchProject")}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {projectLabel(p)}
                </option>
              ))}
            </select>
          )}
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          {NAV.map(({ href, labelKey }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium",
                pathname.startsWith(href)
                  ? "bg-accent-soft text-accent-strong"
                  : "text-ink-soft hover:bg-hover"
              )}
            >
              {t(labelKey)}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
