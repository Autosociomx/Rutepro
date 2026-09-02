/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Cloud sync layer (offline-first).
 *
 * Route sellers work without signal for hours at a time, so every operation is
 * written to device storage first and *then* pushed to Supabase through the
 * transactional RPCs (`registrar_operacion`, `registrar_abono`). Each queued
 * item carries a stable idempotency key, so replaying the queue after a crash,
 * a tab reload or a flaky connection can never double-charge a customer.
 *
 * Without this layer sales only ever existed in one browser's localStorage:
 * clearing site data destroyed the books, and the owner's phone never saw what
 * the route sold.
 */

import { RouteProRepository, RegistrarOperacionPayload } from './routeproRepository';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const QUEUE_KEY = 'rp_sync_queue';

/**
 * Demo mode runs against a synthetic business id ('demo-isolated-negocio') and
 * must never touch a real tenant. Only genuine UUIDs are allowed into the queue.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function esNegocioReal(negocioId: string | null | undefined): negocioId is string {
  return !!negocioId && UUID_RE.test(negocioId);
}

/** Give up auto-retrying after this many failures and surface the item to the owner. */
const MAX_INTENTOS = 8;

export interface QueuedOperation {
  /** Idempotency key — stable across retries. Also links back to the local record. */
  key: string;
  negocioId: string;
  kind: 'operacion' | 'abono';
  /** Payload for `registrar_operacion` (kind === 'operacion'). */
  payload?: RegistrarOperacionPayload;
  /** Payload for `registrar_abono` (kind === 'abono'). */
  abono?: {
    cliente_nombre: string;
    monto_centavos: number;
    recibido_por: string;
  };
  createdAt: number;
  intentos: number;
  ultimoError?: string;
  /** Set once the item exhausted MAX_INTENTOS; needs the owner to review it. */
  bloqueada?: boolean;
}

export interface SyncSummary {
  enviadas: number;
  pendientes: number;
  bloqueadas: number;
  errores: string[];
}

// ─────────────────────────────────────────────────────────────
// Queue persistence
// ─────────────────────────────────────────────────────────────

function readQueue(): QueuedOperation[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedOperation[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('[CloudSync] No se pudo escribir la cola de sincronización:', e);
  }
}

/** Operations still waiting to reach the cloud (blocked ones included). */
export function operacionesPendientes(): QueuedOperation[] {
  return readQueue();
}

/** Count of items the owner should know about, split by state. */
export function estadoCola(): { pendientes: number; bloqueadas: number } {
  const queue = readQueue();
  return {
    pendientes: queue.filter((q) => !q.bloqueada).length,
    bloqueadas: queue.filter((q) => q.bloqueada).length,
  };
}

/** Clears a blocked item after the owner reviewed it (kept in local history). */
export function descartarOperacion(key: string): void {
  writeQueue(readQueue().filter((q) => q.key !== key));
}

/** Re-arms a blocked item for another sync attempt. */
export function reintentarOperacion(key: string): void {
  writeQueue(
    readQueue().map((q) => (q.key === key ? { ...q, bloqueada: false, intentos: 0, ultimoError: undefined } : q))
  );
}

// ─────────────────────────────────────────────────────────────
// Enqueue
// ─────────────────────────────────────────────────────────────

/**
 * Queues a sale / merma / devolución for the cloud. Safe to call with no
 * business id (demo or logged-out): the operation is simply not queued, since
 * there is no tenant to attribute it to.
 */
export function encolarOperacion(
  negocioId: string | null,
  key: string,
  payload: RegistrarOperacionPayload
): void {
  if (!esNegocioReal(negocioId) || !isSupabaseConfigured) return;

  const queue = readQueue();
  if (queue.some((q) => q.key === key)) return; // already queued

  queue.push({
    key,
    negocioId,
    kind: 'operacion',
    payload: { ...payload, idempotency_key: key },
    createdAt: Date.now(),
    intentos: 0,
  });
  writeQueue(queue);
}

/** Queues a credit payment (abono) for the cloud. */
export function encolarAbono(
  negocioId: string | null,
  key: string,
  abono: { cliente_nombre: string; monto_centavos: number; recibido_por: string }
): void {
  if (!esNegocioReal(negocioId) || !isSupabaseConfigured) return;

  const queue = readQueue();
  if (queue.some((q) => q.key === key)) return;

  queue.push({
    key,
    negocioId,
    kind: 'abono',
    abono,
    createdAt: Date.now(),
    intentos: 0,
  });
  writeQueue(queue);
}

// ─────────────────────────────────────────────────────────────
// Name → id resolution
// ─────────────────────────────────────────────────────────────

/**
 * The counter and route screens work from the config catalog (local ids), while
 * the RPCs want real `rp_productos` / `rp_clientes` UUIDs so stock and debt
 * balances move. We resolve by name, which is what the seller actually typed.
 * A product that can't be matched still syncs — it just doesn't move stock.
 */
async function resolverProductoIds(negocioId: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const { data } = await RouteProRepository.getProductos(negocioId);
  for (const p of data || []) {
    if (p.nombre) map.set(p.nombre.trim().toLowerCase(), p.id);
  }
  return map;
}

/** Finds a client by name, creating it when the seller registered a new one on the route. */
async function resolverClienteId(
  negocioId: string,
  nombre: string
): Promise<{ id: string | null; error?: string }> {
  const limpio = (nombre || '').trim();
  if (!limpio) return { id: null };

  const { data, error } = await supabase
    .from('rp_clientes')
    .select('id')
    .eq('negocio_id', negocioId)
    .ilike('nombre', limpio)
    .limit(1)
    .maybeSingle();

  if (error) return { id: null, error: error.message };
  if (data?.id) return { id: data.id };

  const { data: creado, error: createError } = await RouteProRepository.upsertCliente(negocioId, {
    nombre: limpio,
  });
  if (createError) return { id: null, error: createError.message };
  return { id: creado?.id ?? null };
}

// ─────────────────────────────────────────────────────────────
// Flush
// ─────────────────────────────────────────────────────────────

/** Network-ish failures should retry forever; business rejections should not. */
function esErrorTransitorio(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('failed to fetch') ||
    m.includes('networkerror') ||
    m.includes('network request failed') ||
    m.includes('load failed') ||
    m.includes('timeout') ||
    m.includes('fetch failed')
  );
}

let sincronizando = false;

/**
 * Pushes every queued operation for `negocioId` to Supabase. Idempotent and
 * safe to call repeatedly — concurrent calls collapse into one.
 */
export async function sincronizarPendientes(negocioId: string | null): Promise<SyncSummary> {
  const vacio: SyncSummary = { enviadas: 0, pendientes: 0, bloqueadas: 0, errores: [] };

  if (!esNegocioReal(negocioId) || !isSupabaseConfigured || sincronizando) return { ...vacio, ...estadoCola() };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ...vacio, ...estadoCola() };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ...vacio, ...estadoCola() }; // not signed in — nothing to push as

  sincronizando = true;
  const errores: string[] = [];
  let enviadas = 0;

  try {
    const queue = readQueue();
    const target = queue.filter((q) => q.negocioId === negocioId && !q.bloqueada);
    if (target.length === 0) return { ...vacio, ...estadoCola() };

    const productos = await resolverProductoIds(negocioId);
    const enviadasKeys = new Set<string>();

    for (const item of target) {
      try {
        if (item.kind === 'abono' && item.abono) {
          const { id: clienteId, error: cliErr } = await resolverClienteId(negocioId, item.abono.cliente_nombre);
          if (!clienteId) throw new Error(cliErr || 'No se pudo identificar al cliente del abono.');

          const { error } = await RouteProRepository.registrarAbono(
            negocioId,
            clienteId,
            null,
            item.abono.monto_centavos,
            item.abono.recibido_por,
            item.key
          );
          if (error) throw error;
        } else if (item.payload) {
          const payload: RegistrarOperacionPayload = {
            ...item.payload,
            items: item.payload.items.map((it) => ({
              ...it,
              producto_id: it.producto_id || productos.get(it.producto_nombre.trim().toLowerCase()),
            })),
          };

          // Credit sales create a debt row, so the RPC insists on a real client.
          if (payload.tipo_cobro === 'credito' && !payload.cliente_id) {
            const { id: clienteId, error: cliErr } = await resolverClienteId(negocioId, payload.cliente_nombre);
            if (!clienteId) throw new Error(cliErr || 'No se pudo identificar al cliente de la venta a crédito.');
            payload.cliente_id = clienteId;
          }

          const { error } = await RouteProRepository.registrarOperacion(negocioId, payload);
          if (error) throw error;
        } else {
          throw new Error('Operación en cola sin contenido.');
        }

        enviadasKeys.add(item.key);
        enviadas += 1;
      } catch (e: any) {
        const message = e?.message || String(e);
        errores.push(message);

        // A transient network failure must not burn a retry: the operation is
        // still valid, the phone simply lost signal mid-route.
        if (!esErrorTransitorio(message)) {
          item.intentos += 1;
          item.ultimoError = message;
          if (item.intentos >= MAX_INTENTOS) item.bloqueada = true;
        } else {
          item.ultimoError = message;
        }
      }
    }

    // Persist: drop what landed, keep the rest with its updated retry state.
    const restante = readQueue()
      .filter((q) => !enviadasKeys.has(q.key))
      .map((q) => {
        const updated = target.find((t) => t.key === q.key);
        return updated ? { ...q, ...updated } : q;
      });
    writeQueue(restante);

    marcarLocalesSincronizadas(enviadasKeys);
  } finally {
    sincronizando = false;
  }

  return { enviadas, errores, ...estadoCola() };
}

/** Mirrors the sync state onto the local sale records so the UI can show it. */
function marcarLocalesSincronizadas(keys: Set<string>): void {
  if (keys.size === 0) return;
  try {
    const raw = localStorage.getItem('rp_ventas');
    if (!raw) return;
    const ventas = JSON.parse(raw);
    if (!Array.isArray(ventas)) return;
    let cambio = false;
    for (const v of ventas) {
      if (keys.has(v.id) && !v.sincronizado) {
        v.sincronizado = true;
        cambio = true;
      }
    }
    if (cambio) localStorage.setItem('rp_ventas', JSON.stringify(ventas));
  } catch (e) {
    console.warn('[CloudSync] No se pudo marcar ventas locales como sincronizadas:', e);
  }
}

// ─────────────────────────────────────────────────────────────
// Auto sync
// ─────────────────────────────────────────────────────────────

/**
 * Starts background syncing for a business: on reconnect, when the tab becomes
 * visible again, and on a slow interval as a safety net. Returns a cleanup fn.
 */
export function iniciarAutoSync(
  negocioId: string | null,
  onSync?: (summary: SyncSummary) => void,
  intervaloMs = 60_000
): () => void {
  if (!esNegocioReal(negocioId) || !isSupabaseConfigured) return () => {};

  let cancelado = false;

  const run = () => {
    if (cancelado) return;
    sincronizarPendientes(negocioId)
      .then((summary) => {
        if (!cancelado && onSync) onSync(summary);
      })
      .catch((e) => console.warn('[CloudSync] Fallo de sincronización:', e));
  };

  const onVisibility = () => {
    if (document.visibilityState === 'visible') run();
  };

  run();
  window.addEventListener('online', run);
  document.addEventListener('visibilitychange', onVisibility);
  const timer = window.setInterval(run, intervaloMs);

  return () => {
    cancelado = true;
    window.removeEventListener('online', run);
    document.removeEventListener('visibilitychange', onVisibility);
    window.clearInterval(timer);
  };
}

// ─────────────────────────────────────────────────────────────
// Helpers for the screens
// ─────────────────────────────────────────────────────────────

/** Maps a local sale record onto the RPC payload shape. */
export function ventaLocalAPayload(venta: {
  id: string;
  vendedorNombre: string;
  clienteNombre: string;
  monto: number;
  tipoCobro: string;
  items: Array<{ id: string; nombre: string; q: number; pr: number }>;
}): RegistrarOperacionPayload {
  return {
    vendedor_nombre: venta.vendedorNombre,
    cliente_nombre: venta.clienteNombre,
    tipo_operacion: 'venta',
    // The UI writes 'crédito' (accented); the RPC enum is 'credito'.
    tipo_cobro: venta.tipoCobro === 'crédito' || venta.tipoCobro === 'credito' ? 'credito' : 'efectivo',
    monto_total_centavos: venta.monto,
    idempotency_key: venta.id,
    items: venta.items.map((it) => ({
      producto_nombre: it.nombre,
      cantidad: it.q,
      precio_unitario_centavos: it.pr,
      subtotal_centavos: Math.round(it.q * it.pr),
    })),
  };
}

/** Maps a local return/merma record onto the RPC payload shape. */
export function devolucionLocalAPayload(devolucion: {
  id: string;
  vendedorNombre: string;
  clienteNombre: string;
  productoNombre: string;
  cantidad: number;
}): RegistrarOperacionPayload {
  return {
    vendedor_nombre: devolucion.vendedorNombre,
    cliente_nombre: devolucion.clienteNombre,
    tipo_operacion: 'devolucion',
    tipo_cobro: 'gratis',
    monto_total_centavos: 0,
    idempotency_key: devolucion.id,
    items: [
      {
        producto_nombre: devolucion.productoNombre,
        cantidad: devolucion.cantidad,
        precio_unitario_centavos: 0,
        subtotal_centavos: 0,
      },
    ],
  };
}
