/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Capa de conexión a Supabase (Postgres + Realtime + Auth).
 * Sustituye a `src/firebase.ts` de la plantilla original.
 *
 * Las credenciales NO viven en el repositorio: se leen de variables de
 * entorno Vite (`.env.local`). La llave `anon` es pública por diseño —
 * quien protege los datos es Row Level Security en la base, no ocultarla.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || '';
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';

/** `false` cuando faltan las variables de entorno: la UI lo puede avisar. */
export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!isConfigured) {
  console.error(
    '[RutePro] Falta VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. ' +
    'Copia .env.example a .env.local, llena los valores del proyecto Supabase y reinicia el servidor.'
  );
}

export const supabase: SupabaseClient = createClient(
  SUPABASE_URL || 'https://sin-configurar.supabase.co',
  SUPABASE_ANON_KEY || 'sin-configurar',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'rp_session'
    },
    realtime: { params: { eventsPerSecond: 5 } },
    global: { headers: { 'x-application-name': 'rutepro-panaderia' } }
  }
);

/** Alias histórico: las pantallas siguen recibiendo `db` como primer argumento. */
export const db = supabase;
export const auth = supabase.auth;

// ─────────────────────────────────────────────────────────────
// Sesión
// ─────────────────────────────────────────────────────────────
// Las políticas RLS exigen un usuario autenticado, así que la app abre una
// sesión anónima al arrancar. Toda operación de datos espera esta promesa
// antes de consultar, para que no haya carrera entre el primer render y el
// login (la plantilla original sí tenía esa carrera).

let sessionPromise: Promise<string | null> | null = null;

export function ensureSession(): Promise<string | null> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      try {
        const { data: existing } = await supabase.auth.getSession();
        if (existing.session?.user?.id) return existing.session.user.id;

        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        return data.user?.id ?? null;
      } catch (err) {
        console.warn(
          '[RutePro] No se pudo abrir sesión anónima. Revisa que "Anonymous sign-ins" ' +
          'esté habilitado en Supabase → Authentication → Providers.',
          err
        );
        // Se limpia para reintentar en la siguiente operación (p. ej. al volver la red).
        sessionPromise = null;
        return null;
      }
    })();
  }
  return sessionPromise;
}

/** Cierra la sesión del dispositivo sin tocar los datos del negocio. */
export async function signOutSession(): Promise<void> {
  sessionPromise = null;
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('[RutePro] Error al cerrar sesión local:', err);
  }
}

// ─────────────────────────────────────────────────────────────
// Errores
// ─────────────────────────────────────────────────────────────

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
}

export interface DbErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: { userId?: string | null };
}

/**
 * Registra el error con contexto y lo devuelve.
 *
 * A diferencia de la plantilla (`handleFirestoreError`), NO relanza: se
 * llamaba dentro de callbacks de suscripción, donde lanzar dejaba la pantalla
 * atorada en "cargando". Quien necesite cortar el flujo, que revise el valor.
 */
export function handleDbError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): DbErrorInfo {
  const info: DbErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: { userId: null }
  };
  console.error('[RutePro] Error de base de datos:', JSON.stringify(info));
  return info;
}

/** Sonda de arranque: confirma credenciales, RLS y sesión sin romper la app. */
export async function testConnection(): Promise<boolean> {
  if (!isConfigured) return false;
  try {
    await ensureSession();
    const { error } = await supabase.from('config').select('id').limit(1);
    if (error) {
      console.warn('[RutePro] Sin acceso a la tabla `config`:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[RutePro] No se pudo contactar a Supabase:', err);
    return false;
  }
}
