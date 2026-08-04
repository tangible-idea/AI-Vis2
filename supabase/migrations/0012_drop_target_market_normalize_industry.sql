-- Converges a database whose migration history was recorded out of band.
--
-- Migration 0009 was never applied to production. It did two things: an
-- industry re-map and dropping `target_market`. Re-running it as written is
-- no longer safe — its map contains `'other' -> 'professional_services'`,
-- and since 0010 introduced the MECE taxonomy `other` is a *valid current
-- value* (Other Industries). Replaying 0009 would silently recategorize
-- every project sitting in Other Industries.
--
-- So 0009 and 0010 are marked applied and this migration carries what
-- genuinely remains: the column drop, plus one composite industry map that
-- folds both generations of legacy values forward in a single pass —
-- everything 0009 and 0010 would have done, minus that one unsafe row.
--
-- Safe to run on a database that already applied 0009/0010: every statement
-- is a no-op there.

-- ── target market removal (from 0009) ────────────────────────
-- Country + language already define the monitoring market; the free-text
-- field overlapped with the Markets architecture and is read nowhere.
alter table public.projects drop column if exists target_market;

-- ── industry taxonomy (composite of 0009 + 0010, idempotent) ─
-- Values already on the current MECE taxonomy pass through untouched, so
-- running this twice changes nothing.
create or replace function public.normalize_industry_mece(v text)
returns text
language sql immutable
as $$
  select case v
    -- pre-0009 free-text labels, folded straight to the current taxonomy.
    -- NOTE: 0009's `'other' -> 'professional_services'` row is deliberately
    -- omitted — 'other' is a valid current id (Other Industries).
    when 'SaaS & software'              then 'software_saas'
    when 'e-commerce & retail'          then 'ecommerce_retail'
    when 'marketing & advertising'      then 'professional_services'
    when 'finance & fintech'            then 'financial_services'
    when 'healthcare & wellness'        then 'healthcare_life_sciences'
    when 'education & e-learning'       then 'education'
    when 'travel & hospitality'         then 'other'
    when 'food & beverage'              then 'ecommerce_retail'
    when 'real estate'                  then 'other'
    when 'legal & professional services' then 'professional_services'
    when 'consulting & agencies'        then 'professional_services'
    when 'manufacturing & industrial'   then 'other'
    when 'media & entertainment'        then 'other'
    when 'beauty & fashion'             then 'ecommerce_retail'
    when 'fitness & sports'             then 'healthcare_life_sciences'
    when 'automotive'                   then 'other'
    when 'home & local services'        then 'professional_services'

    -- 0009-era slugs (from 0010's map)
    when 'saas'                     then 'software_saas'
    when 'tech_b2b'                 then 'software_saas'
    when 'tech_b2c'                 then 'consumer_technology'
    when 'mobile_apps'              then 'consumer_technology'
    when 'retail_ecommerce'         then 'ecommerce_retail'
    when 'healthcare'               then 'healthcare_life_sciences'
    when 'travel_hospitality'       then 'other'
    when 'media_entertainment'      then 'other'
    when 'manufacturing'            then 'other'
    when 'logistics'                then 'other'
    when 'real_estate_construction' then 'other'

    -- already-aligned ids pass through:
    -- software_saas, consumer_technology, ecommerce_retail,
    -- healthcare_life_sciences, financial_services, professional_services,
    -- education, government_nonprofit, other
    --
    -- Ad-hoc values that never appeared in any taxonomy (e.g. 'IT',
    -- 'Technology') also pass through untouched. Reassigning them would
    -- change a customer's category, prompts and benchmark bucket, so that
    -- stays a deliberate decision rather than a migration side effect.
    else v
  end;
$$;

update public.projects
  set industry = public.normalize_industry_mece(industry)
  where industry is distinct from public.normalize_industry_mece(industry);

update public.prompt_observations
  set industry = public.normalize_industry_mece(industry)
  where industry is distinct from public.normalize_industry_mece(industry);

drop function public.normalize_industry_mece(text);
