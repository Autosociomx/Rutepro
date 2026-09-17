/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pantalla de ruta para un negocio de un solo producto (bolillo).
 *
 * Tres momentos, en este orden:
 *   1. CARGA   — cuántas piezas se lleva en la mañana.
 *   2. VENTA   — en la calle: teclea la cantidad y cobra. Dos toques.
 *   3. CIERRE  — cuánto cargó, cuánto vendió, cuánto trae de regreso.
 *
 * Todo funciona sin señal: se guarda en el teléfono y sube solo cuando hay
 * internet. Mientras la jornada está abierta se va dejando el rastro de la
 * ruta (migajas), sin prender el GPS fino para no acabar la batería.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppConfig, Seller, Client } from '../types';
import {
  Jornada,
  abrirJornada,
  ajustarCarga,
  calcularCuadre,
  cerrarJornada,
  cobradoHoy,
  deshacerUltimaVenta,
  jornadaDeHoy,
  piezasVendidasHoy,
  registrarVenta,
  ventasDeHoy,
  ventasPendientesDeSubir,
  VentaLocal
} from '../utils/jornada';
import { iniciarRastreo, migajasDeHoy, migajasPendientes, Rastreador } from '../utils/gps';
import { safeParseArray } from '../utils/syncEngine';
import { LOGO_NEGOCIO } from '../data';

interface Props {
  cfg: AppConfig;
  onGoBack: () => void;
  triggerToast: (mensaje: string, tipo?: 'ok' | 'err') => void;
}

const ATAJOS = [1, 2, 5, 10, 20, 50];
const ATAJOS_CARGA = [100, 200, 300, 500];

export const RutaScreen: React.FC<Props> = ({ cfg, onGoBack, triggerToast }) => {
  const color = cfg.color_principal || '#C9822A';
  const producto = cfg.productos?.[0];

  const repartidores = useMemo(
    () => (cfg.vendedores || []).filter((v) => v.rol === 'repartidor' || v.rol === 'ambos'),
    [cfg.vendedores]
  );

  const [vendedor, setVendedor] = useState<Seller | null>(null);
  const [jornada, setJornada] = useState<Jornada | null>(null);
  const [paso, setPaso] = useState<'vendedor' | 'carga' | 'venta' | 'cierre'>('vendedor');

  const [cantidad, setCantidad] = useState(0);
  const [carga, setCarga] = useState(0);
  const [sobrantes, setSobrantes] = useState(0);
  const [aCredito, setACredito] = useState(false);
  const [cliente, setCliente] = useState<{ id: string; nombre: string; tipo?: string } | null>(null);
  const [mostrarClientes, setMostrarClientes] = useState(false);
  const [busquedaCliente, setBusquedaCliente] = useState('');

  const [ventas, setVentas] = useState<VentaLocal[]>([]);
  const [migajas, setMigajas] = useState(0);
  const [porSubir, setPorSubir] = useState(0);
  const [gpsVivo, setGpsVivo] = useState(false);

  const rastreador = useRef<Rastreador | null>(null);

  const clientesGuardados = useMemo<Client[]>(
    () => safeParseArray<Client>(localStorage.getItem('rp_clientes')),
    [mostrarClientes]
  );

  const refrescar = (vId: string) => {
    setVentas(ventasDeHoy(vId));
    setMigajas(migajasDeHoy(vId).length);
    setPorSubir(ventasPendientesDeSubir() + migajasPendientes());
  };

  // Rastreo encendido sólo mientras la jornada está abierta.
  useEffect(() => {
    if (!vendedor || !jornada || jornada.estado !== 'activa') return;

    const r = iniciarRastreo(vendedor.id, vendedor.nombre, () => {
      setMigajas(migajasDeHoy(vendedor.id).length);
      setGpsVivo(true);
    });
    rastreador.current = r;

    const reloj = setInterval(() => refrescar(vendedor.id), 10000);
    return () => {
      r.detener();
      rastreador.current = null;
      clearInterval(reloj);
    };
  }, [vendedor?.id, jornada?.id, jornada?.estado]);

  const elegirVendedor = (v: Seller) => {
    if (!producto) {
      triggerToast('Primero da de alta el producto en Configuración', 'err');
      return;
    }
    setVendedor(v);
    const j = jornadaDeHoy(v.id);
    setJornada(j);
    refrescar(v.id);

    if (!j) {
      setCarga(0);
      setPaso('carga');
    } else if (j.estado === 'cerrada') {
      setPaso('cierre');
    } else {
      setPaso('venta');
    }
  };

  const confirmarCarga = () => {
    if (!vendedor || !producto) return;
    if (carga <= 0) {
      triggerToast('Anota cuántas piezas llevas', 'err');
      return;
    }
    const j = abrirJornada(vendedor, carga, producto.precio);
    setJornada(j);
    setPaso('venta');
    triggerToast(`✓ Jornada abierta con ${carga} piezas`);
  };

  const cobrar = () => {
    if (!vendedor || !producto || cantidad <= 0) return;

    const ultima = rastreador.current?.ultima() || null;
    registrarVenta({
      vendedor,
      producto: { id: producto.id, nombre: producto.nombre, precio: producto.precio, icono: producto.icono },
      piezas: cantidad,
      tipoCobro: aCredito ? 'crédito' : 'efectivo',
      cliente,
      posicion: ultima ? { lat: ultima.lat, lng: ultima.lng } : null
    });

    // Cada venta deja también su propia migaja: así el dueño puede preguntar
    // dónde fue la última venta aunque el teléfono haya estado guardado.
    rastreador.current?.marcar();

    triggerToast(`✓ ${cantidad} piezas · ${precioTexto(cantidad * producto.precio)}`);
    setCantidad(0);
    setACredito(false);
    setCliente(null);
    refrescar(vendedor.id);
  };

  const deshacer = () => {
    if (!vendedor) return;
    const quitada = deshacerUltimaVenta(vendedor.id);
    if (quitada) {
      triggerToast('Venta borrada');
      refrescar(vendedor.id);
    } else {
      triggerToast('No hay ventas que borrar', 'err');
    }
  };

  const confirmarCierre = () => {
    if (!vendedor) return;
    const j = cerrarJornada(vendedor.id, sobrantes);
    if (j) {
      setJornada(j);
      triggerToast('✓ Jornada cerrada');
    }
  };

  const precioTexto = (centavos: number) => `$${(centavos / 100).toFixed(2)}`;
  const hora = (ts: number) => new Date(ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  const vendidasHoy = vendedor ? piezasVendidasHoy(vendedor.id) : 0;
  const restantes = jornada ? Math.max(0, jornada.piezasCargadas - vendidasHoy) : 0;
  const dinero = vendedor ? cobradoHoy(vendedor.id) : { efectivo: 0, credito: 0 };

  // ─── Encabezado común ─────────────────────────────────────────────
  const Encabezado = ({ titulo, atras }: { titulo: string; atras: () => void }) => (
    <div className="sticky top-0 z-40 bg-[#06080C]/95 backdrop-blur-md border-b border-white/5 px-4 h-14 flex items-center gap-3">
      <button
        onClick={atras}
        className="w-9 h-9 rounded-lg bg-[#111520] border border-white/5 flex items-center justify-center text-[#8A93A8] hover:text-white transition-all cursor-pointer shrink-0"
      >
        ←
      </button>
      <div className="flex-1 min-w-0">
        <div className="font-display font-bold text-sm text-white truncate">{titulo}</div>
        {vendedor && <div className="text-[10px] text-[#8A93A8] truncate">{vendedor.ruta}</div>}
      </div>
      {jornada?.estado === 'activa' && (
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`text-[9px] font-bold px-2 py-1 rounded-full border ${
              gpsVivo
                ? 'text-emerald-300 border-emerald-500/20 bg-emerald-500/10'
                : 'text-[#8A93A8] border-white/10 bg-white/5'
            }`}
            title={gpsVivo ? `${migajas} migajas grabadas hoy` : 'Sin señal de ubicación todavía'}
          >
            {gpsVivo ? `📍 ${migajas}` : '📍 —'}
          </span>
          {porSubir > 0 && (
            <span
              className="text-[9px] font-bold px-2 py-1 rounded-full text-amber-300 border border-amber-500/20 bg-amber-500/10"
              title="Guardado en el teléfono; sube solo cuando haya internet"
            >
              ↑ {porSubir}
            </span>
          )}
        </div>
      )}
    </div>
  );

  // ─── 1. ¿Quién sale a ruta? ───────────────────────────────────────
  if (paso === 'vendedor' || !vendedor) {
    return (
      <div className="min-h-screen bg-[#06080C] text-[#EEF1F8] font-sans">
        <Encabezado titulo="Salir a ruta" atras={onGoBack} />
        <div className="p-5 space-y-4">
          <div className="flex flex-col items-center text-center pt-2 pb-1">
            <img
              src={cfg.logo_url || LOGO_NEGOCIO}
              alt={cfg.nombre}
              className="w-24 h-24 object-contain mb-3"
            />
            <h2 className="font-display font-extrabold text-xl text-white">¿Quién sale hoy?</h2>
            <p className="text-xs text-[#8A93A8] mt-1">Toca tu nombre para abrir tu jornada.</p>
          </div>

          {!producto && (
            <div className="text-xs text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 leading-relaxed">
              Todavía no hay producto dado de alta. Entra a <strong>Configuración</strong> y
              agrega el pan que se vende en ruta con su precio.
            </div>
          )}

          <div className="space-y-2.5">
            {repartidores.map((v) => {
              const j = jornadaDeHoy(v.id);
              return (
                <button
                  key={v.id}
                  onClick={() => elegirVendedor(v)}
                  className="w-full bg-[#111520] border border-white/5 rounded-2xl p-4 flex items-center gap-3.5 text-left hover:bg-[#161C2A] active:scale-98 transition-all cursor-pointer"
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center font-display font-extrabold text-lg shrink-0"
                    style={{ backgroundColor: `${color}22`, color }}
                  >
                    {(v.nombre || '?').charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-white truncate">{v.nombre}</div>
                    <div className="text-[11px] text-[#8A93A8] truncate">{v.ruta}</div>
                  </div>
                  <div className="text-right shrink-0">
                    {!j && <span className="text-[10px] text-[#8A93A8]">Sin cargar</span>}
                    {j?.estado === 'activa' && (
                      <span className="text-[10px] font-bold text-emerald-400">En ruta</span>
                    )}
                    {j?.estado === 'cerrada' && (
                      <span className="text-[10px] text-[#8A93A8]">Cerrada</span>
                    )}
                  </div>
                </button>
              );
            })}
            {repartidores.length === 0 && (
              <div className="text-xs text-[#8A93A8] bg-[#111520] border border-white/5 rounded-2xl p-5 text-center">
                No hay repartidores dados de alta. Agrégalos en Configuración.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── 2. Carga de la mañana ────────────────────────────────────────
  if (paso === 'carga') {
    return (
      <div className="min-h-screen bg-[#06080C] text-[#EEF1F8] font-sans">
        <Encabezado titulo="Carga de hoy" atras={() => setPaso('vendedor')} />
        <div className="p-5 space-y-5">
          <div className="text-left">
            <h2 className="font-display font-extrabold text-xl text-white">
              ¿Cuántas piezas llevas?
            </h2>
            <p className="text-xs text-[#8A93A8] mt-1">
              {producto?.nombre || 'Producto'} · {precioTexto(producto?.precio || 0)} por pieza
            </p>
          </div>

          <div className="bg-[#111520] border border-white/5 rounded-3xl p-6 text-center">
            <div className="font-display font-extrabold text-6xl tracking-tight" style={{ color }}>
              {carga}
            </div>
            <div className="text-[11px] text-[#8A93A8] mt-1">piezas cargadas</div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {ATAJOS_CARGA.map((n) => (
              <button
                key={n}
                onClick={() => setCarga((c) => c + n)}
                className="py-3.5 rounded-xl bg-[#181D2B] border border-white/5 text-sm font-bold text-white hover:bg-[#1F2638] active:scale-95 transition-all cursor-pointer"
              >
                +{n}
              </button>
            ))}
          </div>

          <Teclado valor={carga} onCambio={setCarga} color={color} />

          <button
            onClick={confirmarCarga}
            disabled={carga <= 0}
            className="w-full py-5 rounded-2xl font-extrabold text-base text-[#0B0E14] disabled:opacity-30 active:scale-98 transition-all cursor-pointer shadow-lg"
            style={{ backgroundColor: color }}
          >
            Iniciar jornada
          </button>
        </div>
      </div>
    );
  }

  // ─── 4. Cierre de jornada ─────────────────────────────────────────
  if (paso === 'cierre' && jornada) {
    const cuadre = calcularCuadre(jornada);
    const cerrada = jornada.estado === 'cerrada';
    const faltantes = Math.max(0, cuadre.piezasEsperadas - sobrantes);

    return (
      <div className="min-h-screen bg-[#06080C] text-[#EEF1F8] font-sans">
        <Encabezado titulo="Cierre de jornada" atras={() => setPaso(cerrada ? 'vendedor' : 'venta')} />
        <div className="p-5 space-y-4">
          <div className="bg-[#111520] border border-white/5 rounded-2xl divide-y divide-white/5">
            <Renglon etiqueta="Cargó en la mañana" valor={`${cuadre.piezasCargadas} pzas`} />
            <Renglon etiqueta="Vendió" valor={`${cuadre.piezasVendidas} pzas`} destacado={color} />
            <Renglon etiqueta="Debería traer" valor={`${cuadre.piezasEsperadas} pzas`} />
            <Renglon etiqueta="Efectivo del día" valor={precioTexto(cuadre.efectivoEsperado)} destacado="#00C896" />
            {cuadre.creditoDelDia > 0 && (
              <Renglon etiqueta="Quedó a crédito" valor={precioTexto(cuadre.creditoDelDia)} destacado="#F59E0B" />
            )}
            <Renglon etiqueta="Ventas registradas" valor={String(cuadre.ventas)} />
          </div>

          {cerrada ? (
            <div className="bg-[#111520] border border-white/5 rounded-2xl p-5 space-y-2 text-center">
              <div className="text-sm font-bold text-white">Jornada cerrada</div>
              <div className="text-xs text-[#8A93A8]">
                Trajo {jornada.piezasSobrantes} piezas de regreso
                {(jornada.piezasFaltantes || 0) > 0 && ` · faltaron ${jornada.piezasFaltantes}`}
              </div>
            </div>
          ) : (
            <>
              <div className="text-left pt-1">
                <h2 className="font-display font-extrabold text-lg text-white">
                  ¿Cuántas piezas traes de regreso?
                </h2>
                <p className="text-xs text-[#8A93A8] mt-1">
                  Lo que no se vendió ni regresó cuenta como merma del día.
                </p>
              </div>

              <div className="bg-[#111520] border border-white/5 rounded-3xl p-5 text-center">
                <div className="font-display font-extrabold text-5xl tracking-tight text-white">{sobrantes}</div>
                <div className="text-[11px] text-[#8A93A8] mt-1">
                  {faltantes > 0 ? `faltarían ${faltantes} piezas` : 'cuadra exacto'}
                </div>
              </div>

              <Teclado valor={sobrantes} onCambio={setSobrantes} color={color} />

              <button
                onClick={confirmarCierre}
                className="w-full py-5 rounded-2xl font-extrabold text-base text-[#0B0E14] active:scale-98 transition-all cursor-pointer shadow-lg"
                style={{ backgroundColor: color }}
              >
                Cerrar jornada
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ─── 3. Venta en la calle ─────────────────────────────────────────
  const total = (producto?.precio || 0) * cantidad;

  return (
    <div className="min-h-screen bg-[#06080C] text-[#EEF1F8] font-sans pb-4">
      <Encabezado titulo={vendedor.nombre} atras={() => setPaso('vendedor')} />

      {/* Estado de la jornada */}
      <div className="grid grid-cols-3 gap-px bg-white/5 border-b border-white/5">
        <Tarjeta etiqueta="Llevas" valor={`${restantes}`} sufijo="pzas" />
        <Tarjeta etiqueta="Vendidas" valor={`${vendidasHoy}`} sufijo="pzas" color={color} />
        <Tarjeta etiqueta="Efectivo" valor={precioTexto(dinero.efectivo)} />
      </div>

      <div className="p-5 space-y-4">
        {/* Contador */}
        <div className="bg-[#111520] border border-white/5 rounded-3xl p-6 text-center">
          <div className="font-display font-extrabold text-7xl leading-none tracking-tight" style={{ color }}>
            {cantidad}
          </div>
          <div className="text-xs text-[#8A93A8] mt-2">
            {producto?.nombre || 'piezas'} · {precioTexto(producto?.precio || 0)} c/u
          </div>
          <div className="mt-3 font-display font-extrabold text-2xl text-white">{precioTexto(total)}</div>
        </div>

        {/* Atajos */}
        <div className="grid grid-cols-6 gap-1.5">
          {ATAJOS.map((n) => (
            <button
              key={n}
              onClick={() => setCantidad((c) => c + n)}
              className="py-3 rounded-xl bg-[#181D2B] border border-white/5 text-sm font-bold text-white hover:bg-[#1F2638] active:scale-95 transition-all cursor-pointer"
            >
              +{n}
            </button>
          ))}
        </div>

        <Teclado valor={cantidad} onCambio={setCantidad} color={color} />

        {/* Cliente y forma de cobro */}
        <div className="flex gap-2">
          <button
            onClick={() => setMostrarClientes(true)}
            className="flex-1 py-3 rounded-xl bg-[#181D2B] border border-white/5 text-xs font-semibold text-[#8A93A8] hover:text-white transition-all cursor-pointer truncate px-3"
          >
            {cliente ? `👤 ${cliente.nombre}` : '👤 Venta de calle'}
          </button>
          <button
            onClick={() => setACredito((c) => !c)}
            className={`px-4 py-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              aCredito
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                : 'bg-[#181D2B] border-white/5 text-[#8A93A8]'
            }`}
          >
            {aCredito ? 'Crédito' : 'Efectivo'}
          </button>
        </div>

        <button
          onClick={cobrar}
          disabled={cantidad <= 0}
          className="w-full py-6 rounded-2xl font-extrabold text-lg text-[#0B0E14] disabled:opacity-25 active:scale-98 transition-all cursor-pointer shadow-xl"
          style={{ backgroundColor: aCredito ? '#F59E0B' : color }}
        >
          {cantidad > 0 ? `Cobrar ${precioTexto(total)}` : 'Anota la cantidad'}
        </button>

        {/* Últimas ventas */}
        {ventas.length > 0 && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#3E4A60] font-bold">
                Hoy · {ventas.length} ventas
              </span>
              <button
                onClick={deshacer}
                className="text-[10px] font-bold text-red-400/80 hover:text-red-400 cursor-pointer"
              >
                Borrar la última
              </button>
            </div>
            <div className="space-y-1.5">
              {ventas.slice(0, 6).map((v) => (
                <div
                  key={v.id}
                  className="flex items-center gap-3 bg-[#111520] border border-white/5 rounded-xl px-3.5 py-2.5"
                >
                  <span className="text-[10px] font-mono text-[#3E4A60] shrink-0">{hora(v.timestamp)}</span>
                  <span className="text-xs text-white flex-1 truncate">
                    {(v.items?.[0]?.q || 0)} pzas · {v.clienteNombre}
                  </span>
                  {v.lat && <span className="text-[9px] text-[#3E4A60] shrink-0" title="Con ubicación">📍</span>}
                  <span
                    className="text-xs font-bold shrink-0"
                    style={{ color: v.tipoCobro === 'crédito' ? '#F59E0B' : '#00C896' }}
                  >
                    {precioTexto(v.monto)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => {
            setSobrantes(Math.max(0, (jornada?.piezasCargadas || 0) - vendidasHoy));
            setPaso('cierre');
          }}
          className="w-full py-4 rounded-2xl bg-[#111520] border border-white/5 text-sm font-bold text-[#8A93A8] hover:text-white transition-all cursor-pointer"
        >
          Terminar jornada
        </button>

        <button
          onClick={() => {
            const nueva = window.prompt('Corregir la carga del día (piezas):', String(jornada?.piezasCargadas || 0));
            if (nueva === null) return;
            const n = parseInt(nueva, 10);
            if (!Number.isFinite(n) || n < 0) {
              triggerToast('Cantidad inválida', 'err');
              return;
            }
            const j = ajustarCarga(vendedor.id, n);
            if (j) {
              setJornada(j);
              triggerToast(`✓ Carga corregida a ${n} piezas`);
            }
          }}
          className="w-full text-[11px] text-[#3E4A60] hover:text-[#8A93A8] cursor-pointer"
        >
          Corregir la carga de la mañana
        </button>
      </div>

      {/* Selector de cliente */}
      {mostrarClientes && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end" onClick={() => setMostrarClientes(false)}>
          <div
            className="w-full bg-[#0B0E14] border-t border-white/10 rounded-t-3xl p-5 space-y-3 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-display font-bold text-sm text-white">¿A quién le vendiste?</div>

            <input
              autoFocus
              value={busquedaCliente}
              onChange={(e) => setBusquedaCliente(e.target.value)}
              placeholder="Buscar o escribir el nombre"
              className="w-full bg-[#181D2B] border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500"
            />

            <button
              onClick={() => {
                setCliente(null);
                setMostrarClientes(false);
                setBusquedaCliente('');
              }}
              className="w-full text-left px-4 py-3 rounded-xl bg-[#111520] border border-white/5 text-sm text-white hover:bg-[#161C2A] cursor-pointer"
            >
              🚶 Venta de calle (sin cliente)
            </button>

            {busquedaCliente.trim().length > 1 && (
              <button
                onClick={() => {
                  const nombre = busquedaCliente.trim();
                  setCliente({ id: `CLI_${nombre.toLowerCase().replace(/\s+/g, '_').slice(0, 40)}`, nombre, tipo: 'Tienda' });
                  setMostrarClientes(false);
                  setBusquedaCliente('');
                }}
                className="w-full text-left px-4 py-3 rounded-xl border text-sm cursor-pointer"
                style={{ backgroundColor: `${color}18`, borderColor: `${color}40`, color }}
              >
                ➕ Usar «{busquedaCliente.trim()}»
              </button>
            )}

            {clientesGuardados
              .filter((c) => !busquedaCliente || (c.nombre || '').toLowerCase().includes(busquedaCliente.toLowerCase()))
              .slice(0, 25)
              .map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setCliente({ id: c.id, nombre: c.nombre, tipo: c.tipo });
                    setMostrarClientes(false);
                    setBusquedaCliente('');
                  }}
                  className="w-full text-left px-4 py-3 rounded-xl bg-[#111520] border border-white/5 text-sm text-white hover:bg-[#161C2A] cursor-pointer"
                >
                  <div className="truncate">{c.nombre}</div>
                  {c.direccion && <div className="text-[10px] text-[#8A93A8] truncate">{c.direccion}</div>}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Piezas sueltas de interfaz ─────────────────────────────────────

const Tarjeta: React.FC<{ etiqueta: string; valor: string; sufijo?: string; color?: string }> = ({
  etiqueta,
  valor,
  sufijo,
  color
}) => (
  <div className="bg-[#06080C] px-3 py-3 text-center">
    <div className="text-[9px] font-mono uppercase tracking-wider text-[#3E4A60] font-bold">{etiqueta}</div>
    <div className="font-display font-extrabold text-lg mt-0.5" style={{ color: color || '#EEF1F8' }}>
      {valor}
    </div>
    {sufijo && <div className="text-[9px] text-[#3E4A60]">{sufijo}</div>}
  </div>
);

const Renglon: React.FC<{ etiqueta: string; valor: string; destacado?: string }> = ({
  etiqueta,
  valor,
  destacado
}) => (
  <div className="flex items-center justify-between px-4 py-3.5">
    <span className="text-xs text-[#8A93A8]">{etiqueta}</span>
    <span className="font-display font-bold text-sm" style={{ color: destacado || '#EEF1F8' }}>
      {valor}
    </span>
  </div>
);

/** Teclado numérico grande: para cantidades exactas (7, 8, 15...). */
const Teclado: React.FC<{ valor: number; onCambio: (n: number) => void; color: string }> = ({
  valor,
  onCambio,
  color
}) => {
  const teclear = (d: string) => {
    const nuevo = parseInt(`${valor === 0 ? '' : valor}${d}`, 10);
    if (Number.isFinite(nuevo) && nuevo <= 99999) onCambio(nuevo);
  };

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
        <button
          key={d}
          onClick={() => teclear(d)}
          className="py-4 rounded-xl bg-[#111520] border border-white/5 text-xl font-display font-bold text-white hover:bg-[#161C2A] active:scale-95 transition-all cursor-pointer"
        >
          {d}
        </button>
      ))}
      <button
        onClick={() => onCambio(0)}
        className="py-4 rounded-xl bg-[#111520] border border-white/5 text-xs font-bold text-[#8A93A8] hover:text-white active:scale-95 transition-all cursor-pointer"
      >
        Borrar
      </button>
      <button
        onClick={() => teclear('0')}
        className="py-4 rounded-xl bg-[#111520] border border-white/5 text-xl font-display font-bold text-white hover:bg-[#161C2A] active:scale-95 transition-all cursor-pointer"
      >
        0
      </button>
      <button
        onClick={() => onCambio(Math.floor(valor / 10))}
        className="py-4 rounded-xl bg-[#111520] border border-white/5 text-lg font-bold active:scale-95 transition-all cursor-pointer"
        style={{ color }}
      >
        ⌫
      </button>
    </div>
  );
};
