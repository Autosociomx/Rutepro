/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { AppConfig, Venta } from '../types';
import { useBusiness } from '../context/BusinessContext';
import { RouteProRepository } from '../services/routeproRepository';
import { esNegocioReal, estadoCola } from '../services/cloudSync';
import { isSupabaseConfigured } from '../lib/supabase';

interface Props {
  cfg: AppConfig;
  onGoBack: () => void;
}

interface VentaNormalizada {
  monto: number; // cents
  vendedor: string;
  timestamp: number;
}

/** Local records are the offline fallback; the cloud is the source of truth. */
function leerVentasLocales(): VentaNormalizada[] {
  try {
    const raw = localStorage.getItem('rp_ventas');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as Venta[]).map((v) => ({
      monto: v.monto || 0,
      vendedor: v.vendedorNombre || 'Sin asignar',
      timestamp: v.timestamp || Date.now(),
    }));
  } catch {
    return [];
  }
}

export const DashboardScreen: React.FC<Props> = ({ cfg, onGoBack }) => {
  const { negocioId } = useBusiness();

  const [ventas, setVentas] = useState<VentaNormalizada[]>([]);
  const [loading, setLoading] = useState(true);
  // Whether the numbers on screen cover the whole business or just this device.
  const [origen, setOrigen] = useState<'nube' | 'dispositivo'>('dispositivo');
  const [pendientes, setPendientes] = useState(0);

  useEffect(() => {
    let vivo = true;

    const cargar = async () => {
      setLoading(true);
      const locales = leerVentasLocales();

      // Demo mode and unconfigured installs have no tenant to query: showing the
      // device's own records is the honest answer, and querying anyway would
      // hang this screen on a placeholder Supabase URL.
      if (!isSupabaseConfigured || !esNegocioReal(negocioId)) {
        if (vivo) {
          setVentas(locales);
          setOrigen('dispositivo');
          setPendientes(estadoCola().pendientes);
          setLoading(false);
        }
        return;
      }

      // The owner checks this from home while the route is out: reading from
      // rp_operaciones is what makes the number cover every phone, not just this one.
      // A dead network must degrade to local data, never to an endless spinner.
      const { data, error } = await Promise.race([
        RouteProRepository.getOperaciones(negocioId, { limit: 500 }),
        new Promise<{ data: null; error: Error }>((resolve) =>
          setTimeout(() => resolve({ data: null, error: new Error('timeout') }), 10000)
        ),
      ]);
      if (!vivo) return;

      if (error || !data) {
        setVentas(locales);
        setOrigen('dispositivo');
      } else {
        setVentas(
          data
            .filter((o) => o.tipo_operacion === 'venta')
            .map((o) => ({
              monto: o.monto_total_centavos || 0,
              vendedor: o.vendedor_nombre || 'Sin asignar',
              timestamp: new Date(o.created_at).getTime(),
            }))
        );
        setOrigen('nube');
      }

      setPendientes(estadoCola().pendientes);
      setLoading(false);
    };

    cargar();
    return () => {
      vivo = false;
    };
  }, [negocioId]);

  const formatPesos = (cents: number) =>
    `$${(cents / 100).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const totalCentavos = ventas.reduce((acc, v) => acc + v.monto, 0);
  const ticketPromedio = ventas.length > 0 ? totalCentavos / ventas.length : 0;

  const hoy = new Date().toDateString();
  const totalHoy = ventas
    .filter((v) => new Date(v.timestamp).toDateString() === hoy)
    .reduce((acc, v) => acc + v.monto, 0);

  const datosGrafica = [...ventas]
    .sort((a, b) => a.timestamp - b.timestamp)
    .reduce((acc: Array<{ fecha: string; monto: number }>, v) => {
      const fecha = new Date(v.timestamp).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
      const existing = acc.find((item) => item.fecha === fecha);
      if (existing) {
        existing.monto += v.monto / 100;
      } else {
        acc.push({ fecha, monto: v.monto / 100 });
      }
      return acc;
    }, []);

  const porVendedor = ventas
    .reduce((acc: Array<{ vendedor: string; monto: number }>, v) => {
      const existing = acc.find((item) => item.vendedor === v.vendedor);
      if (existing) {
        existing.monto += v.monto / 100;
      } else {
        acc.push({ vendedor: v.vendedor, monto: v.monto / 100 });
      }
      return acc;
    }, [])
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 8);

  const color = cfg.color_principal || '#C9912A';

  return (
    <div className="min-h-screen bg-[#06080C] text-[#EEF1F8] p-5 font-sans">
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={onGoBack}
          className="p-2 bg-[#111520] rounded-lg border border-white/5 cursor-pointer hover:bg-[#1C2235] transition-colors"
        >
          ←
        </button>
        <div className="min-w-0">
          <h2 className="text-xl font-bold font-display truncate">Dashboard</h2>
          <div className="text-[10px] text-[#8A93A8] flex items-center gap-1.5 mt-0.5">
            {origen === 'nube' ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Todo el negocio · {ventas.length} ventas</span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>Solo este dispositivo · {ventas.length} ventas</span>
              </>
            )}
          </div>
        </div>
      </div>

      {pendientes > 0 && (
        <div className="mb-5 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-[11px] text-amber-200/90">
          ⏳ {pendientes} operación(es) capturada(s) sin señal aún no aparecen aquí. Se suben solas al
          recuperar conexión.
        </div>
      )}

      {loading ? (
        <div className="text-center p-10 text-[#8A93A8] text-sm">Cargando…</div>
      ) : ventas.length === 0 ? (
        <div className="text-center p-10 space-y-2">
          <div className="text-3xl">📊</div>
          <div className="text-sm font-bold text-white">Todavía no hay ventas</div>
          <div className="text-xs text-[#8A93A8] leading-relaxed max-w-xs mx-auto">
            En cuanto tu equipo registre el primer cobro en Ruta o Mostrador, aquí verás la tendencia y
            el comparativo por vendedor.
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#111520] p-3.5 rounded-2xl border border-white/5">
              <div className="text-[10px] text-[#8A93A8] leading-tight">Vendido hoy</div>
              <div className="text-lg font-black text-white mt-1 truncate">{formatPesos(totalHoy)}</div>
            </div>
            <div className="bg-[#111520] p-3.5 rounded-2xl border border-white/5">
              <div className="text-[10px] text-[#8A93A8] leading-tight">Acumulado</div>
              <div className="text-lg font-black text-white mt-1 truncate">{formatPesos(totalCentavos)}</div>
            </div>
            <div className="bg-[#111520] p-3.5 rounded-2xl border border-white/5">
              <div className="text-[10px] text-[#8A93A8] leading-tight">Ticket promedio</div>
              <div className="text-lg font-black text-white mt-1 truncate">{formatPesos(ticketPromedio)}</div>
            </div>
          </div>

          <div className="bg-[#111520] p-4 rounded-2xl border border-white/5">
            <h3 className="text-sm font-bold mb-4">Ventas por día</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={datosGrafica}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                  <XAxis dataKey="fecha" stroke="#8A93A8" fontSize={10} />
                  <YAxis stroke="#8A93A8" fontSize={10} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#06080C', border: '1px solid #333', borderRadius: 8 }}
                    formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Vendido']}
                  />
                  <Line type="monotone" dataKey="monto" stroke={color} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[#111520] p-4 rounded-2xl border border-white/5">
            <h3 className="text-sm font-bold mb-4">Comparativo por vendedor</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porVendedor} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" horizontal={false} />
                  <XAxis type="number" stroke="#8A93A8" fontSize={10} />
                  <YAxis type="category" dataKey="vendedor" stroke="#8A93A8" fontSize={10} width={90} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#06080C', border: '1px solid #333', borderRadius: 8 }}
                    formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Vendido']}
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  />
                  <Bar dataKey="monto" fill={color} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
