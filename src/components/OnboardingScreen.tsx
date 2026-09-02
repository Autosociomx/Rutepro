/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * First-run screen for a freshly signed-up account.
 *
 * A paying customer who registers has an auth user but no tenant yet: no
 * business row, no owner membership, so every screen would come up empty and
 * nothing they entered could be saved. This is the step that turns an account
 * into a usable workspace.
 */

import React, { useState } from 'react';
import { useBusiness } from '../context/BusinessContext';
import { useAuth } from '../context/AuthContext';
import { DEMOS } from '../data';

interface OnboardingScreenProps {
  triggerToast: (msg: string, type?: 'ok' | 'err') => void;
}

const COLORES = ['#C9912A', '#E8B04A', '#00C896', '#4A9FE8', '#B95CF4', '#F45C5C'];

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ triggerToast }) => {
  const { crearNegocio } = useBusiness();
  const { user, signOut } = useAuth();

  const [nombre, setNombre] = useState('');
  const [giro, setGiro] = useState<string>('');
  const [color, setColor] = useState(COLORES[0]);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState('');

  const handleCrear = async () => {
    const limpio = nombre.trim();
    if (limpio.length < 2) {
      setError('Escribe el nombre de tu negocio (mínimo 2 caracteres).');
      return;
    }

    setCreando(true);
    setError('');

    const { error: createError } = await crearNegocio(limpio, giro, color);

    setCreando(false);
    if (createError) {
      setError(createError.message || 'No se pudo crear el negocio. Intenta de nuevo.');
      triggerToast('No se pudo crear el negocio', 'err');
      return;
    }

    triggerToast(`✓ ${limpio} está listo. Ahora carga tu catálogo.`);
  };

  return (
    <div className="min-h-screen bg-[#06080C] text-[#EEF1F8] flex flex-col items-center justify-center px-6 py-12 font-sans">
      <div className="w-full max-w-md space-y-6 text-left">
        <div className="space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-[#3E4A60] font-bold">
            Configuración inicial
          </div>
          <h1 className="font-display font-extrabold text-2xl text-white leading-tight">
            Da de alta tu negocio
          </h1>
          <p className="text-xs text-[#8A93A8] leading-relaxed">
            Tu cuenta <strong className="text-[#8A93A8]">{user?.email}</strong> quedará como dueña. Desde aquí
            controlas el catálogo, las rutas, los cobros y el balance. Solo se hace una vez.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono text-[#3E4A60] uppercase tracking-wider font-bold">
              Nombre comercial
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value);
                setError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && !creando && handleCrear()}
              className="bg-[#181D2B] border border-white/10 rounded-xl px-3.5 py-3 text-sm text-white focus:outline-none focus:border-amber-500 w-full"
              placeholder="Ej: Panadería El Trigo Dorado"
              autoFocus
              maxLength={80}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono text-[#3E4A60] uppercase tracking-wider font-bold">
              Giro (opcional)
            </label>
            <select
              value={giro}
              onChange={(e) => setGiro(e.target.value)}
              className="bg-[#181D2B] border border-white/10 rounded-xl px-3.5 py-3 text-sm text-white focus:outline-none focus:border-amber-500 w-full"
            >
              <option value="">Selecciona tu giro…</option>
              {DEMOS.map((d) => (
                <option key={d.id} value={d.subtitulo}>
                  {d.icono} {d.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-mono text-[#3E4A60] uppercase tracking-wider font-bold">
              Color de marca
            </label>
            <div className="flex gap-2.5">
              {COLORES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  className={`w-9 h-9 rounded-full transition-all cursor-pointer ${
                    color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#06080C] scale-110' : 'opacity-70'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-950/50 border border-red-500/20 text-[11px] text-red-400 font-semibold">
            ⚠️ {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleCrear}
          disabled={creando}
          className="w-full py-4 rounded-xl text-sm font-bold text-[#0B0E14] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: color }}
        >
          {creando ? 'Creando tu negocio…' : 'Crear negocio y empezar'}
        </button>

        <button
          type="button"
          onClick={() => signOut()}
          className="w-full py-2 text-[11px] font-semibold text-[#3E4A60] hover:text-[#8A93A8] cursor-pointer transition-all"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
};
