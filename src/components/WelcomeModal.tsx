import React, { useState } from 'react';
import { DEMOS, DemoConfig } from '../data';

interface WelcomeModalProps {
  onLaunchDemo: (demo: DemoConfig, name: string) => void;
  onDismiss: () => void;
}

export function WelcomeModal({ onLaunchDemo, onDismiss }: WelcomeModalProps) {
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<DemoConfig | null>(null);
  const [name, setName] = useState('');

  const handleSelect = (d: DemoConfig) => {
    setSelected(d);
    setName(d.businessName);
  };

  const handleDismiss = () => {
    localStorage.setItem('rp_welcome_seen', '1');
    onDismiss();
  };

  const handleLaunch = () => {
    if (!selected) return;
    localStorage.setItem('rp_welcome_seen', '1');
    onLaunchDemo(selected, name.trim() || selected.businessName);
  };

  const stripHtml = (s: string) => s.replace(/<[^>]+>/g, '');

  return (
    <div className="fixed inset-0 z-50 bg-[#06080C]/95 backdrop-blur-md flex items-end justify-center p-4 pb-10">
      <div className="w-full max-w-md bg-[#0F1320] border border-white/8 rounded-2xl overflow-hidden shadow-2xl">

        {/* Progress bar */}
        <div className="flex gap-1.5 p-4 pb-0">
          {[1, 2, 3].map(s => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-all duration-300 ${s <= step ? 'bg-amber-400' : 'bg-white/10'}`} />
          ))}
        </div>

        <div className="p-5 space-y-5">

          {/* ── PASO 1: ¿Qué es RoutePro? ── */}
          {step === 1 && (
            <>
              <div className="text-center pt-2 space-y-2">
                <p className="text-[10px] font-mono text-amber-400 uppercase tracking-widest">Bienvenido</p>
                <h2 className="text-2xl font-black text-white leading-tight">
                  RoutePro <span className="text-amber-400">Elite</span>
                </h2>
                <p className="text-xs text-[#8A93A8] leading-relaxed max-w-xs mx-auto">
                  Controla ventas, rutas y clientes desde el celular — sin internet, sin complicaciones.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: '🚚', title: 'Repartidor', desc: 'Registra ventas en ruta' },
                  { icon: '🏪', title: 'Mostrador', desc: 'Cobra en caja o local' },
                  { icon: '📊', title: 'Admin', desc: 'Reportes y control total' },
                ].map(r => (
                  <div key={r.title} className="bg-[#181D2B] border border-white/5 rounded-xl p-3 text-center space-y-1.5">
                    <div className="text-2xl">{r.icon}</div>
                    <div className="text-[10px] font-bold text-white">{r.title}</div>
                    <div className="text-[9px] text-[#8A93A8] leading-tight">{r.desc}</div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setStep(2)}
                className="w-full py-3.5 text-sm font-bold text-[#0B0E14] bg-amber-400 hover:brightness-105 rounded-xl cursor-pointer transition-all shadow-lg shadow-amber-500/10"
              >
                Probar en mi tipo de negocio →
              </button>
              <button
                onClick={handleDismiss}
                className="w-full text-xs text-[#8A93A8] hover:text-white transition-colors py-1 cursor-pointer"
              >
                Ya conozco la app — entrar directo
              </button>
            </>
          )}

          {/* ── PASO 2: Elegir tipo de negocio ── */}
          {step === 2 && (
            <>
              <div className="space-y-1">
                <h3 className="font-bold text-white text-sm">¿Qué tipo de negocio tienes?</h3>
                <p className="text-[10px] text-[#8A93A8]">Cargamos productos, precios y vendedores de ejemplo para ti.</p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-0.5">
                {DEMOS.map(d => (
                  <div
                    key={d.id}
                    onClick={() => handleSelect(d)}
                    className={`border p-3.5 rounded-xl flex flex-col items-center gap-1.5 cursor-pointer transition-all text-center ${
                      selected?.id === d.id
                        ? 'bg-amber-500/10 border-amber-500/30 shadow-md shadow-amber-500/5'
                        : 'bg-[#181D2B] border-white/5 hover:bg-[#1F2638]'
                    }`}
                  >
                    <span className="text-2xl">{d.icono}</span>
                    <div className="text-[10px] font-bold text-white leading-tight">{d.nombre}</div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setStep(1)}
                  className="flex-none px-4 py-3 text-xs text-[#8A93A8] bg-[#181D2B] border border-white/5 rounded-xl cursor-pointer hover:text-white transition-colors"
                >
                  ←
                </button>
                <button
                  onClick={() => { if (selected) setStep(3); }}
                  disabled={!selected}
                  className="flex-1 py-3 text-sm font-bold text-[#0B0E14] bg-amber-400 hover:brightness-105 rounded-xl cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Continuar →
                </button>
              </div>
            </>
          )}

          {/* ── PASO 3: Nombre y lanzar ── */}
          {step === 3 && selected && (
            <>
              <div className="text-center space-y-1">
                <div className="text-3xl">{selected.icono}</div>
                <h3 className="font-bold text-white text-sm">¿Cómo se llama tu negocio?</h3>
                <p className="text-[10px] text-[#8A93A8]">Aparece en reportes y mensajes de WhatsApp.</p>
              </div>

              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={selected.businessName}
                className="w-full bg-[#181D2B] border border-white/5 focus:border-amber-500 rounded-xl px-4 py-3 text-sm text-white placeholder-[#4A5568] outline-none transition-colors"
              />

              <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/10 text-[10px] text-amber-200/80 leading-relaxed">
                💡 {stripHtml(selected.insight ?? `Demo de ${selected.nombre} lista para explorar`)}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setStep(2)}
                  className="flex-none px-4 py-3 text-xs text-[#8A93A8] bg-[#181D2B] border border-white/5 rounded-xl cursor-pointer hover:text-white transition-colors"
                >
                  ←
                </button>
                <button
                  onClick={handleLaunch}
                  className="flex-1 py-3 text-sm font-bold text-[#0B0E14] rounded-xl cursor-pointer transition-all hover:brightness-105 shadow-lg"
                  style={{ backgroundColor: selected.color }}
                >
                  ▶ Activar Demo Gratis
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
