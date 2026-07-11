-- UI language preference, synced across devices for signed-in users.
-- Null = follow the device/browser choice (cookie) or English default.
alter table public.profiles add column if not exists ui_language text;
