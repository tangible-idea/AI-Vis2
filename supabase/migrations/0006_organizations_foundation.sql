-- Sprint 3: organization layer, project lifecycle (archive), and the
-- normalized AI-visibility data foundation (response cache + anonymous
-- prompt observations). No behavior change for existing rows beyond
-- backfilled org ownership.

-- ── organizations ────────────────────────────────────────────
-- One organization per customer account. Largely invisible in the UI for
-- now; it anchors billing, team, usage limits and future enterprise
-- features so those can move off profiles without another remodel.
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null default '',
  created_at timestamptz not null default now()
);

alter table public.organizations enable row level security;
create policy "own organization" on public.organizations
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- every new profile automatically gets an organization
create or replace function public.handle_new_profile_org()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.organizations (owner_id, name)
  values (new.id, coalesce(new.full_name, ''))
  on conflict (owner_id) do nothing;
  return new;
end;
$$;

create trigger on_profile_created_org
  after insert on public.profiles
  for each row execute function public.handle_new_profile_org();

-- backfill: one organization per existing profile
insert into public.organizations (owner_id, name)
select p.id, coalesce(p.full_name, '') from public.profiles p
on conflict (owner_id) do nothing;

-- ── projects: org ownership + lifecycle + brand logo ─────────
alter table public.projects
  add column if not exists org_id uuid references public.organizations (id) on delete set null,
  add column if not exists archived_at timestamptz,
  add column if not exists logo_url text;

update public.projects pr
set org_id = o.id
from public.organizations o
where o.owner_id = pr.user_id and pr.org_id is null;

-- keep org_id filled without touching application inserts
create or replace function public.set_project_org()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.org_id is null then
    select id into new.org_id from public.organizations where owner_id = new.user_id;
  end if;
  return new;
end;
$$;

create trigger on_project_set_org
  before insert on public.projects
  for each row execute function public.set_project_org();

create index on public.projects (org_id);
-- plan limits count active (non-archived, non-demo) projects
create index on public.projects (user_id) where archived_at is null and is_demo = false;

-- ── ai_responses: shared response cache ──────────────────────
-- One row per (prompt, engine, market, language) answer. Scans reuse a
-- fresh cached answer instead of re-querying the provider, deduplicating
-- identical prompts across organizations, projects, markets and scheduled
-- runs. Internal only: served exclusively through the service role and
-- never exposed to users (responses contain no customer identity).
create table public.ai_responses (
  id uuid primary key default gen_random_uuid(),
  prompt_hash text not null,
  prompt_text text not null,
  engine text not null,
  model text not null default '',
  country text not null,
  language text not null,
  response_text text not null,
  sources jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index on public.ai_responses (prompt_hash, engine, country, language, created_at desc);

alter table public.ai_responses enable row level security;
-- no policies: service-role access only

-- ── prompt_observations: anonymous prompt metadata ───────────
-- Normalized observation per engine answer, stripped of customer identity
-- (no user/org/project keys). This is the storage layer future market
-- benchmarks aggregate over — aggregated statistics and anonymous
-- metadata only, per the data-privacy rules.
create table public.prompt_observations (
  id uuid primary key default gen_random_uuid(),
  prompt_hash text not null,
  intent text not null default 'custom',
  country text not null,
  language text not null,
  industry text not null,
  engine text not null,
  brand_mentioned boolean not null default false,
  competitor_mentioned boolean not null default false,
  cited boolean not null default false,
  source_domains jsonb not null default '[]',
  scanned_at timestamptz not null default now()
);

create index on public.prompt_observations (industry, country, scanned_at desc);
create index on public.prompt_observations (engine, scanned_at desc);

alter table public.prompt_observations enable row level security;
-- no policies: service-role access only
