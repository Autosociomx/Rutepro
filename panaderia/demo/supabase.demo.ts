/**
 * Sustituto de src/supabase.ts para la demostración.
 * No hay red, no hay credenciales, no hay servidor: todo vive en el navegador.
 */

export const isConfigured = true;

export const supabase: any = null;
export const db: any = { __demo: true };
export const auth: any = null;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
}

export function ensureSession(): Promise<string | null> {
  return Promise.resolve('demo-local');
}

export function signOutSession(): Promise<void> {
  return Promise.resolve();
}

export function handleDbError(error: unknown, operationType: OperationType, path: string | null) {
  console.warn('[Demo] Operación local:', operationType, path, error);
  return {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: { userId: 'demo-local' }
  };
}

export function testConnection(): Promise<boolean> {
  return Promise.resolve(true);
}
