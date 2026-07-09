-- AI Visibility Platform — initial schema
-- Run via: supabase db push  (or paste into Supabase SQL editor)

-- ── profiles ────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  plan text not null default 'free' check (plan in ('free', 'starter', 'pro')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── projects ────────────────────────────────────────────────
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  website text not null,
  industry text not null,
  country text not null default 'US',
  language text not null default 'en',
  target_market text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.competitors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  website text,
  created_at timestamptz not null default now()
);

create table public.prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  text text not null,
  category text not null default 'best' check (category in ('best', 'comparison', 'recommendation', 'local', 'alternative', 'custom')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── scans ───────────────────────────────────────────────────
create table public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed')),
  trigger text not null default 'manual' check (trigger in ('onboarding', 'manual', 'scheduled', 'demo')),
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.scan_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scan_id uuid not null references public.scans (id) on delete cascade,
  prompt_id uuid not null references public.prompts (id) on delete cascade,
  engine text not null,
  response_text text not null default '',
  brand_mentioned boolean not null default false,
  brand_position integer,
  recommended boolean not null default false,
  cited boolean not null default false,
  competitors_mentioned jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table public.snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  scan_id uuid references public.scans (id) on delete set null,
  overall_score integer not null,
  engine_scores jsonb not null default '{}',
  mention_rate real not null default 0,
  recommendation_rate real not null default 0,
  avg_position real,
  coverage real not null default 0,
  share_of_voice jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ── recommendations & content ───────────────────────────────
create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  scan_id uuid references public.scans (id) on delete set null,
  title text not null,
  description text not null default '',
  type text not null check (type in ('faq_page', 'blog_post', 'comparison_page', 'category_page', 'location_page', 'schema', 'llms_txt', 'metadata', 'internal_links')),
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  impact text not null default '',
  effort text not null default '',
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.generated_content (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  recommendation_id uuid references public.recommendations (id) on delete set null,
  type text not null,
  language text not null default 'en',
  title text not null default '',
  content text not null default '',
  created_at timestamptz not null default now()
);

-- ── sharing ─────────────────────────────────────────────────
create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(16), 'hex'),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── indexes ─────────────────────────────────────────────────
create index on public.projects (user_id);
create index on public.competitors (project_id);
create index on public.prompts (project_id);
create index on public.scans (project_id, created_at desc);
create index on public.scan_results (scan_id);
create index on public.snapshots (project_id, created_at desc);
create index on public.recommendations (project_id, status);
create index on public.generated_content (project_id, created_at desc);
create index on public.share_links (token);

-- ── row level security ──────────────────────────────────────
-- Every table carries user_id so policies stay uniform and join-free.
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.competitors enable row level security;
alter table public.prompts enable row level security;
alter table public.scans enable row level security;
alter table public.scan_results enable row level security;
alter table public.snapshots enable row level security;
alter table public.recommendations enable row level security;
alter table public.generated_content enable row level security;
alter table public.share_links enable row level security;

create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

do $$
declare t text;
begin
  foreach t in array array['projects','competitors','prompts','scans','scan_results','snapshots','recommendations','generated_content','share_links']
  loop
    execute format(
      'create policy "own rows" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t
    );
  end loop;
end $$;

-- Shared report pages are rendered server-side with the service role key,
-- which bypasses RLS — no public policies needed.
