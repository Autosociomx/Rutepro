-- ════════════════════════════════════════════════════════════════════
-- RutePro · Panadería — esquema inicial (Supabase / Postgres)
-- ════════════════════════════════════════════════════════════════════
-- Cada "colección" de la app es una tabla con el documento completo en
-- jsonb, más columnas derivadas (ts, vendedor_id) que el trigger mantiene
-- al día para poder ordenar y filtrar con índices de verdad.
--
-- Lo que la versión anterior hacía con reglas de seguridad, aquí lo hace
-- la base: los montos imposibles los rechaza un CHECK, y ningún borrado
-- de dinero se pierde porque queda copiado en `bitacora_borrados`.

-- ─── Utilidades ─────────────────────────────────────────────────────

create or replace function public.rp_sync_cols()
returns trigger
language plpgsql
as $$
begin
  new.ts := case
    when jsonb_typeof(new.data->'timestamp') = 'number'
      then floor((new.data->>'timestamp')::numeric)::bigint
    else null
  end;
  new.vendedor_id := nullif(new.data->>'vendedorId', '');
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.rp_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Bitácora de borrados: pista de auditoría que sobrevive al botón
-- "Limpiar todo" del panel. Sólo la escribe el trigger.
create table if not exists public.bitacora_borrados (
  id           bigserial primary key,
  tabla        text        not null,
  doc_id       text        not null,
  data         jsonb       not null,
  borrado_por  uuid,
  borrado_en   timestamptz not null default now()
);

create index if not exists bitacora_borrados_tabla_idx on public.bitacora_borrados (tabla, borrado_en desc);

create or replace function public.rp_registrar_borrado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.bitacora_borrados (tabla, doc_id, data, borrado_por)
  values (tg_table_name, old.id, old.data, auth.uid());
  return old;
end;
$$;

-- ─── Configuración del negocio ──────────────────────────────────────

create table if not exists public.config (
  id         text primary key,
  data       jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint config_nombre_ck check (
    data->>'nombre' is null or length(data->>'nombre') <= 100
  ),
  constraint config_color_ck check (
    data->>'color_principal' is null
    or data->>'color_principal' ~ '^#[A-Fa-f0-9]{3}([A-Fa-f0-9]{3})?$'
  ),
  constraint config_listas_ck check (
    (data->'productos'  is null or jsonb_typeof(data->'productos')  = 'array') and
    (data->'vendedores' is null or jsonb_typeof(data->'vendedores') = 'array')
  )
);

drop trigger if exists config_touch on public.config;
create trigger config_touch before insert or update on public.config
  for each row execute function public.rp_touch();

-- ─── Ventas ─────────────────────────────────────────────────────────

create table if not exists public.ventas (
  id          text primary key,
  data        jsonb       not null default '{}'::jsonb,
  ts          bigint,
  vendedor_id text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Montos en centavos: no negativos y con techo sano ($1,000,000.00).
  constraint ventas_monto_ck check (
    data->'monto' is null or (
      jsonb_typeof(data->'monto') = 'number'
      and (data->>'monto')::numeric >= 0
      and (data->>'monto')::numeric <= 100000000
    )
  ),
  constraint ventas_items_ck check (
    data->'items' is null or jsonb_typeof(data->'items') = 'array'
  ),
  constraint ventas_tipo_cobro_ck check (
    data->>'tipoCobro' is null
    or data->>'tipoCobro' in ('efectivo', 'crédito', 'credito')
  )
);

create index if not exists ventas_ts_idx       on public.ventas (ts desc);
create index if not exists ventas_vendedor_idx on public.ventas (vendedor_id, ts desc);

drop trigger if exists ventas_sync on public.ventas;
create trigger ventas_sync before insert or update on public.ventas
  for each row execute function public.rp_sync_cols();

drop trigger if exists ventas_bitacora on public.ventas;
create trigger ventas_bitacora before delete on public.ventas
  for each row execute function public.rp_registrar_borrado();

-- ─── Devoluciones / mermas ──────────────────────────────────────────

create table if not exists public.devoluciones (
  id          text primary key,
  data        jsonb       not null default '{}'::jsonb,
  ts          bigint,
  vendedor_id text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint devoluciones_cantidad_ck check (
    data->'cantidad' is null or (
      jsonb_typeof(data->'cantidad') = 'number'
      and (data->>'cantidad')::numeric >= 0
      and (data->>'cantidad')::numeric <= 1000000
    )
  )
);

create index if not exists devoluciones_ts_idx on public.devoluciones (ts desc);

drop trigger if exists devoluciones_sync on public.devoluciones;
create trigger devoluciones_sync before insert or update on public.devoluciones
  for each row execute function public.rp_sync_cols();

drop trigger if exists devoluciones_bitacora on public.devoluciones;
create trigger devoluciones_bitacora before delete on public.devoluciones
  for each row execute function public.rp_registrar_borrado();

-- ─── Clientes ───────────────────────────────────────────────────────

create table if not exists public.clientes (
  id          text primary key,
  data        jsonb       not null default '{}'::jsonb,
  ts          bigint,
  vendedor_id text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint clientes_nombre_ck check (
    data->>'nombre' is null or length(data->>'nombre') between 1 and 160
  )
);

create index if not exists clientes_vendedor_idx on public.clientes (vendedor_id);

drop trigger if exists clientes_sync on public.clientes;
create trigger clientes_sync before insert or update on public.clientes
  for each row execute function public.rp_sync_cols();

drop trigger if exists clientes_bitacora on public.clientes;
create trigger clientes_bitacora before delete on public.clientes
  for each row execute function public.rp_registrar_borrado();

-- ─── Abonos (pagos a crédito) ───────────────────────────────────────

create table if not exists public.abonos (
  id          text primary key,
  data        jsonb       not null default '{}'::jsonb,
  ts          bigint,
  vendedor_id text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint abonos_monto_ck check (
    data->'monto' is null or (
      jsonb_typeof(data->'monto') = 'number'
      and (data->>'monto')::numeric > 0
      and (data->>'monto')::numeric <= 100000000
    )
  )
);

create index if not exists abonos_ts_idx on public.abonos (ts desc);

drop trigger if exists abonos_sync on public.abonos;
create trigger abonos_sync before insert or update on public.abonos
  for each row execute function public.rp_sync_cols();

drop trigger if exists abonos_bitacora on public.abonos;
create trigger abonos_bitacora before delete on public.abonos
  for each row execute function public.rp_registrar_borrado();

-- ─── Auditorías de ruta (mystery shop) ──────────────────────────────

create table if not exists public.mystery_audits (
  id          text primary key,
  data        jsonb       not null default '{}'::jsonb,
  ts          bigint,
  vendedor_id text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint mystery_calificacion_ck check (
    data->'calificacion' is null or (
      jsonb_typeof(data->'calificacion') = 'number'
      and (data->>'calificacion')::numeric between 0 and 100
    )
  )
);

create index if not exists mystery_audits_ts_idx on public.mystery_audits (ts desc);

drop trigger if exists mystery_audits_sync on public.mystery_audits;
create trigger mystery_audits_sync before insert or update on public.mystery_audits
  for each row execute function public.rp_sync_cols();

drop trigger if exists mystery_audits_bitacora on public.mystery_audits;
create trigger mystery_audits_bitacora before delete on public.mystery_audits
  for each row execute function public.rp_registrar_borrado();

-- ─── Seguridad a nivel de fila ──────────────────────────────────────
-- A diferencia de la plantilla anterior, NADA es público: sin sesión no
-- se lee ni un renglón. La app abre sesión (anónima) al arrancar.

alter table public.config            enable row level security;
alter table public.ventas            enable row level security;
alter table public.devoluciones      enable row level security;
alter table public.clientes          enable row level security;
alter table public.abonos            enable row level security;
alter table public.mystery_audits    enable row level security;
alter table public.bitacora_borrados enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['config','ventas','devoluciones','clientes','abonos','mystery_audits']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);

    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (true)', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (true) with check (true)', t || '_update', t);
    -- El borrado queda abierto porque el botón "Limpiar todo" del panel corre
    -- desde el navegador; la bitácora conserva la copia de lo borrado.
    execute format('create policy %I on public.%I for delete to authenticated using (true)', t || '_delete', t);
  end loop;
end
$$;

-- La bitácora se lee, no se toca: sólo el trigger (security definer) escribe.
drop policy if exists bitacora_select on public.bitacora_borrados;
create policy bitacora_select on public.bitacora_borrados
  for select to authenticated using (true);

-- ─── Tiempo real ────────────────────────────────────────────────────

do $$
declare
  t text;
begin
  foreach t in array array['config','ventas','devoluciones','clientes','abonos','mystery_audits']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;
      when undefined_object then null;
    end;
  end loop;
end
$$;

-- ─── Vistas de reporte (para el dueño y para exportar a Excel) ──────

create or replace view public.v_ventas as
select
  v.id,
  to_timestamp(v.ts / 1000.0)                    as fecha,
  v.data->>'vendedorNombre'                      as vendedor,
  v.data->>'clienteNombre'                       as cliente,
  v.data->>'tipoCobro'                           as tipo_cobro,
  ((v.data->>'monto')::numeric / 100.0)          as monto_pesos,
  jsonb_array_length(coalesce(v.data->'items', '[]'::jsonb)) as renglones
from public.ventas v;

create or replace view public.v_corte_diario as
select
  (to_timestamp(v.ts / 1000.0) at time zone 'America/Mexico_City')::date as dia,
  v.data->>'vendedorNombre'                                    as vendedor,
  count(*)                                                     as tickets,
  sum((v.data->>'monto')::numeric) / 100.0                     as total_pesos,
  sum(case when v.data->>'tipoCobro' = 'efectivo'
           then (v.data->>'monto')::numeric else 0 end) / 100.0 as efectivo_pesos
from public.ventas v
where v.ts is not null
group by 1, 2
order by 1 desc, 2;
