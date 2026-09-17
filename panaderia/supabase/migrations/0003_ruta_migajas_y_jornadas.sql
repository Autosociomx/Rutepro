-- ════════════════════════════════════════════════════════════════════
-- RutePro · Ruta de bolillo: migajas, jornadas y consultas para el bot
-- ════════════════════════════════════════════════════════════════════
-- Tres cosas nuevas:
--   1. `jornadas`  — lo que carga el repartidor en la mañana y su cierre.
--   2. `recorrido` — las migajas de GPS que va dejando durante la ruta.
--   3. Vistas que responden de una sola consulta lo que el dueño va a
--      preguntarle al bot de Telegram: cuánto lleva vendido cada repartidor
--      y dónde fue su última venta.

-- ─── Columnas derivadas con ubicación ───────────────────────────────

create or replace function public.rp_sync_cols_geo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.ts := case
    when jsonb_typeof(new.data->'timestamp') = 'number'
      then floor((new.data->>'timestamp')::numeric)::bigint
    else null
  end;
  new.vendedor_id := nullif(new.data->>'vendedorId', '');
  new.lat := case when jsonb_typeof(new.data->'lat') = 'number' then (new.data->>'lat')::double precision else null end;
  new.lng := case when jsonb_typeof(new.data->'lng') = 'number' then (new.data->>'lng')::double precision else null end;
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.rp_sync_cols_geo() from anon, authenticated, public;

-- ─── Las ventas ahora pueden traer dónde ocurrieron ─────────────────

alter table public.ventas add column if not exists lat double precision;
alter table public.ventas add column if not exists lng double precision;

drop trigger if exists ventas_sync on public.ventas;
create trigger ventas_sync before insert or update on public.ventas
  for each row execute function public.rp_sync_cols_geo();

create index if not exists ventas_geo_idx on public.ventas (vendedor_id, ts desc) where lat is not null;

-- ─── Jornadas: la carga de la mañana y el cuadre del día ────────────

create table if not exists public.jornadas (
  id          text primary key,
  data        jsonb       not null default '{}'::jsonb,
  ts          bigint,
  vendedor_id text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint jornadas_piezas_ck check (
    data->'piezasCargadas' is null or (
      jsonb_typeof(data->'piezasCargadas') = 'number'
      and (data->>'piezasCargadas')::numeric >= 0
      and (data->>'piezasCargadas')::numeric <= 1000000
    )
  ),
  constraint jornadas_estado_ck check (
    data->>'estado' is null or data->>'estado' in ('activa', 'cerrada')
  )
);

create index if not exists jornadas_vendedor_idx on public.jornadas (vendedor_id, ts desc);
create index if not exists jornadas_fecha_idx on public.jornadas ((data->>'fecha'));

drop trigger if exists jornadas_sync on public.jornadas;
create trigger jornadas_sync before insert or update on public.jornadas
  for each row execute function public.rp_sync_cols();

drop trigger if exists jornadas_bitacora on public.jornadas;
create trigger jornadas_bitacora before delete on public.jornadas
  for each row execute function public.rp_registrar_borrado();

-- ─── Recorrido: las migajas de la ruta ──────────────────────────────

create table if not exists public.recorrido (
  id          text primary key,
  data        jsonb       not null default '{}'::jsonb,
  ts          bigint,
  vendedor_id text,
  lat         double precision,
  lng         double precision,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint recorrido_lat_ck check (
    data->'lat' is null or (jsonb_typeof(data->'lat') = 'number' and (data->>'lat')::numeric between -90 and 90)
  ),
  constraint recorrido_lng_ck check (
    data->'lng' is null or (jsonb_typeof(data->'lng') = 'number' and (data->>'lng')::numeric between -180 and 180)
  )
);

create index if not exists recorrido_vendedor_idx on public.recorrido (vendedor_id, ts desc);

drop trigger if exists recorrido_sync on public.recorrido;
create trigger recorrido_sync before insert or update on public.recorrido
  for each row execute function public.rp_sync_cols_geo();

-- ─── Seguridad ──────────────────────────────────────────────────────

alter table public.jornadas  enable row level security;
alter table public.recorrido enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['jornadas','recorrido']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);

    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (true)', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (true) with check (true)', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (true)', t || '_delete', t);
  end loop;
end
$$;

do $$
declare
  t text;
begin
  foreach t in array array['jornadas','recorrido']
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

-- ─── Consultas listas para el bot de Telegram ───────────────────────
-- Un renglón por repartidor con todo lo que el dueño suele preguntar.
-- El bot no necesita lógica: lee esta vista y contesta.

create or replace view public.v_ruta_hoy
with (security_invoker = on) as
with limites as (
  select
    (extract(epoch from date_trunc('day', now() at time zone 'America/Mexico_City')
             at time zone 'America/Mexico_City') * 1000)::bigint as desde
),
ventas_hoy as (
  select
    v.vendedor_id,
    max(v.data->>'vendedorNombre')                                     as vendedor,
    count(*)                                                           as ventas,
    sum(coalesce((v.data->>'monto')::numeric, 0)) / 100.0              as vendido_pesos,
    sum(case when v.data->>'tipoCobro' = 'efectivo'
             then coalesce((v.data->>'monto')::numeric, 0) else 0 end) / 100.0 as efectivo_pesos,
    sum((
      select coalesce(sum((it->>'q')::numeric), 0)
      from jsonb_array_elements(coalesce(v.data->'items', '[]'::jsonb)) it
    ))                                                                 as piezas_vendidas,
    max(v.ts)                                                          as ultima_venta_ts
  from public.ventas v, limites l
  where v.ts >= l.desde
  group by v.vendedor_id
),
ultima_venta as (
  select distinct on (v.vendedor_id)
    v.vendedor_id, v.ts, v.lat, v.lng, v.data->>'clienteNombre' as cliente,
    coalesce((v.data->>'monto')::numeric, 0) / 100.0 as monto_pesos
  from public.ventas v, limites l
  where v.ts >= l.desde
  order by v.vendedor_id, v.ts desc
),
ultima_posicion as (
  select distinct on (r.vendedor_id)
    r.vendedor_id, r.ts, r.lat, r.lng
  from public.recorrido r
  order by r.vendedor_id, r.ts desc
),
jornada_hoy as (
  select distinct on (j.vendedor_id)
    j.vendedor_id,
    j.data->>'vendedorNombre'                          as vendedor,
    coalesce((j.data->>'piezasCargadas')::numeric, 0)  as piezas_cargadas,
    j.data->>'estado'                                  as estado
  from public.jornadas j
  where j.data->>'fecha' = to_char(now() at time zone 'America/Mexico_City', 'YYYY-MM-DD')
  order by j.vendedor_id, j.ts desc
)
-- Se arma primero la lista de repartidores que aparecen en cualquiera de las
-- tres fuentes, y luego se les pega lo demás: evita las uniones externas
-- completas encadenadas, que Postgres no siempre puede resolver.
quienes as (
  select vendedor_id from jornada_hoy
  union
  select vendedor_id from ventas_hoy
  union
  select vendedor_id from ultima_posicion
)
select
  q.vendedor_id,
  coalesce(jh.vendedor, vh.vendedor)                                as vendedor,
  coalesce(jh.estado, 'sin jornada')                                as estado,
  coalesce(jh.piezas_cargadas, 0)                                   as piezas_cargadas,
  coalesce(vh.piezas_vendidas, 0)                                   as piezas_vendidas,
  greatest(coalesce(jh.piezas_cargadas, 0) - coalesce(vh.piezas_vendidas, 0), 0) as piezas_restantes,
  coalesce(vh.ventas, 0)                                            as ventas,
  coalesce(vh.vendido_pesos, 0)                                     as vendido_pesos,
  coalesce(vh.efectivo_pesos, 0)                                    as efectivo_pesos,
  to_timestamp(uv.ts / 1000.0) at time zone 'America/Mexico_City'   as ultima_venta_hora,
  uv.monto_pesos                                                    as ultima_venta_pesos,
  uv.cliente                                                        as ultima_venta_cliente,
  uv.lat                                                            as ultima_venta_lat,
  uv.lng                                                            as ultima_venta_lng,
  case when uv.lat is not null
       then 'https://maps.google.com/?q=' || uv.lat || ',' || uv.lng end as ultima_venta_mapa,
  to_timestamp(up.ts / 1000.0) at time zone 'America/Mexico_City'   as ultima_posicion_hora,
  case when up.lat is not null
       then 'https://maps.google.com/?q=' || up.lat || ',' || up.lng end as ultima_posicion_mapa,
  case when up.ts is not null
       then floor((extract(epoch from now()) - up.ts / 1000.0) / 60)::int end as minutos_sin_reportar
from quienes q
left join jornada_hoy     jh on jh.vendedor_id = q.vendedor_id
left join ventas_hoy      vh on vh.vendedor_id = q.vendedor_id
left join ultima_venta    uv on uv.vendedor_id = q.vendedor_id
left join ultima_posicion up on up.vendedor_id = q.vendedor_id;

-- El camino completo de un repartidor en un día, en orden, para dibujarlo.
create or replace view public.v_recorrido
with (security_invoker = on) as
select
  r.vendedor_id,
  r.data->>'vendedorNombre'                                        as vendedor,
  (to_timestamp(r.ts / 1000.0) at time zone 'America/Mexico_City')::date as dia,
  to_timestamp(r.ts / 1000.0) at time zone 'America/Mexico_City'   as hora,
  r.lat,
  r.lng,
  coalesce((r.data->>'precision')::numeric, 0)                     as precision_metros
from public.recorrido r
where r.lat is not null
order by r.vendedor_id, r.ts;
