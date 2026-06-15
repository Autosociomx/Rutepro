import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { NegocioEnGestion } from '../types';

interface ContadorScreenProps {
  contadorUid: string;
  contadorNombre: string;
  negociosGestionados: string[];
  onEnterNegocio: (ownerUid: string) => void;
  onCerrarSesion: () => void;
  triggerToast: (msg: string, type?: 'ok' | 'err') => void;
}

export const ContadorScreen: React.FC<ContadorScreenProps> = ({
  contadorUid,
  contadorNombre,
  negociosGestionados,
  onEnterNegocio,
  onCerrarSesion,
  triggerToast,
}) => {
  const [negocios, setNegocios] = useState<NegocioEnGestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (negociosGestionados.length === 0) {
      setNegocios([]);
      setLoading(false);
      return;
    }

    const map: Record<string, NegocioEnGestion> = {};
    const unsubs: (() => void)[] = [];
    let resolved = 0;

    negociosGestionados.forEach(ownerUid => {
      const unsub = onSnapshot(doc(db, 'negocios', ownerUid, 'config', 'global'), (snap) => {
        if (snap.exists()) {
          const d = snap.data() as any;
          map[ownerUid] = {
            ownerUid,
            nombre: d.nombre || 'Negocio vinculado',
            letra: d.letra || '?',
            color: d.color_principal || '#C9912A',
            subtitulo: d.subtitulo,
            logo_url: d.logo_url,
          };
        } else {
          map[ownerUid] = { ownerUid, nombre: 'Negocio vinculado', letra: '?', color: '#C9912A' };
        }
        setNegocios(Object.values(map));
        resolved += 1;
        if (resolved >= negociosGestionados.length) setLoading(false);
      });
      unsubs.push(unsub);
    });

    return () => unsubs.forEach(u => u());
  }, [JSON.stringify(negociosGestionados)]);

  const firstName = contadorNombre.split(' ')[0];

  return (
    <div className="min-h-screen bg-[#06080C] text-[#EEF1F8] font-sans flex flex-col">

      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#06080C]/95 backdrop-blur-md border-b border-white/5 px-5 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-sm">
            <span className="text-[11px] font-extrabold text-slate-950">R</span>
          </div>
          <div>
            <p className="text-[8px] font-mono text-amber-500/60 uppercase tracking-widest leading-tight">Modo Contador</p>
            <p className="text-[11px] font-bold text-white leading-tight">{firstName}</p>
          </div>
        </div>
        <button
          onClick={onCerrarSesion}
          className="text-[10px] text-[#3E4A60] hover:text-white border border-white/5 px-3 py-1.5 rounded-lg cursor-pointer transition-all"
        >
          Salir
        </button>
      </div>

      <div className="flex-1 p-5 space-y-5">

        {/* Title */}
        <div>
          <h2 className="text-xl font-display font-extrabold text-white">Mis Negocios</h2>
          <p className="text-xs text-[#8A93A8] mt-0.5">
            {loading ? 'Cargando...' : `${negocios.length} negocio${negocios.length !== 1 ? 's' : ''} vinculado${negocios.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Empty state */}
        {!loading && negocios.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex items-center justify-center text-3xl">
              🏪
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-bold text-white">Sin negocios vinculados</p>
              <p className="text-xs text-[#8A93A8] leading-relaxed max-w-xs">
                Pide al dueño del negocio que abra RoutePro, vaya a Configuración y seleccione "Compartir acceso con contador". Te enviará un enlace por WhatsApp.
              </p>
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="bg-[#0B0E14] border border-white/5 rounded-2xl p-4 h-20 animate-pulse" />
            ))}
          </div>
        )}

        {/* Negocio cards */}
        {!loading && negocios.length > 0 && (
          <div className="space-y-3">
            {negocios.map(n => (
              <button
                key={n.ownerUid}
                onClick={() => onEnterNegocio(n.ownerUid)}
                className="w-full bg-[#0B0E14] border border-white/8 rounded-2xl p-4 flex items-center gap-4 text-left hover:bg-[#111520] active:scale-98 transition-all cursor-pointer group"
              >
                {n.logo_url ? (
                  <img src={n.logo_url} alt={n.nombre} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                ) : (
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center font-display font-extrabold text-xl shrink-0"
                    style={{
                      backgroundColor: `${n.color}18`,
                      color: n.color,
                      border: `1px solid ${n.color}30`,
                    }}
                  >
                    {n.letra}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-white truncate group-hover:text-amber-300 transition-colors">{n.nombre}</p>
                  {n.subtitulo && (
                    <p className="text-[10px] text-[#8A93A8] mt-0.5 truncate">{n.subtitulo}</p>
                  )}
                  <p className="text-[9px] font-mono text-[#3E4A60] mt-1.5 uppercase tracking-wide">Ver panel · Admin</p>
                </div>
                <span className="text-[#3E4A60] group-hover:text-amber-400 text-sm shrink-0 transition-colors">→</span>
              </button>
            ))}
          </div>
        )}

        {/* Info footer */}
        <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4 space-y-1.5">
          <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wide">¿Cómo vincular un negocio?</p>
          <p className="text-[10px] text-[#8A93A8] leading-relaxed">
            El dueño del negocio abre RoutePro → Ajustes (⚙️) → "Compartir acceso con contador" → te envía el enlace. Al abrirlo, el negocio aparece automáticamente aquí.
          </p>
        </div>

      </div>
    </div>
  );
};
