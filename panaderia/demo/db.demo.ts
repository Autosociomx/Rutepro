/**
 * Sustituto de src/lib/db.ts para la demostración.
 *
 * Misma interfaz exacta, pero guardando en el navegador (localStorage) en vez
 * de Postgres. Así el HTML de demostración se abre con doble clic, funciona
 * sin internet y no toca ninguna base de datos real.
 */

const PREFIX = 'rp_demo_';

type Store = Record<string, any>;

export type WhereOp = '==' | '!=' | '>' | '>=' | '<' | '<=' | 'in';

export interface DocRef { __rp: 'doc'; table: string; id: string; path: string }
export interface CollectionRef { __rp: 'collection'; table: string; path: string }
export interface QueryRef {
  __rp: 'query';
  table: string;
  path: string;
  filters: Array<{ field: string; op: WhereOp; value: any }>;
  orders: Array<{ field: string; dir: 'asc' | 'desc' }>;
  max?: number;
}
export interface DocSnapshot { id: string; exists: () => boolean; data: () => any }
export interface QuerySnapshot {
  docs: DocSnapshot[];
  size: number;
  empty: boolean;
  forEach: (cb: (d: DocSnapshot, i: number) => void) => void;
}

type Constraint =
  | { __c: 'where'; field: string; op: WhereOp; value: any }
  | { __c: 'order'; field: string; dir: 'asc' | 'desc' }
  | { __c: 'limit'; n: number };

// ─── Almacén local ──────────────────────────────────────────────────

const listeners: Record<string, Set<() => void>> = {};

// Respaldo en memoria: hay navegadores y visores de archivos que bloquean el
// almacenamiento local al abrir un documento desde el disco. En ese caso la
// demostración funciona igual, sólo que no recuerda nada al recargar.
const memoria: Record<string, Store> = {};
let usarMemoria = false;

try {
  const sonda = '__rp_prueba__';
  localStorage.setItem(sonda, '1');
  localStorage.removeItem(sonda);
} catch {
  usarMemoria = true;
  console.warn('[Demo] El navegador bloquea el almacenamiento local; se usa memoria temporal.');
}

function readStore(table: string): Store {
  if (usarMemoria) return memoria[table] || {};
  try {
    return JSON.parse(localStorage.getItem(PREFIX + table) || '{}');
  } catch {
    return memoria[table] || {};
  }
}

function writeStore(table: string, store: Store) {
  memoria[table] = store;
  try {
    if (!usarMemoria) localStorage.setItem(PREFIX + table, JSON.stringify(store));
  } catch (e) {
    usarMemoria = true;
    console.warn('[Demo] Sin espacio o sin permiso de almacenamiento; se continúa en memoria:', e);
  }
  (listeners[table] ||= new Set()).forEach((fn) => {
    try { fn(); } catch (e) { console.warn('[Demo] Error al avisar cambio:', e); }
  });
}

/** Carga directa usada por el sembrado de datos de muestra. */
export function demoSeedTable(table: string, rows: Record<string, any>) {
  writeStore(table, rows);
}

/** ¿La demostración ya tiene datos cargados? */
export function demoHayDatos(): boolean {
  return Object.keys(readStore('ventas')).length > 0;
}

export function demoClearAll() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith(PREFIX) || k.startsWith('rp_'))
    .forEach((k) => localStorage.removeItem(k));
}

function toJson<T>(value: T): any {
  try {
    return JSON.parse(JSON.stringify(value ?? {}));
  } catch {
    return {};
  }
}

function snapOf(id: string, data: any): DocSnapshot {
  return { id, exists: () => data !== undefined, data: () => data };
}

function listSnapshot(rows: Array<[string, any]>): QuerySnapshot {
  const docs = rows.map(([id, data]) => snapOf(id, data));
  return {
    docs,
    size: docs.length,
    empty: docs.length === 0,
    forEach: (cb) => docs.forEach((d, i) => cb(d, i))
  };
}

// ─── Referencias y restricciones ────────────────────────────────────

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

function runQuery(q: QueryRef): Array<[string, any]> {
  const store = readStore(q.table);
  let rows = Object.entries(store);

  for (const f of q.filters) {
    rows = rows.filter(([id, row]) => {
      const v = f.field === 'id' ? id : row?.[f.field];
      switch (f.op) {
        case '==': return v === f.value;
        case '!=': return v !== f.value;
        case '>': return v > f.value;
        case '>=': return v >= f.value;
        case '<': return v < f.value;
        case '<=': return v <= f.value;
        case 'in': return Array.isArray(f.value) && f.value.includes(v);
        default: return true;
      }
    });
  }

  for (const o of [...q.orders].reverse()) {
    rows.sort((a, b) => {
      const va = o.field === 'id' ? a[0] : a[1]?.[o.field];
      const vb = o.field === 'id' ? b[0] : b[1]?.[o.field];
      if (va === vb) return 0;
      if (va === undefined || va === null) return 1;
      if (vb === undefined || vb === null) return -1;
      const res = va > vb ? 1 : -1;
      return o.dir === 'desc' ? -res : res;
    });
  }

  return q.max ? rows.slice(0, q.max) : rows;
}

// ─── Lecturas y escrituras ──────────────────────────────────────────

export async function getDoc(ref: DocRef): Promise<DocSnapshot> {
  return snapOf(ref.id, readStore(ref.table)[ref.id]);
}

export const getDocFromServer = getDoc;

export async function getDocs(target: QueryRef | CollectionRef): Promise<QuerySnapshot> {
  const q: QueryRef = (target as QueryRef).__rp === 'query' ? (target as QueryRef) : query(target as CollectionRef);
  return listSnapshot(runQuery(q));
}

export async function setDoc(ref: DocRef, value: any): Promise<void> {
  const store = readStore(ref.table);
  store[ref.id] = toJson(value);
  writeStore(ref.table, store);
}

export async function updateDoc(ref: DocRef, value: any): Promise<void> {
  const store = readStore(ref.table);
  store[ref.id] = { ...(store[ref.id] || {}), ...toJson(value) };
  writeStore(ref.table, store);
}

export async function addDoc(ref: CollectionRef, value: any): Promise<DocRef> {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const target = doc(null, ref.table, id);
  await setDoc(target, { ...toJson(value), id });
  return target;
}

export async function deleteDoc(ref: DocRef): Promise<void> {
  const store = readStore(ref.table);
  delete store[ref.id];
  writeStore(ref.table, store);
}

export function writeBatch(_db?: unknown) {
  const ops: Array<() => void> = [];
  const batch = {
    set(ref: DocRef, value: any) {
      ops.push(() => {
        const store = readStore(ref.table);
        store[ref.id] = toJson(value);
        writeStore(ref.table, store);
      });
      return batch;
    },
    update(ref: DocRef, value: any) {
      return batch.set(ref, value);
    },
    delete(ref: DocRef) {
      ops.push(() => {
        const store = readStore(ref.table);
        delete store[ref.id];
        writeStore(ref.table, store);
      });
      return batch;
    },
    async commit() {
      ops.forEach((op) => op());
      ops.length = 0;
    }
  };
  return batch;
}

export function onSnapshot(
  target: DocRef | CollectionRef | QueryRef,
  onNext: (snap: any) => void,
  _onError?: (err: any) => void
): () => void {
  const isDoc = (target as DocRef).__rp === 'doc';
  const table = (target as any).table as string;
  let active = true;

  const load = () => {
    if (!active) return;
    if (isDoc) {
      const ref = target as DocRef;
      onNext(snapOf(ref.id, readStore(ref.table)[ref.id]));
    } else {
      const q: QueryRef = (target as QueryRef).__rp === 'query' ? (target as QueryRef) : query(target as CollectionRef);
      onNext(listSnapshot(runQuery(q)));
    }
  };

  load();
  (listeners[table] ||= new Set()).add(load);

  return () => {
    active = false;
    listeners[table]?.delete(load);
  };
}
