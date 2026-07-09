-- Optional business description captured during onboarding. Not required by
-- the scan pipeline, but improves prompt/content quality downstream.
alter table public.projects add column if not exists description text;
