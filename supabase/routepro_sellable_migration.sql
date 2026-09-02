-- =====================================================================
-- ROUTEPRO MIGRATION CANDIDATE — PENDING EXECUTION, ADVISORS AND TESTS
-- BLOQUE 2C-2: APLICACIONES DE ABONO, VALIDACIONES ENUM/ROW_COUNT Y CORTES IDEMPOTENTES
-- =====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABLAS BASE
-- 2.1 Rp Negocios
CREATE TABLE IF NOT EXISTS public.rp_negocios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  letra VARCHAR(5) DEFAULT 'R',
  subtitulo TEXT DEFAULT '',
  color_principal VARCHAR(20) DEFAULT '#C9912A',
  logo_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ajustes de marca y plantilla del negocio (vendedores/etiquetas de ruta) que no
-- tienen tabla propia. El catálogo real vive en rp_productos, nunca aquí.
ALTER TABLE public.rp_negocios ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2.2 Rp Memberships (FK a auth.users(id))
CREATE TABLE IF NOT EXISTS public.rp_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  negocio_id UUID NOT NULL REFERENCES public.rp_negocios(id) ON DELETE CASCADE,
  rol TEXT NOT NULL CHECK (rol IN ('dueño', 'admin', 'mostrador', 'repartidor')),
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rp_memberships_user_negocio_uniq UNIQUE (user_id, negocio_id)
);

-- 2.3 Rp Productos (con legacy_id y restricciones UNIQUE por negocio)
CREATE TABLE IF NOT EXISTS public.rp_productos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.rp_negocios(id) ON DELETE CASCADE,
  codigo TEXT,
  legacy_id TEXT,
  nombre TEXT NOT NULL,
  precio_centavos INTEGER NOT NULL CHECK (precio_centavos >= 0),
  costo_centavos INTEGER DEFAULT 0 CHECK (costo_centavos >= 0),
  stock_actual NUMERIC NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
  icono TEXT DEFAULT '📦',
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rp_productos_negocio_codigo_uniq'
  ) THEN
    ALTER TABLE public.rp_productos ADD CONSTRAINT rp_productos_negocio_codigo_uniq UNIQUE (negocio_id, codigo);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rp_productos_negocio_legacy_uniq'
  ) THEN
    ALTER TABLE public.rp_productos ADD CONSTRAINT rp_productos_negocio_legacy_uniq UNIQUE (negocio_id, legacy_id);
  END IF;
END $$;

-- 2.4 Rp Clientes (con legacy_id y restricción UNIQUE por negocio)
CREATE TABLE IF NOT EXISTS public.rp_clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.rp_negocios(id) ON DELETE CASCADE,
  legacy_id TEXT,
  nombre TEXT NOT NULL,
  tipo TEXT DEFAULT 'Tiendita',
  direccion TEXT DEFAULT '',
  telefono TEXT DEFAULT '',
  vendedor_id UUID,
  vendedor_nombre TEXT DEFAULT '',
  lat NUMERIC,
  lng NUMERIC,
  saldo_fiado_centavos INTEGER NOT NULL DEFAULT 0 CHECK (saldo_fiado_centavos >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rp_clientes_negocio_legacy_uniq'
  ) THEN
    ALTER TABLE public.rp_clientes ADD CONSTRAINT rp_clientes_negocio_legacy_uniq UNIQUE (negocio_id, legacy_id);
  END IF;
END $$;

-- 2.5 Rp Rutas
CREATE TABLE IF NOT EXISTS public.rp_rutas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.rp_negocios(id) ON DELETE CASCADE,
  repartidor_id UUID NOT NULL,
  repartidor_nombre TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'cerrada', 'en_proceso')),
  fecha_apertura TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_cierre TIMESTAMPTZ,
  total_ventas_efectivo_centavos INTEGER DEFAULT 0 CHECK (total_ventas_efectivo_centavos >= 0),
  total_ventas_credito_centavos INTEGER DEFAULT 0 CHECK (total_ventas_credito_centavos >= 0),
  total_mermas_centavos INTEGER DEFAULT 0 CHECK (total_mermas_centavos >= 0),
  total_abonos_centavos INTEGER DEFAULT 0 CHECK (total_abonos_centavos >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.6 Rp Cargas (Inventario a bordo)
CREATE TABLE IF NOT EXISTS public.rp_cargas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.rp_negocios(id) ON DELETE CASCADE,
  ruta_id UUID NOT NULL REFERENCES public.rp_rutas(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES public.rp_productos(id) ON DELETE RESTRICT,
  cantidad_cargada NUMERIC NOT NULL CHECK (cantidad_cargada >= 0),
  cantidad_vendida NUMERIC NOT NULL DEFAULT 0 CHECK (cantidad_vendida >= 0),
  cantidad_devuelta NUMERIC NOT NULL DEFAULT 0 CHECK (cantidad_devuelta >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rp_cargas_ruta_producto_uniq UNIQUE (ruta_id, producto_id)
);

-- 2.7 Rp Operaciones (Ventas / Mermas)
CREATE TABLE IF NOT EXISTS public.rp_operaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.rp_negocios(id) ON DELETE CASCADE,
  ruta_id UUID REFERENCES public.rp_rutas(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.rp_clientes(id) ON DELETE SET NULL,
  vendedor_id UUID,
  vendedor_nombre TEXT NOT NULL DEFAULT '',
  cliente_nombre TEXT NOT NULL DEFAULT '',
  tipo_operacion TEXT NOT NULL CHECK (tipo_operacion IN ('venta', 'merma', 'devolucion')),
  tipo_cobro TEXT NOT NULL CHECK (tipo_cobro IN ('efectivo', 'credito', 'gratis')),
  monto_total_centavos INTEGER NOT NULL CHECK (monto_total_centavos >= 0),
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rp_operaciones_idempotency_unique UNIQUE (negocio_id, idempotency_key)
);

-- 2.8 Rp Operacion Items
CREATE TABLE IF NOT EXISTS public.rp_operacion_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.rp_negocios(id) ON DELETE CASCADE,
  operacion_id UUID NOT NULL REFERENCES public.rp_operaciones(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES public.rp_productos(id) ON DELETE SET NULL,
  producto_nombre TEXT NOT NULL,
  cantidad NUMERIC NOT NULL CHECK (cantidad > 0),
  precio_unitario_centavos INTEGER NOT NULL CHECK (precio_unitario_centavos >= 0),
  subtotal_centavos INTEGER NOT NULL CHECK (subtotal_centavos >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.9 Rp Fiados (Deudas)
CREATE TABLE IF NOT EXISTS public.rp_fiados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.rp_negocios(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.rp_clientes(id) ON DELETE CASCADE,
  operacion_id UUID REFERENCES public.rp_operaciones(id) ON DELETE SET NULL,
  monto_original_centavos INTEGER NOT NULL CHECK (monto_original_centavos >= 0),
  saldo_pendiente_centavos INTEGER NOT NULL CHECK (saldo_pendiente_centavos >= 0),
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'parcial', 'pagado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.10 Rp Abonos (con idempotency_key obligatoria y unique por negocio)
CREATE TABLE IF NOT EXISTS public.rp_abonos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.rp_negocios(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.rp_clientes(id) ON DELETE CASCADE,
  fiado_id UUID REFERENCES public.rp_fiados(id) ON DELETE SET NULL,
  ruta_id UUID REFERENCES public.rp_rutas(id) ON DELETE SET NULL,
  monto_centavos INTEGER NOT NULL CHECK (monto_centavos > 0),
  recibido_por TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rp_abonos_idempotency_unique UNIQUE (negocio_id, idempotency_key)
);

-- 2.11 Rp Abono Aplicaciones (Relación N:M abonos -> fiados pagados)
CREATE TABLE IF NOT EXISTS public.rp_abono_aplicaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.rp_negocios(id) ON DELETE CASCADE,
  abono_id UUID NOT NULL REFERENCES public.rp_abonos(id) ON DELETE CASCADE,
  fiado_id UUID NOT NULL REFERENCES public.rp_fiados(id) ON DELETE CASCADE,
  monto_centavos INTEGER NOT NULL CHECK (monto_centavos > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rp_abono_aplicaciones_abono_fiado_uniq UNIQUE (abono_id, fiado_id)
);

-- 2.12 Rp Cortes (con UNIQUE en ruta_id)
CREATE TABLE IF NOT EXISTS public.rp_cortes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.rp_negocios(id) ON DELETE CASCADE,
  ruta_id UUID REFERENCES public.rp_rutas(id) ON DELETE SET NULL,
  usuario_id UUID NOT NULL,
  total_efectivo_esperado_centavos INTEGER NOT NULL DEFAULT 0 CHECK (total_efectivo_esperado_centavos >= 0),
  total_efectivo_entregado_centavos INTEGER NOT NULL DEFAULT 0 CHECK (total_efectivo_entregado_centavos >= 0),
  diferencia_centavos INTEGER NOT NULL DEFAULT 0,
  notas TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rp_cortes_ruta_uniq UNIQUE (ruta_id)
);

-- 2.13 Rp Audit Log
CREATE TABLE IF NOT EXISTS public.rp_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.rp_negocios(id) ON DELETE CASCADE,
  usuario_id UUID,
  accion TEXT NOT NULL,
  tabla_afectada TEXT NOT NULL,
  registro_id TEXT,
  detalles JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 3. INDICES PARA RENDIMIENTO
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_rp_memberships_user ON public.rp_memberships(user_id, activo);
CREATE INDEX IF NOT EXISTS idx_rp_memberships_negocio ON public.rp_memberships(negocio_id);
CREATE INDEX IF NOT EXISTS idx_rp_productos_negocio ON public.rp_productos(negocio_id, activo);
CREATE INDEX IF NOT EXISTS idx_rp_clientes_negocio ON public.rp_clientes(negocio_id, vendedor_id);
CREATE INDEX IF NOT EXISTS idx_rp_rutas_negocio_estado ON public.rp_rutas(negocio_id, estado, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rp_cargas_ruta ON public.rp_cargas(ruta_id);
CREATE INDEX IF NOT EXISTS idx_rp_operaciones_negocio_fecha ON public.rp_operaciones(negocio_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rp_operaciones_ruta ON public.rp_operaciones(ruta_id);
CREATE INDEX IF NOT EXISTS idx_rp_operacion_items_operacion ON public.rp_operacion_items(operacion_id);
CREATE INDEX IF NOT EXISTS idx_rp_fiados_cliente ON public.rp_fiados(cliente_id, estado);
CREATE INDEX IF NOT EXISTS idx_rp_abonos_cliente_fecha ON public.rp_abonos(cliente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rp_abono_aplicaciones_abono ON public.rp_abono_aplicaciones(abono_id);
CREATE INDEX IF NOT EXISTS idx_rp_abono_aplicaciones_fiado ON public.rp_abono_aplicaciones(fiado_id);
CREATE INDEX IF NOT EXISTS idx_rp_abono_aplicaciones_negocio ON public.rp_abono_aplicaciones(negocio_id);
CREATE INDEX IF NOT EXISTS idx_rp_cortes_negocio ON public.rp_cortes(negocio_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rp_audit_log_negocio ON public.rp_audit_log(negocio_id, created_at DESC);

-- =====================================================================
-- 4. FUNCIONES HELPER SECURITY DEFINER PARA SEGURIDAD Y RLS
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_user_role(p_negocio_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol TEXT;
BEGIN
  SELECT rol INTO v_rol
  FROM public.rp_memberships
  WHERE negocio_id = p_negocio_id
    AND user_id = auth.uid()
    AND activo = true;
  RETURN v_rol;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_member_of(p_negocio_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rp_memberships
    WHERE negocio_id = p_negocio_id
      AND user_id = auth.uid()
      AND activo = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_owner_of(p_negocio_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rp_memberships
    WHERE negocio_id = p_negocio_id
      AND user_id = auth.uid()
      AND activo = true
      AND rol IN ('dueño', 'admin')
  );
$$;

-- =====================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================
ALTER TABLE public.rp_negocios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rp_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rp_productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rp_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rp_rutas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rp_cargas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rp_operaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rp_operacion_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rp_fiados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rp_abonos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rp_abono_aplicaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rp_cortes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rp_audit_log ENABLE ROW LEVEL SECURITY;

-- 5.1 rp_negocios
DROP POLICY IF EXISTS "Miembros pueden ver su negocio" ON public.rp_negocios;
CREATE POLICY "Miembros pueden ver su negocio" ON public.rp_negocios
  FOR SELECT USING (public.is_member_of(id));

DROP POLICY IF EXISTS "Dueños/Admins pueden actualizar su negocio" ON public.rp_negocios;
CREATE POLICY "Dueños/Admins pueden actualizar su negocio" ON public.rp_negocios
  FOR UPDATE USING (public.is_admin_or_owner_of(id)) WITH CHECK (public.is_admin_or_owner_of(id));

-- 5.2 rp_memberships
DROP POLICY IF EXISTS "Usuarios ven sus propias membresias o las de su negocio" ON public.rp_memberships;
CREATE POLICY "Usuarios ven sus propias membresias o las de su negocio" ON public.rp_memberships
  FOR SELECT USING (user_id = auth.uid() OR public.is_member_of(negocio_id));

DROP POLICY IF EXISTS "Admins/Dueños gestionan membresias" ON public.rp_memberships;
CREATE POLICY "Admins/Dueños gestionan membresias" ON public.rp_memberships
  FOR ALL USING (public.is_admin_or_owner_of(negocio_id)) WITH CHECK (public.is_admin_or_owner_of(negocio_id));

-- 5.3 rp_productos (Escritura solo admin o dueño)
DROP POLICY IF EXISTS "Miembros ven productos" ON public.rp_productos;
CREATE POLICY "Miembros ven productos" ON public.rp_productos
  FOR SELECT USING (public.is_member_of(negocio_id));

DROP POLICY IF EXISTS "Admins gestionan productos" ON public.rp_productos;
CREATE POLICY "Admins gestionan productos" ON public.rp_productos
  FOR ALL USING (public.is_admin_or_owner_of(negocio_id)) WITH CHECK (public.is_admin_or_owner_of(negocio_id));

-- 5.4 rp_clientes (Escritura solo admin o dueño)
DROP POLICY IF EXISTS "Miembros ven clientes" ON public.rp_clientes;
CREATE POLICY "Miembros ven clientes" ON public.rp_clientes
  FOR SELECT USING (public.is_member_of(negocio_id));

DROP POLICY IF EXISTS "Admins gestionan clientes" ON public.rp_clientes;
CREATE POLICY "Admins gestionan clientes" ON public.rp_clientes
  FOR ALL USING (public.is_admin_or_owner_of(negocio_id)) WITH CHECK (public.is_admin_or_owner_of(negocio_id));

-- 5.5 rp_rutas (Escritura solo admin o dueño)
DROP POLICY IF EXISTS "Miembros ven rutas" ON public.rp_rutas;
CREATE POLICY "Miembros ven rutas" ON public.rp_rutas
  FOR SELECT USING (public.is_member_of(negocio_id));

DROP POLICY IF EXISTS "Admins gestionan rutas" ON public.rp_rutas;
CREATE POLICY "Admins gestionan rutas" ON public.rp_rutas
  FOR ALL USING (public.is_admin_or_owner_of(negocio_id)) WITH CHECK (public.is_admin_or_owner_of(negocio_id));

-- 5.6 rp_cargas (Escritura solo admin o dueño)
DROP POLICY IF EXISTS "Miembros ven cargas" ON public.rp_cargas;
CREATE POLICY "Miembros ven cargas" ON public.rp_cargas
  FOR SELECT USING (public.is_member_of(negocio_id));

DROP POLICY IF EXISTS "Admins gestionan cargas" ON public.rp_cargas;
CREATE POLICY "Admins gestionan cargas" ON public.rp_cargas
  FOR ALL USING (public.is_admin_or_owner_of(negocio_id)) WITH CHECK (public.is_admin_or_owner_of(negocio_id));

-- 5.7 rp_cortes (Escritura solo admin o dueño)
DROP POLICY IF EXISTS "Miembros ven cortes" ON public.rp_cortes;
CREATE POLICY "Miembros ven cortes" ON public.rp_cortes
  FOR SELECT USING (public.is_member_of(negocio_id));

DROP POLICY IF EXISTS "Admins gestionan cortes" ON public.rp_cortes;
CREATE POLICY "Admins gestionan cortes" ON public.rp_cortes
  FOR ALL USING (public.is_admin_or_owner_of(negocio_id)) WITH CHECK (public.is_admin_or_owner_of(negocio_id));

-- 5.8 rp_operaciones, rp_operacion_items, rp_fiados, rp_abonos, rp_abono_aplicaciones (Sin INSERT/UPDATE/DELETE directos, solo SELECT de miembros y escritura mediante RPC SECURITY DEFINER)
DROP POLICY IF EXISTS "Miembros ven operaciones" ON public.rp_operaciones;
CREATE POLICY "Miembros ven operaciones" ON public.rp_operaciones
  FOR SELECT USING (public.is_member_of(negocio_id));

DROP POLICY IF EXISTS "Miembros ven operacion_items" ON public.rp_operacion_items;
CREATE POLICY "Miembros ven operacion_items" ON public.rp_operacion_items
  FOR SELECT USING (public.is_member_of(negocio_id));

DROP POLICY IF EXISTS "Miembros ven fiados" ON public.rp_fiados;
CREATE POLICY "Miembros ven fiados" ON public.rp_fiados
  FOR SELECT USING (public.is_member_of(negocio_id));

DROP POLICY IF EXISTS "Miembros ven abonos" ON public.rp_abonos;
CREATE POLICY "Miembros ven abonos" ON public.rp_abonos
  FOR SELECT USING (public.is_member_of(negocio_id));

DROP POLICY IF EXISTS "Miembros ven abono_aplicaciones" ON public.rp_abono_aplicaciones;
CREATE POLICY "Miembros ven abono_aplicaciones" ON public.rp_abono_aplicaciones
  FOR SELECT USING (public.is_member_of(negocio_id));

-- 5.9 rp_audit_log (Solo SELECT admin/dueño y ninguna política INSERT/UPDATE/DELETE)
DROP POLICY IF EXISTS "Admins ven audit_log" ON public.rp_audit_log;
CREATE POLICY "Admins ven audit_log" ON public.rp_audit_log
  FOR SELECT USING (public.is_admin_or_owner_of(negocio_id));

-- =====================================================================
-- 6. RPC TRANSACCIONALES SEGURAS
-- =====================================================================

-- 6.1 Crear negocio con dueño
CREATE OR REPLACE FUNCTION public.crear_negocio_con_dueno(
  p_nombre TEXT,
  p_letra TEXT DEFAULT 'R',
  p_subtitulo TEXT DEFAULT '',
  p_color_principal TEXT DEFAULT '#C9912A'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_negocio_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado.';
  END IF;

  INSERT INTO public.rp_negocios (nombre, letra, subtitulo, color_principal)
  VALUES (p_nombre, COALESCE(p_letra, 'R'), COALESCE(p_subtitulo, ''), COALESCE(p_color_principal, '#C9912A'))
  RETURNING id INTO v_negocio_id;

  INSERT INTO public.rp_memberships (user_id, negocio_id, rol, activo)
  VALUES (v_user_id, v_negocio_id, 'dueño', true);

  INSERT INTO public.rp_audit_log (negocio_id, usuario_id, accion, tabla_afectada, registro_id)
  VALUES (v_negocio_id, v_user_id, 'CREAR_NEGOCIO', 'rp_negocios', v_negocio_id::text);

  RETURN v_negocio_id;
END;
$$;

-- 6.2 Abrir Ruta (Solo Dueño o Admin)
CREATE OR REPLACE FUNCTION public.abrir_ruta(
  p_negocio_id UUID,
  p_repartidor_id UUID,
  p_repartidor_nombre TEXT,
  p_cargas JSONB -- array of { producto_id, cantidad_cargada }
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_rol TEXT;
  v_ruta_id UUID;
  v_item JSONB;
  v_prod_id UUID;
  v_cant NUMERIC;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado.';
  END IF;

  -- Validar rol: solo dueño o admin pueden abrir rutas
  v_rol := public.get_user_role(p_negocio_id);
  IF v_rol IS NULL OR v_rol NOT IN ('dueño', 'admin') THEN
    RAISE EXCEPTION 'Acceso denegado: solo dueño o admin pueden abrir rutas.';
  END IF;

  -- Validar repartidor_id pertenezca al negocio como miembro activo
  IF NOT EXISTS (
    SELECT 1 FROM public.rp_memberships
    WHERE negocio_id = p_negocio_id AND user_id = p_repartidor_id AND activo = true
  ) THEN
    RAISE EXCEPTION 'El repartidor especificado no es un usuario activo de este negocio.';
  END IF;

  -- Validar cross-tenant en cargas antes de modificar datos
  IF p_cargas IS NOT NULL AND jsonb_array_length(p_cargas) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_cargas) LOOP
      v_prod_id := (v_item->>'producto_id')::uuid;
      v_cant := (v_item->>'cantidad_cargada')::numeric;

      IF v_cant < 0 THEN
        RAISE EXCEPTION 'La cantidad cargada debe ser mayor o igual a cero.';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM public.rp_productos
        WHERE id = v_prod_id AND negocio_id = p_negocio_id AND activo = true
      ) THEN
        RAISE EXCEPTION 'El producto ID % no pertenece a este negocio o está inactivo.', v_prod_id;
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.rp_rutas (negocio_id, repartidor_id, repartidor_nombre, estado)
  VALUES (p_negocio_id, p_repartidor_id, p_repartidor_nombre, 'abierta')
  RETURNING id INTO v_ruta_id;

  IF p_cargas IS NOT NULL AND jsonb_array_length(p_cargas) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_cargas) LOOP
      v_prod_id := (v_item->>'producto_id')::uuid;
      v_cant := (v_item->>'cantidad_cargada')::numeric;

      INSERT INTO public.rp_cargas (
        negocio_id, ruta_id, producto_id, cantidad_cargada, cantidad_vendida, cantidad_devuelta
      )
      VALUES (
        p_negocio_id,
        v_ruta_id,
        v_prod_id,
        v_cant,
        0,
        0
      );
    END LOOP;
  END IF;

  INSERT INTO public.rp_audit_log (negocio_id, usuario_id, accion, tabla_afectada, registro_id)
  VALUES (p_negocio_id, v_user_id, 'ABRIR_RUTA', 'rp_rutas', v_ruta_id::text);

  RETURN v_ruta_id;
END;
$$;

-- 6.3 Registrar Operación (Idempotencia robusta, enums, validación de miembro vendedor, row_count en carga y auditoría)
CREATE OR REPLACE FUNCTION public.registrar_operacion(
  p_negocio_id UUID,
  p_ruta_id UUID,
  p_cliente_id UUID,
  p_vendedor_id UUID,
  p_vendedor_nombre TEXT,
  p_cliente_nombre TEXT,
  p_tipo_operacion TEXT,
  p_tipo_cobro TEXT,
  p_monto_total_centavos INT,
  p_items JSONB,
  p_idempotency_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_rol TEXT;
  v_existing_id UUID;
  v_operacion_id UUID;
  v_item JSONB;
  v_prod_id UUID;
  v_cant NUMERIC;
  v_precio INT;
  v_subtotal INT;
  v_total_calculado INT := 0;
  v_carga_id UUID;
  v_cant_cargada NUMERIC;
  v_cant_vendida NUMERIC;
  v_cant_devuelta NUMERIC;
  v_disponible NUMERIC;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado.';
  END IF;

  -- Key de idempotencia obligatoria
  IF p_idempotency_key IS NULL OR TRIM(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'idempotency_key es obligatorio para registrar operaciones.';
  END IF;

  -- Validar enums explícitamente
  IF p_tipo_operacion NOT IN ('venta', 'merma', 'devolucion') THEN
    RAISE EXCEPTION 'tipo_operacion inválido: %', p_tipo_operacion;
  END IF;

  IF p_tipo_cobro NOT IN ('efectivo', 'credito', 'gratis') THEN
    RAISE EXCEPTION 'tipo_cobro inválido: %', p_tipo_cobro;
  END IF;

  -- Validar rol y permisos por negocio
  v_rol := public.get_user_role(p_negocio_id);
  IF v_rol IS NULL THEN
    RAISE EXCEPTION 'Acceso denegado al negocio.';
  END IF;

  -- Mostrador no puede asociar operaciones a rutas
  IF v_rol = 'mostrador' AND p_ruta_id IS NOT NULL THEN
    RAISE EXCEPTION 'El personal de mostrador no tiene permitido registrar ventas asociadas a rutas.';
  END IF;

  IF v_rol NOT IN ('dueño', 'admin', 'repartidor', 'mostrador') THEN
    RAISE EXCEPTION 'Rol no autorizado para registrar operaciones.';
  END IF;

  -- Validar vendedor_id como miembro activo del mismo negocio si se provee
  IF p_vendedor_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.rp_memberships
      WHERE negocio_id = p_negocio_id AND user_id = p_vendedor_id AND activo = true
    ) THEN
      RAISE EXCEPTION 'El vendedor especificado no es un miembro activo de este negocio.';
    END IF;
  END IF;

  -- Validar cliente si fue provisto
  IF p_cliente_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.rp_clientes WHERE id = p_cliente_id AND negocio_id = p_negocio_id
    ) THEN
      RAISE EXCEPTION 'El cliente especificado no pertenece a este negocio (mismatch cross-tenant).';
    END IF;
  END IF;

  -- Validar ruta si fue provista y bloqueo FOR UPDATE
  IF p_ruta_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.rp_rutas
      WHERE id = p_ruta_id AND negocio_id = p_negocio_id AND estado = 'abierta'
      FOR UPDATE
    ) THEN
      RAISE EXCEPTION 'La ruta especificada no existe, no pertenece a este negocio o se encuentra cerrada.';
    END IF;
  END IF;

  -- Chequeo previo de idempotencia
  SELECT id INTO v_existing_id
  FROM public.rp_operaciones
  WHERE negocio_id = p_negocio_id AND idempotency_key = p_idempotency_key;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  -- Validar array de items
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La operación debe contener al menos un item.';
  END IF;

  -- Bucle 1: Validar exactitud de subtotales y stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_prod_id := (v_item->>'producto_id')::uuid;
    v_cant := (v_item->>'cantidad')::numeric;
    v_precio := (v_item->>'precio_unitario_centavos')::int;
    v_subtotal := (v_item->>'subtotal_centavos')::int;

    IF v_cant <= 0 THEN
      RAISE EXCEPTION 'La cantidad del producto debe ser mayor a cero.';
    END IF;

    IF v_precio < 0 THEN
      RAISE EXCEPTION 'El precio unitario no puede ser negativo.';
    END IF;

    IF v_subtotal <> ROUND(v_cant * v_precio)::int THEN
      RAISE EXCEPTION 'El subtotal del item (% centavos) no coincide con cantidad * precio.', v_subtotal;
    END IF;

    v_total_calculado := v_total_calculado + v_subtotal;

    IF v_prod_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.rp_productos WHERE id = v_prod_id AND negocio_id = p_negocio_id
      ) THEN
        RAISE EXCEPTION 'El producto ID % no pertenece a este negocio.', v_prod_id;
      END IF;

      IF p_ruta_id IS NOT NULL AND p_tipo_operacion = 'venta' THEN
        SELECT id, cantidad_cargada, cantidad_vendida, cantidad_devuelta
        INTO v_carga_id, v_cant_cargada, v_cant_vendida, v_cant_devuelta
        FROM public.rp_cargas
        WHERE ruta_id = p_ruta_id AND producto_id = v_prod_id AND negocio_id = p_negocio_id
        FOR UPDATE;

        IF v_carga_id IS NULL THEN
          RAISE EXCEPTION 'El producto ID % no fue cargado en la ruta.', v_prod_id;
        END IF;

        v_disponible := v_cant_cargada - v_cant_vendida - v_cant_devuelta;
        IF v_disponible < v_cant THEN
          RAISE EXCEPTION 'Stock insuficiente a bordo para el producto ID %. Disponible: %, Solicitado: %',
            v_prod_id, v_disponible, v_cant;
        END IF;
      END IF;
    END IF;
  END LOOP;

  IF p_monto_total_centavos <> v_total_calculado THEN
    RAISE EXCEPTION 'El monto total enviado (% centavos) no coincide con la suma de los items (% centavos).',
      p_monto_total_centavos, v_total_calculado;
  END IF;

  -- Insertar Cabecera de Operación con manejo de unique_violation por concurrencia
  BEGIN
    INSERT INTO public.rp_operaciones (
      negocio_id, ruta_id, cliente_id, vendedor_id, vendedor_nombre,
      cliente_nombre, tipo_operacion, tipo_cobro, monto_total_centavos, idempotency_key
    )
    VALUES (
      p_negocio_id, p_ruta_id, p_cliente_id, p_vendedor_id, COALESCE(p_vendedor_nombre, ''),
      COALESCE(p_cliente_nombre, ''), p_tipo_operacion, p_tipo_cobro, p_monto_total_centavos, p_idempotency_key
    )
    RETURNING id INTO v_operacion_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_existing_id
    FROM public.rp_operaciones
    WHERE negocio_id = p_negocio_id AND idempotency_key = p_idempotency_key;
    RETURN v_existing_id;
  END;

  -- Bucle 2: Insertar items y actualizar inventarios en carga con verificación ROW_COUNT
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_prod_id := (v_item->>'producto_id')::uuid;
    v_cant := (v_item->>'cantidad')::numeric;
    v_precio := (v_item->>'precio_unitario_centavos')::int;
    v_subtotal := (v_item->>'subtotal_centavos')::int;

    INSERT INTO public.rp_operacion_items (
      negocio_id, operacion_id, producto_id, producto_nombre, cantidad, precio_unitario_centavos, subtotal_centavos
    )
    VALUES (
      p_negocio_id, v_operacion_id, v_prod_id,
      v_item->>'producto_nombre', v_cant, v_precio, v_subtotal
    );

    IF p_ruta_id IS NOT NULL AND v_prod_id IS NOT NULL THEN
      IF p_tipo_operacion = 'venta' THEN
        UPDATE public.rp_cargas
        SET cantidad_vendida = cantidad_vendida + v_cant
        WHERE ruta_id = p_ruta_id AND producto_id = v_prod_id AND negocio_id = p_negocio_id;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'No se encontró la carga para actualizar cantidad vendida del producto ID %.', v_prod_id;
        END IF;
      ELSIF p_tipo_operacion IN ('merma', 'devolucion') THEN
        UPDATE public.rp_cargas
        SET cantidad_devuelta = cantidad_devuelta + v_cant
        WHERE ruta_id = p_ruta_id AND producto_id = v_prod_id AND negocio_id = p_negocio_id;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'No se encontró la carga para actualizar cantidad devuelta del producto ID %.', v_prod_id;
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- Manejo de venta a crédito / Fiado
  IF p_tipo_cobro = 'credito' AND p_tipo_operacion = 'venta' THEN
    IF p_cliente_id IS NULL THEN
      RAISE EXCEPTION 'Ventas a crédito requieren especificar un cliente valido.';
    END IF;

    INSERT INTO public.rp_fiados (
      negocio_id, cliente_id, operacion_id, monto_original_centavos, saldo_pendiente_centavos, estado
    )
    VALUES (
      p_negocio_id, p_cliente_id, v_operacion_id, p_monto_total_centavos, p_monto_total_centavos, 'pendiente'
    );

    UPDATE public.rp_clientes
    SET saldo_fiado_centavos = saldo_fiado_centavos + p_monto_total_centavos,
        updated_at = NOW()
    WHERE id = p_cliente_id AND negocio_id = p_negocio_id;
  END IF;

  INSERT INTO public.rp_audit_log (negocio_id, usuario_id, accion, tabla_afectada, registro_id, detalles)
  VALUES (p_negocio_id, v_user_id, 'REGISTRAR_OPERACION', 'rp_operaciones', v_operacion_id::text, jsonb_build_object('tipo_operacion', p_tipo_operacion, 'monto_centavos', p_monto_total_centavos));

  RETURN v_operacion_id;
END;
$$;

-- 6.4 Registrar Abono (con validación de deuda previa, bloqueo FOR UPDATE, aplicaciones y idempotencia)
CREATE OR REPLACE FUNCTION public.registrar_abono(
  p_negocio_id UUID,
  p_cliente_id UUID,
  p_ruta_id UUID,
  p_monto_centavos INT,
  p_recibido_por TEXT,
  p_idempotency_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_rol TEXT;
  v_existing_abono_id UUID;
  v_abono_id UUID;
  v_total_deuda INT := 0;
  v_restante INT;
  v_fiado RECORD;
  v_pago INT;
  v_nuevo_saldo INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado.';
  END IF;

  IF p_idempotency_key IS NULL OR TRIM(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'idempotency_key es obligatorio para registrar abonos.';
  END IF;

  -- Validar rol
  v_rol := public.get_user_role(p_negocio_id);
  IF v_rol IS NULL OR v_rol NOT IN ('dueño', 'admin', 'repartidor') THEN
    RAISE EXCEPTION 'Acceso denegado: rol no autorizado para registrar abonos.';
  END IF;

  IF p_monto_centavos <= 0 THEN
    RAISE EXCEPTION 'El monto del abono debe ser estrictamente mayor a 0.';
  END IF;

  -- Validar pertenencia del cliente y bloquear con FOR UPDATE
  IF NOT EXISTS (
    SELECT 1 FROM public.rp_clientes WHERE id = p_cliente_id AND negocio_id = p_negocio_id FOR UPDATE
  ) THEN
    RAISE EXCEPTION 'El cliente no pertenece a este negocio.';
  END IF;

  -- Validar ruta si fue enviada
  IF p_ruta_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.rp_rutas WHERE id = p_ruta_id AND negocio_id = p_negocio_id
    ) THEN
      RAISE EXCEPTION 'La ruta especificada no pertenece a este negocio.';
    END IF;
  END IF;

  -- Chequeo de idempotencia
  SELECT id INTO v_existing_abono_id
  FROM public.rp_abonos
  WHERE negocio_id = p_negocio_id AND idempotency_key = p_idempotency_key;

  IF v_existing_abono_id IS NOT NULL THEN
    RETURN v_existing_abono_id;
  END IF;

  -- Calcular deuda total pendiente ANTES de insertar abono y bloquear fiados FOR UPDATE
  SELECT COALESCE(SUM(saldo_pendiente_centavos), 0) INTO v_total_deuda
  FROM public.rp_fiados
  WHERE negocio_id = p_negocio_id AND cliente_id = p_cliente_id AND estado IN ('pendiente', 'parcial')
  FOR UPDATE;

  IF p_monto_centavos > v_total_deuda THEN
    RAISE EXCEPTION 'El monto del abono (% centavos) excede el saldo de deuda total del cliente (% centavos).',
      p_monto_centavos, v_total_deuda;
  END IF;

  -- Insertar Abono con manejador de unique_violation por concurrencia
  BEGIN
    INSERT INTO public.rp_abonos (
      negocio_id, cliente_id, ruta_id, monto_centavos, recibido_por, idempotency_key
    )
    VALUES (
      p_negocio_id, p_cliente_id, p_ruta_id, p_monto_centavos, COALESCE(p_recibido_por, ''), p_idempotency_key
    )
    RETURNING id INTO v_abono_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_existing_abono_id
    FROM public.rp_abonos
    WHERE negocio_id = p_negocio_id AND idempotency_key = p_idempotency_key;
    RETURN v_existing_abono_id;
  END;

  -- Aplicar abono a deudas de fiado más antiguas y registrar aplicaciones
  v_restante := p_monto_centavos;
  FOR v_fiado IN 
    SELECT * FROM public.rp_fiados
    WHERE negocio_id = p_negocio_id AND cliente_id = p_cliente_id AND estado IN ('pendiente', 'parcial')
    ORDER BY created_at ASC
  LOOP
    IF v_restante <= 0 THEN
      EXIT;
    END IF;

    IF v_fiado.saldo_pendiente_centavos <= v_restante THEN
      v_pago := v_fiado.saldo_pendiente_centavos;
      v_restante := v_restante - v_pago;

      UPDATE public.rp_fiados
      SET saldo_pendiente_centavos = 0, estado = 'pagado', updated_at = NOW()
      WHERE id = v_fiado.id;
    ELSE
      v_pago := v_restante;
      UPDATE public.rp_fiados
      SET saldo_pendiente_centavos = saldo_pendiente_centavos - v_restante, estado = 'parcial', updated_at = NOW()
      WHERE id = v_fiado.id;
      v_restante := 0;
    END IF;

    -- Insertar en rp_abono_aplicaciones
    INSERT INTO public.rp_abono_aplicaciones (negocio_id, abono_id, fiado_id, monto_centavos)
    VALUES (p_negocio_id, v_abono_id, v_fiado.id, v_pago)
    ON CONFLICT (abono_id, fiado_id) DO UPDATE SET monto_centavos = EXCLUDED.monto_centavos;
  END LOOP;

  -- Sincronizar saldo de fiados exacto en el cliente
  SELECT COALESCE(SUM(saldo_pendiente_centavos), 0) INTO v_nuevo_saldo
  FROM public.rp_fiados
  WHERE negocio_id = p_negocio_id AND cliente_id = p_cliente_id AND estado IN ('pendiente', 'parcial');

  UPDATE public.rp_clientes
  SET saldo_fiado_centavos = v_nuevo_saldo,
      updated_at = NOW()
  WHERE id = p_cliente_id AND negocio_id = p_negocio_id;

  INSERT INTO public.rp_audit_log (negocio_id, usuario_id, accion, tabla_afectada, registro_id, detalles)
  VALUES (p_negocio_id, v_user_id, 'REGISTRAR_ABONO', 'rp_abonos', v_abono_id::text, jsonb_build_object('monto_centavos', p_monto_centavos, 'cliente_id', p_cliente_id));

  RETURN v_abono_id;
END;
$$;

-- 6.5 Cerrar Ruta (Exige estado exactamente 'abierta', efectivo >= 0, idempotente si ya existe corte)
CREATE OR REPLACE FUNCTION public.cerrar_ruta(
  p_negocio_id UUID,
  p_ruta_id UUID,
  p_efectivo_entregado_centavos INT,
  p_notas TEXT DEFAULT ''
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_rol TEXT;
  v_estado_actual TEXT;
  v_corte_existente_id UUID;
  v_corte_id UUID;
  v_ventas_efectivo INT := 0;
  v_ventas_credito INT := 0;
  v_mermas INT := 0;
  v_abonos INT := 0;
  v_efectivo_esperado INT := 0;
  v_diferencia INT := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado.';
  END IF;

  IF p_efectivo_entregado_centavos < 0 THEN
    RAISE EXCEPTION 'El efectivo entregado no puede ser negativo.';
  END IF;

  -- Validar rol: solo dueño o admin pueden cerrar rutas
  v_rol := public.get_user_role(p_negocio_id);
  IF v_rol IS NULL OR v_rol NOT IN ('dueño', 'admin') THEN
    RAISE EXCEPTION 'Acceso denegado: solo dueño o admin pueden cerrar rutas.';
  END IF;

  -- Si ya existe un corte para esta ruta, retornar su ID sin duplicar
  SELECT id INTO v_corte_existente_id
  FROM public.rp_cortes
  WHERE ruta_id = p_ruta_id AND negocio_id = p_negocio_id;

  IF v_corte_existente_id IS NOT NULL THEN
    RETURN v_corte_existente_id;
  END IF;

  -- Bloquear fila de ruta y verificar estado exactamente 'abierta'
  SELECT estado INTO v_estado_actual
  FROM public.rp_rutas
  WHERE id = p_ruta_id AND negocio_id = p_negocio_id
  FOR UPDATE;

  IF v_estado_actual IS NULL THEN
    RAISE EXCEPTION 'La ruta especificada no existe o no pertenece a este negocio.';
  END IF;

  IF v_estado_actual <> 'abierta' THEN
    RAISE EXCEPTION 'La ruta no se encuentra abierta (estado actual: %).', v_estado_actual;
  END IF;

  -- Calcular totales de ventas en la ruta
  SELECT COALESCE(SUM(monto_total_centavos), 0) INTO v_ventas_efectivo
  FROM public.rp_operaciones
  WHERE ruta_id = p_ruta_id AND negocio_id = p_negocio_id AND tipo_operacion = 'venta' AND tipo_cobro = 'efectivo';

  SELECT COALESCE(SUM(monto_total_centavos), 0) INTO v_ventas_credito
  FROM public.rp_operaciones
  WHERE ruta_id = p_ruta_id AND negocio_id = p_negocio_id AND tipo_operacion = 'venta' AND tipo_cobro = 'credito';

  SELECT COALESCE(SUM(monto_total_centavos), 0) INTO v_mermas
  FROM public.rp_operaciones
  WHERE ruta_id = p_ruta_id AND negocio_id = p_negocio_id AND tipo_operacion IN ('merma', 'devolucion');

  SELECT COALESCE(SUM(monto_centavos), 0) INTO v_abonos
  FROM public.rp_abonos
  WHERE ruta_id = p_ruta_id AND negocio_id = p_negocio_id;

  v_efectivo_esperado := v_ventas_efectivo + v_abonos;
  v_diferencia := p_efectivo_entregado_centavos - v_efectivo_esperado;

  UPDATE public.rp_rutas
  SET estado = 'cerrada',
      fecha_cierre = NOW(),
      total_ventas_efectivo_centavos = v_ventas_efectivo,
      total_ventas_credito_centavos = v_ventas_credito,
      total_mermas_centavos = v_mermas,
      total_abonos_centavos = v_abonos,
      updated_at = NOW()
  WHERE id = p_ruta_id AND negocio_id = p_negocio_id;

  BEGIN
    INSERT INTO public.rp_cortes (
      negocio_id, ruta_id, usuario_id, total_efectivo_esperado_centavos,
      total_efectivo_entregado_centavos, diferencia_centavos, notas
    )
    VALUES (
      p_negocio_id, p_ruta_id, v_user_id, v_efectivo_esperado,
      p_efectivo_entregado_centavos, v_diferencia, COALESCE(p_notas, '')
    )
    RETURNING id INTO v_corte_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_corte_existente_id
    FROM public.rp_cortes
    WHERE ruta_id = p_ruta_id AND negocio_id = p_negocio_id;
    RETURN v_corte_existente_id;
  END;

  INSERT INTO public.rp_audit_log (negocio_id, usuario_id, accion, tabla_afectada, registro_id)
  VALUES (p_negocio_id, v_user_id, 'CERRAR_RUTA', 'rp_rutas', p_ruta_id::text);

  RETURN v_corte_id;
END;
$$;

-- 6.6 Migración idempotente de datos históricos (Con esquemas exactos de tablas legacy 'precios' y 'clientes')
CREATE OR REPLACE FUNCTION public.migrar_datos_historicos_la_favorita(
  p_negocio_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_prod_count INT := 0;
  v_cli_count INT := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado.';
  END IF;

  IF NOT public.is_admin_or_owner_of(p_negocio_id) THEN
    RAISE EXCEPTION 'Solo el dueño o administrador puede ejecutar la migración de datos.';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'precios') THEN
    INSERT INTO public.rp_productos (negocio_id, legacy_id, codigo, nombre, precio_centavos, stock_actual)
    SELECT 
      p_negocio_id,
      p.producto,
      p.producto,
      p.producto,
      COALESCE((p.precio * 100)::int, 0),
      0
    FROM public.precios p
    WHERE p.negocio_id = 'la-favorita'
    ON CONFLICT (negocio_id, legacy_id) DO UPDATE SET
      nombre = EXCLUDED.nombre,
      precio_centavos = EXCLUDED.precio_centavos;
    
    GET DIAGNOSTICS v_prod_count = ROW_COUNT;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clientes') THEN
    INSERT INTO public.rp_clientes (negocio_id, legacy_id, nombre, telefono, vendedor_nombre)
    SELECT 
      p_negocio_id,
      c.id::text,
      c.nom,
      COALESCE(c.tel, ''),
      COALESCE(c.rep, '')
    FROM public.clientes c
    WHERE c.negocio_id = 'la-favorita'
    ON CONFLICT (negocio_id, legacy_id) DO UPDATE SET
      nombre = EXCLUDED.nombre,
      telefono = EXCLUDED.telefono,
      vendedor_nombre = EXCLUDED.vendedor_nombre;

    GET DIAGNOSTICS v_cli_count = ROW_COUNT;
  END IF;

  INSERT INTO public.rp_audit_log (negocio_id, usuario_id, accion, tabla_afectada, detalles)
  VALUES (
    p_negocio_id, v_user_id, 'MIGRACION_DATOS_HISTORICOS', 'precios,clientes',
    jsonb_build_object('productos_migrados', v_prod_count, 'clientes_migrados', v_cli_count)
  );

  RETURN jsonb_build_object(
    'status', 'ok',
    'productos_migrados', v_prod_count,
    'clientes_migrados', v_cli_count
  );
END;
$$;

-- =====================================================================
-- 7. CONCESIÓN DE PERMISOS FUNCIÓN POR FUNCIÓN (PROHIBIDO REVOKE EXECUTE ON ALL)
-- =====================================================================
REVOKE EXECUTE ON FUNCTION public.get_user_role(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_member_of(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_owner_of(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.crear_negocio_con_dueno(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.abrir_ruta(UUID, UUID, TEXT, JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.registrar_operacion(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, INT, JSONB, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.registrar_abono(UUID, UUID, UUID, INT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cerrar_ruta(UUID, UUID, INT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.migrar_datos_historicos_la_favorita(UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_user_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_member_of(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_owner_of(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crear_negocio_con_dueno(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.abrir_ruta(UUID, UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_operacion(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, INT, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_abono(UUID, UUID, UUID, INT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cerrar_ruta(UUID, UUID, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.migrar_datos_historicos_la_favorita(UUID) TO authenticated;

-- =====================================================================
-- 8. PUBLICACIÓN REALTIME (IDEMPOTENTE Y SEGURA SIN EXCEPTION)
-- =====================================================================
DO $$
DECLARE
  v_tables TEXT[] := ARRAY[
    'public.rp_productos',
    'public.rp_clientes',
    'public.rp_rutas',
    'public.rp_cargas',
    'public.rp_operaciones',
    'public.rp_abonos',
    'public.rp_abono_aplicaciones',
    'public.rp_cortes'
  ];
  v_tbl TEXT;
  v_schema TEXT;
  v_name TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH v_tbl IN ARRAY v_tables LOOP
      v_schema := split_part(v_tbl, '.', 1);
      v_name := split_part(v_tbl, '.', 2);
      
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = v_schema 
          AND tablename = v_name
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I.%I', v_schema, v_name);
      END IF;
    END LOOP;
  END IF;
END $$;
