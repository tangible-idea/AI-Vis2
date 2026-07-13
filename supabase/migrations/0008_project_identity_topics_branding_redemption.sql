-- Sprint 4: project identity (domain + market uniqueness), prompt topics,
-- white-label branding on organizations, and AppSumo lifetime redemption.

-- ── project uniqueness: one active project per domain + market ──
-- A Project is one monitored website for one target market. Archive any
-- older duplicates first (data is kept; they leave the working set) so the
-- partial unique index can be created on existing databases.
update public.projects p
set archived_at = now()
from (
  select id, row_number() over (
    partition by user_id, lower(website), country
    order by created_at desc
  ) as rn
  from public.projects
  where archived_at is null and is_demo = false
) dup
where p.id = dup.id and dup.rn > 1;

create unique index if not exists projects_active_domain_market
  on public.projects (user_id, lower(website), country)
  where archived_at is null and is_demo = false;

-- ── prompt topics ─────────────────────────────────────────────
-- User-defined grouping for the Prompt Explorer ("Digital Marketing",
-- "CRM", …). Category stays the buyer-intent taxonomy; topic is free-form.
alter table public.prompts add column if not exists topic text;

-- ── white-label branding (Pro) ────────────────────────────────
-- Lives on the organization (the billing/entitlement anchor); appears on
-- exported reports. `name` doubles as the company name.
alter table public.organizations
  add column if not exists logo_url text,
  add column if not exists website text;

-- ── lifetime redemption codes (AppSumo) ───────────────────────
-- Self-service activation: a code is claimed atomically (redeemed_by is
-- null → set) and maps the profile to the lifetime plan. Service-role
-- only — codes are never readable by clients.
create table public.redemption_codes (
  code text primary key,
  plan text not null default 'lifetime' check (plan in ('lifetime')),
  redeemed_by uuid references auth.users (id) on delete set null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

create index on public.redemption_codes (redeemed_by);

alter table public.redemption_codes enable row level security;
-- no policies: service-role access only
