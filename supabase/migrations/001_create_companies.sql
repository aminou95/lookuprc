create extension if not exists "pgcrypto";

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  nrc1 text not null,
  nrc2 text not null,
  nrc3 text not null,
  nrc4 text not null,
  nrc5 text not null,
  rc text,
  nom text,
  prenom text,
  adresse text,
  statut text,
  merchant jsonb not null default '{}'::jsonb,
  activities jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone not null default now()
);

create index if not exists companies_created_at_idx on public.companies (created_at desc);
create index if not exists companies_rc_idx on public.companies (rc);
