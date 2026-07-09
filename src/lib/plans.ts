import type { Plan } from "./types";

export interface PlanLimits {
  label: string;
  price: string;
  priceNote: string;
  maxPrompts: number;
  maxCompetitors: number;
  scansPerMonth: number;
  /** Lifetime scan cap per user (free plan); null = monthly limit applies. */
  totalScans: number | null;
  contentGenerations: number;
  trends: boolean;
  weeklyReports: boolean;
  shareLinks: boolean;
  api: boolean;
  whiteLabel: boolean;
  team: boolean;
}

export const PLANS: Record<Plan, PlanLimits> = {
  free: {
    label: "Free",
    price: "$0",
    priceNote: "forever",
    maxPrompts: 5,
    maxCompetitors: 2,
    scansPerMonth: 5,
    totalScans: 5,
    contentGenerations: 3,
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
    maxPrompts: 20,
    maxCompetitors: 5,
    scansPerMonth: 8,
    totalScans: null,
    contentGenerations: 40,
    trends: true,
    weeklyReports: true,
    shareLinks: true,
    api: false,
    whiteLabel: false,
    team: false,
  },
  pro: {
    label: "Pro",
    price: "$149",
    priceNote: "per month",
    maxPrompts: 100,
    maxCompetitors: 20,
    scansPerMonth: 100,
    totalScans: null,
    contentGenerations: 1000,
    trends: true,
    weeklyReports: true,
    shareLinks: true,
    api: true,
    whiteLabel: true,
    team: true,
  },
};

export function planLimits(plan: Plan | null | undefined): PlanLimits {
  return PLANS[plan ?? "free"];
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
