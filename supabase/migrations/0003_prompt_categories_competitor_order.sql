-- Prompt taxonomy v2: seven buyer-intent categories (legacy values stay valid
-- so existing rows keep working) + competitor display ordering.

alter table public.prompts drop constraint if exists prompts_category_check;
alter table public.prompts add constraint prompts_category_check check (
  category in (
    'branded', 'category', 'informational', 'comparison', 'purchase', 'local', 'problem',
    -- legacy
    'best', 'recommendation', 'alternative', 'custom'
  )
);

-- Competitors: user-defined display order (drag-and-drop in Settings).
alter table public.competitors add column if not exists position integer not null default 0;
update public.competitors c
set position = sub.rn - 1
from (
  select id, row_number() over (partition by project_id order by created_at) as rn
  from public.competitors
) sub
where c.id = sub.id and c.position = 0;
