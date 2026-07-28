create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  type text not null check (type in ('feedback', 'alert', 'order')),
  data jsonb not null,
  analysis text not null check (char_length(trim(analysis)) > 0)
);

create index if not exists webhook_events_created_at_idx
  on public.webhook_events (created_at desc);

alter table public.webhook_events enable row level security;

-- Endpoint zapisuje rekordy kluczem service-role, który omija RLS.
-- Brak polityk celowo blokuje bezpośredni dostęp przez klucz anon.
