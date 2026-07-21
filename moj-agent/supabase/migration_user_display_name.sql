-- Run once in Supabase SQL Editor after migration_auth_isolation.sql.
alter table public.user_profiles add column if not exists display_name text;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'name'
  ) then
    update public.user_profiles set display_name = name
    where display_name is null and name is not null;
  end if;
end;
$$;

create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_profiles (id, display_name, preferences)
  values (new.id, null, '{}'::jsonb)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_profile_after_signup on auth.users;
create trigger create_profile_after_signup
after insert on auth.users for each row execute function public.create_profile_for_new_user();

-- Backfill profiles for accounts created before this trigger existed.
insert into public.user_profiles (id, display_name, preferences)
select id, null, '{}'::jsonb from auth.users
on conflict (id) do nothing;
