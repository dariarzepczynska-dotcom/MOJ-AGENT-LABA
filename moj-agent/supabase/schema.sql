-- Supabase schema for Moj Agent.
-- Run this file in Supabase SQL Editor.
--
-- The app currently uses a browser anon client and a locally generated
-- user_profiles.id from localStorage, not Supabase Auth. RLS is disabled for
-- the workshop/local setup. Enable and tighten policies when real auth is added.

create extension if not exists pgcrypto;
create extension if not exists vector;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.user_profiles (
  id uuid primary key,
  name text,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.user_profiles(id) on delete set null,
  title text not null default 'Nowa rozmowa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  embedding vector(768) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists documents_title_idx on public.documents (title);

create or replace function public.match_documents(
  query_embedding vector(768),
  match_threshold float default 0.7,
  match_count int default 5
)
returns table (
  id uuid,
  title text,
  content text,
  metadata jsonb,
  similarity float
)
language sql
stable
as $$
  select
    documents.id,
    documents.title,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from public.documents
  where 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by documents.embedding <=> query_embedding
  limit match_count;
$$;

create index if not exists conversations_updated_at_idx
  on public.conversations (updated_at desc);

create index if not exists conversations_user_id_updated_at_idx
  on public.conversations (user_id, updated_at desc);

create index if not exists messages_conversation_id_created_at_idx
  on public.messages (conversation_id, created_at asc);

create index if not exists messages_content_search_idx
  on public.messages using gin (to_tsvector('simple', content));

drop trigger if exists set_user_profiles_updated_at on public.user_profiles;
create trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_conversations_updated_at on public.conversations;
create trigger set_conversations_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

alter table public.user_profiles disable row level security;
alter table public.conversations disable row level security;
alter table public.messages disable row level security;
alter table public.documents disable row level security;

-- Optional stricter policy direction for later Supabase Auth:
-- 1. Store auth.uid() in conversations.user_id.
-- 2. Enable RLS and add authenticated-only policies:
--    using (user_id = auth.uid()) / with check (user_id = auth.uid()).
-- 3. For messages, authorize through the parent conversation:
--    exists (
--      select 1 from public.conversations c
--      where c.id = messages.conversation_id
--        and c.user_id = auth.uid()
--    )
