alter table public.message_logs
  add column if not exists blocked boolean not null default false,
  add column if not exists message text,
  add column if not exists block_reason text;

create index if not exists message_logs_blocked_created_at_idx
  on public.message_logs (created_at desc)
  where blocked = true;

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

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select count(*)::integer, min(created_at)
    into v_message_count, v_oldest_timestamp
  from public.message_logs
  where user_id = v_user_id
    and blocked = false
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

create or replace function public.get_admin_security_usage()
returns table (
  user_id uuid,
  tokens_today bigint,
  tokens_week bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    usage.user_id,
    coalesce(sum(usage.tokens_input::bigint + usage.tokens_output::bigint)
      filter (
        where usage.created_at >= (
          date_trunc('day', now() at time zone 'Europe/Warsaw')
          at time zone 'Europe/Warsaw'
        )
      ), 0) as tokens_today,
    coalesce(sum(usage.tokens_input::bigint + usage.tokens_output::bigint)
      filter (
        where usage.created_at >= (
          date_trunc('week', now() at time zone 'Europe/Warsaw')
          at time zone 'Europe/Warsaw'
        )
      ), 0) as tokens_week
  from public.api_usage as usage
  where usage.user_id is not null
    and usage.created_at >= (
      date_trunc('week', now() at time zone 'Europe/Warsaw')
      at time zone 'Europe/Warsaw'
    )
  group by usage.user_id;
$$;

create or replace function public.get_admin_security_bursts()
returns table (
  user_id uuid,
  message_count bigint,
  last_message_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    logs.user_id,
    count(*) as message_count,
    max(logs.created_at) as last_message_at
  from public.message_logs as logs
  where logs.created_at >= now() - interval '10 minutes'
  group by logs.user_id
  having count(*) > 20;
$$;

revoke all on function public.get_admin_security_usage() from public;
revoke all on function public.get_admin_security_bursts() from public;
grant execute on function public.get_admin_security_usage() to service_role;
grant execute on function public.get_admin_security_bursts() to service_role;
