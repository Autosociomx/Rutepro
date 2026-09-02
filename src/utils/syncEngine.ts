/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** Upper bound for any single sale, in cents ($1,000,000.00). */
export const MAX_MONTO_CENTS = 100000000;

export interface SyncResult {
  ventasSincronizadas: number;
  devolucionesSincronizadas: number;
}

/**
 * Validates a sale locally before registration and cloud storage.
 * Verifies that the items are well-formed, quantities are positive integers,
 * and the recorded total value exactly matches the calculated sum of the items.
 */
export function validateSale(sale: any): { isValid: boolean; reason?: string } {
  if (!sale) return { isValid: false, reason: 'La venta está vacía.' };
  if (!sale.id) return { isValid: false, reason: 'ID de venta ausente.' };
  if (!sale.vendedorId) return { isValid: false, reason: 'Identificador de vendedor ausente.' };
  if (!sale.clienteNombre || sale.clienteNombre.trim().length === 0) {
    return { isValid: false, reason: 'Nombre de cliente inválido.' };
  }
  if (!Array.isArray(sale.items) || sale.items.length === 0) {
    return { isValid: false, reason: 'El carrito de compras está vacío.' };
  }

  let calculatedTotal = 0;
  for (const it of sale.items) {
    if (!it.id) return { isValid: false, reason: 'ID de producto ausente en el carrito.' };
    if (!it.nombre) return { isValid: false, reason: 'Nombre de producto ausente en el carrito.' };

    const qty = Number(it.q);
    const priceCents = Number(it.pr);

    // Reject NaN/Infinity outright: coercing them to 0 would let a corrupted
    // cart through with a total that no longer means anything.
    if (!Number.isFinite(qty) || qty <= 0) {
      return { isValid: false, reason: `Cantidad inválida (${it.q}) para el producto: ${it.nombre}` };
    }
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      return { isValid: false, reason: `Precio inválido para el producto: ${it.nombre}` };
    }

    calculatedTotal += qty * priceCents;
  }

  const monto = Number(sale.monto);
  if (!Number.isFinite(monto) || monto < 0) {
    return { isValid: false, reason: 'El monto de la venta es inválido.' };
  }
  if (monto > MAX_MONTO_CENTS) {
    return { isValid: false, reason: 'El monto de la venta excede el máximo permitido.' };
  }

  // The recorded total must match the sum of the line items exactly: this is
  // what stops a tampered client from booking a sale for less than it charged.
  if (Math.round(monto) !== Math.round(calculatedTotal)) {
    return {
      isValid: false,
      reason: `Discrepancia en el balance. Total registrado: $${(monto / 100).toFixed(2)}, Esperado por sumatoria: $${(calculatedTotal / 100).toFixed(2)}`,
    };
  }

  return { isValid: true };
}

/**
 * Safe JSON parser for array data structures
 */
export function safeParseArray<T = any>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
