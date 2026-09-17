/**
 * Datos de muestra para la demostración del negocio de bolillo.
 *
 * Arma dos semanas de ruta: lo que se cargó cada mañana, las ventas de calle
 * y de tiendita, los abonos de quienes compran a crédito, y el rastro de GPS
 * del día de hoy. Es determinista (misma "aleatoriedad" en cada corrida), para
 * que la demostración se vea igual en cada presentación.
 */

import { NEGOCIO } from '../src/data';
import { demoSeedTable } from './db.demo';

const DIAS = 14;

function crearAzar(semilla: number) {
  let s = semilla;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const azar = crearAzar(20260917);
const entre = (min: number, max: number) => min + Math.floor(azar() * (max - min + 1));
const alguno = <T,>(xs: T[]): T => xs[entre(0, xs.length - 1)];

const TIENDITAS = [
  { nombre: 'Abarrotes Doña Mary',    tipo: 'Abarrotes',   ruta: 'V1', dir: 'Hidalgo 45, Centro' },
  { nombre: 'Tiendita La Esquina',    tipo: 'Abarrotes',   ruta: 'V1', dir: 'Morelos 312' },
  { nombre: 'Cafetería El Portal',    tipo: 'Cafetería',   ruta: 'V1', dir: 'Plaza Principal 8' },
  { nombre: 'Fonda Las Delicias',     tipo: 'Fonda',       ruta: 'V1', dir: 'Allende 77' },
  { nombre: 'MiniSúper Gaby',         tipo: 'Minisuper',   ruta: 'V2', dir: 'Av. Juárez 1204' },
  { nombre: 'Lonchería Doña Chuy',    tipo: 'Fonda',       ruta: 'V2', dir: 'Zaragoza 156' },
  { nombre: 'Tienda Los Pinos',       tipo: 'Abarrotes',   ruta: 'V2', dir: 'Los Pinos 23' },
  { nombre: 'Escuela Primaria Juárez',tipo: 'Institución', ruta: 'V2', dir: 'Niños Héroes s/n' }
];

const CALLE = ['Venta de calle', 'Venta de calle', 'Venta de calle', 'Sra. Carmen', 'Don Rafa', 'Familia Gómez'];

const BOLILLO = NEGOCIO.productos[0];
const REPARTIDORES = NEGOCIO.vendedores.filter((v) => v.rol === 'repartidor' || v.rol === 'ambos');
const CAJERO = NEGOCIO.vendedores.find((v) => v.rol === 'cajero');

// Centro de referencia para el rastro de la ruta (datos de muestra).
const CENTRO = { lat: 21.5041, lng: -104.8942 };

function ventaDe(
  vendedor: { id: string; nombre: string },
  cliente: { id: string; nombre: string; tipo: string },
  piezas: number,
  cuando: Date,
  tipoCobro: 'efectivo' | 'crédito',
  pos?: { lat: number; lng: number }
) {
  const id = `V${cuando.getTime()}_${entre(100, 999)}`;
  return {
    id,
    vendedorId: vendedor.id,
    vendedorNombre: vendedor.nombre,
    clienteId: cliente.id,
    clienteNombre: cliente.nombre,
    clienteTipo: cliente.tipo,
    monto: piezas * BOLILLO.precio,
    tipoCobro,
    items: [{ id: BOLILLO.id, nombre: BOLILLO.nombre, q: piezas, pr: BOLILLO.precio, ic: BOLILLO.icono || '🥖' }],
    timestamp: cuando.getTime(),
    validado: true,
    sincronizado: true,
    ...(pos ? { lat: pos.lat, lng: pos.lng } : {})
  };
}

export function sembrarDemo() {
  const ahora = new Date();
  const ventas: Record<string, any> = {};
  const clientes: Record<string, any> = {};
  const abonos: Record<string, any> = {};
  const jornadas: Record<string, any> = {};
  const migajas: Record<string, any> = {};

  TIENDITAS.forEach((t, i) => {
    const id = `CLI_${String(i + 1).padStart(2, '0')}`;
    const vnd = REPARTIDORES.find((v) => v.id === t.ruta) || REPARTIDORES[0];
    clientes[id] = {
      id,
      nombre: t.nombre,
      tipo: t.tipo,
      vendedorId: vnd.id,
      vendedorNombre: vnd.nombre,
      direccion: t.dir,
      telefono: `31${entre(1, 9)} ${entre(100, 999)} ${entre(1000, 9999)}`,
      frecuencia: 'Diaria',
      timestamp: ahora.getTime() - DIAS * 86400000,
      total_comprado: 0,
      ultima_compra: 0
    };
  });

  const fechaISO = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dia}`;
  };

  for (let d = DIAS - 1; d >= 0; d--) {
    const dia = new Date(ahora.getTime() - d * 86400000);
    const esHoy = d === 0;
    const domingo = dia.getDay() === 0;

    for (const vnd of REPARTIDORES) {
      const misTienditas = Object.values(clientes).filter((c: any) => c.vendedorId === vnd.id);
      let vendidasHoy = 0;

      // Tienditas de la ruta
      const visitas = domingo ? entre(1, 2) : misTienditas.length;
      for (let i = 0; i < visitas; i++) {
        const cli: any = misTienditas[i % misTienditas.length];
        const piezas = entre(30, 90);
        const hora = new Date(dia);
        hora.setHours(entre(6, 10), entre(0, 59), 0, 0);
        if (esHoy && hora.getTime() > ahora.getTime()) hora.setTime(ahora.getTime() - entre(5, 90) * 60000);

        const v = ventaDe(vnd, { id: cli.id, nombre: cli.nombre, tipo: cli.tipo }, piezas,
          hora, azar() < 0.35 ? 'crédito' : 'efectivo',
          { lat: CENTRO.lat + (azar() - 0.5) * 0.04, lng: CENTRO.lng + (azar() - 0.5) * 0.04 });
        ventas[v.id] = v;
        vendidasHoy += piezas;
        cli.total_comprado += v.monto;
        cli.ultima_compra = hora.getTime();
      }

      // Venta suelta en la calle
      const sueltas = domingo ? entre(3, 6) : entre(8, 16);
      for (let i = 0; i < sueltas; i++) {
        const piezas = entre(2, 20);
        const hora = new Date(dia);
        hora.setHours(entre(6, 13), entre(0, 59), 0, 0);
        if (esHoy && hora.getTime() > ahora.getTime()) hora.setTime(ahora.getTime() - entre(5, 120) * 60000);

        const nombre = alguno(CALLE);
        const v = ventaDe(vnd, { id: 'PUBLICO', nombre, tipo: 'Público' }, piezas, hora, 'efectivo',
          { lat: CENTRO.lat + (azar() - 0.5) * 0.05, lng: CENTRO.lng + (azar() - 0.5) * 0.05 });
        ventas[v.id] = v;
        vendidasHoy += piezas;
      }

      // La jornada: carga de la mañana y, si ya terminó, su cierre.
      // La carga se calcula a partir de lo vendido para que el cuadre tenga
      // sentido: nadie vende más pan del que se llevó.
      const abierta = esHoy && vnd.id === REPARTIDORES[0].id;
      const sobrantes = abierta ? 0 : entre(8, 45);
      const faltantes = abierta ? 0 : entre(0, 6);
      const cargadas = abierta
        ? vendidasHoy + entre(120, 240)   // todavía trae pan en la canasta
        : vendidasHoy + sobrantes + faltantes;
      const id = `JOR_${vnd.id}_${fechaISO(dia)}`;
      jornadas[id] = {
        id,
        vendedorId: vnd.id,
        vendedorNombre: vnd.nombre,
        fecha: fechaISO(dia),
        piezasCargadas: cargadas,
        precioUnitario: BOLILLO.precio,
        inicio: new Date(dia).setHours(5, 45, 0, 0),
        timestamp: new Date(dia).setHours(5, 45, 0, 0),
        estado: abierta ? 'activa' : 'cerrada',
        sincronizado: true,
        ...(abierta
          ? {}
          : {
              fin: new Date(dia).setHours(14, entre(0, 59), 0, 0),
              piezasVendidas: vendidasHoy,
              piezasSobrantes: sobrantes,
              piezasFaltantes: faltantes,
              efectivoEsperado: vendidasHoy * BOLILLO.precio
            })
      };
    }

    // Mostrador (si hay cajero)
    if (CAJERO && !domingo) {
      for (let i = 0; i < entre(4, 9); i++) {
        const hora = new Date(dia);
        hora.setHours(entre(7, 19), entre(0, 59), 0, 0);
        if (esHoy && hora.getTime() > ahora.getTime()) hora.setTime(ahora.getTime() - entre(10, 180) * 60000);
        const v = ventaDe(CAJERO, { id: 'MOSTRADOR', nombre: alguno(CALLE), tipo: 'Mostrador' },
          entre(3, 25), hora, 'efectivo');
        ventas[v.id] = v;
      }
    }
  }

  // Abonos de las tienditas que compran a crédito
  const aCredito = Object.values(ventas).filter((v: any) => v.tipoCobro === 'crédito');
  for (let i = 0; i < 8 && i < aCredito.length; i++) {
    const v: any = aCredito[(i * 5) % aCredito.length];
    const fecha = new Date(v.timestamp + 2 * 86400000);
    const id = `ABO_${2000 + i}`;
    abonos[id] = {
      id,
      clienteNombre: v.clienteNombre,
      monto: Math.round(v.monto * (azar() < 0.5 ? 0.5 : 1)),
      fecha: fecha.toISOString().slice(0, 10),
      timestamp: fecha.getTime(),
      recibidoPor: v.vendedorNombre
    };
  }

  // Rastro de hoy del repartidor que anda en ruta: un recorrido de ~3 horas
  const enRuta = REPARTIDORES[0];
  let lat = CENTRO.lat;
  let lng = CENTRO.lng;
  const arranque = new Date();
  arranque.setHours(6, 30, 0, 0);
  for (let i = 0; i < 40; i++) {
    const t = arranque.getTime() + i * 5 * 60000;
    if (t > ahora.getTime()) break;
    // Camina por calles: avanza en un eje a la vez, como una cuadrícula.
    if (i % 2 === 0) lat += (azar() - 0.4) * 0.004;
    else lng += (azar() - 0.4) * 0.004;
    const id = `TRK_${enRuta.id}_${t}`;
    migajas[id] = {
      id,
      vendedorId: enRuta.id,
      vendedorNombre: enRuta.nombre,
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      precision: entre(18, 45),
      timestamp: t,
      sincronizado: true
    };
  }

  // Lo que ve el panel del dueño (la "nube" de la demostración)
  demoSeedTable('config', { global: { ...NEGOCIO } });
  demoSeedTable('ventas', ventas);
  demoSeedTable('clientes', clientes);
  demoSeedTable('abonos', abonos);
  demoSeedTable('jornadas', jornadas);
  demoSeedTable('recorrido', migajas);
  demoSeedTable('devoluciones', {});
  demoSeedTable('mystery_audits', {});

  // Lo que ve la app de ruta (lo guardado en el teléfono)
  try {
    localStorage.setItem('rp_cfg', JSON.stringify(NEGOCIO));
    localStorage.setItem('rp_clientes', JSON.stringify(Object.values(clientes)));
    localStorage.setItem('rp_ventas', JSON.stringify(Object.values(ventas)));
    localStorage.setItem('rp_jornadas', JSON.stringify(Object.values(jornadas)));
    localStorage.setItem('rp_migajas', JSON.stringify(Object.values(migajas)));
    localStorage.setItem('rp_devoluciones', '[]');
    // PIN del Panel del Dueño ya creado, para no perder tiempo frente al
    // cliente. En una instalación real lo crea el dueño en su dispositivo.
    localStorage.setItem('rp_admin_pin', '1234');
  } catch (e) {
    console.warn('[Demo] No se pudo preparar la caché local:', e);
  }

  return {
    ventas: Object.keys(ventas).length,
    clientes: Object.keys(clientes).length,
    jornadas: Object.keys(jornadas).length,
    migajas: Object.keys(migajas).length
  };
}
