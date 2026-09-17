import React, { useState, useEffect } from 'react';
import { db, handleDbError, OperationType, ensureSession, signOutSession, testConnection } from './supabase';
import { doc, onSnapshot, setDoc } from './lib/db';
import { AppConfig } from './types';
import { syncLocalTransactions } from './utils/syncEngine';

// Configuración del negocio (catálogo, rutas, marca) — ver src/data.ts
import { NEGOCIO, MODO_RUTA_SIMPLE } from './data';

// Modular Workspace Screens
import { LandingScreen } from './components/LandingScreen';
import { ConfigScreen } from './components/ConfigScreen';
import { RepartidorScreen } from './components/RepartidorScreen';
import { RutaScreen } from './components/RutaScreen';
import { MostradorScreen } from './components/MostradorScreen';
import { AdminScreen } from './components/AdminScreen';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'landing' | 'configuracion' | 'repartidor' | 'mostrador' | 'admin'>('landing');
  // Arranca con la configuración del negocio ya cargada: la primera pantalla
  // se pinta con la marca del cliente, sin parpadeo genérico.
  const [cfg, setCfg] = useState<AppConfig>(NEGOCIO);

  const [loading, setLoading] = useState(true);

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

  // Sincronización en vivo con la configuración del negocio.
  // En una instalación nueva la base viene vacía: se siembra con NEGOCIO para
  // que el programa abra listo para vender desde el primer arranque.
  useEffect(() => {
    let sembrando = false;

    const leerCache = (): AppConfig => {
      try {
        const cached = localStorage.getItem('rp_cfg');
        if (cached) return JSON.parse(cached) as AppConfig;
      } catch (e) {
        console.warn('[RutePro] Caché de configuración ilegible, se usa la de fábrica.', e);
      }
      return NEGOCIO;
    };

    const unsub = onSnapshot(doc(db, 'config', 'global'), async (docSnap: any) => {
      if (docSnap.exists()) {
        const cloudData = docSnap.data() as AppConfig;
        setCfg(cloudData);
        applyThemeColor(cloudData.color_principal || NEGOCIO.color_principal);
        try {
          localStorage.setItem('rp_cfg', JSON.stringify(cloudData));
        } catch (e) {
          console.warn('[RutePro] No se pudo guardar la caché local de configuración:', e);
        }
        setLoading(false);
        return;
      }

      // Sin configuración en la nube todavía.
      const local = leerCache();
      setCfg(local);
      applyThemeColor(local.color_principal || NEGOCIO.color_principal);
      setLoading(false);

      if (!sembrando) {
        sembrando = true;
        try {
          await setDoc(doc(db, 'config', 'global'), local);
          console.log('[RutePro] Configuración inicial publicada en Supabase.');
        } catch (err) {
          console.warn('[RutePro] No se pudo publicar la configuración inicial:', err);
        } finally {
          sembrando = false;
        }
      }
    }, (error: any) => {
      handleDbError(error, OperationType.GET, 'config/global');
      // Sin red: se opera con la última configuración conocida.
      const local = leerCache();
      setCfg(local);
      applyThemeColor(local.color_principal || NEGOCIO.color_principal);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Sesión de dispositivo + sonda de conexión al arrancar.
  useEffect(() => {
    ensureSession().then((uid) => {
      if (uid) console.log('[RutePro] Sesión activa:', uid);
    });
    testConnection().then((ok) => {
      if (!ok) console.warn('[RutePro] Sin conexión con Supabase: la app opera con caché local y sincroniza al volver la red.');
    });
  }, []);

  // Setup real-time background sync engine for offline operations
  useEffect(() => {
    // 1. Initial sync attempts
    syncLocalTransactions().catch(e => console.warn('Offline sync background error:', e));

    // 2. Sync whenever browser network state changes to online
    const handleOnline = () => {
      syncLocalTransactions().then((res) => {
        if (res.ventasSincronizadas > 0 || res.devolucionesSincronizadas > 0) {
          triggerToast(`✓ ¡Conexión restablecida! Sincronizados: ${res.ventasSincronizadas} ventas y ${res.devolucionesSincronizadas} devoluciones.`);
        }
      }).catch(e => console.warn('Online event sync error:', e));
    };
    window.addEventListener('online', handleOnline);

    // 3. Periodic execution of syncing queue (every 12 seconds)
    const interval = setInterval(() => {
      syncLocalTransactions().then((res) => {
        if (res.ventasSincronizadas > 0 || res.devolucionesSincronizadas > 0) {
          triggerToast(`✓ Sincronización automática: ${res.ventasSincronizadas} ventas y ${res.devolucionesSincronizadas} mermas subidas.`);
        }
      }).catch(e => console.warn('Periodic sync failure:', e));
    }, 12000);

    return () => {
      window.removeEventListener('online', handleOnline);
      clearInterval(interval);
    };
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


  // En una instalación de cliente, "cerrar sesión" NO borra información del
  // negocio: cierra la sesión de este dispositivo y quita el PIN local. El
  // borrado de datos vive en el Panel del Dueño, detrás de su confirmación.
  const handleCerrarSesion = async () => {
    try {
      localStorage.removeItem('rp_admin_pin');
      await signOutSession();
      await ensureSession();
      setCurrentScreen('landing');
      triggerToast('Sesión cerrada en este dispositivo');
    } catch (err) {
      console.error(err);
      triggerToast('Error al cerrar sesión', 'err');
    }
  };

  return (
    <div className="bg-[#06080C] min-h-screen">
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
        MODO_RUTA_SIMPLE ? (
          <RutaScreen
            cfg={cfg}
            onGoBack={() => setCurrentScreen('landing')}
            triggerToast={triggerToast}
          />
        ) : (
          <RepartidorScreen 
            cfg={cfg} 
            onGoBack={() => setCurrentScreen('landing')} 
            triggerToast={triggerToast}
          />
        )
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
