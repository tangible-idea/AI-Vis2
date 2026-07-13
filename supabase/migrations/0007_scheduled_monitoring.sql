-- Scheduled monitoring: each project owns its monitoring configuration.
-- Weekly scans run via /api/cron/scan for paid plans; the toggle lets a
-- project opt out without archiving it.

alter table public.projects
  add column if not exists auto_scan_enabled boolean not null default true;

-- the cron sweeps active, monitored, non-demo projects
create index on public.projects (auto_scan_enabled)
  where archived_at is null and is_demo = false;
