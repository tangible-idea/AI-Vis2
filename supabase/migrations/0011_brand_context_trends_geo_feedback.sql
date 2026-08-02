-- Brand Context support columns.
--
-- The Brand Profile is the existing project row + competitors, so nothing is
-- duplicated here — these are the two pieces of state the profile didn't
-- already carry. The Brand Context itself is derived at request time
-- (src/lib/brand) and is never stored.

-- ── Google Trends geo (independent of the monitoring market) ──
-- Null means "follow the project's monitoring market"; a value is the user's
-- last explicit Google Trends selection and is remembered across sessions.
alter table public.projects add column if not exists trends_geo text;

-- ── brand relevance feedback ──────────────────────────────────
-- Answer to the lightweight "Are these results relevant to your brand?"
-- prompt shown after the first two completed scans. 'relevant' dismisses it
-- for good; 'improved' records that the user refined the Brand Profile.
alter table public.projects
  add column if not exists brand_feedback text
    check (brand_feedback in ('relevant', 'improved')),
  add column if not exists brand_feedback_at timestamptz;
