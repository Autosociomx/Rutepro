/**
 * Arranque de la demostración: siembra los datos de muestra (una sola vez),
 * monta la app y agrega un distintivo flotante para cambiar el nombre del
 * negocio en vivo frente al cliente y para reiniciar la demostración.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../src/App';
import '../src/index.css';
import { sembrarDemo } from './seed';
import { demoClearAll } from './db.demo';

const MARCA_SEMBRADO = 'rp_demo_sembrado_v1';

function sembrarSiHaceFalta() {
  try {
    if (!localStorage.getItem(MARCA_SEMBRADO)) {
      const res = sembrarDemo();
      localStorage.setItem(MARCA_SEMBRADO, String(Date.now()));
      console.log(`[Demo] Datos de muestra listos: ${res.ventas} ventas, ${res.clientes} clientes.`);
    }
  } catch (e) {
    console.warn('[Demo] No se pudieron preparar los datos de muestra:', e);
  }
}

function leerNombreActual(): string {
  try {
    const cfg = JSON.parse(localStorage.getItem('rp_demo_config') || '{}');
    return cfg?.global?.nombre || '';
  } catch {
    return '';
  }
}

function renombrarNegocio() {
  const actual = leerNombreActual();
  const nuevo = window.prompt('Nombre del negocio (se aplica a toda la app):', actual);
  if (!nuevo || !nuevo.trim()) return;

  const nombre = nuevo.trim();
  try {
    const store = JSON.parse(localStorage.getItem('rp_demo_config') || '{}');
    const cfg = { ...(store.global || {}), nombre, letra: nombre[0].toUpperCase() };
    localStorage.setItem('rp_demo_config', JSON.stringify({ ...store, global: cfg }));
    localStorage.setItem('rp_cfg', JSON.stringify(cfg));
  } catch (e) {
    console.warn('[Demo] No se pudo cambiar el nombre:', e);
  }
  location.reload();
}

function reiniciarDemo() {
  if (!window.confirm('¿Reiniciar la demostración con los datos de muestra originales?')) return;
  demoClearAll();
  location.reload();
}

function montarDistintivo() {
  const caja = document.createElement('div');
  caja.setAttribute('style', [
    'position:fixed', 'right:10px', 'bottom:10px', 'z-index:2147483000',
    'display:flex', 'gap:6px', 'align-items:center',
    'font-family:system-ui,-apple-system,sans-serif', 'font-size:10px',
    'background:rgba(11,14,20,.92)', 'border:1px solid rgba(255,255,255,.10)',
    'border-radius:999px', 'padding:4px 6px 4px 9px',
    'box-shadow:0 6px 20px rgba(0,0,0,.45)', 'backdrop-filter:blur(6px)'
  ].join(';'));

  const etiqueta = document.createElement('span');
  etiqueta.textContent = 'DEMO · PIN 1234';
  etiqueta.setAttribute('style', 'color:#E8B04A;font-weight:800;letter-spacing:.08em');

  const boton = (texto: string, titulo: string, accion: () => void) => {
    const b = document.createElement('button');
    b.textContent = texto;
    b.title = titulo;
    b.setAttribute('style', [
      'cursor:pointer', 'border:0', 'border-radius:999px',
      'background:rgba(255,255,255,.07)', 'color:#EEF1F8',
      'padding:3px 8px', 'font-size:10px', 'font-family:inherit'
    ].join(';'));
    b.onclick = accion;
    return b;
  };

  caja.appendChild(etiqueta);
  caja.appendChild(boton('✎ Nombre', 'Cambiar el nombre del negocio en toda la app', renombrarNegocio));
  caja.appendChild(boton('↻ Reiniciar', 'Volver a los datos de muestra originales', reiniciarDemo));
  document.body.appendChild(caja);
}

// Marca esta copia como demostración: oculta las herramientas de venta que no
// van dirigidas al cliente.
(window as any).__RP_DEMO = true;

sembrarSiHaceFalta();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

montarDistintivo();
