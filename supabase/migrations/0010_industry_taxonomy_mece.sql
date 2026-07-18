-- Sprint 6: collapse the industry taxonomy to the MECE set used by the
-- frontend (see INDUSTRIES in src/lib/types.ts), so stored values and
-- benchmark grouping stay aligned with what users now select.
--
-- Runtime code also maps legacy ids forward (normalizeIndustry), so a missed
-- row never breaks — this migration just canonicalizes the stored data.

create or replace function public.normalize_industry_mece(v text)
returns text
language sql immutable
as $$
  select case v
    when 'saas'                    then 'software_saas'
    when 'tech_b2b'                then 'software_saas'
    when 'tech_b2c'                then 'consumer_technology'
    when 'mobile_apps'             then 'consumer_technology'
    when 'retail_ecommerce'        then 'ecommerce_retail'
    when 'healthcare'              then 'healthcare_life_sciences'
    when 'travel_hospitality'      then 'other'
    when 'media_entertainment'     then 'other'
    when 'manufacturing'           then 'other'
    when 'logistics'               then 'other'
    when 'real_estate_construction' then 'other'
    -- already-aligned ids pass through:
    -- software_saas, consumer_technology, ecommerce_retail,
    -- healthcare_life_sciences, financial_services, professional_services,
    -- education, government_nonprofit, other
    else v
  end;
$$;

update public.projects set industry = public.normalize_industry_mece(industry);
update public.prompt_observations set industry = public.normalize_industry_mece(industry);

drop function public.normalize_industry_mece(text);
