create table if not exists public.sidjilcom_detail_imports (
  id uuid primary key default gen_random_uuid(),
  rc text,
  merchant jsonb not null default '{}'::jsonb,
  activities jsonb not null default '[]'::jsonb,
  modifications jsonb not null default '[]'::jsonb,
  raw_fields jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create index if not exists sidjilcom_detail_imports_rc_idx on public.sidjilcom_detail_imports (rc);
create index if not exists sidjilcom_detail_imports_created_at_idx on public.sidjilcom_detail_imports (created_at desc);
