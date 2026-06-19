import React, { useState, useEffect, lazy, Suspense } from 'react';
import { db, handleFirestoreError, OperationType, auth } from './firebase';
import { signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, deleteDoc, writeBatch, updateDoc, arrayUnion } from 'firebase/firestore';
import { Product, Seller, AppConfig } from './types';
import { syncLocalTransactions } from './utils/syncEngine';

// presaved assets
import { DEMOS, DemoConfig } from './data';

// Crítico: siempre en el bundle principal
import { LandingScreen } from './components/LandingScreen';
import { AuthScreen } from './components/AuthScreen';

// Lazy: se cargan solo cuando el usuario los necesita
const ConfigScreen = lazy(() => import('./components/ConfigScreen').then(m => ({ default: m.ConfigScreen })));
const RepartidorScreen = lazy(() => import('./components/RepartidorScreen').then(m => ({ default: m.RepartidorScreen })));
const MostradorScreen = lazy(() => import('./components/MostradorScreen').then(m => ({ default: m.MostradorScreen })));
const AdminScreen = lazy(() => import('./components/AdminScreen').then(m => ({ default: m.AdminScreen })));
const WelcomeModal = lazy(() => import('./components/WelcomeModal').then(m => ({ default: m.WelcomeModal })));
const PaywallScreen = lazy(() => import('./components/PaywallScreen').then(m => ({ default: m.PaywallScreen })));
const ContadorScreen = lazy(() => import('./components/ContadorScreen').then(m => ({ default: m.ContadorScreen })));

const ScreenLoader = () => (
  <div className="min-h-screen bg-[#06080C] flex items-center justify-center">
    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 animate-pulse" />
  </div>
);

interface BillingInfo {
  status: 'trial' | 'active' | 'expired';
  trial_ends_at?: number;
  days_remaining?: number;
  owner_nombre?: string;
}

interface UserProfile {
  rol?: 'dueno' | 'contador';
  nombre?: string;
  negocios_gestionados?: string[];
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'landing' | 'configuracion' | 'repartidor' | 'mostrador' | 'admin' | 'demo'>(() => {
    const m = new URLSearchParams(window.location.search).get('mode');
    return (m === 'repartidor' || m === 'mostrador') ? m : 'landing';
  });
  const isWorkerMode = (() => {
    const m = new URLSearchParams(window.location.search).get('mode');
    return m === 'repartidor' || m === 'mostrador';
  })();
  const [cfg, setCfg] = useState<AppConfig>({
    nombre: 'Mi Negocio',
    letra: 'MN',
    subtitulo: 'Configura tu negocio en Ajustes ⚙️',
    color_principal: '#C9912A',
    productos: [
      { id: 'P1', icono: '📦', nombre: 'Producto 1', precio: 1000, unidad: 'pza' },
      { id: 'P2', icono: '📦', nombre: 'Producto 2', precio: 2000, unidad: 'pza' },
    ],
    vendedores: [
      { id: 'V1', nombre: 'Repartidor 1', rol: 'repartidor', ruta: 'Ruta A' },
    ],
    logo_url: ''
  });

  const [demoSel, setDemoSel] = useState<DemoConfig | null>(null);
  const [demoNameInput, setDemoNameInput] = useState('');
  const [showWelcome, setShowWelcome] = useState(() => {
    const m = new URLSearchParams(window.location.search).get('mode');
    if (m === 'repartidor' || m === 'mostrador') return false;
    return !localStorage.getItem('rp_welcome_seen');
  });
  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [errorToast, setErrorToast] = useState<{ message: string; type: 'ok' | 'err' } | null>(null);
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null);
  const [billingLoading, setBillingLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [contadorNegocioUid, setContadorNegocioUid] = useState<string | null>(null);

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

  // Demo: sin UID → todos los guards de Firestore lo bloquean (if !ownerUid return)
  const ownerUid = isDemoMode
    ? ''
    : isWorkerMode
      ? (new URLSearchParams(window.location.search).get('uid') || '')
      : contadorNegocioUid || (authUser?.uid || '');

  // Real-time Firestore synchronization on mount for the corporate setup
  useEffect(() => {
    if (!ownerUid) return;
    const unsub = onSnapshot(doc(db, 'negocios', ownerUid, 'config', 'global'), (docSnap) => {
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
            nombre: 'Mi Negocio',
            letra: 'MN',
            subtitulo: 'Configura tu negocio en Ajustes ⚙️',
            color_principal: '#C9912A',
            productos: [
              { id: 'P1', icono: '📦', nombre: 'Producto 1', precio: 1000, unidad: 'pza' },
              { id: 'P2', icono: '📦', nombre: 'Producto 2', precio: 2000, unidad: 'pza' },
            ],
            vendedores: [
              { id: 'V1', nombre: 'Repartidor 1', rol: 'repartidor', ruta: 'Ruta A' },
            ],
            logo_url: ''
          };
          setDoc(doc(db, 'negocios', ownerUid, 'config', 'global'), defaultNayaritas)
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
  }, [ownerUid]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthReady(true);
      if (!user && isWorkerMode) {
        signInAnonymously(auth).catch(() => {});
      }
    });
    return unsub;
  }, []);

  // Maneja ?join={ownerUid} — vincula al contador con el negocio del dueño
  useEffect(() => {
    const joinUid = new URLSearchParams(window.location.search).get('join');
    if (!joinUid || !authUser?.uid) return;

    const contadorUid = authUser.uid;
    const accesoRef = doc(db, 'negocios', joinUid, 'acceso', contadorUid);
    const usuarioRef = doc(db, 'usuarios', contadorUid);

    setDoc(accesoRef, {
      nombre: userProfile?.nombre || 'Contador',
      rol: 'contador',
      addedAt: Date.now(),
    }).then(() =>
      updateDoc(usuarioRef, {
        negocios_gestionados: arrayUnion(joinUid),
        rol: 'contador',
      })
    ).then(() => {
      window.history.replaceState({}, '', window.location.pathname);
      triggerToast('✓ Negocio vinculado exitosamente');
    }).catch(e => console.error('join error:', e));
  }, [authUser?.uid]);

  // Billing / subscription gate — reads usuarios/{uid} for plan status
  useEffect(() => {
    if (isDemoMode || isWorkerMode) {
      setBillingLoading(false);
      return;
    }
    if (!authUser?.uid) {
      setBillingLoading(false);
      return;
    }
    const unsub = onSnapshot(doc(db, 'usuarios', authUser.uid), (snap) => {
      if (!snap.exists()) {
        setBillingInfo({ status: 'active' });
        setBillingLoading(false);
        return;
      }
      const d = snap.data() as any;

      // Perfil de usuario (rol + negocios gestionados)
      setUserProfile({
        rol: d.rol,
        nombre: d.nombre,
        negocios_gestionados: d.negocios_gestionados || [],
      });

      const trialEndsAt: number | undefined = d.trial_ends_at ?? d.billing?.trial_ends_at;
      const planStatus: string = d.billing?.status ?? d.plan ?? 'trial';

      let status: BillingInfo['status'];
      if (planStatus === 'active') {
        status = 'active';
      } else if (!trialEndsAt) {
        // Usuarios anteriores sin trial_ends_at → acceso completo (retrocompat)
        status = 'active';
      } else if (Date.now() > trialEndsAt) {
        status = 'expired';
      } else {
        status = 'trial';
      }

      const daysRemaining = trialEndsAt
        ? Math.max(0, Math.ceil((trialEndsAt - Date.now()) / (1000 * 60 * 60 * 24)))
        : undefined;

      setBillingInfo({
        status,
        trial_ends_at: trialEndsAt,
        days_remaining: daysRemaining,
        owner_nombre: d.nombre,
      });
      setBillingLoading(false);
    });
    return unsub;
  }, [authUser?.uid, isDemoMode, isWorkerMode]);

  // Setup real-time background sync engine for offline operations
  useEffect(() => {
    if (!ownerUid) return;

    // 1. Initial sync attempts
    syncLocalTransactions(ownerUid).catch(e => console.warn('Offline sync background error:', e));

    // 2. Sync whenever browser network state changes to online
    const handleOnline = () => {
      syncLocalTransactions(ownerUid).then((res) => {
        if (res.ventasSincronizadas > 0 || res.devolucionesSincronizadas > 0) {
          triggerToast(`✓ ¡Conexión restablecida! Sincronizados: ${res.ventasSincronizadas} ventas y ${res.devolucionesSincronizadas} devoluciones.`);
        }
      }).catch(e => console.warn('Online event sync error:', e));
    };
    window.addEventListener('online', handleOnline);

    // 3. Periodic execution of syncing queue (every 12 seconds)
    const interval = setInterval(() => {
      syncLocalTransactions(ownerUid).then((res) => {
        if (res.ventasSincronizadas > 0 || res.devolucionesSincronizadas > 0) {
          triggerToast(`✓ Sincronización automática: ${res.ventasSincronizadas} ventas y ${res.devolucionesSincronizadas} mermas subidas.`);
        }
      }).catch(e => console.warn('Periodic sync failure:', e));
    }, 12000);

    return () => {
      window.removeEventListener('online', handleOnline);
      clearInterval(interval);
    };
  }, [ownerUid]);

  const handleSaveConfig = async (newCfg: AppConfig) => {
    let cloudSaved = false;
    if (ownerUid) {
      try {
        await setDoc(doc(db, 'negocios', ownerUid, 'config', 'global'), newCfg);
        cloudSaved = true;
      } catch (e) {
        console.warn('Silent fallback activated. Firestore save failed, using local offline persistence:', e);
      }
    }

    try {
      localStorage.setItem('rp_cfg', JSON.stringify(newCfg));
      setCfg(newCfg);
      if (newCfg.color_principal) {
        applyThemeColor(newCfg.color_principal);
      }
      if (isDemoMode) {
        triggerToast('✓ Configuración guardada (solo en este dispositivo — modo demo)');
      } else if (cloudSaved) {
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

  const launchDemo = async (demo: DemoConfig, customName: string) => {
    const demoConfig = {
      nombre: customName,
      letra: customName[0].toUpperCase(),
      subtitulo: `Demo activa · ${demo.nombre}`,
      color_principal: demo.color,
      productos: demo.productos,
      vendedores: demo.vendedores,
      tipo_negocio: demo.id
    };

    let cloudSaved = false;
    if (ownerUid) {
      try {
        await setDoc(doc(db, 'negocios', ownerUid, 'config', 'global'), demoConfig);
        cloudSaved = true;
      } catch (e) {
        console.warn('Silent database write failed, running demo in high-res offline cache mode:', e);
      }
    }

    try {
      const existingCfg = localStorage.getItem('rp_cfg');
      if (existingCfg) localStorage.setItem('rp_cfg_backup', existingCfg);
      const existingVentas = localStorage.getItem('rp_ventas');
      if (existingVentas) localStorage.setItem('rp_ventas_backup', existingVentas);
      const existingDevol = localStorage.getItem('rp_devoluciones');
      if (existingDevol) localStorage.setItem('rp_devoluciones_backup', existingDevol);

      localStorage.setItem('rp_cfg', JSON.stringify(demoConfig));
      localStorage.removeItem('rp_ventas');
      localStorage.removeItem('rp_devoluciones');
      setCfg(demoConfig);
      applyThemeColor(demo.color);

      const now = Date.now();
      const p0 = demo.productos[0];
      const p2 = demo.productos[2];
      const q0 = p0?.vendePorMonto ? 2.5 : 3;
      const q2 = p2?.vendePorMonto ? 1.2 : 5;
      const mockVentas = [
        {
          id: 'S_MOCK_1', tipo_negocio: demo.id,
          vendedorId: demo.vendedores[0]?.id || 'V1',
          vendedorNombre: demo.vendedores[0]?.nombre || 'Ana Ruiz',
          clienteId: 'C_MOCK_1', clienteNombre: 'Abarrotes El Tulipán',
          monto: Math.round((p0?.precio || 1500) * q0), tipoCobro: 'efectivo',
          items: [{ id: p0?.id || 'P1', nombre: p0?.nombre || 'Item A', q: q0,
            pr: p0?.precio || 1500, ic: p0?.icono || '📦',
            unidad: p0?.unidad || 'pza', modo_venta: p0?.vendePorMonto ? 'por_monto' : 'por_cantidad' }],
          timestamp: now - 3600000, validado: true, sincronizado: true,
          prod_resumen: `${p0?.icono || '📦'}${p0?.nombre || 'Item'} (${q0}${p0?.unidad || 'x'})`,
          hora: new Date(now - 3600000).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
        },
        {
          id: 'S_MOCK_2', tipo_negocio: demo.id,
          vendedorId: demo.vendedores[1]?.id || 'V2',
          vendedorNombre: demo.vendedores[1]?.nombre || 'Pedro Leal',
          clienteId: 'C_MOCK_2', clienteNombre: 'Ricos Tacos Imperial',
          monto: Math.round((p2?.precio || 2000) * q2), tipoCobro: 'credito',
          items: [{ id: p2?.id || 'P3', nombre: p2?.nombre || 'Item C', q: q2,
            pr: p2?.precio || 2000, ic: p2?.icono || '🧁',
            unidad: p2?.unidad || 'pza', modo_venta: p2?.vendePorMonto ? 'por_monto' : 'por_cantidad' }],
          timestamp: now - 1800000, validado: true, sincronizado: true,
          prod_resumen: `${p2?.icono || '🧁'}${p2?.nombre || 'Item'} (${q2}${p2?.unidad || 'x'})`,
          hora: new Date(now - 1800000).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
        }
      ];
      localStorage.setItem('rp_ventas', JSON.stringify(mockVentas));

      triggerToast(cloudSaved
        ? `✓ Demo iniciada para ${customName} con saldo en cero`
        : `✓ Demo iniciada localmente para ${customName} con saldo en cero`
      );
      setDemoSel(null);
      setDemoNameInput('');
      setShowWelcome(false);
      setCurrentScreen('landing');
    } catch (e) {
      console.error(e);
      triggerToast('Error al inicializar la base de datos de ejemplo', 'err');
    }
  };

  const handleLaunchDemoObject = async () => {
    if (!demoSel) {
      triggerToast('Por favor selecciona un tipo de negocio', 'err');
      return;
    }
    await launchDemo(demoSel, demoNameInput.trim() || demoSel.businessName);
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

  const handleNuevaDemo = () => {
    localStorage.removeItem('rp_welcome_seen');
    localStorage.removeItem('rp_cfg');
    localStorage.removeItem('rp_ventas');
    localStorage.removeItem('rp_devoluciones');
    setCfg({ nombre: '', letra: '', subtitulo: 'App del vendedor · RoutePro', color_principal: '#C9912A', productos: [], vendedores: [] });
    setShowWelcome(true);
  };

  const handleCerrarSesion = async () => {
    try {
      // 1. Wipe demo cache
      localStorage.removeItem('rp_welcome_seen');
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

      if (isDemoMode) {
        // En demo: volver a la pantalla de registro
        setIsDemoMode(false);
        setShowWelcome(false);
        triggerToast('Demo finalizada — crea tu cuenta para guardar datos reales');
      } else {
        setShowWelcome(true);
        triggerToast('Sesión finalizada correctamente');
        // Reiniciar configuración en la nube
        if (ownerUid) {
          try {
            await setDoc(doc(db, 'negocios', ownerUid, 'config', 'global'), nextCfg);
          } catch (dbErr) {
            console.log('[Info] Configuración remota no actualizada.', dbErr);
          }
        }
      }
    } catch (err) {
      console.error(err);
      triggerToast('Error al reiniciar sesión local', 'err');
    }
  };

  if (!authReady) return (
    <div className="min-h-screen bg-[#06080C] flex items-center justify-center">
      <div className="text-amber-400 animate-pulse text-sm font-bold">Cargando...</div>
    </div>
  );

  if (!authUser && !isWorkerMode && !isDemoMode) return (
    <AuthScreen
      onSuccess={() => {}}
      onDemoMode={() => { setIsDemoMode(true); setShowWelcome(true); }}
      triggerToast={triggerToast}
    />
  );

  // Esperar datos de suscripción antes de mostrar la app (evita parpadeos)
  if (billingLoading && !isDemoMode && !isWorkerMode) return (
    <div className="min-h-screen bg-[#06080C] flex items-center justify-center">
      <div className="text-amber-400 animate-pulse text-sm font-bold">Cargando...</div>
    </div>
  );

  // Modo contador: si el usuario tiene rol=contador y no ha seleccionado un negocio
  if (userProfile?.rol === 'contador' && !contadorNegocioUid && !isDemoMode && !isWorkerMode) return (
    <>
      <Suspense fallback={<ScreenLoader />}>
        <ContadorScreen
          contadorUid={authUser?.uid || ''}
          contadorNombre={userProfile.nombre || 'Contador'}
          negociosGestionados={userProfile.negocios_gestionados || []}
          onEnterNegocio={(uid) => setContadorNegocioUid(uid)}
          onCerrarSesion={handleCerrarSesion}
          triggerToast={triggerToast}
        />
      </Suspense>
      {errorToast && (
        <div className={`fixed bottom-6 left-5 right-5 p-3.5 rounded-xl z-50 shadow-md text-xs font-bold flex items-center gap-2 justify-center animate-fade-in ${errorToast.type === 'err' ? 'bg-red-950/80 border border-red-500/20 text-red-400' : 'bg-emerald-950/80 border border-emerald-500/20 text-[#00C896]'}`}>
          <span>{errorToast.type === 'err' ? '⚠️' : '✓'}</span>
          <span>{errorToast.message}</span>
        </div>
      )}
    </>
  );

  // Paywall: trial expirado y sin plan activo
  if (billingInfo?.status === 'expired' && !isDemoMode && !isWorkerMode) return (
    <>
      <Suspense fallback={<ScreenLoader />}>
        <PaywallScreen
          ownerUid={ownerUid}
          ownerEmail={authUser?.email ?? ''}
          ownerNombre={billingInfo.owner_nombre}
          trialEndedAt={billingInfo.trial_ends_at}
          triggerToast={triggerToast}
        />
      </Suspense>
      {errorToast && (
        <div className={`fixed bottom-6 left-5 right-5 p-3.5 rounded-xl z-50 shadow-md text-xs font-bold flex items-center gap-2 justify-center animate-fade-in ${errorToast.type === 'err' ? 'bg-red-950/80 border border-red-500/20 text-red-400' : 'bg-emerald-950/80 border border-emerald-500/20 text-[#00C896]'}`}>
          <span>{errorToast.type === 'err' ? '⚠️' : '✓'}</span>
          <span>{errorToast.message}</span>
        </div>
      )}
    </>
  );

  return (
    <div className="bg-[#06080C] min-h-screen">
      {currentScreen === 'landing' && (
        <LandingScreen
          cfg={cfg}
          onGo={(screen: any) => setCurrentScreen(screen)}
          onCerrarSesion={handleCerrarSesion}
          onNuevaDemo={handleNuevaDemo}
          onSaveConfig={handleSaveConfig}
          triggerToast={triggerToast}
          ownerUid={ownerUid}
          isDemoMode={isDemoMode}
          onRegistrarse={() => { setIsDemoMode(false); setShowWelcome(false); }}
        />
      )}

      <Suspense fallback={<ScreenLoader />}>
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
            isWorkerMode={isWorkerMode}
            ownerUid={ownerUid}
          />
        )}

        {currentScreen === 'mostrador' && (
          <MostradorScreen
            cfg={cfg}
            onGoBack={() => setCurrentScreen('landing')}
            triggerToast={triggerToast}
            isWorkerMode={isWorkerMode}
            ownerUid={ownerUid}
          />
        )}

        {currentScreen === 'admin' && (
          <AdminScreen
            cfg={cfg}
            onGoBack={() => setCurrentScreen('landing')}
            triggerToast={triggerToast}
            onGoConfig={() => setCurrentScreen('configuracion')}
            onCerrarSesion={handleCerrarSesion}
            ownerEmail={authUser?.email ?? undefined}
            ownerUid={ownerUid}
            isContador={!!contadorNegocioUid}
            onBackToContador={contadorNegocioUid ? () => setContadorNegocioUid(null) : undefined}
          />
        )}

        {currentScreen === 'landing' && showWelcome && (
          <WelcomeModal
            onLaunchDemo={(demo, name) => launchDemo(demo, name)}
            onDismiss={() => setShowWelcome(false)}
          />
        )}
      </Suspense>

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

      {/* TRIAL BANNER */}
      {billingInfo?.status === 'trial' && !isDemoMode && !isWorkerMode && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-[#06080C] text-center py-1.5 px-4 text-[10px] font-extrabold tracking-wide">
          {billingInfo.days_remaining === 0
            ? '⚠ Tu prueba vence hoy — activa tu plan para no perder acceso'
            : `Prueba gratis: ${billingInfo.days_remaining} día${billingInfo.days_remaining !== 1 ? 's' : ''} restante${billingInfo.days_remaining !== 1 ? 's' : ''}`}
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
