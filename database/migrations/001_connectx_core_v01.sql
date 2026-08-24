-- ConnectX Negocio OS v0.1
-- Private application schema. The browser must not write directly to these tables.
-- All mutations go through the authenticated API, carrying tenant/business context
-- plus an idempotency key for offline-safe replay.

create schema if not exists cx;

revoke all on schema cx from public;
revoke all on schema cx from anon;
revoke all on schema cx from authenticated;

create table if not exists cx.tenants (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists cx.businesses (
  id text primary key,
  tenant_id text not null references cx.tenants(id) on delete cascade,
  name text not null,
  slug text not null,
  vertical text not null,
  currency text not null default 'MXN',
  timezone text not null default 'America/Mazatlan',
  config_version integer not null default 1 check (config_version > 0),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create table if not exists cx.locations (
  id text primary key,
  business_id text not null references cx.businesses(id) on delete cascade,
  name text not null,
  type text not null check (type in ('store','kitchen','warehouse','branch','other')),
  address text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists cx.memberships (
  id text primary key,
  tenant_id text not null references cx.tenants(id) on delete cascade,
  business_id text not null references cx.businesses(id) on delete cascade,
  user_id text not null,
  role text not null,
  permissions jsonb not null default '[]'::jsonb,
  location_ids jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create table if not exists cx.products (
  id text primary key,
  business_id text not null references cx.businesses(id) on delete cascade,
  category_id text,
  name text not null,
  sku text,
  unit text not null,
  price_cents bigint not null check (price_cents >= 0),
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cx.customers (
  id text primary key,
  business_id text not null references cx.businesses(id) on delete cascade,
  name text not null,
  phone text,
  address text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  route_id text,
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists cx.inventory_movements (
  id text primary key,
  business_id text not null references cx.businesses(id) on delete cascade,
  location_id text references cx.locations(id) on delete set null,
  product_id text not null references cx.products(id) on delete restrict,
  movement_type text not null check (movement_type in ('PURCHASE','PRODUCTION','LOAD','TRANSFER','SALE','RETURN','WASTE','ADJUSTMENT')),
  quantity numeric(18,4) not null,
  unit text not null,
  reference_type text,
  reference_id text,
  actor_id text,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists cx.routes (
  id text primary key,
  business_id text not null references cx.businesses(id) on delete cascade,
  name text not null,
  driver_id text,
  vehicle_id text,
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists cx.route_runs (
  id text primary key,
  tenant_id text not null references cx.tenants(id) on delete cascade,
  business_id text not null references cx.businesses(id) on delete cascade,
  route_id text not null references cx.routes(id) on delete restrict,
  driver_id text not null,
  vehicle_id text,
  status text not null check (status in ('planned','active','closed','cancelled')),
  started_at timestamptz not null,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists cx.route_loads (
  id text primary key,
  run_id text not null references cx.route_runs(id) on delete cascade,
  authorized_by text,
  authorized_at timestamptz,
  created_at timestamptz not null default now(),
  unique (run_id)
);

create table if not exists cx.route_load_items (
  load_id text not null references cx.route_loads(id) on delete cascade,
  product_id text not null references cx.products(id) on delete restrict,
  quantity numeric(18,4) not null check (quantity >= 0),
  unit text not null,
  primary key (load_id, product_id)
);

create table if not exists cx.route_stops (
  id text primary key,
  run_id text not null references cx.route_runs(id) on delete cascade,
  customer_id text not null references cx.customers(id) on delete restrict,
  outcome text not null check (outcome in ('sale','no_sale','closed','skipped')),
  latitude numeric(9,6),
  longitude numeric(9,6),
  visited_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists cx.sales (
  id text primary key,
  tenant_id text not null references cx.tenants(id) on delete cascade,
  business_id text not null references cx.businesses(id) on delete cascade,
  source text not null check (source in ('route','local','web','manual')),
  source_ref_id text,
  customer_id text references cx.customers(id) on delete set null,
  total_cents bigint not null check (total_cents >= 0),
  currency text not null default 'MXN',
  status text not null default 'completed' check (status in ('pending','completed','cancelled','refunded')),
  created_by text,
  created_at timestamptz not null,
  unique (business_id, id)
);

create table if not exists cx.sale_items (
  id text primary key,
  sale_id text not null references cx.sales(id) on delete cascade,
  product_id text not null references cx.products(id) on delete restrict,
  quantity numeric(18,4) not null check (quantity >= 0),
  returned_quantity numeric(18,4) not null default 0 check (returned_quantity >= 0),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  metadata jsonb not null default '{}'::jsonb,
  check (returned_quantity <= quantity)
);

create table if not exists cx.payments (
  id text primary key,
  business_id text not null references cx.businesses(id) on delete cascade,
  sale_id text not null references cx.sales(id) on delete cascade,
  method text not null check (method in ('cash','card','transfer','wallet','credit')),
  amount_cents bigint not null check (amount_cents >= 0),
  currency text not null default 'MXN',
  received_by text,
  external_reference text,
  created_at timestamptz not null
);

create table if not exists cx.credit_accounts (
  id text primary key,
  business_id text not null references cx.businesses(id) on delete cascade,
  customer_id text not null references cx.customers(id) on delete restrict,
  status text not null default 'open' check (status in ('open','closed','blocked')),
  created_at timestamptz not null default now(),
  unique (business_id, customer_id)
);

create table if not exists cx.credit_movements (
  id text primary key,
  account_id text not null references cx.credit_accounts(id) on delete cascade,
  sale_id text references cx.sales(id) on delete set null,
  type text not null check (type in ('CHARGE','PAYMENT','ADJUSTMENT')),
  amount_cents bigint not null,
  currency text not null default 'MXN',
  actor_id text,
  occurred_at timestamptz not null,
  note text
);

create table if not exists cx.route_closes (
  run_id text primary key references cx.route_runs(id) on delete cascade,
  gross_sales_cents bigint not null,
  cash_expected_cents bigint not null,
  cash_delivered_cents bigint not null,
  credit_created_cents bigint not null,
  returns_value_cents bigint not null,
  expenses_cents bigint not null,
  difference_cents bigint not null,
  closed_by text not null,
  closed_at timestamptz not null
);

create table if not exists cx.local_orders (
  id text primary key,
  tenant_id text not null references cx.tenants(id) on delete cascade,
  business_id text not null references cx.businesses(id) on delete cascade,
  location_id text not null references cx.locations(id) on delete restrict,
  table_label text,
  waiter_id text,
  customer_id text references cx.customers(id) on delete set null,
  status text not null check (status in ('draft','sent','preparing','ready','delivered','paid','cancelled')),
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists cx.local_order_items (
  id text primary key,
  order_id text not null references cx.local_orders(id) on delete cascade,
  product_id text not null references cx.products(id) on delete restrict,
  quantity numeric(18,4) not null check (quantity > 0),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  station_id text not null,
  person_label text,
  notes text,
  modifiers jsonb not null default '[]'::jsonb
);

create table if not exists cx.production_tasks (
  id text primary key,
  order_id text not null references cx.local_orders(id) on delete cascade,
  station_id text not null,
  item_ids jsonb not null default '[]'::jsonb,
  status text not null check (status in ('pending','preparing','ready','delivered','cancelled')),
  started_at timestamptz,
  completed_at timestamptz
);

create table if not exists cx.print_jobs (
  id text primary key,
  business_id text not null references cx.businesses(id) on delete cascade,
  printer_id text not null,
  order_id text not null references cx.local_orders(id) on delete cascade,
  template text not null check (template in ('production','account','receipt')),
  status text not null check (status in ('pending','printing','printed','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  created_at timestamptz not null,
  printed_at timestamptz,
  last_error text
);

create table if not exists cx.domain_events (
  id text primary key,
  tenant_id text not null,
  business_id text not null,
  aggregate_type text not null,
  aggregate_id text not null,
  event_type text not null,
  actor_id text,
  device_id text,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now()
);

create table if not exists cx.idempotency_keys (
  business_id text not null references cx.businesses(id) on delete cascade,
  key text not null,
  command_type text not null,
  result_ref_id text,
  created_at timestamptz not null default now(),
  primary key (business_id, key)
);

create index if not exists idx_products_business on cx.products(business_id) where active;
create index if not exists idx_customers_business_route on cx.customers(business_id, route_id) where active;
create index if not exists idx_route_runs_business_started on cx.route_runs(business_id, started_at desc);
create index if not exists idx_sales_business_created on cx.sales(business_id, created_at desc);
create index if not exists idx_local_orders_business_created on cx.local_orders(business_id, created_at desc);
create index if not exists idx_events_business_time on cx.domain_events(business_id, occurred_at desc);
create index if not exists idx_inventory_product_time on cx.inventory_movements(business_id, product_id, occurred_at desc);

comment on schema cx is 'Private ConnectX Negocio OS application schema. Access through authenticated application API only.';
