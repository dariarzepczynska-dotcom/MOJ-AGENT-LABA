create table if not exists public.message_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  message_length integer not null check (message_length >= 0)
);

create index if not exists message_logs_user_id_created_at_idx
  on public.message_logs (user_id, created_at desc);

alter table public.message_logs enable row level security;

drop policy if exists "own message logs select" on public.message_logs;
create policy "own message logs select"
on public.message_logs for select to authenticated
using (user_id = auth.uid());

drop policy if exists "own message logs insert" on public.message_logs;
create policy "own message logs insert"
on public.message_logs for insert to authenticated
with check (user_id = auth.uid());

create or replace function public.check_message_rate_limit(
  p_message_length integer
)
returns table (
  allowed boolean,
  retry_after_minutes integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_window_start timestamptz := now() - interval '1 hour';
  v_oldest_timestamp timestamptz;
  v_message_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_message_length < 0 or p_message_length > 2000 then
    raise exception 'Invalid message length';
  end if;

  -- Serialize requests for one user so parallel calls cannot bypass the limit.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select count(*)::integer, min(created_at)
    into v_message_count, v_oldest_timestamp
  from public.message_logs
  where user_id = v_user_id
    and created_at > v_window_start;

  if v_message_count >= 50 then
    return query select
      false,
      greatest(
        1,
        ceil(extract(epoch from (v_oldest_timestamp + interval '1 hour' - now())) / 60)::integer
      );
    return;
  end if;

  insert into public.message_logs (user_id, message_length)
  values (v_user_id, p_message_length);

  return query select true, 0;
end;
$$;

revoke all on function public.check_message_rate_limit(integer) from public;
grant execute on function public.check_message_rate_limit(integer) to authenticated;
