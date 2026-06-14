/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DemoProduct {
  id: string;
  icono: string;
  nombre: string;
  precio: number; // in cents, e.g. 1800 = $18.00
  unidad: string;
  vendePorMonto?: boolean;
}

export interface DemoSeller {
  id: string;
  nombre: string;
  rol: 'repartidor' | 'cajero' | 'ambos';
  ruta: string;
}

export interface DemoConfig {
  id: string;
  icono: string;
  nombre: string;
  subtitulo: string;
  color: string;
  businessName: string;
  insight: string;
  productos: DemoProduct[];
  vendedores: DemoSeller[];
}

export const COLS = [
  '#C9822A', '#00C896', '#4A8FFF', '#FF4060', '#9B59B6', 
  '#27AE60', '#E67E22', '#2C3E50', '#5D6D7E', '#1A1A2E'
];

export const DEMOS: DemoConfig[] = [
  {
    id: 'nayaritas',
    icono: '🫓',
    nombre: 'Tostadas Nayaritas',
    subtitulo: 'Tostadas raspadas, cevicheras, salsas',
    color: '#D97706',
    businessName: 'Tostadas Nayaritas',
    insight: '¿Cuánto producto sale cada día sin quedar registrado? Con RoutePro cada entrega y cada pago queda en el sistema — el fiado se cobra, la merma se ve, el día cuadra.',
    productos: [
      { id: 'NY1', icono: '🫓', nombre: 'Tostadas Raspadas (Paquete Familiar)', precio: 3800, unidad: 'pac' },
      { id: 'NY2', icono: '🌮', nombre: 'Tostadas Cevicheras Crujientes', precio: 3500, unidad: 'pac' },
      { id: 'NY3', icono: '🌽', nombre: 'Tortilla de Maíz Nixtamalizado (1 Kg)', precio: 2400, unidad: 'kg' },
      { id: 'NY4', icono: '🌶️', nombre: 'Salsa Picante Huichol Tradicional', precio: 1900, unidad: 'pza' },
      { id: 'NY5', icono: '🧀', nombre: 'Queso Cotija Seco Madurado', precio: 9500, unidad: 'kg' },
      { id: 'NY6', icono: '📦', nombre: 'Caja Grande Tostadas Deshidratadas', precio: 18000, unidad: 'caja' }
    ],
    vendedores: [
      { id: 'V_NY1', nombre: 'Juan Pablo Díaz', rol: 'repartidor', ruta: 'Ruta Costa y Huajicori' },
      { id: 'V_NY2', nombre: 'Alondra Bañales', rol: 'repartidor', ruta: 'Ruta Miramar y San Blas' },
      { id: 'V_NY3', nombre: 'Estela Martínez', rol: 'cajero', ruta: 'Mostrador Tepic Centro' }
    ]
  },
  {
    id: 'pan',
    icono: '🍞',
    nombre: 'Panadería',
    subtitulo: 'Pan, teleras, pasteles',
    color: '#C9822A',
    businessName: 'Panadería El Trigo Dorado',
    insight: 'Las panaderías con rutas tienen hasta 23% de fiado que nunca regresa registrado. Con RoutePro ese número se vuelve visible — y cobrable — desde el primer día.',
    productos: [
      { id: 'P1', icono: '🍞', nombre: 'Pan bolillo', precio: 150, unidad: 'pza' },
      { id: 'P2', icono: '🥖', nombre: 'Pan telera', precio: 200, unidad: 'pza' },
      { id: 'P3', icono: '🧁', nombre: 'Pan dulce', precio: 400, unidad: 'pza' },
      { id: 'P4', icono: '🎂', nombre: 'Pastel chico', precio: 15000, unidad: 'pza' },
      { id: 'P5', icono: '🥐', nombre: 'Cuernito', precio: 300, unidad: 'pza' },
      { id: 'P6', icono: '📦', nombre: 'Caja surtida', precio: 8500, unidad: 'caja' }
    ],
    vendedores: [
      { id: 'V1', nombre: 'Ana Ruiz', rol: 'repartidor', ruta: 'Ruta 1 – Zona Centro' },
      { id: 'V2', nombre: 'Pedro Leal', rol: 'repartidor', ruta: 'Ruta 2 – Col. Morelos' },
      { id: 'V3', nombre: 'Lupita M.', rol: 'cajero', ruta: 'Mostrador' }
    ]
  },
  {
    id: 'tort',
    icono: '🌮',
    nombre: 'Tortillería',
    subtitulo: 'Tortillas, tostadas, sopes',
    color: '#E67E22',
    businessName: 'Tortillería La Favorita',
    insight: '¿Sabes exactamente cuántos kilos vendió cada ruta hoy? RoutePro registra despachos, devoluciones y cuentas por cobrar en tiempo real — desde el celular del repartidor.',
    productos: [
      { id: 'P1', icono: '🌮', nombre: 'Tortilla kg', precio: 1800, unidad: 'kg' },
      { id: 'P2', icono: '🫓', nombre: 'Tostadas 30pz', precio: 2500, unidad: 'pac' },
      { id: 'P3', icono: '🍽', nombre: 'Sopes 12pz', precio: 3500, unidad: 'pac' },
      { id: 'P4', icono: '🥙', nombre: 'Gorditas 6pz', precio: 2800, unidad: 'pac' },
      { id: 'P5', icono: '🌯', nombre: 'Quesadillas 6pz', precio: 3200, unidad: 'pac' },
      { id: 'P6', icono: '📦', nombre: 'Caja 5kg', precio: 8500, unidad: 'caja' }
    ],
    vendedores: [
      { id: 'V1', nombre: 'Martín Cruz', rol: 'repartidor', ruta: 'Ruta 1 – Mercado Central' },
      { id: 'V2', nombre: 'Sofía Díaz', rol: 'repartidor', ruta: 'Ruta 2 – Col. Nueva' },
      { id: 'V3', nombre: 'Jorge Ibarra', rol: 'cajero', ruta: 'Mostrador' }
    ]
  },
  {
    id: 'agua',
    icono: '💧',
    nombre: 'Agua Purificada',
    subtitulo: 'Garrafones, botellones, ruta',
    color: '#4A8FFF',
    businessName: 'Purificadora Agua Cristal',
    insight: 'Con RoutePro sabes cuándo necesita garrafón cada cliente antes de que llame — cero clientes sin agua, cero días perdidos rastreando pedidos por teléfono.',
    productos: [
      { id: 'P1', icono: '💧', nombre: 'Garrafón 20L', precio: 3500, unidad: 'garrafón' },
      { id: 'P2', icono: '🫙', nombre: 'Botellón 10L', precio: 2000, unidad: 'botellón' },
      { id: 'P3', icono: '🍶', nombre: 'Botella 5L', precio: 1200, unidad: 'pza' },
      { id: 'P4', icono: '♻️', nombre: 'Renta dispensador', precio: 15000, unidad: 'mes' },
      { id: 'P5', icono: '🔄', nombre: 'Intercambio garrafón', precio: 3000, unidad: 'pza' },
      { id: 'P6', icono: '🧴', nombre: 'Sal mineral 1kg', precio: 2500, unidad: 'kg' }
    ],
    vendedores: [
      { id: 'V1', nombre: 'Ramón Flores', rol: 'repartidor', ruta: 'Ruta 1 – Norte/Centro' },
      { id: 'V2', nombre: 'Luis Peña', rol: 'repartidor', ruta: 'Ruta 2 – Sur/Oriente' },
      { id: 'V3', nombre: 'Carmen Ríos', rol: 'cajero', ruta: 'Almacén / Mostrador' }
    ]
  },
  {
    id: 'carn',
    icono: '🥩',
    nombre: 'Carnicería',
    subtitulo: 'Cortes, molida, embutidos',
    color: '#C0392B',
    businessName: 'Carnicería El Rancho',
    insight: 'Los cortes a crédito son el punto ciego más costoso de una carnicería. Con RoutePro cada cuenta queda registrada y el cierre del día cuadra en minutos.',
    productos: [
      { id: 'P1', icono: '🥩', nombre: 'Bistec res kg', precio: 18000, unidad: 'kg' },
      { id: 'P2', icono: '🍗', nombre: 'Pollo entero kg', precio: 9000, unidad: 'kg' },
      { id: 'P3', icono: '🫀', nombre: 'Carne molida kg', precio: 14000, unidad: 'kg' },
      { id: 'P4', icono: '🌭', nombre: 'Chorizo kg', precio: 16000, unidad: 'kg' },
      { id: 'P5', icono: '🥓', nombre: 'Costilla kg', precio: 17000, unidad: 'kg' },
      { id: 'P6', icono: '📦', nombre: 'Paquete mixto 5kg', precio: 65000, unidad: 'pac' }
    ],
    vendedores: [
      { id: 'V1', nombre: 'Ernesto V.', rol: 'repartidor', ruta: 'Ruta 1 – Mercados' },
      { id: 'V2', nombre: 'Diana S.', rol: 'cajero', ruta: 'Mostrador local' }
    ]
  },
  {
    id: 'dist',
    icono: '🚚',
    nombre: 'Distribuidora',
    subtitulo: 'Refrescos, botanas, abarrotes',
    color: '#8E44AD',
    businessName: 'Distribuidora Norteña',
    insight: 'Con 3 rutas puedes manejar más de 200 clientes activos. RoutePro centraliza pedidos, crédito y cobros en tiempo real — sin hojas de papel, sin llamadas para rastrear quién debe.',
    productos: [
      { id: 'P1', icono: '🥤', nombre: 'Refresco 600ml', precio: 2000, unidad: 'pza' },
      { id: 'P2', icono: '💦', nombre: 'Agua 500ml', precio: 1000, unidad: 'pza' },
      { id: 'P3', icono: '🍟', nombre: 'Papas bolsa', precio: 1500, unidad: 'pza' },
      { id: 'P4', icono: '🧃', nombre: 'Jugo 1L', precio: 2500, unidad: 'pza' },
      { id: 'P5', icono: '📦', nombre: 'Caja refrescos', precio: 22000, unidad: 'caja' },
      { id: 'P6', icono: '🛒', nombre: 'Paquete mixto', precio: 35000, unidad: 'pac' }
    ],
    vendedores: [
      { id: 'V1', nombre: 'Héctor M.', rol: 'repartidor', ruta: 'Ruta A – Zona Comercial' },
      { id: 'V2', nombre: 'Gaby Torres', rol: 'repartidor', ruta: 'Ruta B – Colonias' },
      { id: 'V3', nombre: 'Omar Castillo', rol: 'ambos', ruta: 'Ruta C + Mostrador' }
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
