alter table public.companies
  add column if not exists cnrc_key text,
  add column if not exists id_commercant text,
  add column if not exists details jsonb not null default '{}'::jsonb,
  add column if not exists details_checked_at timestamp with time zone,
  add column if not exists has_secondaires boolean not null default false,
  add column if not exists annexes jsonb not null default '[]'::jsonb,
  add column if not exists annexes_checked_at timestamp with time zone,
  add column if not exists updated_at timestamp with time zone not null default now();

update public.companies
set cnrc_key = upper(coalesce(nrc1, '') || coalesce(nrc2, '') || coalesce(nrc3, '') || coalesce(nrc4, '') || coalesce(nrc5, ''))
where cnrc_key is null;

create unique index if not exists companies_cnrc_key_uidx on public.companies (cnrc_key);
create index if not exists companies_updated_at_idx on public.companies (updated_at desc);
