/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Migajas de ruta: el rastro que va dejando el repartidor.
 *
 * Tres cosas mandan en este archivo:
 *
 * 1. BATERÍA. Se pide la posición por red/celda (`enableHighAccuracy: false`),
 *    se acepta una lectura de hasta 30 segundos de antigüedad y sólo se guarda
 *    una migaja cuando el repartidor realmente se movió. Un teléfono en GPS
 *    fino continuo se acaba en unas horas; así aguanta la jornada.
 *
 * 2. SIN SEÑAL. Nada depende de internet: cada migaja se guarda en el
 *    teléfono y el motor de sincronización las sube por lotes cuando vuelve
 *    la red.
 *
 * 3. QUE EL DUEÑO PUEDA PREGUNTAR. Cada migaja y cada venta llevan hora y
 *    coordenadas, que es lo que necesita el bot de Telegram para responder
 *    "¿dónde anda Ana?" o "¿dónde fue su última venta?".
 */

export interface Migaja {
  id: string;
  vendedorId: string;
  vendedorNombre: string;
  lat: number;
  lng: number;
  precision: number;
  timestamp: number;
  sincronizado?: boolean;
}

export const CLAVE_MIGAJAS = 'rp_migajas';

/** Distancia mínima para considerar que se movió (metros). */
const METROS_MINIMOS = 40;
/** Tiempo mínimo entre migajas (ms). */
const MS_MINIMOS = 60000;
/** Aunque esté parado, deja una migaja cada tanto (ms). */
const MS_LATIDO = 300000;
/** Tope de migajas guardadas en el teléfono. */
const MAXIMO_GUARDADO = 5000;

function leerMigajas(): Migaja[] {
  try {
    const raw = localStorage.getItem(CLAVE_MIGAJAS);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function guardarMigajas(migajas: Migaja[]) {
  try {
    // Si se llenó, se tiran las más viejas ya sincronizadas.
    let lista = migajas;
    if (lista.length > MAXIMO_GUARDADO) {
      const pendientes = lista.filter((m) => !m.sincronizado);
      const subidas = lista.filter((m) => m.sincronizado).slice(-500);
      lista = [...subidas, ...pendientes];
    }
    localStorage.setItem(CLAVE_MIGAJAS, JSON.stringify(lista));
  } catch (e) {
    console.warn('[GPS] No se pudieron guardar las migajas:', e);
  }
}

/** Distancia aproximada en metros entre dos coordenadas (fórmula del haversine). */
export function metrosEntre(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function migajasPendientes(): number {
  return leerMigajas().filter((m) => !m.sincronizado).length;
}

export function migajasDeHoy(vendedorId?: string): Migaja[] {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  return leerMigajas().filter(
    (m) => m.timestamp >= inicio.getTime() && (!vendedorId || m.vendedorId === vendedorId)
  );
}

/** Última posición conocida del repartidor, venga de donde venga. */
export function ultimaMigaja(vendedorId: string): Migaja | null {
  const propias = leerMigajas().filter((m) => m.vendedorId === vendedorId);
  return propias.length ? propias[propias.length - 1] : null;
}

function agregarMigaja(m: Migaja) {
  const lista = leerMigajas();
  lista.push(m);
  guardarMigajas(lista);
}

export interface Rastreador {
  detener: () => void;
  /** Fuerza una lectura (al abrir la app o al cobrar una venta). */
  marcar: () => void;
  ultima: () => Migaja | null;
}

/**
 * Enciende el rastreo mientras la jornada esté abierta.
 *
 * Aviso honesto: un navegador deja de recibir posiciones cuando la pantalla se
 * apaga o la app pasa a segundo plano. Por eso además se marca una migaja cada
 * vez que el repartidor vuelve a la app y en cada venta: aunque traiga el
 * teléfono guardado, el recorrido queda con los puntos que importan.
 */
export function iniciarRastreo(
  vendedorId: string,
  vendedorNombre: string,
  alGuardar?: (m: Migaja) => void
): Rastreador {
  let ultimaGuardada: Migaja | null = ultimaMigaja(vendedorId);

  // En la demostración no se le pide la ubicación a nadie: frente a un cliente,
  // un permiso del navegador sobra y puede salir mal. El recorrido de muestra
  // ya viene sembrado y cada venta agrega su punto.
  if (typeof window !== 'undefined' && (window as any).__RP_DEMO === true) {
    const simular = (): Migaja => {
      const base = ultimaGuardada || { lat: 21.5041, lng: -104.8942 };
      const m: Migaja = {
        id: `TRK_${vendedorId}_${Date.now()}`,
        vendedorId,
        vendedorNombre,
        lat: Number((base.lat + (Math.random() - 0.5) * 0.002).toFixed(6)),
        lng: Number((base.lng + (Math.random() - 0.5) * 0.002).toFixed(6)),
        precision: 25,
        timestamp: Date.now(),
        sincronizado: true
      };
      ultimaGuardada = m;
      agregarMigaja(m);
      if (alGuardar) alGuardar(m);
      return m;
    };

    // Un punto al abrir, para que el indicador se encienda.
    simular();

    return {
      detener: () => {},
      marcar: () => { simular(); },
      ultima: () => ultimaGuardada
    };
  }
  let idReloj: number | null = null;

  const considerar = (pos: GeolocationPosition, forzar = false) => {
    const ahora = Date.now();
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    if (!forzar && ultimaGuardada) {
      const transcurrido = ahora - ultimaGuardada.timestamp;
      const distancia = metrosEntre(ultimaGuardada.lat, ultimaGuardada.lng, lat, lng);
      const seMovio = distancia >= METROS_MINIMOS && transcurrido >= MS_MINIMOS;
      const latido = transcurrido >= MS_LATIDO;
      if (!seMovio && !latido) return;
    }

    const migaja: Migaja = {
      id: `TRK_${vendedorId}_${ahora}`,
      vendedorId,
      vendedorNombre,
      lat,
      lng,
      precision: Math.round(pos.coords.accuracy || 0),
      timestamp: ahora,
      sincronizado: false
    };

    ultimaGuardada = migaja;
    agregarMigaja(migaja);
    if (alGuardar) alGuardar(migaja);
  };

  const opciones: PositionOptions = {
    enableHighAccuracy: false,
    maximumAge: 30000,
    timeout: 60000
  };

  if (navigator.geolocation) {
    // Primera posición en cuanto arranca la jornada.
    navigator.geolocation.getCurrentPosition(
      (pos) => considerar(pos, true),
      (err) => console.warn('[GPS] Sin posición inicial:', err.message),
      opciones
    );

    idReloj = navigator.geolocation.watchPosition(
      (pos) => considerar(pos),
      (err) => console.warn('[GPS] Lectura fallida:', err.message),
      opciones
    );
  } else {
    console.warn('[GPS] Este dispositivo no reporta ubicación.');
  }

  const alVolver = () => {
    if (document.visibilityState === 'visible' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => considerar(pos),
        () => {},
        opciones
      );
    }
  };
  document.addEventListener('visibilitychange', alVolver);

  return {
    detener: () => {
      if (idReloj !== null) navigator.geolocation.clearWatch(idReloj);
      document.removeEventListener('visibilitychange', alVolver);
    },
    marcar: () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => considerar(pos, true),
        () => {},
        opciones
      );
    },
    ultima: () => ultimaGuardada
  };
}
