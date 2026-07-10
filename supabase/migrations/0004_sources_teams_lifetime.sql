-- Sprint 2: citation sources, scan progress, lifetime plan,
-- lightweight workspaces (members + comments) with membership RLS.

-- ── citation sources per engine answer ──────────────────────
-- [{ "url": "...", "domain": "g2.com", "type": "review" }]
alter table public.scan_results add column if not exists sources jsonb not null default '[]';

-- ── live scan progress for transparency ─────────────────────
-- { "done": 12, "total": 55, "engine": "chatgpt" }
alter table public.scans add column if not exists progress jsonb not null default '{}';

-- ── lifetime (AppSumo) plan ──────────────────────────────────
alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles add constraint profiles_plan_check
  check (plan in ('free', 'starter', 'pro', 'lifetime'));

-- ── workspace members ────────────────────────────────────────
-- The project owner is projects.user_id (no member row). Invites are keyed
-- by email; user_id/accepted_at fill in when the invitee signs in.
create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('member', 'viewer')),
  invited_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (project_id, email)
);

create index on public.project_members (project_id);
create index on public.project_members (user_id);
create index on public.project_members (email);

-- ── internal comments (team activity on the Timeline) ────────
create table public.project_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null default '',
  body text not null,
  created_at timestamptz not null default now()
);

create index on public.project_comments (project_id, created_at desc);

-- ── membership helpers (security definer avoids RLS recursion)
create or replace function public.project_role(pid uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select case
    when exists (select 1 from projects p where p.id = pid and p.user_id = auth.uid())
      then 'owner'
    else (
      select m.role from project_members m
      where m.project_id = pid and m.user_id = auth.uid() and m.accepted_at is not null
      limit 1
    )
  end;
$$;

create or replace function public.has_project_access(pid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.project_role(pid) is not null;
$$;

-- ── RLS ───────────────────────────────────────────────────────
alter table public.project_members enable row level security;
alter table public.project_comments enable row level security;

-- members see their own membership; owners manage the roster
create policy "own membership" on public.project_members
  for select using (user_id = auth.uid() or email = (auth.jwt() ->> 'email'));
create policy "owner manages members" on public.project_members
  for all using (public.project_role(project_id) = 'owner')
  with check (public.project_role(project_id) = 'owner');
-- invitees claim their invite (attach user_id / accepted_at) on sign-in
create policy "claim invite" on public.project_members
  for update using (email = (auth.jwt() ->> 'email'))
  with check (email = (auth.jwt() ->> 'email'));

-- comments: any workspace member reads; owner + member write; authors delete
create policy "members read comments" on public.project_comments
  for select using (public.has_project_access(project_id));
create policy "members write comments" on public.project_comments
  for insert with check (
    public.project_role(project_id) in ('owner', 'member') and user_id = auth.uid()
  );
create policy "authors delete comments" on public.project_comments
  for delete using (user_id = auth.uid());

-- membership grants read access to workspace data (adds to the owner-only
-- "own rows" policies — permissive policies OR together)
create policy "members read" on public.projects
  for select using (public.has_project_access(id));

do $$
declare t text;
begin
  foreach t in array array['competitors','prompts','scans','snapshots','recommendations','generated_content','share_links']
  loop
    execute format(
      'create policy "members read" on public.%I for select using (public.has_project_access(project_id))', t
    );
  end loop;
end $$;

create policy "members read results" on public.scan_results
  for select using (
    exists (
      select 1 from public.scans s
      where s.id = scan_id and public.has_project_access(s.project_id)
    )
  );

-- members (not viewers) can run scans and update recommendation status
create policy "members run scans" on public.scans
  for insert with check (
    public.project_role(project_id) in ('owner', 'member') and user_id = auth.uid()
  );
create policy "members update recommendations" on public.recommendations
  for update using (public.project_role(project_id) in ('owner', 'member'));
