/**
 * Datos de muestra para la demostración.
 *
 * Genera dos semanas de operación de una panadería: ventas de mostrador y de
 * dos rutas, clientes con crédito, abonos, mermas y auditorías de ruta. Es
 * determinista (misma "aleatoriedad" cada vez), para que la demostración se
 * vea igual en cada presentación.
 */

import { NEGOCIO } from '../src/data';
import { demoSeedTable } from './db.demo';

const DIAS = 14;

/** Generador pseudoaleatorio con semilla fija: la demo siempre luce igual. */
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

const CLIENTES_RUTA = [
  { nombre: 'Abarrotes Doña Mary',      tipo: 'Abarrotes',  ruta: 'V1', dir: 'Hidalgo 45, Centro' },
  { nombre: 'Tiendita La Esquina',      tipo: 'Abarrotes',  ruta: 'V1', dir: 'Morelos 312' },
  { nombre: 'Cafetería El Portal',      tipo: 'Cafetería',  ruta: 'V1', dir: 'Plaza Principal 8' },
  { nombre: 'MiniSúper Gaby',           tipo: 'Minisuper',  ruta: 'V1', dir: 'Av. Juárez 1204' },
  { nombre: 'Fonda Las Delicias',       tipo: 'Fonda',      ruta: 'V1', dir: 'Allende 77' },
  { nombre: 'Cremería San José',        tipo: 'Cremería',   ruta: 'V2', dir: 'Col. Morelos, Mz 4' },
  { nombre: 'Abarrotes El Sol',         tipo: 'Abarrotes',  ruta: 'V2', dir: 'Insurgentes 900' },
  { nombre: 'Lonchería Doña Chuy',      tipo: 'Fonda',      ruta: 'V2', dir: 'Zaragoza 156' },
  { nombre: 'Tienda Los Pinos',         tipo: 'Abarrotes',  ruta: 'V2', dir: 'Los Pinos 23' },
  { nombre: 'Cafecito de la Colonia',   tipo: 'Cafetería',  ruta: 'V2', dir: 'Reforma 410' },
  { nombre: 'Escuela Primaria Juárez',  tipo: 'Institución',ruta: 'V2', dir: 'Niños Héroes s/n' }
];

const CLIENTES_MOSTRADOR = [
  'Público general', 'Sra. Carmen', 'Don Rafa', 'Familia Gómez',
  'Sr. Efrén', 'Doña Lupita', 'Público general', 'Joven Diego'
];

const VENDEDORES = NEGOCIO.vendedores;
const PRODUCTOS = NEGOCIO.productos;

function vendedor(id: string) {
  return VENDEDORES.find((v) => v.id === id) || VENDEDORES[0];
}

/** Canasta verosímil: mucho pan barato, de vez en cuando algo caro. */
function armarCanasta(esMostrador: boolean) {
  const cuantos = esMostrador ? entre(1, 3) : entre(2, 4);
  const elegidos = new Set<string>();
  const items: any[] = [];

  for (let i = 0; i < cuantos; i++) {
    const p = azar() < 0.12 ? alguno(PRODUCTOS) : alguno(PRODUCTOS.slice(0, 4));
    if (elegidos.has(p.id)) continue;
    elegidos.add(p.id);
    const caro = p.precio > 5000;
    const q = esMostrador
      ? (caro ? 1 : entre(2, 12))
      : (caro ? entre(1, 3) : entre(20, 90));
    items.push({ id: p.id, nombre: p.nombre, q, pr: p.precio, ic: p.icono || '📦' });
  }

  if (items.length === 0) {
    const p = PRODUCTOS[0];
    items.push({ id: p.id, nombre: p.nombre, q: 10, pr: p.precio, ic: p.icono || '🍞' });
  }

  const monto = items.reduce((acc, it) => acc + it.q * it.pr, 0);
  return { items, monto };
}

export function sembrarDemo() {
  const ahora = new Date();
  const ventas: Record<string, any> = {};
  const clientes: Record<string, any> = {};
  const devoluciones: Record<string, any> = {};
  const abonos: Record<string, any> = {};
  const auditorias: Record<string, any> = {};

  // Clientes de ruta, con su historial acumulado
  CLIENTES_RUTA.forEach((c, i) => {
    const id = `CLI_${String(i + 1).padStart(2, '0')}`;
    const vnd = vendedor(c.ruta);
    clientes[id] = {
      id,
      nombre: c.nombre,
      tipo: c.tipo,
      vendedorId: vnd.id,
      vendedorNombre: vnd.nombre,
      direccion: c.dir,
      telefono: `31${entre(1, 9)} ${entre(100, 999)} ${entre(1000, 9999)}`,
      frecuencia: alguno(['Diaria', 'Diaria', 'L-M-V', 'Semanal']),
      timestamp: ahora.getTime() - DIAS * 86400000,
      total_comprado: 0,
      ultima_compra: 0
    };
  });

  let folio = 1000;

  for (let d = DIAS - 1; d >= 0; d--) {
    const dia = new Date(ahora.getTime() - d * 86400000);
    const domingo = dia.getDay() === 0;

    // ── Rutas de reparto (temprano) ──
    for (const vnd of VENDEDORES.filter((v) => v.rol === 'repartidor')) {
      const clientesDeRuta = Object.values(clientes).filter((c: any) => c.vendedorId === vnd.id);
      const visitas = domingo ? entre(1, 2) : entre(3, clientesDeRuta.length);

      for (let i = 0; i < visitas; i++) {
        const cli: any = clientesDeRuta[i % clientesDeRuta.length];
        const { items, monto } = armarCanasta(false);
        const hora = new Date(dia);
        hora.setHours(entre(6, 11), entre(0, 59), 0, 0);

        const id = `VTA_${++folio}`;
        ventas[id] = {
          id,
          vendedorId: vnd.id,
          vendedorNombre: vnd.nombre,
          clienteId: cli.id,
          clienteNombre: cli.nombre,
          clienteTipo: cli.tipo,
          monto,
          tipoCobro: azar() < 0.32 ? 'crédito' : 'efectivo',
          items,
          timestamp: hora.getTime(),
          validado: true
        };

        cli.total_comprado = (cli.total_comprado || 0) + monto;
        cli.ultima_compra = hora.getTime();

        // Merma: pan que regresa de la ruta
        if (azar() < 0.22) {
          const p = alguno(PRODUCTOS.slice(0, 4));
          const idD = `DEV_${folio}`;
          devoluciones[idD] = {
            id: idD,
            vendedorId: vnd.id,
            vendedorNombre: vnd.nombre,
            clienteId: cli.id,
            clienteNombre: cli.nombre,
            productoId: p.id,
            productoNombre: p.nombre,
            cantidad: entre(3, 18),
            timestamp: hora.getTime() + 3600000
          };
        }
      }
    }

    // ── Mostrador (todo el día) ──
    const cajero = VENDEDORES.find((v) => v.rol === 'cajero' || v.rol === 'ambos') || VENDEDORES[0];
    const tickets = domingo ? entre(4, 8) : entre(8, 16);
    for (let i = 0; i < tickets; i++) {
      const { items, monto } = armarCanasta(true);
      const hora = new Date(dia);
      hora.setHours(entre(7, 20), entre(0, 59), 0, 0);
      const id = `VTA_${++folio}`;
      ventas[id] = {
        id,
        vendedorId: cajero.id,
        vendedorNombre: cajero.nombre,
        clienteId: 'MOSTRADOR',
        clienteNombre: alguno(CLIENTES_MOSTRADOR),
        clienteTipo: 'Mostrador',
        monto,
        tipoCobro: 'efectivo',
        items,
        timestamp: hora.getTime(),
        validado: true
      };
    }
  }

  // ── Abonos de clientes con crédito ──
  const conCredito = Object.values(ventas).filter((v: any) => v.tipoCobro === 'crédito');
  for (let i = 0; i < 9 && i < conCredito.length; i++) {
    const v: any = conCredito[i * 3 % conCredito.length];
    const id = `ABO_${2000 + i}`;
    const fecha = new Date(v.timestamp + 2 * 86400000);
    abonos[id] = {
      id,
      clienteNombre: v.clienteNombre,
      monto: Math.round(v.monto * (azar() < 0.5 ? 0.5 : 1)),
      fecha: fecha.toISOString().slice(0, 10),
      timestamp: fecha.getTime(),
      recibidoPor: v.vendedorNombre
    };
  }

  // ── Auditorías de ruta ──
  VENDEDORES.filter((v) => v.rol === 'repartidor').forEach((vnd, i) => {
    const fecha = new Date(ahora.getTime() - (i + 2) * 86400000);
    const id = `AUD_${3000 + i}`;
    const fallo = i === 1;
    auditorias[id] = {
      id,
      vendedorId: vnd.id,
      vendedorNombre: vnd.nombre,
      fecha: fecha.toISOString().slice(0, 10),
      auditor: 'Cliente incógnito',
      checks: {
        cobroExacto: true,
        entregaRecibo: !fallo,
        presentacionLimpia: true,
        tratoAmable: true
      },
      calificacion: fallo ? 75 : 100,
      notas: fallo
        ? 'No entregó nota de venta al cliente. Se le recordó el procedimiento.'
        : 'Ruta en orden: cobro exacto, nota entregada y buen trato.',
      timestamp: fecha.getTime()
    };
  });

  demoSeedTable('config', { global: { ...NEGOCIO } });
  demoSeedTable('ventas', ventas);
  demoSeedTable('clientes', clientes);
  demoSeedTable('devoluciones', devoluciones);
  demoSeedTable('abonos', abonos);
  demoSeedTable('mystery_audits', auditorias);

  try {
    localStorage.setItem('rp_cfg', JSON.stringify(NEGOCIO));
    // PIN del Panel del Dueño ya creado, para no perder tiempo frente al
    // cliente. En una instalación real lo crea el dueño en su dispositivo.
    localStorage.setItem('rp_admin_pin', '1234');
    localStorage.setItem('rp_clientes', JSON.stringify(Object.values(clientes)));
    localStorage.setItem('rp_ventas', '[]');
    localStorage.setItem('rp_devoluciones', '[]');
  } catch (e) {
    console.warn('[Demo] No se pudo preparar la caché local:', e);
  }

  return { ventas: Object.keys(ventas).length, clientes: Object.keys(clientes).length };
}
