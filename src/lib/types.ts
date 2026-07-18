export type Plan = "free" | "starter" | "pro" | "lifetime";

export type Engine = "chatgpt" | "claude" | "gemini" | "perplexity" | "google_ai";

export type PromptCategory =
  | "branded"
  | "category"
  | "informational"
  | "comparison"
  | "purchase"
  | "local"
  | "problem"
  // legacy values still present in existing rows
  | "best"
  | "recommendation"
  | "alternative"
  | "custom";

export const PROMPT_CATEGORIES: { id: PromptCategory; label: string }[] = [
  { id: "branded", label: "Branded" },
  { id: "category", label: "Category" },
  { id: "informational", label: "Informational" },
  { id: "comparison", label: "Comparison" },
  { id: "purchase", label: "Purchase intent" },
  { id: "local", label: "Local intent" },
  { id: "problem", label: "Problem-solving" },
];

export type ScanStatus = "pending" | "running" | "done" | "failed";

export type RecommendationType =
  | "faq_page"
  | "blog_post"
  | "comparison_page"
  | "category_page"
  | "location_page"
  | "schema"
  | "llms_txt"
  | "metadata"
  | "internal_links";

export type RecommendationStatus = "todo" | "in_progress" | "done";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  plan: Plan;
  /** Preferred UI language (i18n locale code); null = device default. */
  ui_language: string | null;
  created_at: string;
}

/**
 * Top-level ownership layer: one organization per customer account,
 * auto-created on signup (see migration 0006). Invisible in the UI for
 * now — it anchors billing, teams and usage limits going forward.
 */
export interface Organization {
  id: string;
  owner_id: string;
  name: string;
  /** White-label branding (Pro): shown on exported reports. */
  logo_url: string | null;
  website: string | null;
  created_at: string;
}

/**
 * A Project's canonical identity is its primary domain (`website`) plus the
 * market (country + language); brand name and industry are supporting
 * context. Monitoring anchors on the domain to maximize entity precision.
 */
export interface Project {
  id: string;
  user_id: string;
  org_id: string | null;
  name: string;
  website: string;
  /** Normalized industry id (see INDUSTRIES); legacy rows may hold free text. */
  industry: string;
  country: string;
  language: string;
  description: string | null;
  logo_url: string | null;
  /** Archived projects keep their data but don't count toward plan limits. */
  archived_at: string | null;
  /** Monitoring configuration: include this project in weekly scheduled scans (paid plans). */
  auto_scan_enabled: boolean;
  is_demo: boolean;
  created_at: string;
}

export interface Competitor {
  id: string;
  project_id: string;
  name: string;
  website: string | null;
  position: number;
}

export interface Prompt {
  id: string;
  project_id: string;
  text: string;
  category: PromptCategory;
  /** Free-form grouping in the Prompt Explorer ("CRM", "AI SEO", …). */
  topic: string | null;
  is_active: boolean;
}

export interface Scan {
  id: string;
  project_id: string;
  status: ScanStatus;
  trigger: "onboarding" | "manual" | "scheduled" | "demo";
  error: string | null;
  /** Live progress while running: { done, total, engine }. */
  progress: { done?: number; total?: number; engine?: string };
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export type MemberRole = "owner" | "member" | "viewer";

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string | null;
  email: string;
  role: "member" | "viewer";
  invited_by: string;
  created_at: string;
  accepted_at: string | null;
}

export interface ProjectComment {
  id: string;
  project_id: string;
  user_id: string;
  author_name: string;
  body: string;
  created_at: string;
}

export type SourceType =
  | "official"
  | "competitor"
  | "review"
  | "news"
  | "docs"
  | "knowledge_base"
  | "blog"
  | "third_party";

export interface CitationSource {
  url: string;
  domain: string;
  type: SourceType;
  /** Page title, when the engine's answer linked it as "[title](url)". */
  title?: string;
}

export interface ScanResult {
  id: string;
  scan_id: string;
  prompt_id: string;
  engine: Engine;
  response_text: string;
  brand_mentioned: boolean;
  brand_position: number | null;
  recommended: boolean;
  cited: boolean;
  competitors_mentioned: string[];
  sources: CitationSource[];
  created_at: string;
}

export interface Snapshot {
  id: string;
  project_id: string;
  scan_id: string | null;
  overall_score: number;
  engine_scores: Record<Engine, number>;
  mention_rate: number;
  recommendation_rate: number;
  avg_position: number | null;
  coverage: number;
  share_of_voice: Record<string, number>;
  created_at: string;
}

export interface Recommendation {
  id: string;
  project_id: string;
  scan_id: string | null;
  title: string;
  description: string;
  type: RecommendationType;
  priority: "high" | "medium" | "low";
  impact: string;
  effort: string;
  status: RecommendationStatus;
  completed_at: string | null;
  created_at: string;
}

export interface GeneratedContent {
  id: string;
  project_id: string;
  recommendation_id: string | null;
  type: string;
  language: string;
  title: string;
  content: string;
  created_at: string;
}

export interface ShareLink {
  id: string;
  project_id: string;
  token: string;
  expires_at: string | null;
  created_at: string;
}

/** Countries offered for market selection — one per AI Visibility scan/market view. */
export const COUNTRIES = ["US", "KR", "JP", "SG", "GB", "DE", "AU", "CA", "TH", "VN", "ID", "MY"] as const;

/**
 * Normalized industry taxonomy — stored as the `id` slug so values stay
 * stable for benchmarking while labels/phrases can evolve. New industries
 * are added by appending entries; no data migration needed. `phrase` is the
 * lowercase wording used inside generated scan prompts ("best {phrase}
 * solutions…"); `label` is what the UI shows.
 */
export interface Industry {
  id: string;
  label: string;
  /** In-sentence phrasing for prompt/content generation. */
  phrase: string;
  /** Short helper shown under the Industry field, per selection. */
  helper: string;
}

/**
 * MECE industry taxonomy — one row per category, shared verbatim by the
 * frontend selectors and the backend (validation + benchmark grouping) so
 * benchmarks stay consistent and unambiguous. Keep IDs stable.
 */
export const INDUSTRIES: Industry[] = [
  { id: "software_saas", label: "Software & SaaS", phrase: "software & SaaS", helper: "B2B software, cloud platforms, enterprise solutions." },
  { id: "consumer_technology", label: "Consumer Technology", phrase: "consumer technology", helper: "Mobile apps, consumer products, electronics." },
  { id: "professional_services", label: "Professional Services", phrase: "professional services", helper: "Agencies, consulting, legal, accounting." },
  { id: "ecommerce_retail", label: "E-Commerce & Retail", phrase: "e-commerce & retail", helper: "Online stores, marketplaces, retail brands." },
  { id: "financial_services", label: "Financial Services", phrase: "financial services", helper: "Banking, fintech, insurance, wealth management." },
  { id: "healthcare_life_sciences", label: "Healthcare & Life Sciences", phrase: "healthcare & life sciences", helper: "Healthcare, pharma, biotech, healthtech." },
  { id: "education", label: "Education", phrase: "education", helper: "EdTech, schools, universities, training." },
  { id: "government_nonprofit", label: "Government & Non-Profit", phrase: "public sector", helper: "Public sector, NGOs, charities." },
  { id: "other", label: "Other Industries", phrase: "other industries", helper: "Manufacturing, real estate, travel, logistics, media, energy and other sectors." },
];

/**
 * Legacy industry ids (and earlier free-text values) → current taxonomy ids,
 * so existing projects and stored observations fold into the new MECE
 * categories for display and benchmark grouping. Unknown values fall through.
 */
const LEGACY_INDUSTRY_MAP: Record<string, string> = {
  saas: "software_saas",
  tech_b2b: "software_saas",
  tech_b2c: "consumer_technology",
  mobile_apps: "consumer_technology",
  retail_ecommerce: "ecommerce_retail",
  healthcare: "healthcare_life_sciences",
  travel_hospitality: "other",
  media_entertainment: "other",
  manufacturing: "other",
  logistics: "other",
  real_estate_construction: "other",
  // unchanged ids (financial_services, professional_services, education,
  // government_nonprofit) already match the new taxonomy
};

/** Maps any stored industry value to a current taxonomy id (best effort). */
export function normalizeIndustry(value: string): string {
  if (INDUSTRIES.some((i) => i.id === value)) return value;
  return LEGACY_INDUSTRY_MAP[value] ?? value;
}

/** UI label for a stored industry value; legacy values map forward. */
export function industryLabel(value: string): string {
  const id = normalizeIndustry(value);
  return INDUSTRIES.find((i) => i.id === id)?.label ?? value;
}

/** In-sentence phrasing for prompt/content generation; legacy values map forward. */
export function industryPhrase(value: string): string {
  const id = normalizeIndustry(value);
  return INDUSTRIES.find((i) => i.id === id)?.phrase ?? value;
}

export const CONTENT_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ko", label: "한국어" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "中文" },
  { code: "th", label: "ไทย" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "ms", label: "Bahasa Melayu" },
] as const;
