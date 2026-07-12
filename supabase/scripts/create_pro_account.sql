-- Creates a confirmed Pro test account (email + password login).
-- Run in the Supabase SQL Editor. NOT a migration — do not add to supabase/migrations.
-- Change user_email / user_password / full name below before running.

do $$
declare
  uid uuid := gen_random_uuid();
  user_email text := 'pro@sightline.test';
  user_password text := 'ProTest1234!';
begin
  -- auth user (email pre-confirmed, so no confirmation mail is needed)
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    user_email, extensions.crypt(user_password, extensions.gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Pro Tester"}',
    now(), now(), '', '', '', ''
  );

  -- GoTrue requires a matching identity row for email/password sign-in
  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), uid, uid::text,
    jsonb_build_object('sub', uid::text, 'email', user_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  -- the on_auth_user_created trigger already inserted the profile row;
  -- upgrade it to the Pro plan
  update public.profiles set plan = 'pro' where id = uid;

  raise notice 'Pro account created: % (id: %)', user_email, uid;
end $$;
