import type { Plan } from "./types";

export interface PlanLimits {
  label: string;
  price: string;
  priceNote: string;
  maxProjects: number;
  maxPrompts: number;
  maxCompetitors: number;
  scansPerMonth: number;
  /** Lifetime scan cap per user (free plan); null = monthly limit applies. */
  totalScans: number | null;
  contentGenerations: number;
  /** Team seats besides the owner (0 = no collaboration). */
  maxTeamMembers: number;
  /** Days of history shown in trends/timeline; null = unlimited. */
  historyDays: number | null;
  trends: boolean;
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
    contentGenerations: 3,
    maxTeamMembers: 0,
    historyDays: null,
    trends: false,
    weeklyReports: false,
    shareLinks: false,
    api: false,
    whiteLabel: false,
    team: false,
  },
  starter: {
    label: "Starter",
    price: "$49",
    priceNote: "per month",
    maxProjects: 3,
    maxPrompts: 20,
    maxCompetitors: 5,
    scansPerMonth: 8,
    totalScans: null,
    contentGenerations: 40,
    maxTeamMembers: 3,
    historyDays: null,
    trends: true,
    weeklyReports: true,
    shareLinks: true,
    api: false,
    whiteLabel: false,
    team: true,
  },
  pro: {
    label: "Pro",
    price: "$149",
    priceNote: "per month",
    maxProjects: 10,
    maxPrompts: 100,
    maxCompetitors: 20,
    scansPerMonth: 100,
    totalScans: null,
    contentGenerations: 1000,
    maxTeamMembers: 10,
    historyDays: null,
    trends: true,
    weeklyReports: true,
    shareLinks: true,
    api: true,
    whiteLabel: true,
    team: true,
  },
  // AppSumo lifetime deal — capped so the plan stays profitable while
  // acting as an acquisition channel. Tune via PLAN_LIMITS_JSON, no deploy.
  lifetime: {
    label: "Lifetime",
    price: "$79",
    priceNote: "one-time (AppSumo)",
    maxProjects: 1,
    maxPrompts: 10,
    maxCompetitors: 3,
    scansPerMonth: 4,
    totalScans: null,
    contentGenerations: 15,
    maxTeamMembers: 2,
    historyDays: 180,
    trends: true,
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

/** Feature list rows for the pricing page / billing comparison. */
export const PLAN_FEATURES: { label: string; key: keyof PlanLimits | null; values?: [string, string, string] }[] = [
  { label: "Tracked prompts", key: null, values: ["5", "20", "100"] },
  { label: "Competitors", key: null, values: ["2", "5", "20"] },
  { label: "Scans", key: null, values: ["5 total", "8 / month", "Unlimited*"] },
  { label: "AI content generations", key: null, values: ["3", "40", "Unlimited*"] },
  { label: "Trending topics", key: "trends" },
  { label: "Weekly email reports", key: "weeklyReports" },
  { label: "Shareable report links", key: "shareLinks" },
  { label: "API access", key: "api" },
  { label: "White label reports", key: "whiteLabel" },
  { label: "Team collaboration", key: "team" },
];
