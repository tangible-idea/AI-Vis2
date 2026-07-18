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
  contentGenerations: number;
  /** Team seats besides the owner (0 = no collaboration). */
  maxTeamMembers: number;
  /** Whether invited teammates can be editing members (false = viewers only). */
  memberSeats: boolean;
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
    maxPrompts: 5,
    maxCompetitors: 2,
    scansPerMonth: 5,
    totalScans: 5,
    contentGenerations: 5,
    maxTeamMembers: 0,
    memberSeats: false,
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
    maxPrompts: 20,
    maxCompetitors: 10,
    scansPerMonth: 30,
    totalScans: null,
    contentGenerations: 30,
    maxTeamMembers: 2,
    // Starter seats are viewer-only; editing collaborators start on Pro
    memberSeats: false,
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
    scansPerMonth: 60,
    totalScans: null,
    contentGenerations: 60,
    maxTeamMembers: 5,
    memberSeats: true,
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
    maxTeamMembers: 2,
    memberSeats: true,
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

/** ISO cutoff for history queries, or null when the plan has full history. */
export function historyCutoffIso(limits: PlanLimits): string | null {
  if (limits.historyDays == null) return null;
  return new Date(Date.now() - limits.historyDays * 86_400_000).toISOString();
}

/**
 * Feature comparison rows — the single source of truth behind BOTH the public
 * pricing page and the in-app billing page (they must stay consistent to avoid
 * confusion). Ordered buyer-first: what you can do, then what's included.
 * `values` are [free, starter, pro]; `key` renders a check/dash from PLANS.
 * `note` renders as small italic sub-text under the feature name.
 */
export const PLAN_FEATURES: {
  label: string;
  key: keyof PlanLimits | null;
  values?: [string, string, string];
  group?: string;
  note?: string;
}[] = [
  { group: "Usage", label: "Brand projects (websites)", key: null, values: ["1", "3", "8"] },
  { label: "Tracked prompts", key: null, values: ["5", "20", "50"] },
  { label: "AI visibility scans", key: null, values: ["5 total", "30 / month", "60 / month"] },
  { label: "Competitors tracked", key: null, values: ["2", "10", "30"] },
  { label: "Content generations (pages, schema, llms.txt, summaries)", key: null, values: ["5", "30 / month", "60 / month"] },
  { group: "Included", label: "Trending topics", key: "trends" },
  { label: "Market benchmarks", key: "benchmarks" },
  { label: "Weekly email reports", key: "weeklyReports" },
  { label: "Shareable report links", key: "shareLinks" },
  {
    label: "Team collaboration (seats)",
    key: null,
    values: ["—", "2 (viewer)", "5 seats"],
    note: "Members can run scans and generate content. Viewers have read-only access.",
  },
  { group: "Pro only", label: "White label reports", key: "whiteLabel" },
];
