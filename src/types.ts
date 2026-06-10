/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Product {
  id: string;
  nombre: string;
  precio: number; // Price in cents, e.g. 500 = $5.00
  icono?: string;
  unidad: string; // 'kg', 'pza', 'lt', 'gr', 'caja', 'pac', etc.
  piezasPorCaja?: number;
  vendePorMonto?: boolean; // if true, Mostrador shows peso-amount picker (ej: tortillas, carne)
  precioPorKg?: number; // fallback compatibility
}

export interface Seller {
  id: string;
  nombre: string;
  rol: 'repartidor' | 'cajero' | 'ambos';
  ruta: string;
  meta_diaria?: number; // in cents, e.g. 500000 = $5,000.00
  vehiculo?: string;
}

export interface Client {
  id: string;
  nombre: string;
  direccion?: string;
  frecuencia?: string;
  telefono?: string;
}

export interface VentaItem {
  id: string; // productId
  nombre: string;
  q: number; // quantity sold
  pr: number; // price in cents
  ic?: string; // product icon
  precio?: number; // fallback compatibility
  icono?: string; // fallback compatibility
}

export interface Venta {
  id: string;
  vendedorId: string;
  vendedorNombre: string;
  clienteId: string;
  clienteNombre: string;
  clienteTipo?: string;
  monto: number;
  tipoCobro: 'efectivo' | 'crédito';
  items: VentaItem[];
  timestamp: number;
  hora?: string;
  lat?: number;  // geolocalización del punto de venta — ruta de migajas
  lng?: number;
}

export interface Devolucion {
  id: string;
  vendedorId: string;
  vendedorNombre: string;
  clienteId: string;
  clienteNombre: string;
  productoId: string;
  productoNombre: string;
  cantidad: number; // kg devueltos
  timestamp: number;
}

export interface Expense {
  concepto: string;
  monto: number;
}

export interface InventarioKilo {
  id: string; // productId
  nombre: string;
  q: number; // kg cargados
}

export interface InventarioRuta {
  id?: string;
  vendedorId: string;
  vendedorNombre?: string;
  items: InventarioKilo[];
  timestamp: number;
  estado: 'activa' | 'finalizado';
}

export interface HistorialCierre {
  id: string;
  vendedor_id: string;
  vendedor_nombre: string;
  fecha: string; // YYYY-MM-DD o ISO
  ventas_efectivo: number;
  gastos_total: number;
  liquido_final: number;
  detalles_gastos: Expense[];
  status: string;
}

export interface RutaMetric {
  vendedorId: string;
  fecha: string;
  total_ventas: number;
  total_devoluciones: number;
  cantidad_ventas: number;
  cantidad_devoluciones: number;
  gastos_total: number;
  liquido_final: number;
}

export interface Usuario {
  uid: string;
  nombre: string;
  email: string;
  telefono: string;
  plan: 'trial' | 'activo' | 'cancelado';
  aviso_privacidad: boolean;
  aviso_privacidad_ts: number;
  created_at: number;
  stripe_customer_id?: string; // Phase 2 — Stripe billing
  ciudad?: string;
}

export interface AppConfig {
  nombre: string;
  letra: string;
  subtitulo: string;
  color_principal: string;
  productos: Product[];
  vendedores: Seller[];
  logo_url?: string;
  tipo_negocio?: string; // 'pan'|'tort'|'agua'|'carn'|'dist'|'custom' — dataset enrichment
  ciudad?: string;       // free text — 'Tijuana'|'CDMX'|'Monterrey' etc.
  pin_admin?: string;
}

