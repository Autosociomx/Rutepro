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

/** Paleta sugerida para el selector de color de marca. */
export const COLS = [
  '#C9822A', '#00C896', '#4A8FFF', '#FF4060', '#9B59B6',
  '#27AE60', '#E67E22', '#2C3E50', '#5D6D7E', '#1A1A2E'
];

export const NEGOCIO: AppConfig = {
  nombre: 'Panadería El Trigo Dorado',
  letra: 'P',
  subtitulo: 'Mostrador y rutas de reparto',
  color_principal: '#C9822A',
  logo_url: '',

  productos: [
    { id: 'P1', icono: '🍞', nombre: 'Bolillo',        precio: 150,   unidad: 'pza' },
    { id: 'P2', icono: '🥖', nombre: 'Telera',         precio: 200,   unidad: 'pza' },
    { id: 'P3', icono: '🧁', nombre: 'Pan dulce',      precio: 400,   unidad: 'pza' },
    { id: 'P4', icono: '🥐', nombre: 'Cuernito',       precio: 300,   unidad: 'pza' },
    { id: 'P5', icono: '🎂', nombre: 'Pastel chico',   precio: 15000, unidad: 'pza' },
    { id: 'P6', icono: '📦', nombre: 'Caja surtida',   precio: 8500,  unidad: 'caja', piezasPorCaja: 30 }
  ],

  vendedores: [
    { id: 'V1', nombre: 'Ana Ruiz',   rol: 'repartidor', ruta: 'Ruta 1 – Zona Centro',  meta_diaria: 250000 },
    { id: 'V2', nombre: 'Pedro Leal', rol: 'repartidor', ruta: 'Ruta 2 – Col. Morelos', meta_diaria: 200000 },
    { id: 'V3', nombre: 'Lupita M.',  rol: 'cajero',     ruta: 'Mostrador' }
  ]
};
