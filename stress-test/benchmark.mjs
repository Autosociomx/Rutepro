#!/usr/bin/env node
/**
 * RoutePro — Prueba de estrés de procesamiento de datos
 *
 * Simula un negocio operando con 15 rutas y mide los algoritmos
 * críticos de AdminScreen (réplica exacta de la lógica) a escalas
 * crecientes: 1 día → 3 meses de operación.
 *
 * También mide el peso del cache localStorage, que tiene cuota de ~5MB.
 *
 * Uso: node stress-test/benchmark.mjs
 */

// ── Generador de datos sintéticos realistas ──────────────────────────────

const RUTAS = 15;
const CLIENTES_POR_RUTA = 40;
const VENTAS_POR_RUTA_DIA = 30;

const NOMBRES = ['Juan', 'María', 'Pedro', 'Alondra', 'Luis', 'Carmen', 'Jorge', 'Estela', 'Raúl', 'Sofía', 'Miguel', 'Elena', 'Paco', 'Rosa', 'Diego'];
const APELLIDOS = ['García', 'Pérez', 'López', 'Díaz', 'Bañales', 'Martínez', 'Aguilar', 'Sánchez', 'Torres', 'Ramírez'];
const TIPOS_CLIENTE = ['Abarrotes', 'Minisuper', 'Cremería', 'Restaurante', 'Lonchería'];
const PRODUCTOS = [
  { id: 'P1', nombre: 'Producto Estrella (Fam.)', pr: 3800, ic: '🫓' },
  { id: 'P2', nombre: 'Producto Premium', pr: 3500, ic: '🌮' },
  { id: 'P3', nombre: 'Producto Base kg', pr: 2400, ic: '🌽' },
  { id: 'P4', nombre: 'Complemento A', pr: 1900, ic: '🌶️' },
  { id: 'P5', nombre: 'Complemento B kg', pr: 9500, ic: '🧀' },
  { id: 'P6', nombre: 'Caja Mayoreo', pr: 18000, ic: '📦' },
];

let seed = 42;
const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;

function generarDataset(dias) {
  const vendedores = Array.from({ length: RUTAS }, (_, i) => ({
    id: `V${i + 1}`,
    nombre: `${pick(NOMBRES)} ${pick(APELLIDOS)}`,
    rol: i === RUTAS - 1 ? 'cajero' : 'repartidor',
    ruta: `Ruta ${i + 1}`,
  }));

  const clientes = [];
  vendedores.forEach(v => {
    for (let c = 0; c < CLIENTES_POR_RUTA; c++) {
      clientes.push({
        id: `C_${v.id}_${c}`,
        nombre: `${pick(TIPOS_CLIENTE)} ${pick(NOMBRES)} ${randInt(1, 999)}`,
        tipo: pick(TIPOS_CLIENTE),
        vendedorId: v.id,
        vendedorNombre: v.nombre,
        latitude: 21.5 + rand() * 0.2,
        longitude: -104.9 + rand() * 0.2,
        direccion: `Calle ${randInt(1, 200)} #${randInt(100, 999)}`,
        telefono: `311${randInt(1000000, 9999999)}`,
        timestamp: Date.now() - randInt(0, 90) * 86400000,
      });
    }
  });

  const ventas = [];
  const devoluciones = [];
  const abonos = [];
  const ahora = Date.now();

  for (let d = 0; d < dias; d++) {
    const diaTs = ahora - d * 86400000;
    vendedores.forEach(v => {
      const clientesRuta = clientes.filter(c => c.vendedorId === v.id);
      for (let s = 0; s < VENTAS_POR_RUTA_DIA; s++) {
        const cliente = pick(clientesRuta);
        const numItems = randInt(1, 4);
        const items = Array.from({ length: numItems }, () => {
          const p = pick(PRODUCTOS);
          return { id: p.id, nombre: p.nombre, q: randInt(1, 10), pr: p.pr, ic: p.ic };
        });
        const monto = items.reduce((acc, it) => acc + it.q * it.pr, 0);
        ventas.push({
          id: `VTA_${d}_${v.id}_${s}`,
          vendedorId: v.id,
          vendedorNombre: v.nombre,
          clienteId: cliente.id,
          clienteNombre: cliente.nombre,
          clienteTipo: cliente.tipo,
          monto,
          tipoCobro: rand() < 0.3 ? 'crédito' : 'efectivo',
          items,
          timestamp: diaTs - randInt(0, 36000000),
        });
      }
      // ~2 devoluciones por ruta por día
      for (let dv = 0; dv < 2; dv++) {
        const cliente = pick(clientesRuta);
        const p = pick(PRODUCTOS);
        devoluciones.push({
          id: `DEV_${d}_${v.id}_${dv}`,
          vendedorId: v.id,
          vendedorNombre: v.nombre,
          clienteId: cliente.id,
          clienteNombre: cliente.nombre,
          productoId: p.id,
          productoNombre: p.nombre,
          cantidad: randInt(1, 5),
          timestamp: diaTs,
        });
      }
      // ~3 abonos por ruta por día
      for (let a = 0; a < 3; a++) {
        const cliente = pick(clientesRuta);
        abonos.push({
          id: `AB_${d}_${v.id}_${a}`,
          clienteNombre: cliente.nombre,
          monto: randInt(5000, 50000),
          fecha: new Date(diaTs).toLocaleDateString('es-MX'),
          timestamp: diaTs,
          recibidoPor: v.nombre,
        });
      }
    });
  }

  return { vendedores, clientes, ventas, devoluciones, abonos };
}

// ── Réplica exacta de los algoritmos de AdminScreen ──────────────────────

function getClientesLedger(ventas, abonos) {
  const ledgerTable = {};
  ventas.forEach((v) => {
    const cName = v.clienteNombre?.trim() || 'Cliente General';
    if (!ledgerTable[cName]) {
      ledgerTable[cName] = { nombre: cName, total_compras: 0, total_abonos: 0, saldo_actual: 0, visitas_totales: 0, compras: [], abonos_detalles: [] };
    }
    ledgerTable[cName].visitas_totales += 1;
    ledgerTable[cName].compras.push(v);
    if (v.tipoCobro === 'crédito') {
      ledgerTable[cName].total_compras += v.monto || 0;
    }
  });
  abonos.forEach((ab) => {
    const cName = ab.clienteNombre?.trim();
    if (!ledgerTable[cName]) {
      ledgerTable[cName] = { nombre: cName, total_compras: 0, total_abonos: 0, saldo_actual: 0, visitas_totales: 0, compras: [], abonos_detalles: [] };
    }
    ledgerTable[cName].total_abonos += ab.monto || 0;
    ledgerTable[cName].abonos_detalles.push(ab);
  });
  for (const key in ledgerTable) {
    ledgerTable[key].saldo_actual = Math.max(0, ledgerTable[key].total_compras - ledgerTable[key].total_abonos);
    ledgerTable[key].compras.sort((a, b) => b.timestamp - a.timestamp);
    ledgerTable[key].abonos_detalles.sort((a, b) => b.timestamp - a.timestamp);
  }
  return Object.values(ledgerTable).sort((a, b) => b.saldo_actual - a.saldo_actual);
}

function getProductPopularity(ventas) {
  const table = {};
  ventas.forEach((v) => {
    (v.items || []).forEach((item) => {
      if (!table[item.nombre]) {
        table[item.nombre] = { nombre: item.nombre, icono: item.ic || '📦', totalCents: 0, qty: 0 };
      }
      table[item.nombre].totalCents += (item.pr || 0) * (item.q || 0);
      table[item.nombre].qty += (item.q || 0);
    });
  });
  return Object.values(table).sort((a, b) => b.totalCents - a.totalCents).slice(0, 4);
}

function getRouteBreadcrumbs(sellerId, vendedores, clientes, ventas) {
  const seller = vendedores.find(v => v.id === sellerId);
  if (!seller) return [];
  const sellerClients = clientes.filter(c => c.vendedorId === sellerId);
  sellerClients.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  return sellerClients.map((c, idx) => {
    const todaySales = ventas.filter(
      v => v.vendedorId === sellerId && (v.clienteId === c.id || v.clienteNombre?.toLowerCase() === c.nombre.trim().toLowerCase())
    );
    const totalAmount = todaySales.reduce((acc, v) => acc + v.monto, 0);
    return { index: idx + 1, id: c.id, nombre: c.nombre, totalVendido: totalAmount, visitado: todaySales.length > 0 };
  });
}

// ── Runner de benchmark ───────────────────────────────────────────────────

function medir(nombre, fn, presupuestoMs) {
  const t0 = performance.now();
  const resultado = fn();
  const ms = performance.now() - t0;
  const estado = ms <= presupuestoMs ? '✓' : ms <= presupuestoMs * 3 ? '⚠️ ' : '❌';
  return { nombre, ms: Math.round(ms * 100) / 100, presupuestoMs, estado, resultado };
}

const ESCENARIOS = [
  { nombre: '1 día de operación', dias: 1 },
  { nombre: '1 semana', dias: 7 },
  { nombre: '1 mes', dias: 30 },
  { nombre: '3 meses (extremo)', dias: 90 },
];

console.log('═'.repeat(72));
console.log(`  RUTEPRO — PRUEBA DE ESTRÉS: ${RUTAS} rutas, ${CLIENTES_POR_RUTA} clientes/ruta, ${VENTAS_POR_RUTA_DIA} ventas/ruta/día`);
console.log('═'.repeat(72));

let hayFallos = false;
const LIMITE_LOCALSTORAGE = 5 * 1024 * 1024; // 5MB cuota típica de navegador móvil

for (const esc of ESCENARIOS) {
  const gen0 = performance.now();
  const data = generarDataset(esc.dias);
  const genMs = Math.round(performance.now() - gen0);

  console.log(`\n▶ ${esc.nombre} — ${data.ventas.length.toLocaleString()} ventas, ${data.clientes.length} clientes, ${data.abonos.length.toLocaleString()} abonos (generado en ${genMs}ms)`);

  // Presupuestos: la UI recalcula esto en cada render → debe ser <50ms para no congelar un teléfono de gama media (que es ~4x más lento que este servidor)
  const pruebas = [
    medir('  Ledger de clientes (cartera/fiado)', () => getClientesLedger(data.ventas, data.abonos), 50),
    medir('  Popularidad de productos', () => getProductPopularity(data.ventas), 50),
    medir('  Breadcrumbs de 1 ruta (mapa)', () => getRouteBreadcrumbs('V1', data.vendedores, data.clientes, data.ventas), 50),
    medir('  Breadcrumbs de las 15 rutas', () => data.vendedores.forEach(v => getRouteBreadcrumbs(v.id, data.vendedores, data.clientes, data.ventas)), 150),
    medir('  Métricas de tarjetas (totales)', () => {
      const totalCobrado = data.ventas.reduce((s, v) => s + v.monto, 0);
      const ledger = getClientesLedger(data.ventas, data.abonos);
      const deuda = ledger.reduce((s, c) => s + c.saldo_actual, 0);
      return { totalCobrado, deuda };
    }, 100),
  ];

  pruebas.forEach(p => {
    console.log(`${p.estado} ${p.nombre}: ${p.ms}ms (presupuesto ${p.presupuestoMs}ms)`);
    if (p.estado === '❌') hayFallos = true;
  });

  // Peso de cache localStorage (la app guarda TODO en localStorage como fallback offline)
  const ventasJson = JSON.stringify(data.ventas);
  const totalJson = ventasJson.length + JSON.stringify(data.clientes).length + JSON.stringify(data.abonos).length + JSON.stringify(data.devoluciones).length;
  const pct = Math.round((totalJson / LIMITE_LOCALSTORAGE) * 100);
  const lsEstado = pct < 60 ? '✓' : pct < 100 ? '⚠️ ' : '❌';
  console.log(`${lsEstado}   Cache localStorage: ${(totalJson / 1024 / 1024).toFixed(2)}MB de 5MB (${pct}% de la cuota)`);
  if (pct >= 100) hayFallos = true;

  // Simular payload de sincronización Firestore (documento por venta)
  const avgDocSize = Math.round(ventasJson.length / data.ventas.length);
  console.log(`    Tamaño promedio por venta: ${avgDocSize} bytes | Lecturas Firestore/día por admin conectado: ~${data.ventas.length}`);
}

console.log('\n' + '═'.repeat(72));
console.log(hayFallos ? '  RESULTADO: ❌ HAY OPERACIONES QUE COLAPSAN — revisar arriba' : '  RESULTADO: ✓ Todos los algoritmos dentro de presupuesto');
console.log('═'.repeat(72));
process.exit(hayFallos ? 1 : 0);
