/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from '../lib/supabase';

// =====================================================================
// INTERFACES Y TIPOS DE BASE DE DATOS ROUTEPRO
// =====================================================================

export interface RpNegocio {
  id: string;
  nombre: string;
  letra: string;
  subtitulo: string;
  color_principal: string;
  logo_url?: string;
  created_at: string;
  updated_at: string;
}

export interface RpMembership {
  id: string;
  user_id: string;
  negocio_id: string;
  rol: 'dueño' | 'admin' | 'mostrador' | 'repartidor';
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface RpProducto {
  id: string;
  negocio_id: string;
  codigo?: string;
  legacy_id?: string;
  nombre: string;
  precio_centavos: number;
  costo_centavos?: number;
  stock_actual: number;
  icono?: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface RpCliente {
  id: string;
  negocio_id: string;
  legacy_id?: string;
  nombre: string;
  tipo?: string;
  direccion?: string;
  telefono?: string;
  vendedor_id?: string;
  vendedor_nombre?: string;
  lat?: number;
  lng?: number;
  saldo_fiado_centavos: number;
  created_at: string;
  updated_at: string;
}

export interface RpRuta {
  id: string;
  negocio_id: string;
  repartidor_id: string;
  repartidor_nombre: string;
  estado: 'abierta' | 'cerrada' | 'en_proceso';
  fecha_apertura: string;
  fecha_cierre?: string;
  total_ventas_efectivo_centavos: number;
  total_ventas_credito_centavos: number;
  total_mermas_centavos: number;
  total_abonos_centavos: number;
  created_at: string;
  updated_at: string;
}

export interface RpCarga {
  id: string;
  negocio_id: string;
  ruta_id: string;
  producto_id: string;
  cantidad_cargada: number;
  cantidad_vendida: number;
  cantidad_devuelta: number;
  created_at: string;
}

export interface RpOperacion {
  id: string;
  negocio_id: string;
  ruta_id?: string;
  cliente_id?: string;
  vendedor_id?: string;
  vendedor_nombre: string;
  cliente_nombre: string;
  tipo_operacion: 'venta' | 'merma' | 'devolucion';
  tipo_cobro: 'efectivo' | 'credito' | 'gratis';
  monto_total_centavos: number;
  idempotency_key: string;
  created_at: string;
}

export interface RpOperacionItem {
  id: string;
  negocio_id: string;
  operacion_id: string;
  producto_id?: string;
  producto_nombre: string;
  cantidad: number;
  precio_unitario_centavos: number;
  subtotal_centavos: number;
  created_at: string;
}

export interface RpFiado {
  id: string;
  negocio_id: string;
  cliente_id: string;
  operacion_id?: string;
  monto_original_centavos: number;
  saldo_pendiente_centavos: number;
  estado: 'pendiente' | 'parcial' | 'pagado';
  created_at: string;
  updated_at: string;
}

export interface RpAbono {
  id: string;
  negocio_id: string;
  cliente_id: string;
  fiado_id?: string;
  ruta_id?: string;
  monto_centavos: number;
  recibido_por: string;
  idempotency_key?: string;
  created_at: string;
}

export interface RpAbonoAplicacion {
  id: string;
  negocio_id: string;
  abono_id: string;
  fiado_id: string;
  monto_centavos: number;
  created_at: string;
}

export interface RpCorte {
  id: string;
  negocio_id: string;
  ruta_id?: string;
  usuario_id: string;
  total_efectivo_esperado_centavos: number;
  total_efectivo_entregado_centavos: number;
  diferencia_centavos: number;
  notas?: string;
  created_at: string;
}

export interface RpAuditLog {
  id: string;
  negocio_id: string;
  usuario_id?: string;
  accion: string;
  tabla_afectada: string;
  registro_id?: string;
  detalles?: Record<string, any>;
  created_at: string;
}

export interface RegistrarOperacionPayload {
  ruta_id?: string;
  cliente_id?: string;
  vendedor_id?: string;
  vendedor_nombre: string;
  cliente_nombre: string;
  tipo_operacion: 'venta' | 'merma' | 'devolucion';
  tipo_cobro: 'efectivo' | 'credito' | 'gratis';
  monto_total_centavos: number;
  idempotency_key?: string;
  items: Array<{
    producto_id?: string;
    producto_nombre: string;
    cantidad: number;
    precio_unitario_centavos: number;
    subtotal_centavos: number;
  }>;
}

// =====================================================================
// REPOSITORY SERVICE
// =====================================================================

export class RouteProRepository {
  // -------------------------------------------------------------------
  // 1. NEGOCIOS & MEMBERSHIPS
  // -------------------------------------------------------------------
  static async getNegocio(negocioId: string): Promise<{ data: RpNegocio | null; error: Error | null }> {
    if (!negocioId) return { data: null, error: new Error('negocioId obligatorio') };

    const { data, error } = await supabase
      .from('rp_negocios')
      .select('*')
      .eq('id', negocioId)
      .single();

    if (error) return { data: null, error };
    return { data: data as RpNegocio, error: null };
  }

  static async updateNegocio(
    negocioId: string,
    updates: Partial<RpNegocio>
  ): Promise<{ data: RpNegocio | null; error: Error | null }> {
    if (!negocioId) return { data: null, error: new Error('negocioId obligatorio') };

    const { data, error } = await supabase
      .from('rp_negocios')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', negocioId)
      .select()
      .single();

    if (error) return { data: null, error };
    return { data: data as RpNegocio, error: null };
  }

  static async crearNegocioConDueno(
    nombre: string,
    letra: string = 'R',
    subtitulo: string = '',
    colorPrincipal: string = '#C9912A'
  ): Promise<{ data: string | null; error: Error | null }> {
    const { data, error } = await supabase.rpc('crear_negocio_con_dueno', {
      p_nombre: nombre,
      p_letra: letra,
      p_subtitulo: subtitulo,
      p_color_principal: colorPrincipal,
    });

    if (error) return { data: null, error };
    return { data: data as string, error: null };
  }

  static async getMemberships(negocioId: string): Promise<{ data: RpMembership[]; error: Error | null }> {
    if (!negocioId) return { data: [], error: new Error('negocioId obligatorio') };

    const { data, error } = await supabase
      .from('rp_memberships')
      .select('*')
      .eq('negocio_id', negocioId);

    if (error) return { data: [], error };
    return { data: (data as RpMembership[]) || [], error: null };
  }

  // -------------------------------------------------------------------
  // 2. PRODUCTOS
  // -------------------------------------------------------------------
  static async getProductos(negocioId: string): Promise<{ data: RpProducto[]; error: Error | null }> {
    if (!negocioId) return { data: [], error: new Error('negocioId obligatorio') };

    const { data, error } = await supabase
      .from('rp_productos')
      .select('*')
      .eq('negocio_id', negocioId)
      .eq('activo', true)
      .order('nombre', { ascending: true });

    if (error) return { data: [], error };
    return { data: (data as RpProducto[]) || [], error: null };
  }

  static async upsertProducto(
    negocioId: string,
    producto: Partial<RpProducto>
  ): Promise<{ data: RpProducto | null; error: Error | null }> {
    if (!negocioId) return { data: null, error: new Error('negocioId obligatorio') };

    const payload = {
      ...producto,
      negocio_id: negocioId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('rp_productos')
      .upsert(payload)
      .select()
      .single();

    if (error) return { data: null, error };
    return { data: data as RpProducto, error: null };
  }

  static async deleteProducto(
    negocioId: string,
    productoId: string
  ): Promise<{ error: Error | null }> {
    if (!negocioId) return { error: new Error('negocioId obligatorio') };

    const { error } = await supabase
      .from('rp_productos')
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq('negocio_id', negocioId)
      .eq('id', productoId);

    return { error };
  }

  static subscribeProductos(negocioId: string, onChange: (productos: RpProducto[]) => void) {
    this.getProductos(negocioId).then(({ data }) => {
      if (data) onChange(data);
    });

    const channel = supabase
      .channel(`rp_productos_${negocioId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rp_productos', filter: `negocio_id=eq.${negocioId}` },
        () => {
          this.getProductos(negocioId).then(({ data }) => {
            if (data) onChange(data);
          });
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  }

  // -------------------------------------------------------------------
  // 3. CLIENTES
  // -------------------------------------------------------------------
  static async getClientes(negocioId: string): Promise<{ data: RpCliente[]; error: Error | null }> {
    if (!negocioId) return { data: [], error: new Error('negocioId obligatorio') };

    const { data, error } = await supabase
      .from('rp_clientes')
      .select('*')
      .eq('negocio_id', negocioId)
      .order('nombre', { ascending: true });

    if (error) return { data: [], error };
    return { data: (data as RpCliente[]) || [], error: null };
  }

  static async upsertCliente(
    negocioId: string,
    cliente: Partial<RpCliente>
  ): Promise<{ data: RpCliente | null; error: Error | null }> {
    if (!negocioId) return { data: null, error: new Error('negocioId obligatorio') };

    const payload = {
      ...cliente,
      negocio_id: negocioId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('rp_clientes')
      .upsert(payload)
      .select()
      .single();

    if (error) return { data: null, error };
    return { data: data as RpCliente, error: null };
  }

  static async deleteCliente(negocioId: string, clienteId: string): Promise<{ error: Error | null }> {
    if (!negocioId) return { error: new Error('negocioId obligatorio') };

    const { error } = await supabase
      .from('rp_clientes')
      .delete()
      .eq('negocio_id', negocioId)
      .eq('id', clienteId);

    return { error };
  }

  static subscribeClientes(negocioId: string, onChange: (clientes: RpCliente[]) => void) {
    this.getClientes(negocioId).then(({ data }) => {
      if (data) onChange(data);
    });

    const channel = supabase
      .channel(`rp_clientes_${negocioId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rp_clientes', filter: `negocio_id=eq.${negocioId}` },
        () => {
          this.getClientes(negocioId).then(({ data }) => {
            if (data) onChange(data);
          });
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  }

  // -------------------------------------------------------------------
  // 4. RUTAS Y CARGAS
  // -------------------------------------------------------------------
  static async getRutaActivaRepartidor(
    negocioId: string,
    repartidorId: string
  ): Promise<{ data: RpRuta | null; error: Error | null }> {
    if (!negocioId) return { data: null, error: new Error('negocioId obligatorio') };

    const { data, error } = await supabase
      .from('rp_rutas')
      .select('*')
      .eq('negocio_id', negocioId)
      .eq('repartidor_id', repartidorId)
      .eq('estado', 'abierta')
      .order('fecha_apertura', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return { data: null, error };
    return { data: data as RpRuta | null, error: null };
  }

  static async getCargas(negocioId: string, rutaId: string): Promise<{ data: RpCarga[]; error: Error | null }> {
    if (!negocioId || !rutaId) return { data: [], error: new Error('Parametros invalidos') };

    const { data, error } = await supabase
      .from('rp_cargas')
      .select('*')
      .eq('negocio_id', negocioId)
      .eq('ruta_id', rutaId);

    if (error) return { data: [], error };
    return { data: (data as RpCarga[]) || [], error: null };
  }

  static async abrirRuta(
    negocioId: string,
    repartidorId: string,
    repartidorNombre: string,
    cargas: Array<{ producto_id: string; cantidad_cargada: number }>
  ): Promise<{ data: string | null; error: Error | null }> {
    const { data, error } = await supabase.rpc('abrir_ruta', {
      p_negocio_id: negocioId,
      p_repartidor_id: repartidorId,
      p_repartidor_nombre: repartidorNombre,
      p_cargas: cargas,
    });

    if (error) return { data: null, error };
    return { data: data as string, error: null };
  }

  static async cerrarRuta(
    negocioId: string,
    rutaId: string,
    efectivoEntregadoCentavos: number,
    notas: string = ''
  ): Promise<{ data: string | null; error: Error | null }> {
    const { data, error } = await supabase.rpc('cerrar_ruta', {
      p_negocio_id: negocioId,
      p_ruta_id: rutaId,
      p_efectivo_entregado_centavos: efectivoEntregadoCentavos,
      p_notas: notas,
    });

    if (error) return { data: null, error };
    return { data: data as string, error: null };
  }

  static subscribeRutaActiva(
    negocioId: string,
    repartidorId: string,
    onChange: (ruta: RpRuta | null) => void
  ) {
    this.getRutaActivaRepartidor(negocioId, repartidorId).then(({ data }) => {
      onChange(data);
    });

    const channel = supabase
      .channel(`rp_rutas_${negocioId}_${repartidorId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rp_rutas', filter: `negocio_id=eq.${negocioId}` },
        () => {
          this.getRutaActivaRepartidor(negocioId, repartidorId).then(({ data }) => {
            onChange(data);
          });
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  }

  // -------------------------------------------------------------------
  // 5. OPERACIONES (VENTAS / MERMAS)
  // -------------------------------------------------------------------
  static async getOperaciones(
    negocioId: string,
    filters?: { rutaId?: string; clienteId?: string; limit?: number }
  ): Promise<{ data: RpOperacion[]; error: Error | null }> {
    if (!negocioId) return { data: [], error: new Error('negocioId obligatorio') };

    let query = supabase
      .from('rp_operaciones')
      .select('*')
      .eq('negocio_id', negocioId)
      .order('created_at', { ascending: false });

    if (filters?.rutaId) query = query.eq('ruta_id', filters.rutaId);
    if (filters?.clienteId) query = query.eq('cliente_id', filters.clienteId);
    if (filters?.limit) query = query.limit(filters.limit);

    const { data, error } = await query;
    if (error) return { data: [], error };
    return { data: (data as RpOperacion[]) || [], error: null };
  }

  static async getOperacionItems(
    negocioId: string,
    operacionId: string
  ): Promise<{ data: RpOperacionItem[]; error: Error | null }> {
    if (!negocioId || !operacionId) return { data: [], error: new Error('Parametros invalidos') };

    const { data, error } = await supabase
      .from('rp_operacion_items')
      .select('*')
      .eq('negocio_id', negocioId)
      .eq('operacion_id', operacionId);

    if (error) return { data: [], error };
    return { data: (data as RpOperacionItem[]) || [], error: null };
  }

  static async registrarOperacion(
    negocioId: string,
    payload: RegistrarOperacionPayload
  ): Promise<{ data: string | null; error: Error | null }> {
    const idempotencyKey = payload.idempotency_key || `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const { data, error } = await supabase.rpc('registrar_operacion', {
      p_negocio_id: negocioId,
      p_ruta_id: payload.ruta_id || null,
      p_cliente_id: payload.cliente_id || null,
      p_vendedor_id: payload.vendedor_id || null,
      p_vendedor_nombre: payload.vendedor_nombre,
      p_cliente_nombre: payload.cliente_nombre,
      p_tipo_operacion: payload.tipo_operacion,
      p_tipo_cobro: payload.tipo_cobro,
      p_monto_total_centavos: payload.monto_total_centavos,
      p_items: payload.items,
      p_idempotency_key: idempotencyKey,
    });

    if (error) return { data: null, error };
    return { data: data as string, error: null };
  }

  static subscribeOperaciones(negocioId: string, onChange: (operaciones: RpOperacion[]) => void) {
    this.getOperaciones(negocioId, { limit: 100 }).then(({ data }) => {
      if (data) onChange(data);
    });

    const channel = supabase
      .channel(`rp_operaciones_${negocioId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rp_operaciones', filter: `negocio_id=eq.${negocioId}` },
        () => {
          this.getOperaciones(negocioId, { limit: 100 }).then(({ data }) => {
            if (data) onChange(data);
          });
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  }

  // -------------------------------------------------------------------
  // 6. FIADOS Y ABONOS
  // -------------------------------------------------------------------
  static async getFiados(
    negocioId: string,
    clienteId?: string
  ): Promise<{ data: RpFiado[]; error: Error | null }> {
    if (!negocioId) return { data: [], error: new Error('negocioId obligatorio') };

    let query = supabase
      .from('rp_fiados')
      .select('*')
      .eq('negocio_id', negocioId)
      .order('created_at', { ascending: false });

    if (clienteId) query = query.eq('cliente_id', clienteId);

    const { data, error } = await query;
    if (error) return { data: [], error };
    return { data: (data as RpFiado[]) || [], error: null };
  }

  static async getAbonos(
    negocioId: string,
    clienteId?: string
  ): Promise<{ data: RpAbono[]; error: Error | null }> {
    if (!negocioId) return { data: [], error: new Error('negocioId obligatorio') };

    let query = supabase
      .from('rp_abonos')
      .select('*')
      .eq('negocio_id', negocioId)
      .order('created_at', { ascending: false });

    if (clienteId) query = query.eq('cliente_id', clienteId);

    const { data, error } = await query;
    if (error) return { data: [], error };
    return { data: (data as RpAbono[]) || [], error: null };
  }

  static async registrarAbono(
    negocioId: string,
    clienteId: string,
    rutaId: string | null,
    montoCentavos: number,
    recibidoPor: string,
    idempotencyKey?: string
  ): Promise<{ data: string | null; error: Error | null }> {
    const key = idempotencyKey || `abono_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const { data, error } = await supabase.rpc('registrar_abono', {
      p_negocio_id: negocioId,
      p_cliente_id: clienteId,
      p_ruta_id: rutaId,
      p_monto_centavos: montoCentavos,
      p_recibido_por: recibidoPor,
      p_idempotency_key: key,
    });

    if (error) return { data: null, error };
    return { data: data as string, error: null };
  }

  static async getAbonoAplicaciones(
    negocioId: string,
    abonoId?: string
  ): Promise<{ data: RpAbonoAplicacion[]; error: Error | null }> {
    if (!negocioId) return { data: [], error: new Error('negocioId obligatorio') };

    let query = supabase
      .from('rp_abono_aplicaciones')
      .select('*')
      .eq('negocio_id', negocioId)
      .order('created_at', { ascending: false });

    if (abonoId) query = query.eq('abono_id', abonoId);

    const { data, error } = await query;
    if (error) return { data: [], error };
    return { data: (data as RpAbonoAplicacion[]) || [], error: null };
  }

  static subscribeAbonos(negocioId: string, onChange: (abonos: RpAbono[]) => void) {
    this.getAbonos(negocioId).then(({ data }) => {
      if (data) onChange(data);
    });

    const channel = supabase
      .channel(`rp_abonos_${negocioId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rp_abonos', filter: `negocio_id=eq.${negocioId}` },
        () => {
          this.getAbonos(negocioId).then(({ data }) => {
            if (data) onChange(data);
          });
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  }

  // -------------------------------------------------------------------
  // 7. CORTES Y AUDITORÍAS
  // -------------------------------------------------------------------
  static async getCortes(negocioId: string): Promise<{ data: RpCorte[]; error: Error | null }> {
    if (!negocioId) return { data: [], error: new Error('negocioId obligatorio') };

    const { data, error } = await supabase
      .from('rp_cortes')
      .select('*')
      .eq('negocio_id', negocioId)
      .order('created_at', { ascending: false });

    if (error) return { data: [], error };
    return { data: (data as RpCorte[]) || [], error: null };
  }

  static async getAuditLogs(negocioId: string): Promise<{ data: RpAuditLog[]; error: Error | null }> {
    if (!negocioId) return { data: [], error: new Error('negocioId obligatorio') };

    const { data, error } = await supabase
      .from('rp_audit_log')
      .select('*')
      .eq('negocio_id', negocioId)
      .order('created_at', { ascending: false });

    if (error) return { data: [], error };
    return { data: (data as RpAuditLog[]) || [], error: null };
  }

  static async logAudit(
    negocioId: string,
    accion: string,
    tablaAfectada: string,
    registroId?: string,
    detalles?: Record<string, any>
  ): Promise<{ error: Error | null }> {
    if (!negocioId) return { error: new Error('negocioId obligatorio') };

    const { error } = await supabase.from('rp_audit_log').insert({
      negocio_id: negocioId,
      accion,
      tabla_afectada: tablaAfectada,
      registro_id: registroId || null,
      detalles: detalles || {},
    });

    return { error };
  }

  // -------------------------------------------------------------------
  // 8. MIGRACIÓN HISTÓRICA LA FAVORITA
  // -------------------------------------------------------------------
  static async migrarDatosHistoricos(
    negocioId: string
  ): Promise<{ data: any | null; error: Error | null }> {
    if (!negocioId) return { data: null, error: new Error('negocioId obligatorio') };

    const { data, error } = await supabase.rpc('migrar_datos_historicos_la_favorita', {
      p_negocio_id: negocioId,
    });

    if (error) return { data: null, error };
    return { data, error: null };
  }
}
