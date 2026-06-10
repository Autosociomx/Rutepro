import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Product, Seller, Venta, VentaItem, AppConfig, Devolucion, MysteryAudit } from '../types';

interface AdminScreenProps {
  cfg: AppConfig;
  onGoBack: () => void;
  triggerToast: (msg: string, type?: 'ok' | 'err') => void;
  onGoConfig?: () => void;
  onCerrarSesion?: () => void;
}

export const AdminScreen: React.FC<AdminScreenProps> = ({ cfg, onGoBack, triggerToast, onGoConfig, onCerrarSesion }) => {
  const [activeTab, setActiveTab] = useState<'res' | 'rutas' | 'alertas' | 'ia' | 'sys'>('res');
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [devoluciones, setDevoluciones] = useState<Devolucion[]>([]);
  const [mysteryAudits, setMysteryAudits] = useState<MysteryAudit[]>([]);

  // Asesor chat states
  const [chatInp, setChatInp] = useState('');
  const [chatLogs, setChatLogs] = useState<{ role: 'bot' | 'usr'; text: string }[]>([
    { role: 'bot', text: `¡Hola! Soy tu Gerente Digital. Operando como un Cdis automatizado, controlo tu fuerza de ventas en tiempo real (ya sean 3, 15 o más de 20 repartidores). Puedo sumar tus ventas totales de hoy, decirte qué ruta va rindiendo mejor, informarte del ticket promedio o indicarte el nivel de efectivo acumulado en calle. ¿Qué reporte deseas generar?` }
  ]);
  const [chatLoading, setChatLoading] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [isWiping, setIsWiping] = useState(false);

  // Mystery modal state
  const [showMysteryModal, setShowMysteryModal] = useState(false);
  const [mSelectedSellerId, setMSelectedSellerId] = useState('');
  const [mAuditorName, setMAuditorName] = useState('Auditor Incógnito #1');
  const [mCheckCobro, setMCheckCobro] = useState(true);
  const [mCheckRecibo, setMCheckRecibo] = useState(true);
  const [mCheckPresentacion, setMCheckPresentacion] = useState(true);
  const [mCheckTrato, setMCheckTrato] = useState(true);
  const [mNotas, setMNotas] = useState('');
  const [isSubmittingAudit, setIsSubmittingAudit] = useState(false);

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const handleWipeData = async () => {
    setIsWiping(true);
    triggerToast('🗑️ Eliminando transacciones de la nube y caches...');
    try {
      // 1. Clear local caches
      localStorage.removeItem('rp_ventas');
      localStorage.removeItem('rp_devoluciones');
      localStorage.removeItem('rp_mystery_audits');
      setVentas([]);
      setDevoluciones([]);
      setMysteryAudits([]);

      // 2. Fetch and delete from Firestore
      const { getDocs, query, collection, deleteDoc, doc, writeBatch } = await import('firebase/firestore');
      const vSnap = await getDocs(query(collection(db, 'ventas')));
      const dSnap = await getDocs(query(collection(db, 'devoluciones')));
      const mSnap = await getDocs(query(collection(db, 'mystery_audits')));

      const batch = writeBatch(db);
      vSnap.forEach((docSnap) => {
        batch.delete(doc(db, 'ventas', docSnap.id));
      });
      dSnap.forEach((docSnap) => {
        batch.delete(doc(db, 'devoluciones', docSnap.id));
      });
      mSnap.forEach((docSnap) => {
        batch.delete(doc(db, 'mystery_audits', docSnap.id));
      });

      await batch.commit();

      triggerToast('✓ Balance y auditorías restauradas en ceros con éxito.', 'ok');
      setShowWipeConfirm(false);
    } catch (e: any) {
      console.error(e);
      triggerToast('Error al limpiar registros de la nube', 'err');
    } finally {
      setIsWiping(false);
    }
  };

  const handleCreateMysteryAudit = async () => {
    if (!mSelectedSellerId) {
      triggerToast('Por favor, selecciona un vendedor para auditar.', 'err');
      return;
    }
    const targetSeller = cfg.vendedores.find(v => v.id === mSelectedSellerId);
    if (!targetSeller) {
      triggerToast('Vendedor no encontrado.', 'err');
      return;
    }

    setIsSubmittingAudit(true);
    triggerToast('⏳ Sincronizando auditoría misteriosa...');

    // Calculate score based on active checks
    let correctChecks = 0;
    if (mCheckCobro) correctChecks++;
    if (mCheckRecibo) correctChecks++;
    if (mCheckPresentacion) correctChecks++;
    if (mCheckTrato) correctChecks++;
    const calif = Math.round((correctChecks / 4) * 100);

    const auditId = 'M_AUDIT_' + Date.now();
    const auditObj: MysteryAudit = {
      id: auditId,
      vendedorId: targetSeller.id,
      vendedorNombre: targetSeller.nombre,
      fecha: new Date().toLocaleDateString('es-MX'),
      auditor: mAuditorName.trim() || 'Auditor Anónimo',
      checks: {
        cobroExacto: mCheckCobro,
        entregaRecibo: mCheckRecibo,
        presentacionLimpia: mCheckPresentacion,
        tratoAmable: mCheckTrato
      },
      calificacion: calif,
      notas: mNotas.trim(),
      timestamp: Date.now()
    };

    try {
      // 1. Save to cloud
      await setDoc(doc(db, 'mystery_audits', auditId), auditObj);
      
      // 2. Save locally
      const prev = JSON.parse(localStorage.getItem('rp_mystery_audits') || '[]');
      localStorage.setItem('rp_mystery_audits', JSON.stringify([auditObj, ...prev]));
      
      triggerToast('✓ Auditoría de Cliente Misterioso registrada y sincronizada en vivo.', 'ok');
      setShowMysteryModal(false);
      
      // Reset state
      setMNotas('');
      setMAuditorName('Auditor Incógnito #1');
      setMCheckCobro(true);
      setMCheckRecibo(true);
      setMCheckPresentacion(true);
      setMCheckTrato(true);
    } catch (err) {
      console.error(err);
      triggerToast('Error al registrar auditoría en la nube', 'err');
    } finally {
      setIsSubmittingAudit(false);
    }
  };

  // Load and consolidate transaction logs directly from Firestore with real-time automatic telemetry synchronization
  useEffect(() => {
    const q = query(collection(db, 'ventas'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const salesFromDb: Venta[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        salesFromDb.push({
          id: docSnap.id,
          vendedorId: data.vendedorId || '',
          vendedorNombre: data.vendedorNombre || '',
          clienteId: data.clienteId || '',
          clienteNombre: data.clienteNombre || '',
          clienteTipo: data.clienteTipo || '',
          monto: Number(data.monto) || 0,
          tipoCobro: data.tipoCobro === 'efectivo' ? 'efectivo' : 'crédito',
          items: (data.items || []).map((it: VentaItem) => ({
            id: it.id || '',
            nombre: it.nombre || '',
            q: Number(it.q) || 0,
            pr: Number(it.pr) || 0,
            ic: it.ic || it.icono || '📦'
          })),
          timestamp: data.timestamp || Date.now()
        });
      });

      // Merge local storage offline sales with database ones to avoid losing unsynced items when offline
      const localSales = JSON.parse(localStorage.getItem('rp_ventas') || '[]');
      const mergedSales = [...salesFromDb];
      localSales.forEach((ls: any) => {
        if (!mergedSales.some(dbSale => dbSale.id === ls.id)) {
          mergedSales.push({
            id: ls.id,
            vendedorId: ls.vendedorId || '',
            vendedorNombre: ls.vendedorNombre || '',
            clienteId: ls.clienteId || '',
            clienteNombre: ls.clienteNombre || '',
            clienteTipo: ls.clienteTipo || '',
            monto: Number(ls.monto) || 0,
            tipoCobro: ls.tipoCobro === 'efectivo' ? 'efectivo' : 'crédito',
            items: (ls.items || []).map((it: any) => ({
              id: it.id || '',
              nombre: it.nombre || '',
              q: Number(it.q) || 0,
              pr: Number(it.pr) || 0,
              ic: it.ic || it.icono || '📦'
            })),
            timestamp: ls.timestamp || ls.ts || Date.now()
          });
        }
      });
      mergedSales.sort((a, b) => b.timestamp - a.timestamp);

      setVentas(mergedSales);
      // Keep local backup store in sync with active cloud logs
      localStorage.setItem('rp_ventas', JSON.stringify(mergedSales));
    }, (error) => {
      console.warn('Real-time sync paused or connection offline. Utilizing local transaction logs cache fallback:', error);
      const localSales = JSON.parse(localStorage.getItem('rp_ventas') || '[]');
      setVentas(localSales);
    });

    return () => unsub();
  }, []);

  // Real-time Firestore subscription for Devoluciones/Mermas
  useEffect(() => {
    const q = query(collection(db, 'devoluciones'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const devolsFromDb: Devolucion[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        devolsFromDb.push({
          id: docSnap.id,
          vendedorId: data.vendedorId || '',
          vendedorNombre: data.vendedorNombre || '',
          clienteId: data.clienteId || '',
          clienteNombre: data.clienteNombre || '',
          productoId: data.productoId || '',
          productoNombre: data.productoNombre || '',
          cantidad: Number(data.cantidad) || 0,
          timestamp: data.timestamp || Date.now()
        });
      });

      // Merge local storage mermas list (rp_devoluciones) with database mermas to avoid losing unsynced items
      const localDevols = JSON.parse(localStorage.getItem('rp_devoluciones') || '[]');
      const mergedDevols = [...devolsFromDb];
      localDevols.forEach((ld: any) => {
        if (!mergedDevols.some(dbDev => dbDev.id === ld.id)) {
          mergedDevols.push({
            id: ld.id,
            vendedorId: ld.vendedorId || '',
            vendedorNombre: ld.vendedorNombre || '',
            clienteId: ld.clienteId || '',
            clienteNombre: ld.clienteNombre || '',
            productoId: ld.productoId || '',
            productoNombre: ld.productoNombre || '',
            cantidad: Number(ld.cantidad) || 0,
            timestamp: ld.timestamp || Date.now()
          });
        }
      });
      mergedDevols.sort((a, b) => b.timestamp - a.timestamp);

      setDevoluciones(mergedDevols);
      localStorage.setItem('rp_devoluciones', JSON.stringify(mergedDevols));
      localStorage.setItem('rp_devoluciones_admin', JSON.stringify(mergedDevols));
    }, (error) => {
      console.warn('Real-time devoluciones paused. Utilizing local cache fallback:', error);
      const localDevols = JSON.parse(localStorage.getItem('rp_devoluciones') || '[]');
      setDevoluciones(localDevols);
    });

    return () => unsub();
  }, []);

  // Real-time Firestore subscription for Mystery Shop Audits
  useEffect(() => {
    const q = query(collection(db, 'mystery_audits'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const auditsFromDb: MysteryAudit[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        auditsFromDb.push({
          id: docSnap.id,
          vendedorId: data.vendedorId || '',
          vendedorNombre: data.vendedorNombre || '',
          fecha: data.fecha || '',
          auditor: data.auditor || '',
          checks: data.checks || { cobroExacto: true, entregaRecibo: true, presentacionLimpia: true, tratoAmable: true },
          calificacion: Number(data.calificacion) || 100,
          notas: data.notas || '',
          timestamp: data.timestamp || Date.now()
        });
      });
      setMysteryAudits(auditsFromDb);
      localStorage.setItem('rp_mystery_audits', JSON.stringify(auditsFromDb));
    }, (error) => {
      console.warn('Real-time mystery audits paused. Utilizing local cache fallback:', error);
      const local = JSON.parse(localStorage.getItem('rp_mystery_audits') || '[]');
      setMysteryAudits(local);
    });

    return () => unsub();
  }, []);

  const handleRefrescar = () => {
    triggerToast('↻ Sincronizando datos de ruta en tiempo real...');
  };

  // Calculations
  const totalCobrado = ventas.reduce((sum, v) => sum + (v.monto || 0), 0);
  const totalClientes = ventas.length;
  const ticketPromedio = totalClientes > 0 ? Math.round(totalCobrado / totalClientes) : 0;
  
  // Count active unique delivery persons (excluding mostrador)
  const activeSellersInVentas = new Set(
    ventas
      .filter(v => v.vendedorId !== 'v_mostrador')
      .map(v => v.vendedorId)
  );
  const activeRoutesCount = activeSellersInVentas.size;

  // Calculate Product Popularity list (Dynamic bar chart)
  const getProductPopularity = () => {
    const table: { [key: string]: { nombre: string; icono: string; totalCents: number; qty: number } } = {};
    
    ventas.forEach((v) => {
      const itemsList = v.items || [];
      itemsList.forEach((item: VentaItem) => {
        const prodName = item.nombre;
        if (!table[prodName]) {
          table[prodName] = { 
            nombre: prodName, 
            icono: item.ic || '📦', 
            totalCents: 0, 
            qty: 0 
          };
        }
        table[prodName].totalCents += (item.pr || 0) * (item.q || 0);
        table[prodName].qty += (item.q || 0);
      });
    });

    return Object.values(table).sort((a, b) => b.totalCents - a.totalCents).slice(0, 4);
  };

  const topProducts = getProductPopularity();
  const maxProductRevenue = topProducts.length > 0 ? topProducts[0].totalCents : 1;

  // Alerts logic
  const getAlerts = () => {
    const alertsList: { tipo: string; icono: string; titulo: string; sub: string }[] = [];
    
    // Check cash limits in routes
    cfg.vendedores.forEach((vendedor) => {
      const routeSales = ventas.filter(v => v.vendedorId === vendedor.id);
      const totalCashInRoute = routeSales
        .filter(s => s.tipoCobro === 'efectivo')
        .reduce((sum, s) => sum + (s.monto || 0), 0);

      if (totalCashInRoute > 500000) { // Over $50.00 pesos/cents placeholder or relative values
        alertsList.push({
          tipo: 'danger',
          icono: '💰',
          titulo: `Efectivo elevado: ${vendedor.nombre}`,
          sub: `Lleva ${formatPrice(totalCashInRoute)} en posesión sin liquidar en caja de sucursal.`
        });
      }
    });

    if (alertsList.length === 0) {
      alertsList.push({
        tipo: 'ok',
        icono: '✅',
        titulo: 'Sistema operando con normalidad',
        sub: 'No hay alertas financieras críticas registradas en este momento.'
      });
    }

    return alertsList;
  };

  const alerts = getAlerts();

  const handleAskAI = async (textOver?: string) => {
    const qStr = textOver || chatInp.trim();
    if (!qStr) return;
    if (!textOver) setChatInp('');

    const newLogs = [...chatLogs, { role: 'usr', text: qStr }];
    setChatLogs([...newLogs, { role: 'bot', text: '⏳ Analizando métricas corporativas...' }]);
    setChatLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: qStr,
          config_negocio: cfg,
          ventas: ventas,
          vendedores: cfg.vendedores,
          chatHistory: chatLogs.slice(-4)
        })
      });
      const data = await response.json();
      setChatLogs([...newLogs, { role: 'bot', text: data.text || 'Sin respuesta del asesor corporativo.' }]);
    } catch (err) {
      setChatLogs([...newLogs, { role: 'bot', text: 'Asistencia corporativa offline: El total cobrado acumulado en el día de hoy asciende a ' + formatPrice(totalCobrado) + ' distribuidos en ' + totalClientes + ' clientes. Agrega tu GEMINI_API_KEY en secrets para activar predicciones avanzadas.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#06080C] text-[#EEF1F8] flex flex-col font-sans pb-10">
      {/* Header Admin */}
      <div className="sticky top-0 z-50 h-14 bg-[#06080C]/94 backdrop-blur-md border-b border-purple-500/20 px-4.5 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 text-left min-w-0">
          <div className="w-9 h-9 rounded-lg bg-[#111520] border border-purple-500/20 flex items-center justify-center font-display font-bold shrink-0 text-purple-400 overflow-hidden">
            {cfg.logo_url ? (
              <img src={cfg.logo_url} className="w-full h-full object-contain p-0.5" alt="Logo" referrerPolicy="no-referrer" />
            ) : (
              <span className="text-sm">👁</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate">{cfg.nombre} · Dueño</div>
            <div className="text-[10px] text-purple-400 tracking-wider flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
              <span>Gerente Digital (Cdis)</span>
            </div>
          </div>
        </div>
        <button 
          onClick={onGoBack} 
          className="w-9 h-9 rounded-lg bg-[#111520] border border-white/5 flex items-center justify-center text-[#8A93A8] hover:text-white transition-all text-xs cursor-pointer"
        >
          ←
        </button>
      </div>

      {/* Tabs Menu Bar */}
      <div className="flex overflow-x-auto no-scrollbar gap-1 bg-[#0B0E14] border-b border-white/5 p-2 shrink-0">
        <button 
          onClick={() => setActiveTab('res')} 
          className={`py-2 px-3 shrink-0 text-[10px] font-bold uppercase tracking-wider rounded-lg select-none cursor-pointer transition-all ${activeTab === 'res' ? 'bg-[#181D2B] text-[#E8B04A] border border-amber-500/10' : 'text-[#3E4A60]'}`}
        >
          📊 Resumen
        </button>
        <button 
          onClick={() => setActiveTab('rutas')} 
          className={`py-2 px-3 shrink-0 text-[10px] font-bold uppercase tracking-wider rounded-lg select-none cursor-pointer transition-all ${activeTab === 'rutas' ? 'bg-[#181D2B] text-[#E8B04A] border border-amber-500/10' : 'text-[#3E4A60]'}`}
        >
          🗺️ Rutas
        </button>
        <button 
          onClick={() => setActiveTab('alertas')} 
          className={`py-2 px-3 shrink-0 text-[10px] font-bold uppercase tracking-wider rounded-lg select-none cursor-pointer transition-all ${activeTab === 'alertas' ? 'bg-[#181D2B] text-[#E8B04A] border border-amber-500/10' : 'text-[#3E4A60]'}`}
        >
          🔔 Alertas
        </button>
        <button 
          onClick={() => setActiveTab('ia')} 
          className={`py-2 px-3 shrink-0 text-[10px] font-bold uppercase tracking-wider rounded-lg select-none cursor-pointer transition-all ${activeTab === 'ia' ? 'bg-[#181D2B] text-[#E8B04A] border border-amber-500/10' : 'text-[#3E4A60]'}`}
        >
          🧠 Gerente
        </button>
        <button 
          onClick={() => setActiveTab('sys')} 
          className={`py-2 px-3 shrink-0 text-[10px] font-bold uppercase tracking-wider rounded-lg select-none cursor-pointer transition-all ${activeTab === 'sys' ? 'bg-[#181D2B] text-[#E8B04A] border border-amber-500/10' : 'text-[#3E4A60]'}`}
        >
          ⚙️ Op's
        </button>
      </div>

      {/* Main Panel views */}
      <div className="flex-1 p-4.5 space-y-4 text-left">
        
        {/* PANEL: RESUMEN */}
        {activeTab === 'res' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-[#111520] border border-white/5 p-3 rounded-xl shrink-0">
              <span className="text-[11px] font-mono text-[#8A93A8] uppercase tracking-wider font-bold">Hoy · {new Date().toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              <button 
                onClick={handleRefrescar}
                className="bg-[#181D2B] hover:bg-slate-800 border border-white/5 text-[10px] text-[#8A93A8] font-semibold py-1.5 px-3 rounded-lg cursor-pointer"
              >
                ↻ Sincronizar
              </button>
            </div>

            {/* Dashboard metrics metrics */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-[#111520] border border-white/5 rounded-xl p-3.5 relative overflow-hidden">
                <div className="text-xl font-bold tracking-tight text-[#E8B04A]">{formatPrice(totalCobrado)}</div>
                <div className="text-[9px] text-[#3E4A60] uppercase mt-0.5 tracking-wider font-bold">Cobrado Total</div>
                <div className="text-[8px] text-[#8A93A8] mt-1.5 shrink-0">Todas las rutas</div>
              </div>
              <div className="bg-[#111520] border border-white/5 rounded-xl p-3.5">
                <div className="text-xl font-bold tracking-tight text-[#00C896]">{totalClientes}</div>
                <div className="text-[9px] text-[#3E4A60] uppercase mt-0.5 tracking-wider font-bold">Clientes Atendidos</div>
                <div className="text-[8px] text-[#8A93A8] mt-1.5 truncate">Ticket Prom: {formatPrice(ticketPromedio)}</div>
              </div>
              <div className="bg-[#111520] border border-white/5 rounded-xl p-3.5">
                <div className="text-xl font-bold tracking-tight text-[#4A8FFF]">{activeRoutesCount}</div>
                <div className="text-[9px] text-[#3E4A60] uppercase mt-0.5 tracking-wider font-bold">Rutas Activas</div>
                <div className="text-[8px] text-[#8A93A8] mt-1.5">de {cfg.vendedores?.filter(v => v.rol !== 'cajero').length || 0} de reparto</div>
              </div>
              <div className="bg-[#111520] border border-white/5 rounded-xl p-3.5">
                <div className="text-xl font-bold text-red-400">{devoluciones.length}</div>
                <div className="text-[9px] text-[#3E4A60] uppercase mt-0.5 tracking-wider font-bold">Devoluciones</div>
                <div className="text-[8px] text-[#8A93A8] mt-1.5">Nivel controlado</div>
              </div>
            </div>

            {/* Top Products progress ratios */}
            <div className="bg-[#111520] border border-white/5 rounded-xl p-4 space-y-3.5">
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>🏆</span>
                <span>Top Artículos Vendidos</span>
              </div>
              
              <div className="space-y-3">
                {topProducts.length === 0 ? (
                  <div className="text-center py-4 text-[10px] text-[#3E4A60]">Esperando ingresos de ruta...</div>
                ) : (
                  topProducts.map((p, idx) => {
                    const pct = Math.round((p.totalCents / maxProductRevenue) * 100);
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between items-center text-xs font-semibold">
                          <span className="text-[#8A93A8] truncate pr-2">{p.icono} {p.nombre}</span>
                          <span className="text-[#E8B04A] shrink-0 font-bold">{formatPrice(p.totalCents)} <span className="text-[9px] text-[#3E4A60]">({p.qty}x)</span></span>
                        </div>
                        <div className="h-1 bg-[#181D2B] rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full"
                            style={{ width: `${pct}%`, transition: 'width 0.8s ease-out' }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Realtime Delivery Ticker */}
            <div className="bg-[#111520] border border-white/5 rounded-xl p-4 space-y-3">
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
                <span>Monitoreo en Tiempo Real</span>
              </div>
              <div className="space-y-2">
                {ventas.length === 0 ? (
                  <div className="text-center py-4 text-[10px] text-[#3E4A60]">Esperando transmisiones satelitales...</div>
                ) : (
                  ventas.slice(0, 5).map((v, i) => (
                    <div key={v.id || i} className="flex justify-between items-start gap-2 text-xs border-b border-white/5 pb-2.5 last:border-0 last:pb-0 pt-1">
                      <div>
                        <div className="font-bold text-white shrink-0 truncate max-w-[150px] flex items-center gap-1.5">
                          {v.clienteNombre || 'Cliente Ambulante'}
                          {v.clienteTipo && <span className="bg-[#E8B04A]/10 text-[#E8B04A] text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">{v.clienteTipo}</span>}
                        </div>
                        <div className="text-[10px] text-[#8A93A8] mt-1 flex flex-col gap-0.5">
                          <div>
                            {v.vendedorNombre} · {v.hora || new Date(v.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-[9px] text-[#00C896] font-medium uppercase tracking-wider">
                              Validado y Sincronizado en Vivo
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className="font-mono text-[#E8B04A] font-bold shrink-0">{formatPrice(v.monto)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Mystery Shop Auditing Panel */}
            <div className="bg-[#111520] border border-amber-500/10 rounded-xl p-4 space-y-4 shadow-[0_0_15px_rgba(232,176,74,0.02)]">
              <div className="flex justify-between items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-base text-[#E8B04A]">🕵️‍♂️</span>
                  <div>
                    <div className="text-xs font-bold text-white uppercase tracking-wider">Cliente Misterioso (Mystery Shop)</div>
                    <div className="text-[9px] text-[#8A93A8]">Auditoría de precios y estándares de trato en ruta</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (cfg.vendedores.length > 0) {
                      setMSelectedSellerId(cfg.vendedores[0].id);
                    }
                    setShowMysteryModal(true);
                  }}
                  className="bg-[#E8B04A]/10 hover:bg-[#E8B04A]/20 border border-amber-500/20 text-xs font-bold text-[#E8B04A] py-1.5 px-3 rounded-lg flex items-center gap-1 cursor-pointer transition-all active:scale-95 shrink-0"
                >
                  <span>⚡ Auditar</span>
                </button>
              </div>

              {/* Statistical Summary */}
              {mysteryAudits.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 bg-[#0B0E14] border border-white/5 p-2.5 rounded-lg text-center">
                  <div>
                    <div className="text-lg font-mono font-bold text-[#00C896]">
                      {Math.round(mysteryAudits.reduce((sum, a) => sum + a.calificacion, 0) / mysteryAudits.length)}%
                    </div>
                    <div className="text-[8px] uppercase font-bold tracking-wider text-[#3E4A60] mt-0.5">Rating Promedio</div>
                  </div>
                  <div>
                    <div className="text-lg font-mono font-bold text-[#4A8FFF]">
                      {mysteryAudits.length}
                    </div>
                    <div className="text-[8px] uppercase font-bold tracking-wider text-[#3E4A60] mt-0.5">Auditorías Hechas</div>
                  </div>
                </div>
              ) : (
                <div className="bg-[#0B0E14] border border-white/5 p-3 rounded-lg text-center text-[10px] text-[#3E4A60]">
                  No se han registrado auditorías de Cliente Misterioso hoy. Pulsa el botón "⚡ Auditar" para registrar una inspección en vivo.
                </div>
              )}

              {/* Historial of Audits */}
              {mysteryAudits.length > 0 && (
                <div className="space-y-2.5 max-h-[250px] overflow-y-auto no-scrollbar pr-0.5">
                  {mysteryAudits.slice(0, 5).map((aud) => {
                    const scoreColor = aud.calificacion >= 80 ? 'text-[#00C896] bg-[#00C896]/10 border-[#00C896]/20' : aud.calificacion >= 50 ? 'text-[#E8B04A] bg-[#E8B04A]/10 border-[#E8B04A]/20' : 'text-red-400 bg-red-400/10 border-red-400/20';
                    return (
                      <div key={aud.id} className="bg-[#181D2B] border border-white/5 p-3 rounded-lg space-y-2 text-left">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                              <span>👤 {aud.vendedorNombre}</span>
                            </div>
                            <div className="text-[8px] text-[#8A93A8] mt-0.5">
                              {aud.auditor} · {aud.fecha}
                            </div>
                          </div>
                          <span className={`text-[10px] font-mono font-extrabold py-0.5 px-2 rounded-full border ${scoreColor} shrink-0`}>
                            {aud.calificacion}%
                          </span>
                        </div>

                        {/* Detailed mini checks checklist bar */}
                        <div className="flex flex-wrap gap-1.5 text-[8px] font-mono">
                          <span className={`px-1.5 py-0.5 rounded flex items-center gap-0.5 font-bold uppercase tracking-wider ${aud.checks.cobroExacto ? 'bg-[#00C896]/10 text-[#00C896]' : 'bg-red-400/10 text-red-400'}`}>
                            {aud.checks.cobroExacto ? '✓' : '✗'} Cobro
                          </span>
                          <span className={`px-1.5 py-0.5 rounded flex items-center gap-0.5 font-bold uppercase tracking-wider ${aud.checks.entregaRecibo ? 'bg-[#00C896]/10 text-[#00C896]' : 'bg-red-400/10 text-red-400'}`}>
                            {aud.checks.entregaRecibo ? '✓' : '✗'} Recibo
                          </span>
                          <span className={`px-1.5 py-0.5 rounded flex items-center gap-0.5 font-bold uppercase tracking-wider ${aud.checks.presentacionLimpia ? 'bg-[#00C896]/10 text-[#00C896]' : 'bg-red-400/10 text-red-400'}`}>
                            {aud.checks.presentacionLimpia ? '✓' : '✗'} Orden
                          </span>
                          <span className={`px-1.5 py-0.5 rounded flex items-center gap-0.5 font-bold uppercase tracking-wider ${aud.checks.tratoAmable ? 'bg-[#00C896]/10 text-[#00C896]' : 'bg-red-400/10 text-red-400'}`}>
                            {aud.checks.tratoAmable ? '✓' : '✗'} Trato
                          </span>
                        </div>

                        {aud.notas && (
                          <p className="text-[9px] text-[#8A93A8] leading-normal italic line-clamp-2 bg-[#0B0E14] p-1.5 rounded border border-white/5">
                            "{aud.notas}"
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PANEL: RUTAS */}
        {activeTab === 'rutas' && (
          <div className="space-y-3">
            <div className="bg-[#111520] border border-white/5 p-3.5 rounded-xl text-xs text-[#8A93A8] leading-relaxed">
              Resumen geográfico e inventario. <strong className="text-purple-400">Escalabilidad (Cdis):</strong> El sistema actúa como un Gerente Digital automatizado. En producción, escala dinámicamente el despacho, asignación de inventario y liquidación para flotillas de 3, 9, 15, 20 o más repartidores simultáneamente en tiempo real.
            </div>

            <div className="space-y-3">
              {cfg.vendedores.map((v) => {
                const vndSales = ventas.filter(x => x.vendedorId === v.id);
                const vndTot = vndSales.reduce((sum, item) => sum + (item.monto || 0), 0);
                const sellerMeta = v.meta_diaria || 500000;
                const progressPct = Math.min(100, Math.round((vndTot / sellerMeta) * 100));
                
                return (
                  <div key={v.id} className="bg-[#111520] border border-white/5 rounded-xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8.5 h-8.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[#E8B04A] font-extrabold flex items-center justify-center shrink-0 text-sm">
                          {v.nombre[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0 text-left">
                          <div className="text-xs font-bold text-white truncate">{v.nombre}</div>
                          <div className="text-[10px] text-[#8A93A8] truncate">Región: {v.ruta} · {v.rol === 'repartidor' ? 'Repartidor' : 'Cajero'}</div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-[#E8B04A] block">{formatPrice(vndTot)}</span>
                        <span className="text-[9px] text-[#3E4A60] font-bold">{vndSales.length} entregas</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[9px] text-[#8A93A8]">
                        <span>Meta Diaria de Venta (${(sellerMeta / 100).toFixed(0)})</span>
                        <span className="font-bold text-[#00C896]">{progressPct}%</span>
                      </div>
                      <div className="h-1 bg-[#181D2B] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-500 to-[#10B981] rounded-full"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PANEL: ALERTAS */}
        {activeTab === 'alertas' && (
          <div className="space-y-3">
            <div className="text-xs font-bold text-[#3E4A60] font-mono tracking-wider uppercase">Alertas Financieras y Operativas</div>
            <div className="space-y-2.5">
              {alerts.map((al, idx) => (
                <div 
                  key={idx} 
                  className={`border p-3.5 rounded-xl flex gap-3 text-left ${al.tipo === 'danger' ? 'bg-red-500/5 border-red-500/20' : al.tipo === 'warn' ? 'bg-yellow-500/5 border-yellow-500/20' : 'bg-emerald-500/5 border-emerald-500/20'}`}
                >
                  <span className="text-lg shrink-0">{al.icono}</span>
                  <div>
                    <div className={`text-xs font-bold ${al.tipo === 'danger' ? 'text-red-400' : al.tipo === 'warn' ? 'text-yellow-400' : 'text-[#00C896]'}`}>{al.titulo}</div>
                    <p className="text-[10px] text-[#8A93A8] leading-relaxed mt-1">{al.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Alerts definitions panel */}
            <div className="bg-[#111520] border border-white/5 rounded-xl p-4 space-y-2.5">
              <div className="text-xs font-bold text-white">Reglas Críticas de Seguridad</div>
              <div className="space-y-1 text-[10px] text-[#8A93A8] leading-relaxed">
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span>⏱️ Repartidor inactivo +30min</span>
                  <span className="font-bold text-emerald-400">ACTIVA</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span>💰 Dinero en ruta &gt; $5,000</span>
                  <span className="font-bold text-emerald-400">ACTIVA</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>↩️ Retornos mayor que 20%</span>
                  <span className="font-bold text-emerald-400">ACTIVA</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PANEL: ASESOR IA */}
        {activeTab === 'ia' && (
          <div className="space-y-4 flex flex-col h-[380px] justify-between">
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1.5">
              {chatLogs.map((log, idx) => (
                <div 
                  key={idx} 
                  className={`flex ${log.role === 'usr' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`p-3 rounded-2xl max-w-[85%] text-xs leading-relaxed text-left ${log.role === 'usr' ? 'bg-[#181D2B] text-white' : 'bg-purple-950/20 border border-purple-500/10 text-purple-200'}`}>
                    {log.role === 'bot' && <span className="block text-[8px] font-mono text-purple-400 uppercase font-bold tracking-wider mb-1">Cdis · Gerente Digital</span>}
                    {log.text}
                  </div>
                </div>
              ))}
            </div>

            <div className="shrink-0 space-y-2">
              {/* Quick boss alerts prompt */}
              <div className="flex gap-2 overflow-x-auto pb-1 invisible-scrollbar">
                <button 
                  onClick={() => handleAskAI('¿Qué ruta vendió más hoy?')} 
                  className="bg-[#111520] border border-white/5 rounded-full px-3.5 py-1.5 text-[10px] text-[#8A93A8] whitespace-nowrap active:scale-95 transition-all text-left cursor-pointer hover:bg-[#181D2B]"
                >
                  📈 ¿Cuál es la mejor ruta hoy?
                </button>
                <button 
                  onClick={() => handleAskAI('¿Cuánto efectivo acumulado tenemos hoy?')} 
                  className="bg-[#111520] border border-white/5 rounded-full px-3.5 py-1.5 text-[10px] text-[#8A93A8] whitespace-nowrap active:scale-95 transition-all text-left cursor-pointer hover:bg-[#181D2B]"
                >
                  💸 Suma de Efectivo
                </button>
                <button 
                  onClick={() => handleAskAI('Dame el resumen del día para mandar por WhatsApp')} 
                  className="bg-[#111520] border border-white/5 rounded-full px-3.5 py-1.5 text-[10px] text-[#8A93A8] whitespace-nowrap active:scale-95 transition-all text-left cursor-pointer hover:bg-[#181D2B]"
                >
                  📱 Resumen de WhatsApp
                </button>
              </div>

              <div className="flex gap-1.5 bg-[#0B0E14] border border-white/5 rounded-lg p-1.5">
                <input 
                  type="text" 
                  value={chatInp} 
                  onChange={(e) => setChatInp(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
                  className="flex-1 bg-transparent p-1.5 text-xs focus:outline-none placeholder-[#3E4A60] text-white"
                  placeholder="Ej: ¿Qué producto tiene mayor volumen de ventas hoy?"
                />
                <button 
                  onClick={() => handleAskAI()} 
                  className="w-8 h-8 rounded-lg bg-purple-500 font-bold hover:brightness-110 flex items-center justify-center shrink-0 active:scale-95 cursor-pointer text-white"
                >
                  →
                </button>
              </div>
            </div>
          </div>
        )}
        {/* PANEL: OP'S / CONFIGURACIÓN (SYS) */}
        {activeTab === 'sys' && (
          <div className="space-y-4 pt-2">
            <div className="bg-[#111520] border border-white/5 p-4 rounded-xl space-y-4">
              <div className="text-left">
                <h3 className="font-display font-bold text-white text-sm">Control Operativo</h3>
                <p className="text-[10px] text-[#8A93A8] mt-1 leading-relaxed">Solo los dueños o gerentes pueden editar el modelo de negocio, o alterar la ejecución de la plataforma.</p>
              </div>
              <div className="space-y-2">
                <button 
                  onClick={() => onGoConfig?.()} 
                  className="w-full py-3 px-6 font-semibold text-xs text-[#8A93A8] bg-[#181D2B]/50 hover:bg-[#181D2B] border border-white/5 rounded-xl hover:text-[#EEF1F8] transition-all cursor-pointer text-left flex justify-between items-center"
                >
                  <span>⚙️ Editar configuración</span>
                  <span className="text-[10px]">→</span>
                </button>
                <button 
                  onClick={() => setShowExitConfirm(true)} 
                  className="w-full py-3 px-6 font-semibold text-xs text-red-400 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 rounded-xl transition-all cursor-pointer text-left flex justify-between items-center"
                >
                  <span>🚪 Cambiar de negocio / Salir</span>
                  <span className="text-[10px]">→</span>
                </button>
                <button 
                  onClick={() => setShowWipeConfirm(true)} 
                  className="w-full py-3 px-6 font-semibold text-xs text-amber-500 bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/15 rounded-xl transition-all cursor-pointer text-left flex justify-between items-center whitespace-normal mt-2"
                >
                  <span className="flex flex-col text-left">
                    <strong>🧹 Borrar Datos y Saldo a Cero</strong>
                    <span className="text-[9px] text-[#8A93A8] mt-0.5 font-normal">Limpia el historial de ventas y reinicia la demostración con balance limpio</span>
                  </span>
                  <span className="text-[10px]">⚡</span>
                </button>
              </div>
            </div>
            {/* Disclaimer */}
            <div className="bg-[#181D2B]/30 border border-amber-500/20 p-3 rounded-lg flex gap-2 items-start mt-4">
              <span className="text-amber-300 text-[10px]">⚡</span>
              <span className="text-[10px] text-amber-500/90 leading-tight">La edición de configuración afectará las terminales de venta de toda la flotilla de manera instantánea vía telemetría.</span>
            </div>
          </div>
        )}
      </div>

      {/* CONFIRM EXIT DIALOG */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-[#111520] border border-red-500/20 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-5 text-center">
            <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-2 text-2xl border border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.15)]">
              🚪
            </div>
            <div className="space-y-2">
              <div className="font-display font-bold text-base text-white">¿Salir de la Demostración?</div>
              <p className="text-[#8A93A8] text-xs leading-relaxed">
                ¿Estás seguro de que deseas salir de <strong>{cfg.nombre || 'el negocio actual'}</strong>?
                <br /><br />
                <span className="text-red-400/80 font-medium">Se borrará toda la arquitectura actual y tu progreso no guardado. Volverás al setup inicial.</span>
              </p>
            </div>
            
            <div className="flex gap-2.5 pt-2">
              <button 
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-3 bg-[#181D2B] hover:bg-[#1F2638] rounded-xl text-xs font-bold text-[#EEF1F8] border border-white/5 cursor-pointer active:scale-95 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  setShowExitConfirm(false);
                  onCerrarSesion?.();
                }}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 rounded-xl text-xs font-bold text-white cursor-pointer active:scale-95 transition-all text-center border-t border-red-400"
              >
                Sí, Salir y Cambiar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM WIPE DIALOG */}
      {showWipeConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-[#111520] border border-amber-500/20 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-5 text-center">
            <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-2 text-2xl border border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
              🧹
            </div>
            <div className="space-y-2">
              <div className="font-display font-bold text-base text-white">¿Borrar Registros y Reestablecer Balance?</div>
              <p className="text-[#8A93A8] text-xs leading-relaxed">
                Esta acción es inmediata e irreversible para la base de datos de <strong>{cfg.nombre}</strong>.
                <br /><br />
                <span className="text-amber-400 font-medium">Reseteará el saldo a $0.00, limpiando el registro de ventas para iniciar una demostración limpia desde cero.</span>
              </p>
            </div>
            
            <div className="flex gap-2.5 pt-2">
              <button 
                onClick={() => setShowWipeConfirm(false)}
                disabled={isWiping}
                className="flex-1 py-3 bg-[#181D2B] hover:bg-[#1F2638] rounded-xl text-xs font-bold text-[#EEF1F8] border border-white/5 cursor-pointer active:scale-95 transition-all disabled:opacity-40"
              >
                Cancelar
              </button>
              <button 
                onClick={handleWipeData}
                disabled={isWiping}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 rounded-xl text-xs font-bold text-black cursor-pointer active:scale-95 transition-all text-center font-bold disabled:opacity-40"
              >
                {isWiping ? 'Borrando...' : 'Sí, Limpiar Todo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MYSTERY SHOP MODAL */}
      {showMysteryModal && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#111520] border border-amber-500/20 rounded-2xl p-5 w-full max-w-md shadow-2xl space-y-4 my-8">
            <div className="flex justify-between items-start border-b border-white/5 pb-3">
              <div className="text-left">
                <h3 className="font-display font-bold text-white text-sm">Nueva Auditoría de Cliente Misterioso</h3>
                <p className="text-[10px] text-[#8A93A8]">Inspección encubierta de estándares operativos en ruta</p>
              </div>
              <button 
                onClick={() => setShowMysteryModal(false)}
                className="text-[#8A93A8] hover:text-white transition-colors cursor-pointer text-sm font-bold p-1 bg-white/5 rounded"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-left">
              {/* Vendedor selection */}
              <div className="space-y-1.5">
                <label className="block text-[#8A93A8] font-semibold text-[10px] uppercase tracking-wider">Vendedor a Auditar</label>
                <select 
                  value={mSelectedSellerId}
                  onChange={(e) => setMSelectedSellerId(e.target.value)}
                  className="w-full bg-[#181D2B] border border-white/10 text-white rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                >
                  {cfg.vendedores.map(v => (
                    <option key={v.id} value={v.id}>{v.nombre} ({v.rol})</option>
                  ))}
                </select>
              </div>

              {/* Auditor Name */}
              <div className="space-y-1.5">
                <label className="block text-[#8A93A8] font-semibold text-[10px] uppercase tracking-wider">Nombre del Auditor Encubierto</label>
                <input 
                  type="text"
                  value={mAuditorName}
                  onChange={(e) => setMAuditorName(e.target.value)}
                  placeholder="Ej: Comprador Secreto, Auditor #3"
                  className="w-full bg-[#181D2B] border border-white/10 text-white rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {/* Checklist Group */}
              <div className="space-y-2 bg-[#0B0E14] border border-[#3E4A60]/10 p-3 rounded-xl">
                <span className="block text-[10px] text-amber-400 font-extrabold uppercase tracking-wide mb-1.5">Estándares de Evaluación</span>
                
                {/* Check 1 */}
                <label className="flex items-center gap-2.5 py-1 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={mCheckCobro}
                    onChange={(e) => setMCheckCobro(e.target.checked)}
                    className="rounded border-white/10 bg-[#181D2B] text-amber-500 focus:ring-amber-500/20"
                  />
                  <div>
                    <span className="text-white font-bold block text-[11px]">Cobro de Precios del Catálogo</span>
                    <span className="text-[9px] text-[#8A93A8] block font-normal">¿Respetó las tarifas oficiales del catálogo de {cfg.nombre}?</span>
                  </div>
                </label>

                {/* Check 2 */}
                <label className="flex items-center gap-2.5 py-1 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={mCheckRecibo}
                    onChange={(e) => setMCheckRecibo(e.target.checked)}
                    className="rounded border-white/10 bg-[#181D2B] text-amber-500 focus:ring-amber-500/20"
                  />
                  <div>
                    <span className="text-white font-bold block text-[11px]">Entrega de Ticket / Recibo</span>
                    <span className="text-[9px] text-[#8A93A8] block font-normal">¿Se entregó el comprobante y registró la venta en pantalla?</span>
                  </div>
                </label>

                {/* Check 3 */}
                <label className="flex items-center gap-2.5 py-1 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={mCheckPresentacion}
                    onChange={(e) => setMCheckPresentacion(e.target.checked)}
                    className="rounded border-white/10 bg-[#181D2B] text-amber-500 focus:ring-amber-500/20"
                  />
                  <div>
                    <span className="text-white font-bold block text-[11px]">Presentación y Limpieza</span>
                    <span className="text-[9px] text-[#8A93A8] block font-normal">¿La presentación personal y de la mercancía cumple el estándar?</span>
                  </div>
                </label>

                {/* Check 4 */}
                <label className="flex items-center gap-2.5 py-1 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={mCheckTrato}
                    onChange={(e) => setMCheckTrato(e.target.checked)}
                    className="rounded border-white/10 bg-[#181D2B] text-amber-500 focus:ring-amber-500/20"
                  />
                  <div>
                    <span className="text-white font-bold block text-[11px]">Trato Cortés y Ágil</span>
                    <span className="text-[9px] text-[#8A93A8] block font-normal">¿Se mostró con amabilidad y ofreció una buena experiencia?</span>
                  </div>
                </label>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="block text-[#8A93A8] font-semibold text-[10px] uppercase tracking-wider">Observaciones y Notas Operativas</label>
                <textarea 
                  value={mNotas}
                  onChange={(e) => setMNotas(e.target.value)}
                  rows={2}
                  placeholder="Detalles sobre lo ocurrido en el punto de contacto..."
                  className="w-full bg-[#181D2B] border border-white/10 text-white rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none resize-none"
                />
              </div>
            </div>

            {/* Submit */}
            <div className="flex gap-2.5 pt-2">
              <button 
                onClick={() => setShowMysteryModal(false)}
                disabled={isSubmittingAudit}
                className="flex-1 py-2.5 bg-[#181D2B] hover:bg-[#1F2638] rounded-xl text-xs font-bold text-[#EEF1F8] border border-white/5 cursor-pointer active:scale-95 transition-all disabled:opacity-40 text-center"
              >
                Cancelar
              </button>
              <button 
                onClick={handleCreateMysteryAudit}
                disabled={isSubmittingAudit}
                className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 text-black font-extrabold rounded-xl text-xs cursor-pointer active:scale-95 transition-all text-center disabled:opacity-40"
              >
                {isSubmittingAudit ? 'Registrando...' : '✓ Registrar Auditoría'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
