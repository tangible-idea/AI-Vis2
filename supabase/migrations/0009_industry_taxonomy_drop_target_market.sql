-- Sprint 5: normalized industry taxonomy + Target Market removal.
--
-- Industry is stored as a stable slug (see INDUSTRIES in src/lib/types.ts).
-- Deliberately no CHECK constraint: new industries are added in code by
-- appending entries, with no data migration required. Unmapped legacy
-- values pass through the UI helpers unchanged, so nothing breaks if a row
-- is missed here.

create or replace function public.normalize_industry(v text)
returns text
language sql immutable
as $$
  select case v
    when 'SaaS & software'              then 'saas'
    when 'e-commerce & retail'          then 'retail_ecommerce'
    when 'marketing & advertising'      then 'professional_services'
    when 'finance & fintech'            then 'financial_services'
    when 'healthcare & wellness'        then 'healthcare'
    when 'education & e-learning'       then 'education'
    when 'travel & hospitality'         then 'travel_hospitality'
    when 'food & beverage'              then 'retail_ecommerce'
    when 'real estate'                  then 'real_estate_construction'
    when 'legal & professional services' then 'professional_services'
    when 'consulting & agencies'        then 'professional_services'
    when 'manufacturing & industrial'   then 'manufacturing'
    when 'media & entertainment'        then 'media_entertainment'
    when 'beauty & fashion'             then 'retail_ecommerce'
    when 'fitness & sports'             then 'healthcare'
    when 'automotive'                   then 'manufacturing'
    when 'home & local services'        then 'professional_services'
    when 'other'                        then 'professional_services'
    else v
  end;
$$;

update public.projects set industry = public.normalize_industry(industry);
-- keep the anonymous benchmark corpus on the same taxonomy
update public.prompt_observations set industry = public.normalize_industry(industry);

drop function public.normalize_industry(text);

-- ── target market removal ─────────────────────────────────────
-- Country + language already define the monitoring market; the free-text
-- field overlapped with the Markets architecture and is no longer read
-- anywhere in the application.
alter table public.projects drop column if exists target_market;
