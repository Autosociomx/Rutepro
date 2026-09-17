/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * La jornada del repartidor: lo que carga en la mañana, lo que vende en la
 * calle y el cuadre al regresar.
 *
 * Todo se escribe primero en el teléfono y de ahí lo sube el motor de
 * sincronización. Así el repartidor puede trabajar toda la ruta sin señal y
 * nada se pierde: cuando agarra internet, sube solo.
 */

import { Seller } from '../types';
import { safeParseArray } from './syncEngine';

export interface Jornada {
  id: string;
  vendedorId: string;
  vendedorNombre: string;
  fecha: string;              // YYYY-MM-DD
  piezasCargadas: number;
  precioUnitario: number;     // centavos por pieza
  inicio: number;
  estado: 'activa' | 'cerrada';
  fin?: number;
  piezasVendidas?: number;
  piezasSobrantes?: number;
  piezasFaltantes?: number;   // lo que no está ni vendido ni de regreso
  efectivoEsperado?: number;  // centavos
  sincronizado?: boolean;
}

export interface VentaLocal {
  id: string;
  vendedorId: string;
  vendedorNombre: string;
  clienteId: string;
  clienteNombre: string;
  clienteTipo: string;
  monto: number;
  tipoCobro: 'efectivo' | 'crédito';
  items: Array<{ id: string; nombre: string; q: number; pr: number; ic?: string }>;
  timestamp: number;
  lat?: number;
  lng?: number;
  sincronizado?: boolean;
}

export const CLAVE_JORNADAS = 'rp_jornadas';
export const CLAVE_VENTAS = 'rp_ventas';

export function hoyISO(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
}

function inicioDeHoy(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function leerJornadas(): Jornada[] {
  return safeParseArray<Jornada>(localStorage.getItem(CLAVE_JORNADAS));
}

function guardarJornadas(js: Jornada[]) {
  try {
    localStorage.setItem(CLAVE_JORNADAS, JSON.stringify(js));
  } catch (e) {
    console.warn('[Jornada] No se pudo guardar en el teléfono:', e);
  }
}

/** La jornada de hoy de ese repartidor, abierta o cerrada. */
export function jornadaDeHoy(vendedorId: string): Jornada | null {
  const fecha = hoyISO();
  return leerJornadas().find((j) => j.vendedorId === vendedorId && j.fecha === fecha) || null;
}

/** Registra la carga de la mañana y deja la jornada abierta. */
export function abrirJornada(vendedor: Seller, piezas: number, precioUnitario: number): Jornada {
  const fecha = hoyISO();
  const jornada: Jornada = {
    id: `JOR_${vendedor.id}_${fecha}`,
    vendedorId: vendedor.id,
    vendedorNombre: vendedor.nombre,
    fecha,
    piezasCargadas: Math.max(0, Math.round(piezas)),
    precioUnitario,
    inicio: Date.now(),
    estado: 'activa',
    sincronizado: false
  };

  const todas = leerJornadas().filter((j) => j.id !== jornada.id);
  todas.push(jornada);
  guardarJornadas(todas);
  return jornada;
}

/** Corrige la carga sin cerrar la jornada (por si le entregaron más pan). */
export function ajustarCarga(vendedorId: string, piezas: number): Jornada | null {
  const todas = leerJornadas();
  const i = todas.findIndex((j) => j.vendedorId === vendedorId && j.fecha === hoyISO());
  if (i === -1) return null;
  todas[i] = { ...todas[i], piezasCargadas: Math.max(0, Math.round(piezas)), sincronizado: false };
  guardarJornadas(todas);
  return todas[i];
}

export function ventasDeHoy(vendedorId: string): VentaLocal[] {
  const desde = inicioDeHoy();
  return safeParseArray<VentaLocal>(localStorage.getItem(CLAVE_VENTAS))
    .filter((v) => v.vendedorId === vendedorId && (v.timestamp || 0) >= desde)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

export function piezasVendidasHoy(vendedorId: string): number {
  return ventasDeHoy(vendedorId).reduce(
    (sum, v) => sum + (v.items || []).reduce((s, it) => s + (Number(it.q) || 0), 0),
    0
  );
}

export function cobradoHoy(vendedorId: string): { efectivo: number; credito: number } {
  return ventasDeHoy(vendedorId).reduce(
    (acc, v) => {
      if (v.tipoCobro === 'crédito') acc.credito += Number(v.monto) || 0;
      else acc.efectivo += Number(v.monto) || 0;
      return acc;
    },
    { efectivo: 0, credito: 0 }
  );
}

export function ventasPendientesDeSubir(): number {
  return safeParseArray<VentaLocal>(localStorage.getItem(CLAVE_VENTAS))
    .filter((v) => v.sincronizado !== true).length;
}

/**
 * Apunta una venta. Se guarda en el teléfono de inmediato (con o sin señal) y
 * el motor de sincronización se encarga de subirla.
 */
export function registrarVenta(params: {
  vendedor: Seller;
  producto: { id: string; nombre: string; precio: number; icono?: string };
  piezas: number;
  tipoCobro: 'efectivo' | 'crédito';
  cliente?: { id: string; nombre: string; tipo?: string } | null;
  posicion?: { lat: number; lng: number } | null;
}): VentaLocal {
  const { vendedor, producto, piezas, tipoCobro, cliente, posicion } = params;
  const ahora = Date.now();

  const venta: VentaLocal = {
    id: `V${ahora}_${Math.random().toString(36).slice(2, 7)}`,
    vendedorId: vendedor.id,
    vendedorNombre: vendedor.nombre,
    clienteId: cliente?.id || 'PUBLICO',
    clienteNombre: cliente?.nombre || 'Venta de calle',
    clienteTipo: cliente?.tipo || 'Público',
    monto: Math.round(piezas * producto.precio),
    tipoCobro,
    items: [{ id: producto.id, nombre: producto.nombre, q: piezas, pr: producto.precio, ic: producto.icono || '🥖' }],
    timestamp: ahora,
    sincronizado: false
  };

  if (posicion) {
    venta.lat = posicion.lat;
    venta.lng = posicion.lng;
  }

  const todas = safeParseArray<VentaLocal>(localStorage.getItem(CLAVE_VENTAS));
  todas.push(venta);
  try {
    localStorage.setItem(CLAVE_VENTAS, JSON.stringify(todas));
  } catch (e) {
    console.warn('[Jornada] No se pudo guardar la venta en el teléfono:', e);
  }

  return venta;
}

/** Borra la última venta del repartidor (para corregir un dedazo en la calle). */
export function deshacerUltimaVenta(vendedorId: string): VentaLocal | null {
  const todas = safeParseArray<VentaLocal>(localStorage.getItem(CLAVE_VENTAS));
  for (let i = todas.length - 1; i >= 0; i--) {
    if (todas[i].vendedorId === vendedorId) {
      const [quitada] = todas.splice(i, 1);
      try {
        localStorage.setItem(CLAVE_VENTAS, JSON.stringify(todas));
      } catch (e) {
        console.warn('[Jornada] No se pudo deshacer la venta:', e);
      }
      return quitada;
    }
  }
  return null;
}

export interface Cuadre {
  piezasCargadas: number;
  piezasVendidas: number;
  piezasEsperadas: number;   // las que debería traer de regreso
  efectivoEsperado: number;  // centavos
  creditoDelDia: number;     // centavos
  ventas: number;
}

export function calcularCuadre(jornada: Jornada): Cuadre {
  const vendidas = piezasVendidasHoy(jornada.vendedorId);
  const { efectivo, credito } = cobradoHoy(jornada.vendedorId);
  return {
    piezasCargadas: jornada.piezasCargadas,
    piezasVendidas: vendidas,
    piezasEsperadas: Math.max(0, jornada.piezasCargadas - vendidas),
    efectivoEsperado: efectivo,
    creditoDelDia: credito,
    ventas: ventasDeHoy(jornada.vendedorId).length
  };
}

/** Cierra la jornada con los sobrantes que el repartidor trae de regreso. */
export function cerrarJornada(vendedorId: string, piezasSobrantes: number): Jornada | null {
  const todas = leerJornadas();
  const i = todas.findIndex((j) => j.vendedorId === vendedorId && j.fecha === hoyISO());
  if (i === -1) return null;

  const jornada = todas[i];
  const cuadre = calcularCuadre(jornada);
  const sobrantes = Math.max(0, Math.round(piezasSobrantes));

  todas[i] = {
    ...jornada,
    estado: 'cerrada',
    fin: Date.now(),
    piezasVendidas: cuadre.piezasVendidas,
    piezasSobrantes: sobrantes,
    // Lo que no está vendido ni de regreso: pan regalado, tirado o mal contado.
    piezasFaltantes: Math.max(0, cuadre.piezasEsperadas - sobrantes),
    efectivoEsperado: cuadre.efectivoEsperado,
    sincronizado: false
  };

  guardarJornadas(todas);
  return todas[i];
}
