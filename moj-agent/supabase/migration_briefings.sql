-- Run once in the Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.briefings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  content text not null check (char_length(trim(content)) > 0),
  date date not null,
  user_id uuid references auth.users(id) on delete cascade,
  constraint briefings_date_key unique (date)
);

create unique index if not exists briefings_date_key
  on public.briefings (date);

create index if not exists briefings_user_id_date_idx
  on public.briefings (user_id, date desc);

alter table public.briefings enable row level security;

drop policy if exists "own briefings" on public.briefings;
create policy "own briefings" on public.briefings
for select to authenticated
using (user_id = auth.uid());

-- The cron writes with SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.
