/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DemoProduct {
  id: string;
  icono: string;
  nombre: string;
  precio: number;    // in cents
  unidad: string;    // 'kg'|'lt'|'pza'|'caja'|'pac'|'gr'|'garrafón'|'botellón'|'mes'
  vendePorMonto?: boolean; // Mostrador price-amount picker (fractional units)
  piezasPorCaja?: number;  // enables +Caja shortcut in cart
}

export interface DemoSeller {
  id: string;
  nombre: string;
  rol: 'repartidor' | 'cajero' | 'ambos';
  ruta: string;
  meta_diaria?: number; // in cents
}

export interface DemoConfig {
  id: string;          // tipo_negocio key — stored in every Firestore sale doc
  icono: string;
  nombre: string;
  subtitulo: string;
  color: string;
  businessName: string;
  insight: string;
  // Dataset metadata — describes how this business type typically operates
  patron_venta: 'por_pieza' | 'por_peso' | 'mixto';  // dominant selling pattern
  productos: DemoProduct[];
  vendedores: DemoSeller[];
}

export const COLS = [
  '#C9822A', '#00C896', '#4A8FFF', '#FF4060', '#9B59B6',
  '#27AE60', '#E67E22', '#2C3E50', '#5D6D7E', '#1A1A2E'
];

export const DEMOS: DemoConfig[] = [
  {
    id: 'pan',
    icono: '🍞',
    nombre: 'Panadería',
    subtitulo: 'Pan, teleras, pasteles',
    color: '#C9822A',
    businessName: 'Panadería El Trigo Dorado',
    patron_venta: 'por_pieza',
    insight: 'Con RoutePro sabrás qué rutas se quedan sin pan antes del mediodía para <strong>reducir la merma hasta un 40%</strong>.',
    productos: [
      { id: 'P1', icono: '🍞', nombre: 'Pan bolillo',    precio:   150, unidad: 'pza' },
      { id: 'P2', icono: '🥖', nombre: 'Pan telera',     precio:   200, unidad: 'pza' },
      { id: 'P3', icono: '🧁', nombre: 'Pan dulce',      precio:   400, unidad: 'pza' },
      { id: 'P4', icono: '🎂', nombre: 'Pastel chico',   precio: 15000, unidad: 'pza' },
      { id: 'P5', icono: '🥐', nombre: 'Cuernito',       precio:   300, unidad: 'pza' },
      { id: 'P6', icono: '📦', nombre: 'Caja surtida',   precio:  8500, unidad: 'caja', piezasPorCaja: 20 }
    ],
    vendedores: [
      { id: 'V1', nombre: 'Ana Ruiz',    rol: 'repartidor', ruta: 'Ruta 1 – Zona Centro',  meta_diaria: 250000 },
      { id: 'V2', nombre: 'Pedro Leal',  rol: 'repartidor', ruta: 'Ruta 2 – Col. Morelos', meta_diaria: 250000 },
      { id: 'V3', nombre: 'Lupita M.',   rol: 'cajero',     ruta: 'Mostrador' }
    ]
  },
  {
    id: 'tort',
    icono: '🌮',
    nombre: 'Tortillería',
    subtitulo: 'Tortillas, tostadas, sopes',
    color: '#E67E22',
    businessName: 'Tortillería La Favorita',
    patron_venta: 'mixto',
    insight: 'Cada ruta tiene un patrón diferente. RoutePro te dice <strong>cuántos kilos llevar por ruta</strong> y en qué días hay más devolución.',
    productos: [
      // vendePorMonto:true — cliente llega al mostrador y pide "$13 de tortillas"
      { id: 'P1', icono: '🌮', nombre: 'Tortilla',         precio:  2800, unidad: 'kg',  vendePorMonto: true },
      { id: 'P2', icono: '🫓', nombre: 'Tostadas 30pz',    precio:  2500, unidad: 'pac' },
      { id: 'P3', icono: '🍽',  nombre: 'Sopes 12pz',       precio:  3500, unidad: 'pac' },
      { id: 'P4', icono: '🥙', nombre: 'Gorditas 6pz',      precio:  2800, unidad: 'pac' },
      { id: 'P5', icono: '🌯', nombre: 'Quesadillas 6pz',   precio:  3200, unidad: 'pac' },
      { id: 'P6', icono: '📦', nombre: 'Caja 5kg',          precio:  8500, unidad: 'caja', piezasPorCaja: 5 }
    ],
    vendedores: [
      { id: 'V1', nombre: 'Martín Cruz',  rol: 'repartidor', ruta: 'Ruta 1 – Mercado Central', meta_diaria: 500000 },
      { id: 'V2', nombre: 'Sofía Díaz',   rol: 'repartidor', ruta: 'Ruta 2 – Col. Nueva',      meta_diaria: 500000 },
      { id: 'V3', nombre: 'Jorge Ibarra', rol: 'cajero',     ruta: 'Mostrador' }
    ]
  },
  {
    id: 'agua',
    icono: '💧',
    nombre: 'Agua Purificada',
    subtitulo: 'Garrafones, botellones, ruta',
    color: '#4A8FFF',
    businessName: 'Purificadora Agua Cristal',
    patron_venta: 'por_pieza',
    insight: '<strong>Dato de oro:</strong> sabrás cada cuántos días se acaba el garrafón por cliente y anticipar el resurtido — <strong>cero llamadas perdidas, cero clientes sin agua</strong>.',
    productos: [
      { id: 'P1', icono: '💧', nombre: 'Garrafón 20L',         precio:  3500, unidad: 'garrafón' },
      { id: 'P2', icono: '🫙', nombre: 'Botellón 10L',         precio:  2000, unidad: 'botellón' },
      { id: 'P3', icono: '🍶', nombre: 'Botella 5L',           precio:  1200, unidad: 'pza' },
      { id: 'P4', icono: '♻️', nombre: 'Renta dispensador',    precio: 15000, unidad: 'mes' },
      { id: 'P5', icono: '🔄', nombre: 'Intercambio garrafón', precio:  3000, unidad: 'pza' },
      { id: 'P6', icono: '🧴', nombre: 'Sal mineral',          precio:  2500, unidad: 'kg',  vendePorMonto: true }
    ],
    vendedores: [
      { id: 'V1', nombre: 'Ramón Flores', rol: 'repartidor', ruta: 'Ruta 1 – Norte/Centro', meta_diaria: 400000 },
      { id: 'V2', nombre: 'Luis Peña',    rol: 'repartidor', ruta: 'Ruta 2 – Sur/Oriente',  meta_diaria: 400000 },
      { id: 'V3', nombre: 'Carmen Ríos',  rol: 'cajero',     ruta: 'Almacén / Mostrador' }
    ]
  },
  {
    id: 'carn',
    icono: '🥩',
    nombre: 'Carnicería',
    subtitulo: 'Cortes, molida, embutidos',
    color: '#C0392B',
    businessName: 'Carnicería El Rancho',
    patron_venta: 'por_peso',
    insight: 'Controla qué ruta vende más res vs pollo. <strong>Optimiza el corte del día con datos reales</strong> de cada ruta.',
    productos: [
      // Carnicería: todo se vende por peso — el cliente pide "$50 de bistec" o "500g de molida"
      { id: 'P1', icono: '🥩', nombre: 'Bistec res',     precio: 18000, unidad: 'kg', vendePorMonto: true },
      { id: 'P2', icono: '🍗', nombre: 'Pollo entero',   precio:  9000, unidad: 'kg', vendePorMonto: true },
      { id: 'P3', icono: '🫀', nombre: 'Carne molida',   precio: 14000, unidad: 'kg', vendePorMonto: true },
      { id: 'P4', icono: '🌭', nombre: 'Chorizo',        precio: 16000, unidad: 'kg', vendePorMonto: true },
      { id: 'P5', icono: '🥓', nombre: 'Costilla',       precio: 17000, unidad: 'kg', vendePorMonto: true },
      { id: 'P6', icono: '📦', nombre: 'Paquete mixto',  precio: 65000, unidad: 'pac' }
    ],
    vendedores: [
      { id: 'V1', nombre: 'Ernesto V.', rol: 'repartidor', ruta: 'Ruta 1 – Mercados',  meta_diaria: 600000 },
      { id: 'V2', nombre: 'Diana S.',   rol: 'cajero',     ruta: 'Mostrador local' }
    ]
  },
  {
    id: 'dist',
    icono: '🚚',
    nombre: 'Distribuidora',
    subtitulo: 'Refrescos, botanas, abarrotes',
    color: '#8E44AD',
    businessName: 'Distribuidora Norteña',
    patron_venta: 'por_pieza',
    insight: 'Con 3 rutas puedes tener <strong>más de 200 clientes activos</strong>. RoutePro centraliza pedidos, crédito y entrega — en tiempo real desde el celular.',
    productos: [
      { id: 'P1', icono: '🥤', nombre: 'Refresco 600ml', precio:  2000, unidad: 'pza' },
      { id: 'P2', icono: '💦', nombre: 'Agua 500ml',     precio:  1000, unidad: 'pza' },
      { id: 'P3', icono: '🍟', nombre: 'Papas bolsa',    precio:  1500, unidad: 'pza' },
      { id: 'P4', icono: '🧃', nombre: 'Jugo 1L',        precio:  2500, unidad: 'pza' },
      { id: 'P5', icono: '📦', nombre: 'Caja refrescos', precio: 22000, unidad: 'caja', piezasPorCaja: 24 },
      { id: 'P6', icono: '🛒', nombre: 'Paquete mixto',  precio: 35000, unidad: 'pac' }
    ],
    vendedores: [
      { id: 'V1', nombre: 'Héctor M.',     rol: 'repartidor', ruta: 'Ruta A – Zona Comercial', meta_diaria: 700000 },
      { id: 'V2', nombre: 'Gaby Torres',   rol: 'repartidor', ruta: 'Ruta B – Colonias',       meta_diaria: 700000 },
      { id: 'V3', nombre: 'Omar Castillo', rol: 'ambos',      ruta: 'Ruta C + Mostrador',      meta_diaria: 600000 }
    ]
  },
  {
    id: 'frut',
    icono: '🍎',
    nombre: 'Frutería / Verdulería',
    subtitulo: 'Frutas, verduras, a granel',
    color: '#27AE60',
    businessName: 'Frutería y Verdulería El Huerto',
    patron_venta: 'por_peso',
    insight: 'Captura exactamente cuántos kg de tomate se venden a qué precio — <strong>datos reales de oferta y demanda por temporada</strong>.',
    productos: [
      // Frutería: pure peso selling — todo vendePorMonto
      { id: 'P1', icono: '🍅', nombre: 'Tomate',         precio:  2000, unidad: 'kg', vendePorMonto: true },
      { id: 'P2', icono: '🥦', nombre: 'Brócoli',        precio:  1800, unidad: 'kg', vendePorMonto: true },
      { id: 'P3', icono: '🥕', nombre: 'Zanahoria',      precio:  1200, unidad: 'kg', vendePorMonto: true },
      { id: 'P4', icono: '🍋', nombre: 'Limón',          precio:  2500, unidad: 'kg', vendePorMonto: true },
      { id: 'P5', icono: '🌽', nombre: 'Elote',          precio:   800, unidad: 'pza' },
      { id: 'P6', icono: '🥑', nombre: 'Aguacate',       precio:  1500, unidad: 'pza' }
    ],
    vendedores: [
      { id: 'V1', nombre: 'Chuy Méndez',  rol: 'repartidor', ruta: 'Ruta 1 – Mercado Municipal', meta_diaria: 350000 },
      { id: 'V2', nombre: 'Rosa Vargas',  rol: 'cajero',     ruta: 'Mostrador' }
    ]
  },
  {
    id: 'poll',
    icono: '🐔',
    nombre: 'Pollería',
    subtitulo: 'Pollos enteros, piezas, marinados',
    color: '#F39C12',
    businessName: 'Pollería El Corral',
    patron_venta: 'mixto',
    insight: 'Sabe cuántos pollos enteros vs piezas sueltas se venden por ruta. <strong>Planifica el sacrificio del día con datos reales</strong>.',
    productos: [
      { id: 'P1', icono: '🐔', nombre: 'Pollo entero',     precio:  9500, unidad: 'kg', vendePorMonto: true },
      { id: 'P2', icono: '🍗', nombre: 'Pechuga',          precio: 12000, unidad: 'kg', vendePorMonto: true },
      { id: 'P3', icono: '🦵', nombre: 'Pierna/Muslo',     precio:  8000, unidad: 'kg', vendePorMonto: true },
      { id: 'P4', icono: '🥚', nombre: 'Huevo 30pz',       precio:  9000, unidad: 'caja', piezasPorCaja: 30 },
      { id: 'P5', icono: '🌶️', nombre: 'Pollo marinado',   precio: 11000, unidad: 'kg', vendePorMonto: true },
      { id: 'P6', icono: '📦', nombre: 'Paq. familiar 4kg',precio: 35000, unidad: 'pac' }
    ],
    vendedores: [
      { id: 'V1', nombre: 'Beto Salinas',  rol: 'repartidor', ruta: 'Ruta 1 – Tianguis',     meta_diaria: 500000 },
      { id: 'V2', nombre: 'Nora Guzmán',   rol: 'cajero',     ruta: 'Mostrador' }
    ]
  }
];

export const QUICK_QUESTIONS = [
  '¿Cuál ruta vendió más hoy?',
  '¿Qué producto tiene más volumen de ventas?',
  '¿Cuánto efectivo hay en ruta ahora mismo?',
  '¿Cuál ruta tiene la mayor cantidad de clientes visitados?',
  'Dame el resumen del día para mandar por WhatsApp'
];
