import React, { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { Product, Seller, AppConfig } from './types';

// presaved assets
import { DEMOS, DemoConfig } from './data';

// Modular Workspace Screens
import { AuthScreen } from './components/AuthScreen';
import { LandingScreen } from './components/LandingScreen';
import { ConfigScreen } from './components/ConfigScreen';
import { RepartidorScreen } from './components/RepartidorScreen';
import { MostradorScreen } from './components/MostradorScreen';
import { AdminScreen } from './components/AdminScreen';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'auth' | 'landing' | 'configuracion' | 'repartidor' | 'mostrador' | 'admin' | 'demo'>('auth');
  const [authChecked, setAuthChecked] = useState(false);
  const [cfg, setCfg] = useState<AppConfig>({
    nombre: 'Tostadas Nayaritas',
    letra: 'TN',
    subtitulo: 'Tostadas raspadas, cevicheras, salsas',
    color_principal: '#D97706',
    productos: [
      { id: 'NY1', icono: '🫓', nombre: 'Tostadas Raspadas (Fam.)', precio: 3800, unidad: 'pac' },
      { id: 'NY2', icono: '🌮', nombre: 'Tostadas Cevicheras Crujientes', precio: 3500, unidad: 'pac' },
      { id: 'NY3', icono: '🌽', nombre: 'Tortilla de Maíz kg', precio: 2400, unidad: 'kg' },
      { id: 'NY4', icono: '🌶️', nombre: 'Salsa Picante Huichol', precio: 1900, unidad: 'pza' },
      { id: 'NY5', icono: '🧀', nombre: 'Queso Cotija Seco kg', precio: 9500, unidad: 'kg' },
      { id: 'NY6', icono: '📦', nombre: 'Caja Grande Deshidratadas', precio: 18000, unidad: 'caja' }
    ],
    vendedores: [
      { id: 'V_NY1', nombre: 'Juan Pablo Díaz', rol: 'repartidor', ruta: 'Ruta Costa y Huajicori' },
      { id: 'V_NY2', nombre: 'Alondra Bañales', rol: 'repartidor', ruta: 'Ruta Miramar y San Blas' },
      { id: 'V_NY3', nombre: 'Estela Martínez', rol: 'cajero', ruta: 'Mostrador Tepic Centro' }
    ],
    logo_url: ''
  });

  const [demoSel, setDemoSel] = useState<DemoConfig | null>(null);
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

  // Helper to generate a lighter version of the brand color (percentage 0 to 100)
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

  // Synchronize with corporate color choices by injecting variables
  const applyThemeColor = (color: string) => {
    const root = document.documentElement;
    root.style.setProperty('--oro', color);
    root.style.setProperty('--oro-l', getLighterHex(color, 25));
    root.style.setProperty('--oro-d', hexToRgba(color, 0.12));
    root.style.setProperty('--oro-b', hexToRgba(color, 0.22));
  };

  // Auth state listener — show AuthScreen only on first visit (no persisted session)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!authChecked) {
        setAuthChecked(true);
        if (user) {
          // User already has a session (email or anonymous) — go straight to app
          if (currentScreen === 'auth') setCurrentScreen('landing');
        }
        // If no user, stay on 'auth' screen
      }
    });
    return () => unsub();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        // Fallback to cache or default to Tostadas Nayaritas
        const localCached = localStorage.getItem('rp_cfg');
        if (localCached) {
          try {
            const parsed = JSON.parse(localCached);
            setCfg(parsed);
            applyThemeColor(parsed.color_principal || '#D97706');
          } catch (e) {
            console.error('Local cache error', e);
          }
        } else {
          const defaultNayaritas: AppConfig = {
            nombre: 'Tostadas Nayaritas',
            letra: 'TN',
            subtitulo: 'Tostadas raspadas, cevicheras, salsas',
            color_principal: '#D97706',
            productos: [
              { id: 'NY1', icono: '🫓', nombre: 'Tostadas Raspadas (Fam.)', precio: 3800, unidad: 'pac' },
              { id: 'NY2', icono: '🌮', nombre: 'Tostadas Cevicheras Crujientes', precio: 3500, unidad: 'pac' },
              { id: 'NY3', icono: '🌽', nombre: 'Tortilla de Maíz kg', precio: 2400, unidad: 'kg' },
              { id: 'NY4', icono: '🌶️', nombre: 'Salsa Picante Huichol', precio: 1900, unidad: 'pza' },
              { id: 'NY5', icono: '🧀', nombre: 'Queso Cotija Seco kg', precio: 9500, unidad: 'kg' },
              { id: 'NY6', icono: '📦', nombre: 'Caja Grande Deshidratadas', precio: 18000, unidad: 'caja' }
            ],
            vendedores: [
              { id: 'V_NY1', nombre: 'Juan Pablo Díaz', rol: 'repartidor', ruta: 'Ruta Costa y Huajicori' },
              { id: 'V_NY2', nombre: 'Alondra Bañales', rol: 'repartidor', ruta: 'Ruta Miramar y San Blas' },
              { id: 'V_NY3', nombre: 'Estela Martínez', rol: 'cajero', ruta: 'Mostrador Tepic Centro' }
            ],
            logo_url: ''
          };
          setDoc(doc(db, 'config', 'global'), defaultNayaritas)
            .then(() => console.log('Successfully auto-seeded blank database with Tostadas Nayaritas'))
            .catch(e => console.warn('Could not auto-seed cloud config:', e));
          localStorage.setItem('rp_cfg', JSON.stringify(defaultNayaritas));
          setCfg(defaultNayaritas);
          applyThemeColor(defaultNayaritas.color_principal);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'config/global');
    });

    return () => unsub();
  }, []);


  const handleSaveConfig = async (newCfg: AppConfig) => {
    let cloudSaved = false;
    try {
      await setDoc(doc(db, 'config', 'global'), newCfg);
      cloudSaved = true;
    } catch (e) {
      console.warn('Silent fallback activated. Firestore save failed, using local offline persistence:', e);
    }

    try {
      localStorage.setItem('rp_cfg', JSON.stringify(newCfg));
      setCfg(newCfg);
      if (newCfg.color_principal) {
        applyThemeColor(newCfg.color_principal);
      }
      if (cloudSaved) {
        triggerToast('✓ Configuración guardada en la nube');
      } else {
        triggerToast('✓ Configuración guardada localmente (Modo sin conexión)', 'ok');
      }
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
      vendedores: demoSel.vendedores,
      tipo_negocio: demoSel.id
    };

    let cloudSaved = false;
    try {
      // 1. Write the new demo configuration
      await setDoc(doc(db, 'config', 'global'), demoConfig);
      cloudSaved = true;
    } catch (e) {
      console.warn('Silent database write failed, running demo in high-res offline cache mode:', e);
    }

    try {
      // Create backup of real user state before demo
      const existingCfg = localStorage.getItem('rp_cfg');
      if (existingCfg) localStorage.setItem('rp_cfg_backup', existingCfg);
      
      const existingVentas = localStorage.getItem('rp_ventas');
      if (existingVentas) localStorage.setItem('rp_ventas_backup', existingVentas);

      const existingDevol = localStorage.getItem('rp_devoluciones');
      if (existingDevol) localStorage.setItem('rp_devoluciones_backup', existingDevol);

      localStorage.setItem('rp_cfg', JSON.stringify(demoConfig));

      // 2. Erase previous transaction logs to offer a squeaky-clean analytical chart
      localStorage.removeItem('rp_ventas');
      localStorage.removeItem('rp_devoluciones');
      setCfg(demoConfig);
      applyThemeColor(demoSel.color);

      // Seed 2 mock historical vector sales so dashboard displays gorgeous content on first open
      const firstSaleId = 'S_MOCK_1';
      const secondSaleId = 'S_MOCK_2';
      const now = Date.now();

      const p0 = demoSel.productos[0];
      const p2 = demoSel.productos[2];
      const q0 = p0?.vendePorMonto ? 2.5 : 3;
      const q2 = p2?.vendePorMonto ? 1.2 : 5;

      const mockVentas = [
        {
          id: firstSaleId,
          tipo_negocio: demoSel.id,
          vendedorId: demoSel.vendedores[0]?.id || 'V1',
          vendedorNombre: demoSel.vendedores[0]?.nombre || 'Ana Ruiz',
          clienteId: 'C_MOCK_1',
          clienteNombre: 'Abarrotes El Tulipán',
          monto: Math.round((p0?.precio || 1500) * q0),
          tipoCobro: 'efectivo',
          items: [
            {
              id: p0?.id || 'P1',
              nombre: p0?.nombre || 'Item A',
              q: q0,
              pr: p0?.precio || 1500,
              ic: p0?.icono || '📦',
              unidad: p0?.unidad || 'pza',
              modo_venta: p0?.vendePorMonto ? 'por_monto' : 'por_cantidad'
            }
          ],
          timestamp: now - 3600000,
          prod_resumen: `${p0?.icono || '📦'}${p0?.nombre || 'Item'} (${q0}${p0?.unidad || 'x'})`,
          hora: new Date(now - 3600000).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
        },
        {
          id: secondSaleId,
          tipo_negocio: demoSel.id,
          vendedorId: demoSel.vendedores[1]?.id || 'V2',
          vendedorNombre: demoSel.vendedores[1]?.nombre || 'Pedro Leal',
          clienteId: 'C_MOCK_2',
          clienteNombre: 'Ricos Tacos Imperial',
          monto: Math.round((p2?.precio || 2000) * q2),
          tipoCobro: 'credito',
          items: [
            {
              id: p2?.id || 'P3',
              nombre: p2?.nombre || 'Item C',
              q: q2,
              pr: p2?.precio || 2000,
              ic: p2?.icono || '🧁',
              unidad: p2?.unidad || 'pza',
              modo_venta: p2?.vendePorMonto ? 'por_monto' : 'por_cantidad'
            }
          ],
          timestamp: now - 1800000,
          prod_resumen: `${p2?.icono || '🧁'}${p2?.nombre || 'Item'} (${q2}${p2?.unidad || 'x'})`,
          hora: new Date(now - 1800000).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
        }
      ];

      localStorage.setItem('rp_ventas', JSON.stringify(mockVentas));

      // Sync mock seeded sales to Firestone database so standard online sync is hydrated
      if (cloudSaved) {
        try {
          const batch = writeBatch(db);
          mockVentas.forEach((mv) => {
            batch.set(doc(db, 'ventas', mv.id), {
              id: mv.id,
              tipo_negocio: mv.tipo_negocio,
              vendedorId: mv.vendedorId,
              vendedorNombre: mv.vendedorNombre,
              clienteId: mv.clienteId,
              clienteNombre: mv.clienteNombre,
              monto: mv.monto,
              tipoCobro: mv.tipoCobro === 'efectivo' ? 'efectivo' : 'crédito',
              items: mv.items,
              timestamp: mv.timestamp
            });
          });
          await batch.commit();
        } catch (seedErr) {
          console.warn('Silent seeding to remote database interrupted:', seedErr);
        }
      }

      if (cloudSaved) {
        triggerToast(`✓ Demo iniciada para ${customName}`);
      } else {
        triggerToast(`✓ Demo iniciada localmente para ${customName}`);
      }
      setDemoSel(null);
      setDemoNameInput('');
      setCurrentScreen('landing');
    } catch (e) {
      console.error(e);
      triggerToast('Error al inicializar la base de datos de ejemplo', 'err');
    }
  };

  // Safe HTML rendering to avoid XSS from dynamic data sources while styling specific words
  const renderSafeHtml = (text: string) => {
    if (!text) return '';
    const parts = text.split(/(<strong>.*?<\/strong>)/g);
    return parts.map((part, index) => {
      if (part.startsWith('<strong>') && part.endsWith('</strong>')) {
        const content = part.substring(8, part.length - 9);
        return <strong key={index} className="font-bold text-amber-200">{content}</strong>;
      }
      return part;
    });
  };

  const handleCerrarSesion = async () => {
    try {
      // 1. Wipe demo cache
      localStorage.removeItem('rp_cfg');
      localStorage.removeItem('rp_ventas');
      localStorage.removeItem('rp_devoluciones');
      
      let nextCfg = {
        nombre: '',
        letra: '',
        subtitulo: 'App del vendedor · RoutePro',
        color_principal: '#C9912A',
        productos: [],
        vendedores: []
      };

      // 2. See if there is a backup of a REAL session to restore
      const dBackup = localStorage.getItem('rp_cfg_backup');
      const vBackup = localStorage.getItem('rp_ventas_backup');
      const devBackup = localStorage.getItem('rp_devoluciones_backup');
      if (dBackup) {
        try {
          nextCfg = JSON.parse(dBackup);
          localStorage.setItem('rp_cfg', dBackup);
          if (vBackup) localStorage.setItem('rp_ventas', vBackup);
          if (devBackup) localStorage.setItem('rp_devoluciones', devBackup);
        } catch (e) {
          console.error('Failed to restore backup', e);
        }
      }

      // Cleanup backups
      localStorage.removeItem('rp_cfg_backup');
      localStorage.removeItem('rp_ventas_backup');
      localStorage.removeItem('rp_devoluciones_backup');
      
      setCfg(nextCfg);
      applyThemeColor(nextCfg.color_principal || '#C9912A');
      setCurrentScreen('landing');
      triggerToast('Sesión de demo finalizada, normalidad restaurada');

      // 3. Silently try to reset the shared database configuration layout
      try {
        await setDoc(doc(db, 'config', 'global'), nextCfg);
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
      {currentScreen === 'auth' && (
        <AuthScreen
          onSuccess={() => setCurrentScreen('landing')}
          triggerToast={triggerToast}
        />
      )}

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
                  <div className="text-[11px] text-amber-200/90 leading-relaxed font-sans">
                    {renderSafeHtml(demoSel.insight)}
                  </div>
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
