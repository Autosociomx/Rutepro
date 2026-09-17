-- ════════════════════════════════════════════════════════════════════
-- RutePro · Panadería — endurecimiento (hallazgos del linter de Supabase)
-- ════════════════════════════════════════════════════════════════════

-- Las vistas de reporte deben respetar la RLS de quien consulta, no la de
-- quien las creó (si no, cualquiera con sesión vería todo a través de ellas).
alter view public.v_ventas       set (security_invoker = on);
alter view public.v_corte_diario set (security_invoker = on);

-- search_path fijo: evita que un esquema en la ruta de búsqueda secuestre
-- las funciones que usan los triggers.
alter function public.rp_sync_cols()         set search_path = '';
alter function public.rp_touch()             set search_path = '';
alter function public.rp_registrar_borrado() set search_path = public;

-- Las funciones de trigger no tienen por qué ser invocables como RPC desde
-- la API pública. Los triggers siguen disparando igual.
revoke execute on function public.rp_sync_cols()         from anon, authenticated, public;
revoke execute on function public.rp_touch()             from anon, authenticated, public;
revoke execute on function public.rp_registrar_borrado() from anon, authenticated, public;
