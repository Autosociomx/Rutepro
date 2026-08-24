export type Result<T, E extends string = string> =
  | { ok: true; value: T }
  | { ok: false; error: E; details?: Record<string, unknown> };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E extends string>(
  error: E,
  details?: Record<string, unknown>,
): Result<never, E> => ({ ok: false, error, details });

export function mapResult<T, U, E extends string>(
  result: Result<T, E>,
  mapper: (value: T) => U,
): Result<U, E> {
  return result.ok ? ok(mapper(result.value)) : result;
}
