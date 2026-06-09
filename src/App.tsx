import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from './firebase';
import { doc, onSnapshot, setDoc, deleteDoc, collection, getDocs, writeBatch } from 'firebase/firestore';

// presaved assets
import { DEMOS } from './data';

// Modular Workspace Screens
import { LandingScreen } from './components/LandingScreen';
import { ConfigScreen } from './components/ConfigScreen';
import { RepartidorScreen } from './components/RepartidorScreen';
import { MostradorScreen } from './components/MostradorScreen';
import { AdminScreen } from './components/AdminScreen';
import { AffiliateScreen } from './components/AffiliateScreen';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'landing' | 'configuracion' | 'repartidor' | 'mostrador' | 'admin' | 'demo' | 'afiliados'>('landing');
  const [cfg, setCfg] = useState<{
    nombre: string;
    letra: string;
    subtitulo: string;
    color_principal: string;
    productos: any[];
    vendedores: any[];
    logo_url?: string;
  }>({
    nombre: '',
    letra: '',
    subtitulo: 'App del vendedor · RoutePro',
    color_principal: '#C9912A',
    productos: [],
    vendedores: [],
    logo_url: ''
  });

  const [demoSel, setDemoSel] = useState<any | null>(null);
  const [demoNameInput, setDemoNameInput] = useState('');
  const [errorToast, setErrorToast] = useState<{ message: string; type: 'ok' | 'err' } | null>(null);

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

  // Synchronize with corporate color choices by injecting variables
  const applyThemeColor = (color: string) => {
    const root = document.documentElement;
    root.style.setProperty('--oro', color);
    root.style.setProperty('--oro-l', color);
    root.style.setProperty('--oro-d', hexToRgba(color, 0.12));
    root.style.setProperty('--oro-b', hexToRgba(color, 0.22));
  };

  // Real-time Firestore synchronization on mount for the corporate setup
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        const cloudData = docSnap.data() as any;
        setCfg(cloudData);
        if (cloudData.color_principal) {
          applyThemeColor(cloudData.color_principal);
        }
      } else {
        // Fallback to cache or empty defaults
        const localCached = localStorage.getItem('rp_cfg');
        if (localCached) {
          try {
            const parsed = JSON.parse(localCached);
            setCfg(parsed);
            applyThemeColor(parsed.color_principal || '#C9912A');
          } catch (e) {
            console.error('Local cache error', e);
          }
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'config/global');
    });

    return () => unsub();
  }, []);

  const handleSaveConfig = async (newCfg: any) => {
    try {
      try {
        await setDoc(doc(db, 'config', 'global'), newCfg);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, 'config/global');
      }
      localStorage.setItem('rp_cfg', JSON.stringify(newCfg));
      setCfg(newCfg);
      if (newCfg.color_principal) {
        applyThemeColor(newCfg.color_principal);
      }
      triggerToast('✓ Configuración guardada en la nube');
      setCurrentScreen('landing');
    } catch (e) {
      console.error(e);
      triggerToast('Error al almacenar configuración', 'err');
    }
  };

  const handleSelectDemo = (demo: any) => {
    setDemoSel(demo);
    setDemoNameInput(demo.businessName);
  };

  const handleLaunchDemoObject = async () => {
    if (!demoSel) {
      triggerToast('Por favor selecciona un tipo de negocio', 'err');
      return;
    }

    const customName = demoNameInput.trim() || demoSel.businessName;

    const demoConfig = {
      nombre: customName,
      letra: customName[0].toUpperCase(),
      subtitulo: `Demo activa · ${demoSel.nombre}`,
      color_principal: demoSel.color,
      productos: demoSel.productos,
      vendedores: demoSel.vendedores
    };

    try {
      // 1. Write the new demo configuration
      try {
        await setDoc(doc(db, 'config', 'global'), demoConfig);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, 'config/global');
      }
      localStorage.setItem('rp_cfg', JSON.stringify(demoConfig));

      // 2. Erase previous transaction logs to offer a squeaky-clean analytical chart
      localStorage.removeItem('rp_ventas');
      setCfg(demoConfig);
      applyThemeColor(demoSel.color);

      // Seed 2 mock historical vector sales so dashboard displays gorgeous content on first open
      const firstSaleId = 'S_MOCK_1';
      const secondSaleId = 'S_MOCK_2';
      const now = Date.now();

      const mockVentas = [
        {
          id: firstSaleId,
          vendedorId: demoSel.vendedores[0]?.id || 'V1',
          vendedorNombre: demoSel.vendedores[0]?.nombre || 'Ana Ruiz',
          clienteId: 'C_MOCK_1',
          clienteNombre: 'Abarrotes El Tulipán',
          monto: (demoSel.productos[0]?.precio || 1500) * 3, // quantity of 3
          tipoCobro: 'efectivo',
          items: [
            {
              id: demoSel.productos[0]?.id || 'P1',
              nombre: demoSel.productos[0]?.nombre || 'Item A',
              q: 3,
              pr: demoSel.productos[0]?.precio || 1500,
              ic: demoSel.productos[0]?.icono || '📦'
            }
          ],
          timestamp: now - 3600000, // 1 hour ago
          prod_resumen: `${demoSel.productos[0]?.icono || '📦'}${demoSel.productos[0]?.nombre || 'Item'} (3x)`,
          hora: new Date(now - 3600000).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
        },
        {
          id: secondSaleId,
          vendedorId: demoSel.vendedores[1]?.id || 'V2',
          vendedorNombre: demoSel.vendedores[1]?.nombre || 'Pedro Leal',
          clienteId: 'C_MOCK_2',
          clienteNombre: 'Ricos Tacos Imperial',
          monto: (demoSel.productos[2]?.precio || 2000) * 5, // quantity of 5
          tipoCobro: 'credito',
          items: [
            {
              id: demoSel.productos[2]?.id || 'P3',
              nombre: demoSel.productos[2]?.nombre || 'Item C',
              q: 5,
              pr: demoSel.productos[2]?.precio || 2000,
              ic: demoSel.productos[2]?.icono || '🧁'
            }
          ],
          timestamp: now - 1800000, // 30 mins ago
          prod_resumen: `${demoSel.productos[2]?.icono || '🧁'}${demoSel.productos[2]?.nombre || 'Item'} (5x)`,
          hora: new Date(now - 1800000).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
        }
      ];

      localStorage.setItem('rp_ventas', JSON.stringify(mockVentas));

      triggerToast(`✓ Demo iniciada para ${customName}`);
      setDemoSel(null);
      setDemoNameInput('');
      setCurrentScreen('landing');
    } catch (e) {
      console.error(e);
      triggerToast('Error al inicializar la base de datos de ejemplo', 'err');
    }
  };

  const handleCerrarSesion = async () => {
    try {
      // 1. Effortlessly wipe local state caches synchronously so transition is immediate
      localStorage.removeItem('rp_cfg');
      localStorage.removeItem('rp_ventas');
      
      setCfg({
        nombre: '',
        letra: '',
        subtitulo: 'App del vendedor · RoutePro',
        color_principal: '#C9912A',
        productos: [],
        vendedores: []
      });
      applyThemeColor('#C9912A');
      setCurrentScreen('landing');
      triggerToast('Sesión de demo reiniciada exitosamente');

      // 2. Silently try to delete the shared database configuration layout
      try {
        await deleteDoc(doc(db, 'config', 'global'));
      } catch (dbErr) {
        console.log('[Info] Configuración remota persistida por otros usuarios del sandbox.', dbErr);
      }
    } catch (err) {
      console.error(err);
      triggerToast('Error al reiniciar sesión local', 'err');
    }
  };

  return (
    <div className="bg-[#06080C] min-h-screen">
      {currentScreen === 'landing' && (
        <LandingScreen 
          cfg={cfg} 
          onGo={(screen: any) => setCurrentScreen(screen)} 
          onCerrarSesion={handleCerrarSesion}
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
        />
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
            <div className="flex-1 font-display font-bold text-sm tracking-wide text-left">Asistente de Demostración</div>
            <span className="text-[10px] font-bold px-2 py-1 bg-yellow-400 text-slate-900 rounded select-none uppercase shrink-0">
              Prueba
            </span>
          </div>

          <div className="flex-1 p-5 overflow-y-auto space-y-6">
            <div className="text-left space-y-1.5">
              <h2 className="font-display font-extrabold text-xl text-white">Selecciona tu Giro de Negocio</h2>
              <p className="text-xs text-[#8A93A8] leading-relaxed">Selecciona un modelo de negocio precargado para rellenar automáticamente tus listas de precios, canales de reparto y rutas satelitales.</p>
            </div>

            {/* Selection Grid presets list */}
            <div className="grid grid-cols-2 gap-3 pb-2">
              {DEMOS.map((d) => (
                <div 
                  key={d.id}
                  onClick={() => handleSelectDemo(d)}
                  className={`border p-4.5 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all active:scale-97 text-center group ${demoSel?.id === d.id ? 'bg-amber-500/10 border-amber-500/30 shadow-lg shadow-amber-500/5' : 'bg-[#181D2B] border-white/5 hover:bg-[#1F2638]'}`}
                >
                  <span className="text-3.5xl">{d.icono}</span>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-amber-300">{d.nombre}</div>
                    <div className="text-[9px] text-[#8A93A8] mt-1 leading-normal line-clamp-1">{d.subtitulo}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Custom Input */}
            {demoSel && (
              <div className="space-y-4 pt-1 animate-fade-in text-left">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-mono text-[#3E4A60] uppercase tracking-wider font-bold">Nombre Comercial del Giro</label>
                  <input 
                    type="text" 
                    value={demoNameInput} 
                    onChange={(e) => setDemoNameInput(e.target.value)} 
                    className="bg-[#181D2B] border border-white/5 rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 w-full"
                    placeholder="Ej: Panadería El Trigo Dorado"
                  />
                </div>

                {/* Insight Tip panel */}
                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 flex gap-2.5 items-start">
                  <span className="text-base shrink-0">💡</span>
                  <div className="text-[11px] text-amber-200/90 leading-relaxed" dangerouslySetInnerHTML={{ __html: demoSel.insight }} />
                </div>

                <button 
                  onClick={handleLaunchDemoObject}
                  className="w-full py-4 px-6 text-sm font-bold text-[#0B0E14] bg-[#E8B04A] hover:brightness-105 rounded-xl cursor-pointer shadow-lg shadow-yellow-500/10 transition-all text-center block"
                  style={{ backgroundColor: demoSel.color }}
                >
                  ▶ Activar y Sincronizar Demo
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {currentScreen === 'afiliados' && (
        <AffiliateScreen 
          cfg={cfg} 
          onGoBack={() => setCurrentScreen('landing')} 
          triggerToast={triggerToast}
        />
      )}

      {/* TOAST SYSTEM */}
      {errorToast && (
        <div className={`fixed bottom-6 left-5 right-5 p-3.5 rounded-xl z-50 shadow-md text-xs font-bold flex items-center gap-2 justify-center animate-fade-in ${errorToast.type === 'err' ? 'bg-red-950/80 border border-red-500/20 text-red-400' : 'bg-emerald-950/80 border border-emerald-500/20 text-[#00C896]'}`}>
          <span>{errorToast.type === 'err' ? '⚠️' : '✓'}</span>
          <span>{errorToast.message}</span>
        </div>
      )}
    </div>
  );
}
