/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  CONFIGURACIÓN DEL NEGOCIO — EDITA ESTE ARCHIVO PARA CADA CLIENTE ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Esto es lo único que hay que tocar para dejar el programa listo:
 * nombre, color, catálogo y personal. Se siembra en la base la primera vez
 * que arranca la app; después de eso, el dueño puede cambiar todo desde la
 * pantalla de Configuración sin tocar código.
 *
 * Los precios van en CENTAVOS: 150 = $1.50, 15000 = $150.00
 */

import { AppConfig } from './types';
// El logotipo viaja dentro del programa: en la compilación normal queda como
// archivo y en la demostración de un solo archivo se incrusta solo.
import logoSuperpan from './assets/logo-superpan.png';

/** Logotipo de la panadería, usado cuando no se haya subido otro. */
export const LOGO_NEGOCIO = logoSuperpan;

/** Paleta sugerida para el selector de color de marca. */
export const COLS = [
  '#C9822A', '#00C896', '#4A8FFF', '#FF4060', '#9B59B6',
  '#27AE60', '#E67E22', '#2C3E50', '#5D6D7E', '#1A1A2E'
];

/**
 * Modo ruta simple: la pantalla del repartidor se reduce a lo esencial —
 * carga de la mañana, venta de dos toques y cierre con cuadre — y va dejando
 * el rastro de la ruta. Ponlo en `false` para volver a la pantalla completa
 * de la plantilla (varios productos, carrito, devoluciones, asistente).
 */
export const MODO_RUTA_SIMPLE = true;

export const NEGOCIO: AppConfig = {
  nombre: 'Superpan La Cantera',
  letra: 'S',
  subtitulo: 'Pan dulce y bolillo · rutas de reparto',
  color_principal: '#D4AD6A', // dorado tomado del logotipo
  logo_url: '',

  // Un solo producto: es lo que venden en ruta. Si algún día agregan otro,
  // basta con añadirlo aquí o desde la pantalla de Configuración.
  productos: [
    { id: 'BOLILLO', icono: '🥖', nombre: 'Bolillo', precio: 200, unidad: 'pza' }
  ],

  vendedores: [
    { id: 'V1', nombre: 'Ana Ruiz',   rol: 'repartidor', ruta: 'Ruta 1 – Zona Centro',  meta_diaria: 250000 },
    { id: 'V2', nombre: 'Pedro Leal', rol: 'repartidor', ruta: 'Ruta 2 – Col. Morelos', meta_diaria: 200000 },
    { id: 'V3', nombre: 'Lupita M.',  rol: 'cajero',     ruta: 'Mostrador' }
  ]
};
