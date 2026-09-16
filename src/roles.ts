// Descripción central de lo que ve (y lo que NO ve) cada rol de RoutePro.
// Se usa tanto en la pantalla de selección del dueño como en los avisos
// que aparecen dentro de cada pantalla, para que la explicación sea una sola
// y no se contradiga en dos lugares.

export type RoleId = 'dueno' | 'repartidor' | 'mostrador';

export interface RoleView {
  id: RoleId;
  /** Cómo se le llama a la persona */
  nombre: string;
  /** Nombre de la pantalla que le toca */
  pantalla: string;
  icono: string;
  /** Una línea para la tarjeta de selección */
  resumen: string;
  /** Alcance en frase, para redactar "solo ve <alcance>" */
  alcance: string;
  color: string;
  ve: string[];
  noVe: string[];
  /** Cómo entra esa persona en la operación real */
  comoEntra: string;
}

export const ROLE_VIEWS: Record<RoleId, RoleView> = {
  dueno: {
    id: 'dueno',
    nombre: 'Dueño',
    pantalla: 'Dashboard del negocio',
    icono: '📊',
    resumen: 'Ve todo el negocio',
    alcance: 'todo el negocio',
    color: '#C9912A',
    ve: [
      'Balance, ventas y cobranza de todo el negocio',
      'Rutas, paradas y avance de cada repartidor',
      'Deudas de clientes, abonos y mermas',
      'Catálogo, precios, equipo y configuración'
    ],
    noVe: [
      'Nada se le oculta: es la única vista completa del negocio'
    ],
    comoEntra: 'Entra con su PIN privado desde su propio teléfono. Es la única pantalla protegida con clave.'
  },
  repartidor: {
    id: 'repartidor',
    nombre: 'Repartidor',
    pantalla: 'App de ruta',
    icono: '🛣',
    resumen: 'Solo su ruta y sus cobros del día',
    alcance: 'su ruta y sus cobros del día',
    color: '#E8B04A',
    ve: [
      'Los clientes de su ruta asignada',
      'Lo que él cobró hoy y las mermas que reportó',
      'Su corte de caja al cerrar turno'
    ],
    noVe: [
      'El balance ni las ganancias del negocio',
      'Las ventas de otros repartidores ni las del mostrador',
      'El catálogo editable, los costos ni la configuración'
    ],
    comoEntra: 'Abre la app en su teléfono y cae directo en su ruta. Nunca ve este menú de selección.'
  },
  mostrador: {
    id: 'mostrador',
    nombre: 'Mostrador',
    pantalla: 'Punto de venta',
    icono: '🛒',
    resumen: 'Solo cobrar en caja',
    alcance: 'lo que cobra en la caja',
    color: '#00C896',
    ve: [
      'El catálogo con precios de venta',
      'El ticket que está cobrando en ese momento',
      'Su propio corte del turno'
    ],
    noVe: [
      'El balance ni las utilidades del negocio',
      'Las rutas ni las ventas de los repartidores',
      'La edición de catálogo ni el borrado de datos'
    ],
    comoEntra: 'La tablet o compu de la caja abre directo el punto de venta. Nunca ve este menú de selección.'
  }
};

export const ROLE_ORDER: RoleId[] = ['dueno', 'repartidor', 'mostrador'];

/** Frase que explica por qué el dueño sí ve las tres pantallas y su equipo no. */
export const OWNER_PREVIEW_NOTE =
  'Estás en la vista del dueño: por eso puedes abrir las tres pantallas y probarlas. ' +
  'Tu equipo no ve este menú; cada quien entra directo a la pantalla de su rol y no puede cambiarse a otra.';
