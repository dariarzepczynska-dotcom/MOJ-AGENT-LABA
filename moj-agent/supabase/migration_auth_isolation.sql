-- Run once on an existing project. This intentionally removes legacy orphaned data.
alter table public.conversations add column if not exists user_id uuid;
alter table public.documents add column if not exists user_id uuid;
delete from public.messages where conversation_id in (select id from public.conversations where user_id is null);
delete from public.conversations where user_id is null;
delete from public.documents where user_id is null;
delete from public.user_profiles where id not in (select id from auth.users);

alter table public.conversations drop constraint if exists conversations_user_id_fkey;
alter table public.conversations add constraint conversations_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.documents drop constraint if exists documents_user_id_fkey;
alter table public.documents add constraint documents_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.user_profiles drop constraint if exists user_profiles_id_fkey;
alter table public.user_profiles add constraint user_profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;
alter table public.conversations alter column user_id set not null;
alter table public.documents alter column user_id set not null;

create index if not exists documents_user_id_title_idx on public.documents (user_id, title);

create or replace function public.match_documents(query_embedding vector(768), match_threshold float default 0.7, match_count int default 5)
returns table (id uuid, title text, content text, metadata jsonb, similarity float)
language sql stable security invoker as $$
  select d.id, d.title, d.content, d.metadata, 1 - (d.embedding <=> query_embedding)
  from public.documents d
  where d.user_id = auth.uid() and 1 - (d.embedding <=> query_embedding) > match_threshold
  order by d.embedding <=> query_embedding limit match_count;
$$;

alter table public.user_profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.documents enable row level security;
drop policy if exists "own profile" on public.user_profiles;
create policy "own profile" on public.user_profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "own conversations" on public.conversations;
create policy "own conversations" on public.conversations for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own messages" on public.messages;
create policy "own messages" on public.messages for all to authenticated
using (exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()))
with check (exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()));
drop policy if exists "own documents" on public.documents;
create policy "own documents" on public.documents for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
