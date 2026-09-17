/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Acceso a datos sobre Supabase con la misma forma que usaban las pantallas
 * (`doc`, `collection`, `query`, `getDocs`, `onSnapshot`, `setDoc`,
 * `writeBatch`). Esto deja las 5 pantallas intactas y concentra en un solo
 * archivo todo lo que toca la base — el día que haya que cambiar el esquema
 * o meter multi-sucursal, se edita aquí y en ningún otro lado.
 *
 * Modelo de datos: cada "colección" es una tabla con
 *   id    text primary key
 *   data  jsonb        ← el documento completo
 *   ts / vendedor_id   ← columnas derivadas (trigger) para ordenar y filtrar
 */

import { supabase, ensureSession, handleDbError, OperationType } from '../supabase';

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────

export type WhereOp = '==' | '!=' | '>' | '>=' | '<' | '<=' | 'in';

export interface DocRef {
  __rp: 'doc';
  table: string;
  id: string;
  path: string;
}

export interface CollectionRef {
  __rp: 'collection';
  table: string;
  path: string;
}

export interface QueryRef {
  __rp: 'query';
  table: string;
  path: string;
  filters: Array<{ field: string; op: WhereOp; value: any }>;
  orders: Array<{ field: string; dir: 'asc' | 'desc' }>;
  max?: number;
}

export interface DocSnapshot {
  id: string;
  exists: () => boolean;
  data: () => any;
}

export interface QuerySnapshot {
  docs: DocSnapshot[];
  size: number;
  empty: boolean;
  forEach: (cb: (d: DocSnapshot, index: number) => void) => void;
}

type Constraint =
  | { __c: 'where'; field: string; op: WhereOp; value: any }
  | { __c: 'order'; field: string; dir: 'asc' | 'desc' }
  | { __c: 'limit'; n: number };

// ─────────────────────────────────────────────────────────────
// Mapeo de campos del documento a columnas reales
// ─────────────────────────────────────────────────────────────
// `timestamp` y `vendedorId` viven además como columnas indexadas, para que
// ordenar por fecha sea un índice y no un escaneo de JSON. Cualquier otro
// campo se resuelve contra el jsonb.

const COLUMN_BY_FIELD: Record<string, string> = {
  id: 'id',
  timestamp: 'ts',
  vendedorId: 'vendedor_id'
};

function columnFor(field: string): string {
  return COLUMN_BY_FIELD[field] ?? `data->>${field}`;
}

/** Quita `undefined`, funciones y referencias cíclicas antes de guardar. */
function toJson<T>(value: T): any {
  try {
    return JSON.parse(JSON.stringify(value ?? {}));
  } catch {
    return {};
  }
}

function rowToSnapshot(row: any): DocSnapshot {
  const payload = row?.data ?? {};
  return {
    id: String(row?.id ?? ''),
    exists: () => Boolean(row),
    data: () => payload
  };
}

function rowsToQuerySnapshot(rows: any[]): QuerySnapshot {
  const docs = (rows || []).map(rowToSnapshot);
  return {
    docs,
    size: docs.length,
    empty: docs.length === 0,
    forEach: (cb) => docs.forEach((d, i) => cb(d, i))
  };
}

// ─────────────────────────────────────────────────────────────
// Referencias y restricciones
// ─────────────────────────────────────────────────────────────

export function doc(_db: unknown, table: string, id: string): DocRef {
  return { __rp: 'doc', table, id: String(id), path: `${table}/${id}` };
}

export function collection(_db: unknown, table: string): CollectionRef {
  return { __rp: 'collection', table, path: table };
}

export function where(field: string, op: WhereOp, value: any): Constraint {
  return { __c: 'where', field, op, value };
}

export function orderBy(field: string, dir: 'asc' | 'desc' = 'asc'): Constraint {
  return { __c: 'order', field, dir };
}

export function limit(n: number): Constraint {
  return { __c: 'limit', n };
}

export function query(base: CollectionRef | QueryRef, ...constraints: Constraint[]): QueryRef {
  const start: QueryRef =
    (base as QueryRef).__rp === 'query'
      ? { ...(base as QueryRef), filters: [...(base as QueryRef).filters], orders: [...(base as QueryRef).orders] }
      : { __rp: 'query', table: base.table, path: base.path, filters: [], orders: [] };

  for (const c of constraints) {
    if (!c) continue;
    if (c.__c === 'where') start.filters.push({ field: c.field, op: c.op, value: c.value });
    else if (c.__c === 'order') start.orders.push({ field: c.field, dir: c.dir });
    else if (c.__c === 'limit') start.max = c.n;
  }
  return start;
}

function buildSelect(q: QueryRef) {
  let builder: any = supabase.from(q.table).select('id,data');

  for (const f of q.filters) {
    const column = columnFor(f.field);
    switch (f.op) {
      case '==': builder = builder.eq(column, f.value); break;
      case '!=': builder = builder.neq(column, f.value); break;
      case '>': builder = builder.gt(column, f.value); break;
      case '>=': builder = builder.gte(column, f.value); break;
      case '<': builder = builder.lt(column, f.value); break;
      case '<=': builder = builder.lte(column, f.value); break;
      case 'in': builder = builder.in(column, f.value); break;
    }
  }

  for (const o of q.orders) {
    builder = builder.order(columnFor(o.field), { ascending: o.dir === 'asc', nullsFirst: false });
  }

  if (q.max) builder = builder.limit(q.max);
  return builder;
}

// ─────────────────────────────────────────────────────────────
// Lecturas
// ─────────────────────────────────────────────────────────────

export async function getDoc(ref: DocRef): Promise<DocSnapshot> {
  await ensureSession();
  const { data, error } = await supabase
    .from(ref.table)
    .select('id,data')
    .eq('id', ref.id)
    .maybeSingle();

  if (error) {
    handleDbError(error, OperationType.GET, ref.path);
    throw error;
  }
  return data ? rowToSnapshot(data) : { id: ref.id, exists: () => false, data: () => undefined };
}

/** Sin caché local: en Supabase toda lectura ya va al servidor. */
export const getDocFromServer = getDoc;

export async function getDocs(target: QueryRef | CollectionRef): Promise<QuerySnapshot> {
  await ensureSession();
  const q: QueryRef = (target as QueryRef).__rp === 'query' ? (target as QueryRef) : query(target as CollectionRef);

  const { data, error } = await buildSelect(q);
  if (error) {
    handleDbError(error, OperationType.LIST, q.path);
    throw error;
  }
  return rowsToQuerySnapshot(data || []);
}

// ─────────────────────────────────────────────────────────────
// Escrituras
// ─────────────────────────────────────────────────────────────

export async function setDoc(ref: DocRef, value: any): Promise<void> {
  await ensureSession();
  const { error } = await supabase
    .from(ref.table)
    .upsert({ id: ref.id, data: toJson(value) }, { onConflict: 'id' });

  if (error) {
    handleDbError(error, OperationType.WRITE, ref.path);
    throw error;
  }
}

/** Inserta con id generado (equivalente a `addDoc` de Firestore). */
export async function addDoc(ref: CollectionRef, value: any): Promise<DocRef> {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const target = doc(null, ref.table, id);
  await setDoc(target, { ...toJson(value), id });
  return target;
}

export async function updateDoc(ref: DocRef, value: any): Promise<void> {
  const current = await getDoc(ref);
  const merged = { ...(current.data() || {}), ...toJson(value) };
  await setDoc(ref, merged);
}

export async function deleteDoc(ref: DocRef): Promise<void> {
  await ensureSession();
  const { error } = await supabase.from(ref.table).delete().eq('id', ref.id);
  if (error) {
    handleDbError(error, OperationType.DELETE, ref.path);
    throw error;
  }
}

/**
 * Lote de escrituras. Agrupa por tabla para mandar el mínimo de peticiones.
 *
 * Nota: no es una transacción única como el batch de Firestore. Si hace falta
 * atomicidad real (p. ej. un corte de caja), conviene una función RPC en
 * Postgres; para el "limpiar todo" del panel esto es suficiente.
 */
export function writeBatch(_db?: unknown) {
  const upserts: Record<string, Array<{ id: string; data: any }>> = {};
  const deletions: Record<string, string[]> = {};

  const batch = {
    set(ref: DocRef, value: any) {
      (upserts[ref.table] ||= []).push({ id: ref.id, data: toJson(value) });
      return batch;
    },
    update(ref: DocRef, value: any) {
      return batch.set(ref, value);
    },
    delete(ref: DocRef) {
      (deletions[ref.table] ||= []).push(ref.id);
      return batch;
    },
    async commit() {
      await ensureSession();

      for (const [table, ids] of Object.entries(deletions)) {
        // PostgREST limita el largo de la URL: se borra en tandas.
        for (let i = 0; i < ids.length; i += 200) {
          const chunk = ids.slice(i, i + 200);
          const { error } = await supabase.from(table).delete().in('id', chunk);
          if (error) {
            handleDbError(error, OperationType.DELETE, table);
            throw error;
          }
        }
      }

      for (const [table, rows] of Object.entries(upserts)) {
        for (let i = 0; i < rows.length; i += 200) {
          const chunk = rows.slice(i, i + 200);
          const { error } = await supabase.from(table).upsert(chunk, { onConflict: 'id' });
          if (error) {
            handleDbError(error, OperationType.WRITE, table);
            throw error;
          }
        }
      }
    }
  };

  return batch;
}

// ─────────────────────────────────────────────────────────────
// Tiempo real
// ─────────────────────────────────────────────────────────────

let channelSeq = 0;

/**
 * Suscripción en vivo a un documento o a una consulta.
 *
 * Estrategia: primera carga inmediata + recarga (con pequeño debounce) cada
 * vez que Postgres avisa un cambio en esa tabla. Para el volumen de una
 * panadería es exacto y simple; si algún día una tabla crece mucho, aquí es
 * donde se cambia por aplicar el delta del evento.
 */
export function onSnapshot(
  target: DocRef | CollectionRef | QueryRef,
  onNext: (snap: any) => void,
  onError?: (err: any) => void
): () => void {
  const isDoc = (target as DocRef).__rp === 'doc';
  const table = (target as any).table as string;
  let active = true;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const load = async () => {
    try {
      const snap = isDoc
        ? await getDoc(target as DocRef)
        : await getDocs(target as QueryRef | CollectionRef);
      if (active) onNext(snap);
    } catch (err) {
      if (active && onError) onError(err);
    }
  };

  void load();

  const channel = supabase
    .channel(`rp_${table}_${++channelSeq}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        ...(isDoc ? { filter: `id=eq.${(target as DocRef).id}` } : {})
      },
      () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => { void load(); }, 150);
      }
    )
    .subscribe();

  return () => {
    active = false;
    if (timer) clearTimeout(timer);
    void supabase.removeChannel(channel);
  };
}
