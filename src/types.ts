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
  piezasPorCaja?: number; // Configurable quantity per box/package
  precioPorKg?: number; // fallback compatibility
}

export interface Seller {
  id: string;
  nombre: string;
  rol: 'repartidor' | 'cajero' | 'ambos';
  ruta: string;
  vehiculo?: string; // fallback compatibility
  meta_diaria?: number; // Daily sales goal in cents, e.g. 500000 = $5,000.00 pesos
}

export interface Client {
  id: string;
  nombre: string;
  tipo?: string;
  vendedorId?: string;
  vendedorNombre?: string;
  latitude?: number;
  longitude?: number;
  direccion?: string;
  frecuencia?: string;
  telefono?: string;
  ultima_compra?: number;
  total_comprado?: number;
  timestamp?: number;
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

export interface AppConfig {
  nombre: string;
  letra: string;
  subtitulo: string;
  color_principal: string;
  productos: Product[];
  vendedores: Seller[];
  logo_url?: string;
}

export interface MysteryAudit {
  id: string;
  vendedorId: string;
  vendedorNombre: string;
  fecha: string;
  auditor: string;
  checks: {
    cobroExacto: boolean;
    entregaRecibo: boolean;
    presentacionLimpia: boolean;
    tratoAmable: boolean;
  };
  calificacion: number; // percentage (e.g. 100)
  notas?: string;
  timestamp: number;
}

export interface Abono {
  id: string;
  clienteNombre: string;
  monto: number; // payment in cents
  fecha: string;
  timestamp: number;
  recibidoPor?: string; // name of dispatcher or cashier
}


