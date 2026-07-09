/** Shared constants/types for the pre-signup AEO/GEO preview scan. */

export const PREVIEW_STORAGE_KEY = "sightline_preview_inputs";
export const PREVIEW_COOKIE = "sightline_previews";
/** Anonymous preview scans allowed per browser before requiring sign-up. */
export const PREVIEW_LIMIT = 5;

export interface PreviewInputs {
  brand: string;
  domain: string;
  industry: string;
  description?: string;
}

/** Limited result payload — full breakdowns stay behind sign-up. */
export interface PreviewResult {
  score: number;
  mentionRate: number;
  coverage: number;
  enginesScanned: number;
  promptsRun: number;
  topEngine: { label: string; score: number } | null;
  sample: { prompt: string; mentioned: boolean; excerpt: string } | null;
  previewsLeft: number;
}
