create table if not exists public.api_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  tokens_input integer not null check (tokens_input >= 0),
  tokens_output integer not null check (tokens_output >= 0),
  model text not null check (char_length(trim(model)) > 0),
  endpoint text not null check (char_length(trim(endpoint)) > 0)
);

create index if not exists api_usage_user_id_created_at_idx
  on public.api_usage (user_id, created_at desc);

alter table public.api_usage enable row level security;

drop policy if exists "own api usage select" on public.api_usage;
create policy "own api usage select"
on public.api_usage for select to authenticated
using (user_id = auth.uid());

drop policy if exists "own api usage insert" on public.api_usage;
create policy "own api usage insert"
on public.api_usage for insert to authenticated
with check (user_id = auth.uid());

revoke all on table public.api_usage from anon;
grant select, insert on table public.api_usage to authenticated;

create or replace function public.get_daily_api_usage()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(tokens_input::bigint + tokens_output::bigint), 0)
  from public.api_usage
  where user_id = auth.uid()
    and created_at >= (
      date_trunc('day', now() at time zone 'Europe/Warsaw')
      at time zone 'Europe/Warsaw'
    );
$$;

revoke all on function public.get_daily_api_usage() from public;
grant execute on function public.get_daily_api_usage() to authenticated;
