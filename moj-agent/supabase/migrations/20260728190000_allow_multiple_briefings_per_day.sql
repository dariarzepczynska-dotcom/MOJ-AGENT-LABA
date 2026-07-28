-- Ręczne uruchomienie briefingu może utworzyć kilka wpisów tego samego dnia.
-- Usuń ewentualny UNIQUE obejmujący wyłącznie kolumnę `date`.
do $$
declare
  constraint_name text;
begin
  select con.conname
    into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'briefings'
    and con.contype = 'u'
    and (
      select array_agg(att.attname order by key_column.ordinality)
      from unnest(con.conkey) with ordinality as key_column(attnum, ordinality)
      join pg_attribute att
        on att.attrelid = rel.oid
       and att.attnum = key_column.attnum
    ) = array['date']::name[]
  limit 1;

  if constraint_name is not null then
    execute format(
      'alter table public.briefings drop constraint %I',
      constraint_name
    );
  end if;
end
$$;

create index if not exists briefings_created_at_desc_idx
  on public.briefings (created_at desc);
