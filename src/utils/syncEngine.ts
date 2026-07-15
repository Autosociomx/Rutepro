import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

export interface SyncResult {
  ventasSincronizadas: number;
  devolucionesSincronizadas: number;
}

// Maximum sale amount accepted, in cents ($1,000,000.00 MXN). Mirrors the
// isMoneyCents() bound enforced in firestore.rules so the client rejects the
// same garbage the backend would.
export const MAX_MONTO_CENTS = 100000000;

/**
 * Safely parse a JSON array out of localStorage. Returns [] on any corruption
 * so a single bad cache entry can never crash a screen on load.
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

    if (!Number.isFinite(qty) || qty <= 0) return { isValid: false, reason: `Cantidad inválida (${it.q}) para el producto: ${it.nombre}` };
    if (!Number.isFinite(priceCents) || priceCents < 0) return { isValid: false, reason: `Precio inválido para el producto: ${it.nombre}` };

    calculatedTotal += qty * priceCents;
  }

  const monto = Number(sale.monto);
  if (!Number.isFinite(monto) || monto < 0) {
    return { isValid: false, reason: 'El monto de la venta es inválido.' };
  }
  if (monto > MAX_MONTO_CENTS) {
    return { isValid: false, reason: 'El monto de la venta excede el máximo permitido.' };
  }

  // Compare rounded cents to avoid floating-point noise rejecting valid sales.
  if (Math.round(monto) !== Math.round(calculatedTotal)) {
    return {
      isValid: false,
      reason: `Discrepancia en el balance. Total registrado: $${(monto / 100).toFixed(2)}, Esperado por sumatoria: $${(calculatedTotal / 100).toFixed(2)}`
    };
  }

  return { isValid: true };
}

/**
 * Sweeps localStorage caches for offline sales and returns that have not been
 * synchronized (flagged by `sincronizado !== true`), validates and synchronizes them to Firestore.
 */
export async function syncLocalTransactions(): Promise<SyncResult> {
  let ventasSincronizadas = 0;
  let devolucionesSincronizadas = 0;

  // 1. Synchronize Pending Sales (rp_ventas)
  try {
    const rawSales = localStorage.getItem('rp_ventas');
    if (rawSales) {
      const sales = JSON.parse(rawSales);
      if (Array.isArray(sales)) {
        let dirty = false;
        
        for (let i = 0; i < sales.length; i++) {
          const s = sales[i];
          if (s.sincronizado !== true) {
            // Validate the item before uploading
            const validation = validateSale(s);
            if (!validation.isValid) {
              console.warn(`[Sync Validation Failed] Sale ${s.id} is invalid: ${validation.reason}`);
              continue;
            }

            try {
              // Extract clean database format matching schema
              const dbDoc = {
                id: s.id,
                vendedorId: s.vendedorId,
                vendedorNombre: s.vendedorNombre,
                clienteId: s.clienteId || 'C_WALKIN_' + Date.now(),
                clienteNombre: s.clienteNombre,
                clienteTipo: s.clienteTipo || '',
                monto: Number(s.monto),
                tipoCobro: s.tipoCobro === 'credito' || s.tipoCobro === 'crédito' ? 'crédito' : 'efectivo',
                items: (s.items || []).map((it: any) => ({
                  id: it.id,
                  nombre: it.nombre,
                  q: Number(it.q) || 1,
                  pr: Number(it.pr) || 0,
                  ic: it.ic || it.icono || '📦'
                })),
                timestamp: s.timestamp || s.ts || Date.now(),
                validado: true // validated status
              };

              await setDoc(doc(db, 'ventas', s.id), dbDoc);
              
              // Mark as synced locally
              sales[i].sincronizado = true;
              sales[i].validado = true;
              dirty = true;
              ventasSincronizadas++;
            } catch (err) {
              console.warn(`[Sync Error] Failed to upload sale ${s.id} to Cloud Firestore:`, err);
            }
          }
        }

        if (dirty) {
          localStorage.setItem('rp_ventas', JSON.stringify(sales));
        }
      }
    }
  } catch (e) {
    console.error('Error scanning rp_ventas during synchronization:', e);
  }

  // 2. Synchronize Pending Returns / Mermas (rp_devoluciones)
  try {
    const rawDevols = localStorage.getItem('rp_devoluciones');
    if (rawDevols) {
      const devols = JSON.parse(rawDevols);
      if (Array.isArray(devols)) {
        let dirty = false;

        for (let i = 0; i < devols.length; i++) {
          const d = devols[i];
          if (d.sincronizado !== true) {
            try {
              const dbDoc = {
                id: d.id,
                vendedorId: d.vendedorId,
                vendedorNombre: d.vendedorNombre,
                clienteId: d.clienteId || 'C_GENERIC',
                clienteNombre: d.clienteNombre || 'Cliente General',
                productoId: d.productoId,
                productoNombre: d.productoNombre,
                cantidad: Number(d.cantidad) || 1,
                timestamp: d.timestamp || Date.now()
              };

              await setDoc(doc(db, 'devoluciones', d.id), dbDoc);
              
              // Mark as synced locally
              devols[i].sincronizado = true;
              dirty = true;
              devolucionesSincronizadas++;
            } catch (err) {
              console.warn(`[Sync Error] Failed to upload return ${d.id} to Cloud Firestore:`, err);
            }
          }
        }

        if (dirty) {
          localStorage.setItem('rp_devoluciones', JSON.stringify(devols));
        }
      }
    }
  } catch (e) {
    console.error('Error scanning rp_devoluciones during synchronization:', e);
  }

  return { ventasSincronizadas, devolucionesSincronizadas };
}
