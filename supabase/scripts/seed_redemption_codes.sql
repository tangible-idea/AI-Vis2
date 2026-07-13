-- Ops: seed lifetime redemption codes for an AppSumo campaign.
-- Run in the Supabase SQL editor (service role). Format: XXXX-XXXX-XXXX.
--
-- Usage: adjust generate_series to the batch size, run, then export:
--   select code from redemption_codes where redeemed_by is null;

insert into public.redemption_codes (code)
select upper(
  substr(md5(random()::text || clock_timestamp()::text), 1, 4) || '-' ||
  substr(md5(random()::text || clock_timestamp()::text), 1, 4) || '-' ||
  substr(md5(random()::text || clock_timestamp()::text), 1, 4)
)
from generate_series(1, 100)  -- ← number of codes
on conflict (code) do nothing;
