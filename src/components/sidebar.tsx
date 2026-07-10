"use client";

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
  ChevronDown,
  Link2,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Plan, Project } from "@/lib/types";
import { switchProject } from "@/app/(app)/actions";
import { logout } from "@/app/(auth)/actions";
import { LegalLinks } from "@/components/legal-links";

/** Navigation mirrors the product journey: Measure → Optimize → Improve → Share. */
const NAV_GROUPS: { label: string | null; items: { href: string; label: string; icon: typeof Radar }[] }[] = [
  {
    label: "Measure",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/monitor", label: "Monitor", icon: Radar },
      { href: "/sources", label: "Sources", icon: Link2 },
    ],
  },
  {
    label: "Optimize",
    items: [
      { href: "/trends", label: "Trends", icon: Flame },
      { href: "/optimize", label: "Optimize", icon: Wand2 },
    ],
  },
  {
    label: "Improve",
    items: [
      { href: "/timeline", label: "Timeline", icon: History },
      { href: "/improve", label: "Improve", icon: TrendingUp },
    ],
  },
  {
    label: "Share",
    items: [{ href: "/reports", label: "Reports", icon: FileText }],
  },
  {
    label: null,
    items: [
      { href: "/billing", label: "Billing", icon: CreditCard },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

const NAV = NAV_GROUPS.flatMap((g) => g.items);

export function Sidebar({
  projects,
  activeProjectId,
  plan,
  mockMode,
}: {
  projects: Project[];
  activeProjectId: string | null;
  plan: Plan;
  mockMode: boolean;
}) {
  const pathname = usePathname();
  const active = projects.find((p) => p.id === activeProjectId);

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

        {projects.length > 0 && (
          <div className="relative mx-3 mb-3">
            <select
              value={activeProjectId ?? ""}
              onChange={(e) => switchProject(e.target.value)}
              className="w-full cursor-pointer appearance-none truncate rounded-lg border border-line bg-paper py-1.5 pl-2.5 pr-7 text-xs font-medium text-ink hover:bg-hover focus:outline-none"
              aria-label="Switch project"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.is_demo ? " (demo)" : ""}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
          </div>
        )}

        <nav className="flex-1 space-y-3 overflow-y-auto px-3">
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.label ?? gi}>
              {group.label && (
                <p className="mb-0.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map(({ href, label, icon: Icon }) => {
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
                      {label}
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
              Mock mode — set POE_API_KEY for real scans
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
              <LogOut className="h-3 w-3" /> Log out
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
              onChange={(e) => switchProject(e.target.value)}
              className="max-w-[45%] truncate rounded-md border border-line bg-paper px-2 py-1 text-xs"
              aria-label="Switch project"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          {NAV.map(({ href, label }) => (
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
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
