alter table public.companies
  add column if not exists merchant jsonb not null default '{}'::jsonb,
  add column if not exists activities jsonb not null default '[]'::jsonb,
  add column if not exists modifications jsonb not null default '[]'::jsonb;
