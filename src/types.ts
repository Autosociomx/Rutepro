/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Product {
  id: string;
  nombre: string;
  precio: number; // Price in cents, e.g. 500 = $5.00
  icono?: string; // Emoji representing the product
  unidad: string; // 'kg', 'pza', 'lt', etc.
  precioPorKg?: number; // fallback compatibility
}

export interface Seller {
  id: string;
  nombre: string;
  rol: 'repartidor' | 'cajero' | 'ambos';
  ruta: string;
  vehiculo?: string; // fallback compatibility
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
}

export interface Venta {
  id: string;
  vendedorId: string;
  vendedorNombre: string;
  clienteId: string;
  clienteNombre: string;
  monto: number;
  tipoCobro: 'efectivo' | 'crédito';
  items: VentaItem[];
  timestamp: number;
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
  vendedorId: string;
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
