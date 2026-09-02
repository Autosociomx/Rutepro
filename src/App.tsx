/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BusinessProvider, useBusiness } from './context/BusinessContext';
import { AppConfig } from './types';
import { DEMOS, DemoConfig } from './data';
import { AuthModal } from './components/AuthModal';
import { iniciarAutoSync } from './services/cloudSync';

// Modular Workspace Screens.
//
// Only the landing screen ships in the initial bundle: route sellers open this
// on a phone over mobile data, and nobody needs the admin panel's charts or the
// maps SDK before they've picked a workspace. Everything else loads on demand.
import { LandingScreen } from './components/LandingScreen';

const ConfigScreen = lazy(() =>
  import('./components/ConfigScreen').then((m) => ({ default: m.ConfigScreen }))
);
const RepartidorScreen = lazy(() =>
  import('./components/RepartidorScreen').then((m) => ({ default: m.RepartidorScreen }))
);
const MostradorScreen = lazy(() =>
  import('./components/MostradorScreen').then((m) => ({ default: m.MostradorScreen }))
);
const AdminScreen = lazy(() =>
  import('./components/AdminScreen').then((m) => ({ default: m.AdminScreen }))
);
const DashboardScreen = lazy(() =>
  import('./components/DashboardScreen').then((m) => ({ default: m.DashboardScreen }))
);
const OnboardingScreenLazy = lazy(() =>
  import('./components/OnboardingScreen').then((m) => ({ default: m.OnboardingScreen }))
);

const PantallaCargando = () => (
  <div className="min-h-screen bg-[#06080C] flex flex-col items-center justify-center gap-3">
    <div className="w-8 h-8 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
    <div className="font-mono text-[10px] text-[#3E4A60] uppercase tracking-widest">Cargando…</div>
  </div>
);

function RouteProApp() {
  const { user, isDemoMode, enterDemoMode, exitDemoMode, signOut, loading: loadingAuth } = useAuth();
  const { cfg, negocioId, rol, loadingBusiness, saveBusinessConfig, updateConfigInMemory } = useBusiness();

  const [currentScreen, setCurrentScreen] = useState<
    'landing' | 'configuracion' | 'repartidor' | 'mostrador' | 'admin' | 'demo' | 'dashboard'
  >('landing');

  const [demoSel, setDemoSel] = useState<DemoConfig | null>(null);
  const [demoNameInput, setDemoNameInput] = useState('');
  const [errorToast, setErrorToast] = useState<{ message: string; type: 'ok' | 'err' } | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const triggerToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setErrorToast({ message: msg, type });
    setTimeout(() => {
      setErrorToast(null);
    }, 3500);
  };

  const hexToRgba = (hex: string, alpha: number) => {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16) || 201;
    const g = parseInt(cleanHex.substring(2, 4), 16) || 145;
    const b = parseInt(cleanHex.substring(4, 6), 16) || 42;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const getLighterHex = (hex: string, percent = 30) => {
    const cleanHex = hex.replace('#', '');
    let r = parseInt(cleanHex.substring(0, 2), 16) || 201;
    let g = parseInt(cleanHex.substring(2, 4), 16) || 145;
    let b = parseInt(cleanHex.substring(4, 6), 16) || 42;

    r = Math.min(255, Math.floor(r + (255 - r) * (percent / 100)));
    g = Math.min(255, Math.floor(g + (255 - g) * (percent / 100)));
    b = Math.min(255, Math.floor(b + (255 - b) * (percent / 100)));

    const rHex = r.toString(16).padStart(2, '0');
    const gHex = g.toString(16).padStart(2, '0');
    const bHex = b.toString(16).padStart(2, '0');
    return `#${rHex}${gHex}${bHex}`;
  };

  const applyThemeColor = (color: string) => {
    const root = document.documentElement;
    root.style.setProperty('--oro', color);
    root.style.setProperty('--oro-l', getLighterHex(color, 25));
    root.style.setProperty('--oro-d', hexToRgba(color, 0.12));
    root.style.setProperty('--oro-b', hexToRgba(color, 0.22));
  };

  useEffect(() => {
    if (cfg?.color_principal) {
      applyThemeColor(cfg.color_principal);
    }
  }, [cfg?.color_principal]);

  // Empuja a la nube lo que se capturó sin señal, en cualquier pantalla.
  useEffect(() => iniciarAutoSync(negocioId), [negocioId]);

  const handleSaveConfig = async (newCfg: AppConfig) => {
    if (isDemoMode) {
      updateConfigInMemory(newCfg);
      triggerToast('✓ Configuración actualizada en modo Demo', 'ok');
      setCurrentScreen('landing');
      return;
    }

    const { error } = await saveBusinessConfig(newCfg);
    if (error) {
      triggerToast(error.message || 'Error al guardar configuración en Supabase', 'err');
    } else {
      triggerToast('✓ Configuración guardada en Supabase');
      setCurrentScreen('landing');
    }
  };

  const handleSelectDemo = (demo: any) => {
    setDemoSel(demo);
    setDemoNameInput(demo.businessName);
  };

  const handleLaunchDemoObject = () => {
    if (!demoSel) {
      triggerToast('Por favor selecciona un tipo de negocio', 'err');
      return;
    }

    const customName = demoNameInput.trim() || demoSel.businessName;
    const demoConfig: AppConfig = {
      nombre: customName,
      letra: customName[0].toUpperCase(),
      subtitulo: `Demo activa · ${demoSel.nombre}`,
      color_principal: demoSel.color,
      productos: demoSel.productos,
      vendedores: demoSel.vendedores,
      logo_url: '',
    };

    enterDemoMode();
    updateConfigInMemory(demoConfig);
    applyThemeColor(demoSel.color);

    triggerToast(`✓ Modo Demo iniciado para "${customName}" (Totalmente aislado de la base real)`);
    setDemoSel(null);
    setDemoNameInput('');
    setCurrentScreen('landing');
  };

  const renderSafeHtml = (text: string) => {
    if (!text) return '';
    const parts = text.split(/(<strong>.*?<\/strong>)/g);
    return parts.map((part, index) => {
      if (part.startsWith('<strong>') && part.endsWith('</strong>')) {
        const content = part.substring(8, part.length - 9);
        return (
          <strong key={index} className="font-bold text-amber-200">
            {content}
          </strong>
        );
      }
      return part;
    });
  };

  const handleCerrarSesion = async () => {
    if (isDemoMode) {
      exitDemoMode();
      triggerToast('Modo Demo cerrado', 'ok');
    } else {
      await signOut();
      triggerToast('Sesión de usuario cerrada', 'ok');
    }
    setCurrentScreen('landing');
  };

  // Cuenta recién creada sin negocio asignado: no hay nada que operar todavía,
  // así que la única acción posible es dar de alta el negocio.
  if (user && !isDemoMode && !loadingAuth && !loadingBusiness && !negocioId) {
    return (
      <Suspense fallback={<PantallaCargando />}>
        <OnboardingScreenLazy triggerToast={triggerToast} />
      </Suspense>
    );
  }

  return (
    <div className="bg-[#06080C] min-h-screen relative flex flex-col font-sans text-[#EEF1F8]">
      {/* Universal Top Access Bar for Auth & Cloud State */}
      <header className="sticky top-0 z-40 bg-[#06080C]/90 backdrop-blur-md border-b border-white/5 px-4 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-display font-black text-amber-400 tracking-wider">ROUTEPRO</span>
          {isDemoMode ? (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
              ⚡ MODO DEMO AISLADO
            </span>
          ) : user ? (
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
              ☁️ {user.email?.split('@')[0]} ({rol || 'miembro'})
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-300 border border-white/10 text-[10px]">
              Invitado
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {user || isDemoMode ? (
            <button
              onClick={handleCerrarSesion}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer text-[11px]"
            >
              {isDemoMode ? 'Salir de Demo' : 'Cerrar Sesión'}
            </button>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition-all font-semibold cursor-pointer text-[11px]"
            >
              Iniciar Sesión / Registro
            </button>
          )}
        </div>
      </header>

      {/* Main Screen Views */}
      <main className="flex-1">
        <Suspense fallback={<PantallaCargando />}>
        {currentScreen === 'landing' && (
          <LandingScreen
            cfg={cfg}
            onGo={(screen: any) => setCurrentScreen(screen)}
            onCerrarSesion={handleCerrarSesion}
            onSaveConfig={handleSaveConfig}
            triggerToast={triggerToast}
          />
        )}

        {currentScreen === 'configuracion' && (
          <ConfigScreen
            initialCfg={cfg}
            onSave={handleSaveConfig}
            onGoBack={() => setCurrentScreen('landing')}
          />
        )}

        {currentScreen === 'repartidor' && (
          <RepartidorScreen
            cfg={cfg}
            onGoBack={() => setCurrentScreen('landing')}
            triggerToast={triggerToast}
          />
        )}

        {currentScreen === 'mostrador' && (
          <MostradorScreen
            cfg={cfg}
            onGoBack={() => setCurrentScreen('landing')}
            triggerToast={triggerToast}
          />
        )}

        {currentScreen === 'admin' && (
          <AdminScreen
            cfg={cfg}
            onGoBack={() => setCurrentScreen('landing')}
            triggerToast={triggerToast}
            onGoConfig={() => setCurrentScreen('configuracion')}
            onCerrarSesion={handleCerrarSesion}
          />
        )}

        {currentScreen === 'dashboard' && (
          <DashboardScreen cfg={cfg} onGoBack={() => setCurrentScreen('landing')} />
        )}

        {currentScreen === 'demo' && (
          <div className="min-h-screen bg-[#06080C] text-[#EEF1F8] flex flex-col font-sans">
            <div className="sticky top-0 z-50 h-14 bg-[#06080C]/94 backdrop-blur-md border-b border-white/5 px-4.5 flex items-center justify-between gap-3 shadow-md shrink-0">
              <button
                onClick={() => setCurrentScreen('landing')}
                className="w-9 h-9 rounded-lg bg-[#111520] border border-white/5 flex items-center justify-center text-[#8A93A8] hover:text-white transition-all cursor-pointer"
              >
                ←
              </button>
              <div className="flex-1 font-display font-bold text-sm tracking-wide text-left">
                Asistente de Demostración Aislado
              </div>
              <span className="text-[10px] font-bold px-2 py-1 bg-yellow-400 text-slate-900 rounded select-none uppercase shrink-0">
                Demo
              </span>
            </div>

            <div className="flex-1 p-5 overflow-y-auto space-y-6">
              <div className="text-left space-y-1.5">
                <h2 className="font-display font-extrabold text-xl text-white">
                  Selecciona tu Giro de Negocio
                </h2>
                <p className="text-xs text-[#8A93A8] leading-relaxed">
                  Modo completamente aislado: prueba catálogos, listas de precios, rutas de reparto y dashboards sin afectar la base de datos real.
                </p>
              </div>

              {/* Selection Grid presets list */}
              <div className="grid grid-cols-2 gap-3 pb-2">
                {DEMOS.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => handleSelectDemo(d)}
                    className={`border p-4.5 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all active:scale-97 text-center group ${
                      demoSel?.id === d.id
                        ? 'bg-amber-500/10 border-amber-500/30 shadow-lg shadow-amber-500/5'
                        : 'bg-[#181D2B] border-white/5 hover:bg-[#1F2638]'
                    }`}
                  >
                    <span className="text-3.5xl">{d.icono}</span>
                    <div>
                      <div className="text-xs font-bold text-white group-hover:text-amber-300">
                        {d.nombre}
                      </div>
                      <div className="text-[9px] text-[#8A93A8] mt-1 leading-normal line-clamp-1">
                        {d.subtitulo}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Custom Input */}
              {demoSel && (
                <div className="space-y-4 pt-1 animate-fade-in text-left">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-mono text-[#3E4A60] uppercase tracking-wider font-bold">
                      Nombre Comercial del Giro
                    </label>
                    <input
                      type="text"
                      value={demoNameInput}
                      onChange={(e) => setDemoNameInput(e.target.value)}
                      className="bg-[#181D2B] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 w-full"
                      placeholder="Ej: Panadería El Trigo Dorado"
                    />
                  </div>

                  {/* Insight Tip panel */}
                  <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 flex gap-2.5 items-start">
                    <span className="text-base shrink-0">💡</span>
                    <div className="text-[11px] text-amber-200/90 leading-relaxed font-sans">
                      {renderSafeHtml(demoSel.insight)}
                    </div>
                  </div>

                  <button
                    onClick={handleLaunchDemoObject}
                    className="w-full py-4 px-6 text-sm font-bold text-[#0B0E14] bg-[#E8B04A] hover:brightness-105 rounded-xl cursor-pointer shadow-lg shadow-yellow-500/10 transition-all text-center block"
                    style={{ backgroundColor: demoSel.color }}
                  >
                    ▶ Activar Demo Aislada
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        </Suspense>
      </main>

      {/* AUTH MODAL */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        triggerToast={triggerToast}
      />

      {/* TOAST SYSTEM */}
      {errorToast && (
        <div
          className={`fixed bottom-6 left-5 right-5 p-3.5 rounded-xl z-50 shadow-md text-xs font-bold flex items-center gap-2 justify-center animate-fade-in ${
            errorToast.type === 'err'
              ? 'bg-red-950/80 border border-red-500/20 text-red-400'
              : 'bg-emerald-950/80 border border-emerald-500/20 text-[#00C896]'
          }`}
        >
          <span>{errorToast.type === 'err' ? '⚠️' : '✓'}</span>
          <span>{errorToast.message}</span>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BusinessProvider>
        <RouteProApp />
      </BusinessProvider>
    </AuthProvider>
  );
}
