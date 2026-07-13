"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronDown, Pin, Plus, Search } from "lucide-react";
import { switchProject } from "@/app/(app)/actions";
import { scoreTone, timeAgo, cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

/** One project row with the scan metadata the switcher displays. */
export interface SwitcherProject {
  id: string;
  name: string;
  website: string;
  country: string;
  is_demo: boolean;
  logo_url: string | null;
  score: number | null;
  lastScanAt: string | null;
}

interface BrandEntry {
  key: string;
  name: string;
  website: string;
  is_demo: boolean;
  logo_url: string | null;
  markets: SwitcherProject[];
  /** Project selected when this entry is clicked (active market or first). */
  target: SwitcherProject;
  score: number | null;
  lastScanAt: string | null;
}

const PIN_KEY = "sightline_pins";
const RECENT_KEY = "sightline_recent";

function loadRecents(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function host(website: string) {
  try {
    return new URL(website).hostname.replace(/^www\./, "");
  } catch {
    return website.replace(/^https?:\/\//, "");
  }
}

function loadPins(): string[] {
  try {
    return JSON.parse(localStorage.getItem(PIN_KEY) ?? "[]");
  } catch {
    return [];
  }
}

/**
 * Project switcher: brands are the primary working unit. Markets (sibling
 * projects per country) collapse into one entry; the active market keeps
 * its context when switching back to a pinned brand.
 */
export function ProjectSwitcher({
  projects,
  activeProjectId,
  canCreate,
  planLabel,
  maxProjects,
}: {
  projects: SwitcherProject[];
  activeProjectId: string | null;
  canCreate: boolean;
  planLabel: string;
  maxProjects: number;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pins, setPins] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const [switching, startSwitch] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPins(loadPins());
    setRecents(loadRecents());
  }, []);

  // close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // group market siblings (same website) into one brand entry
  const groups = new Map<string, SwitcherProject[]>();
  for (const p of projects) {
    const key = `${p.website}|${p.is_demo}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  const entries: BrandEntry[] = [...groups.entries()].map(([key, markets]) => {
    const target = markets.find((m) => m.id === activeProjectId) ?? markets[0];
    return {
      key,
      name: target.name,
      website: target.website,
      is_demo: target.is_demo,
      logo_url: target.logo_url,
      markets,
      target,
      score: target.score,
      lastScanAt: target.lastScanAt,
    };
  });

  const q = query.trim().toLowerCase();
  const filtered = q
    ? entries.filter((e) => e.name.toLowerCase().includes(q) || e.website.toLowerCase().includes(q))
    : entries;
  // pinned first, then recently opened, then original order
  const recentRank = (key: string) => {
    const i = recents.indexOf(key);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  const sorted = [...filtered].sort(
    (a, b) =>
      Number(pins.includes(b.key)) - Number(pins.includes(a.key)) ||
      recentRank(a.key) - recentRank(b.key)
  );

  const active = entries.find((e) => e.markets.some((m) => m.id === activeProjectId));

  function togglePin(key: string) {
    const next = pins.includes(key) ? pins.filter((p) => p !== key) : [...pins, key];
    setPins(next);
    try {
      localStorage.setItem(PIN_KEY, JSON.stringify(next));
    } catch {}
  }

  function select(entry: BrandEntry) {
    setOpen(false);
    const next = [entry.key, ...recents.filter((k) => k !== entry.key)].slice(0, 8);
    setRecents(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {}
    if (entry.target.id !== activeProjectId) startSwitch(() => switchProject(entry.target.id));
  }

  if (!projects.length) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={switching}
        aria-label={t("nav.switchProject")}
        aria-expanded={open}
        className={cn(
          "flex w-full cursor-pointer items-center gap-2 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-left hover:bg-hover focus:outline-none",
          switching && "animate-pulse opacity-60"
        )}
      >
        {active && <BrandLogo entry={active} size={20} />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-ink">
            {active ? `${active.name}${active.is_demo ? " (demo)" : ""}` : t("nav.switchProject")}
          </span>
          {active && (
            <span className="block truncate text-[10px] text-ink-faint">{host(active.website)}</span>
          )}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-xl border border-line bg-surface shadow-card">
          <div className="relative border-b border-line">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-ink-faint" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("switcher.search")}
              aria-label={t("switcher.search")}
              className="w-full bg-transparent py-2 pl-8 pr-2.5 text-xs text-ink placeholder:text-ink-faint focus:outline-none"
            />
          </div>

          <div className="max-h-72 overflow-y-auto p-1">
            {sorted.length === 0 && (
              <p className="px-2.5 py-3 text-xs text-ink-faint">{t("switcher.noMatches")}</p>
            )}
            {sorted.map((e) => {
              const isActive = e.markets.some((m) => m.id === activeProjectId);
              const pinned = pins.includes(e.key);
              return (
                <div
                  key={e.key}
                  className={cn(
                    "group/row flex items-center gap-2 rounded-lg px-2 py-1.5",
                    isActive ? "bg-accent-soft" : "hover:bg-hover"
                  )}
                >
                  <button
                    onClick={() => select(e)}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
                  >
                    <BrandLogo entry={e} size={24} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-medium text-ink">
                          {e.name}
                          {e.is_demo ? " (demo)" : ""}
                        </span>
                        {e.markets.length > 1 && (
                          <span className="shrink-0 rounded-full bg-hover px-1.5 text-[10px] text-ink-soft">
                            {t("switcher.markets", { count: e.markets.length })}
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-[10px] text-ink-faint">
                        {host(e.website)} · {e.target.country} ·{" "}
                        {e.lastScanAt
                          ? t("switcher.lastScan", { time: timeAgo(e.lastScanAt) })
                          : t("switcher.noScan")}
                      </span>
                    </span>
                    {e.score != null && (
                      <span
                        className={cn(
                          "tabular shrink-0 text-xs font-semibold",
                          { good: "text-good", mid: "text-mid", poor: "text-poor" }[scoreTone(e.score)]
                        )}
                      >
                        {e.score}
                      </span>
                    )}
                    {isActive && <Check className="h-3.5 w-3.5 shrink-0 text-accent-strong" />}
                  </button>
                  <button
                    onClick={() => togglePin(e.key)}
                    aria-label={pinned ? t("switcher.unpin") : t("switcher.pin")}
                    title={pinned ? t("switcher.unpin") : t("switcher.pin")}
                    className={cn(
                      "shrink-0 cursor-pointer rounded p-1",
                      pinned
                        ? "text-accent-strong"
                        : "text-ink-faint opacity-0 hover:text-ink group-hover/row:opacity-100"
                    )}
                  >
                    <Pin className={cn("h-3 w-3", pinned && "fill-current")} />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="border-t border-line p-1">
            {canCreate ? (
              <Link
                href="/onboarding"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-soft hover:bg-hover hover:text-ink"
              >
                <Plus className="h-3.5 w-3.5" /> {t("switcher.newProject")}
              </Link>
            ) : (
              <p className="px-2.5 py-1.5 text-[11px] leading-snug text-ink-faint">
                {t("switcher.limitReached", { max: maxProjects, plan: planLabel })}{" "}
                <Link href="/billing" className="text-accent-strong underline" onClick={() => setOpen(false)}>
                  {t("common.upgrade")}
                </Link>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BrandLogo({ entry, size }: { entry: BrandEntry; size: number }) {
  const src =
    entry.logo_url ?? `https://www.google.com/s2/favicons?domain=${host(entry.website)}&sz=64`;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded"
      style={{ width: size, height: size }}
    />
  );
}
