import type { Plan } from "./types";

export interface PlanLimits {
  label: string;
  price: string;
  priceNote: string;
  /** Active (non-archived) projects the organization can own. */
  maxProjects: number;
  maxPrompts: number;
  maxCompetitors: number;
  scansPerMonth: number;
  /** Lifetime scan cap per user (free plan); null = monthly limit applies. */
  totalScans: number | null;
  /** Content generations per calendar month. */
  contentGenerations: number;
  /** Lifetime generation cap per user (free plan); null = monthly limit applies. */
  totalContentGenerations: number | null;
  /** Team seats besides the owner (0 = no collaboration). */
  maxTeamMembers: number;
  /**
   * How many of those seats may be editing members; the rest are viewers.
   * 0 = viewer-only plan.
   */
  maxMemberSeats: number;
  /** Days of history shown in trends/timeline; null = unlimited. */
  historyDays: number | null;
  trends: boolean;
  /** Market benchmarks (foundation now, calculations later). */
  benchmarks: boolean;
  weeklyReports: boolean;
  shareLinks: boolean;
  api: boolean;
  whiteLabel: boolean;
  team: boolean;
}

const BASE_PLANS: Record<Plan, PlanLimits> = {
  free: {
    label: "Free",
    price: "$0",
    priceNote: "forever",
    maxProjects: 1,
    maxPrompts: 3,
    maxCompetitors: 2,
    // free is a lifetime allowance, so the monthly figure only mirrors it
    scansPerMonth: 3,
    totalScans: 3,
    contentGenerations: 3,
    totalContentGenerations: 3,
    maxTeamMembers: 0,
    maxMemberSeats: 0,
    historyDays: null,
    trends: false,
    benchmarks: false,
    weeklyReports: false,
    shareLinks: false,
    api: false,
    whiteLabel: false,
    team: false,
  },
  starter: {
    label: "Starter",
    price: "$59",
    priceNote: "per month",
    maxProjects: 3,
    maxPrompts: 15,
    maxCompetitors: 10,
    scansPerMonth: 10,
    totalScans: null,
    contentGenerations: 10,
    totalContentGenerations: null,
    maxTeamMembers: 2,
    // Starter seats are viewer-only; editing collaborators start on Pro
    maxMemberSeats: 0,
    historyDays: null,
    trends: true,
    benchmarks: true,
    weeklyReports: true,
    shareLinks: true,
    api: false,
    whiteLabel: false,
    team: true,
  },
  pro: {
    label: "Pro",
    price: "$169",
    priceNote: "per month",
    maxProjects: 8,
    maxPrompts: 50,
    maxCompetitors: 30,
    scansPerMonth: 30,
    totalScans: null,
    contentGenerations: 30,
    totalContentGenerations: null,
    // 5 seats, of which one may edit — the rest are read-only viewers
    maxTeamMembers: 5,
    maxMemberSeats: 1,
    historyDays: null,
    trends: true,
    benchmarks: true,
    weeklyReports: true,
    shareLinks: true,
    // API access ships once production-ready — never advertised before then
    api: false,
    whiteLabel: true,
    team: true,
  },
  // AppSumo lifetime deal — capped so the plan stays profitable while
  // acting as an acquisition channel. Tune via PLAN_LIMITS_JSON, no deploy.
  // Never surfaced on pricing or other public UI.
  lifetime: {
    label: "Lifetime",
    price: "$79",
    priceNote: "one-time (AppSumo)",
    maxProjects: 2,
    maxPrompts: 10,
    maxCompetitors: 3,
    scansPerMonth: 4,
    totalScans: null,
    contentGenerations: 15,
    totalContentGenerations: null,
    maxTeamMembers: 2,
    maxMemberSeats: 2,
    historyDays: 180,
    trends: true,
    benchmarks: true,
    weeklyReports: true,
    shareLinks: true,
    api: false,
    whiteLabel: false,
    team: true,
  },
};

/**
 * Plan limits are tunable without a code change: set PLAN_LIMITS_JSON to a
 * partial override, e.g. {"lifetime":{"scansPerMonth":6,"maxPrompts":15}}.
 */
function withEnvOverrides(plans: Record<Plan, PlanLimits>): Record<Plan, PlanLimits> {
  const raw = process.env.PLAN_LIMITS_JSON;
  if (!raw) return plans;
  try {
    const overrides = JSON.parse(raw) as Partial<Record<Plan, Partial<PlanLimits>>>;
    const merged = { ...plans };
    for (const [plan, patch] of Object.entries(overrides)) {
      if (plan in merged && patch) {
        merged[plan as Plan] = { ...merged[plan as Plan], ...patch };
      }
    }
    return merged;
  } catch {
    console.warn("[plans] PLAN_LIMITS_JSON is not valid JSON — using defaults");
    return plans;
  }
}

export const PLANS: Record<Plan, PlanLimits> = withEnvOverrides(BASE_PLANS);

export function planLimits(plan: Plan | null | undefined): PlanLimits {
  return PLANS[plan ?? "free"] ?? PLANS.free;
}

/**
 * The allowance actually in force for a metered feature. Free plans meter a
 * lifetime total; paid plans meter a calendar month. Every enforcement path,
 * usage meter and pricing cell reads the answer from here, so the three can
 * never disagree about what a plan includes.
 */
export interface Allowance {
  limit: number;
  /** True when `limit` is a lifetime cap rather than a monthly one. */
  lifetime: boolean;
}

export function scanAllowance(limits: PlanLimits): Allowance {
  return limits.totalScans != null
    ? { limit: limits.totalScans, lifetime: true }
    : { limit: limits.scansPerMonth, lifetime: false };
}

export function contentAllowance(limits: PlanLimits): Allowance {
  return limits.totalContentGenerations != null
    ? { limit: limits.totalContentGenerations, lifetime: true }
    : { limit: limits.contentGenerations, lifetime: false };
}

/** Start of the current calendar month, ISO — the paid-plan metering window. */
export function monthStartIso(): string {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

/**
 * The `created_at >= …` cutoff for counting usage against an allowance:
 * everything ever for a lifetime cap, this calendar month otherwise. Sharing
 * it keeps the enforcement queries and the billing meters counting the same
 * rows.
 */
export function periodStartIso(allowance: Allowance): string {
  return allowance.lifetime ? new Date(0).toISOString() : monthStartIso();
}

/** "3 total" / "10 / month" — the wording used on pricing and in billing. */
export function allowanceLabel({ limit, lifetime }: Allowance): string {
  return lifetime ? `${limit} total` : `${limit} / month`;
}

/** How a plan's seats split between editing members and read-only viewers. */
export function seatsLabel(limits: PlanLimits): string {
  if (!limits.team || limits.maxTeamMembers === 0) return "—";
  const viewers = limits.maxTeamMembers - limits.maxMemberSeats;
  if (limits.maxMemberSeats === 0) return `${limits.maxTeamMembers} (viewer)`;
  return `${limits.maxTeamMembers} seats (${limits.maxMemberSeats} member, ${viewers} viewer${
    viewers === 1 ? "" : "s"
  })`;
}

/** ISO cutoff for history queries, or null when the plan has full history. */
export function historyCutoffIso(limits: PlanLimits): string | null {
  if (limits.historyDays == null) return null;
  return new Date(Date.now() - limits.historyDays * 86_400_000).toISOString();
}

/**
 * Feature comparison rows — the single source of truth behind BOTH the public
 * pricing page and the in-app billing page (they must stay consistent to avoid
 * confusion). Ordered buyer-first: what you can do, then what's included.
 *
 * Every number is read out of PLANS rather than written here, so the matrix
 * cannot advertise an allowance the enforcement paths don't grant: changing a
 * limit above changes the pricing table, the usage meters and the paywalls in
 * one edit. `key` renders a check/dash straight from the plan's flag; `value`
 * renders text. `note` renders as small italic sub-text under the label.
 */
export const PLAN_FEATURES: {
  label: string;
  key?: keyof PlanLimits;
  value?: (limits: PlanLimits) => string;
  group?: string;
  note?: string;
}[] = [
  {
    group: "Usage",
    label: "Brand projects (websites / apps)",
    value: (l) => String(l.maxProjects),
  },
  { label: "Tracked prompts", value: (l) => String(l.maxPrompts) },
  { label: "AI visibility scans", value: (l) => allowanceLabel(scanAllowance(l)) },
  { label: "Competitors tracked", value: (l) => String(l.maxCompetitors) },
  {
    label: "Content generations (pages, schema, llms.txt, summaries)",
    value: (l) => allowanceLabel(contentAllowance(l)),
  },
  { group: "Included", label: "Trending topics", key: "trends" },
  { label: "Market benchmarks", key: "benchmarks" },
  { label: "Weekly email reports", key: "weeklyReports" },
  { label: "Shareable report links", key: "shareLinks" },
  {
    label: "Team collaboration (seats)",
    value: seatsLabel,
    note: "Members can run scans and generate content. Viewers have read-only access.",
  },
  { group: "Pro only", label: "White label reports", key: "whiteLabel" },
];

// ── rendering the matrix ─────────────────────────────────────
//
// PLANS is resolved from PLAN_LIMITS_JSON, which only exists on the server —
// a client component reading PLANS directly would render the un-overridden
// defaults and hydrate over server HTML that says something else. So the
// table is computed here, on the server, and handed to the UI as plain data.

/** The plans offered publicly, in column order. Lifetime is never shown. */
export const PUBLIC_PLANS = ["free", "starter", "pro"] as const;

export type PublicPlan = (typeof PUBLIC_PLANS)[number];

export interface PlanColumn {
  plan: PublicPlan;
  label: string;
  price: string;
  priceNote: string;
}

export interface PlanMatrixRow {
  label: string;
  group?: string;
  note?: string;
  /** One cell per column: text, or a boolean rendered as a check/dash. */
  cells: (string | boolean)[];
}

export function planColumns(): PlanColumn[] {
  return PUBLIC_PLANS.map((plan) => ({
    plan,
    label: PLANS[plan].label,
    price: PLANS[plan].price,
    priceNote: PLANS[plan].priceNote,
  }));
}

export function planMatrix(): PlanMatrixRow[] {
  return PLAN_FEATURES.map(({ label, group, note, key, value }) => ({
    label,
    group,
    note,
    cells: PUBLIC_PLANS.map((plan) =>
      value ? value(PLANS[plan]) : Boolean(PLANS[plan][key as keyof PlanLimits])
    ),
  }));
}
