-- ConnectX Negocio OS v0.1
-- Target schema only. Do not apply to existing production projects without data-migration review.

create extension if not exists pgcrypto;

create table if not exists public.cx_businesses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  name text not null,
  slug text not null,
  vertical text not null,
  currency text not null default 'MXN',
  timezone text not null default 'America/Mazatlan',
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create table if not exists public.cx_locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  business_id uuid not null references public.cx_businesses(id) on delete cascade,
  name text not null,
  type text not null check (type in ('store','kitchen','warehouse','branch','other')),
  address text,
  latitude numeric,
  longitude numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.cx_products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  business_id uuid not null references public.cx_businesses(id) on delete cascade,
  category_id uuid,
  name text not null,
  sku text,
  unit text not null,
  price_cents bigint not null check (price_cents >= 0),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cx_customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  business_id uuid not null references public.cx_businesses(id) on delete cascade,
  name text not null,
  phone text,
  address text,
  latitude numeric,
  longitude numeric,
  route_id uuid,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cx_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  tenant_id uuid not null,
  business_id uuid not null references public.cx_businesses(id) on delete cascade,
  location_id uuid,
  actor_id uuid,
  device_id text,
  event_type text not null,
  idempotency_key text,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now()
);

create unique index if not exists cx_events_business_idempotency_uidx
  on public.cx_events (business_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists cx_products_business_idx on public.cx_products (business_id, active);
create index if not exists cx_customers_business_idx on public.cx_customers (business_id, active);
create index if not exists cx_events_business_time_idx on public.cx_events (business_id, occurred_at desc);
create index if not exists cx_events_type_time_idx on public.cx_events (event_type, occurred_at desc);

-- Exposed-schema tables must never be left without RLS.
alter table public.cx_businesses enable row level security;
alter table public.cx_locations enable row level security;
alter table public.cx_products enable row level security;
alter table public.cx_customers enable row level security;
alter table public.cx_events enable row level security;

-- Policies are intentionally NOT added in v0.1. Until memberships/auth mapping is
-- implemented, Data API access should remain denied by default rather than expose
-- cross-business data through permissive temporary policies.
