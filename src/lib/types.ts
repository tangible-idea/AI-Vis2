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
  phrase: string;
}

export const INDUSTRIES: Industry[] = [
  { id: "saas", label: "SaaS", phrase: "SaaS" },
  { id: "tech_b2b", label: "Technology (B2B)", phrase: "B2B technology" },
  { id: "tech_b2c", label: "Technology (B2C)", phrase: "consumer technology" },
  { id: "mobile_apps", label: "Mobile Apps", phrase: "mobile app" },
  { id: "retail_ecommerce", label: "Retail & E-commerce", phrase: "retail & e-commerce" },
  { id: "financial_services", label: "Financial Services", phrase: "financial services" },
  { id: "healthcare", label: "Healthcare & Life Sciences", phrase: "healthcare" },
  { id: "education", label: "Education", phrase: "education" },
  { id: "travel_hospitality", label: "Travel & Hospitality", phrase: "travel & hospitality" },
  { id: "media_entertainment", label: "Media & Entertainment", phrase: "media & entertainment" },
  { id: "manufacturing", label: "Manufacturing & Industrial", phrase: "manufacturing" },
  { id: "logistics", label: "Logistics & Transportation", phrase: "logistics" },
  { id: "real_estate_construction", label: "Real Estate & Construction", phrase: "real estate" },
  { id: "professional_services", label: "Professional Services", phrase: "professional services" },
  { id: "government_nonprofit", label: "Government & Non-profit", phrase: "public sector" },
];

/** UI label for a stored industry value; legacy free-text rows pass through. */
export function industryLabel(value: string): string {
  return INDUSTRIES.find((i) => i.id === value)?.label ?? value;
}

/** In-sentence phrasing for prompt/content generation; legacy values pass through. */
export function industryPhrase(value: string): string {
  return INDUSTRIES.find((i) => i.id === value)?.phrase ?? value;
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
