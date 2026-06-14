import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, doc, setDoc, addDoc, query, where, getDocs } from 'firebase/firestore';
import { Product, Seller, AppConfig, Devolucion, Client } from '../types';
import { validateSale } from '../utils/syncEngine';

interface ClientSaleRecord {
  id: string;
  nombre: string;
  tipoNegocio?: string;
  productos: { id: string; nombre: string; pr: number; icono: string; q: number }[];
  tipoCobro: 'efectivo' | 'credito';
  total: number;
  hora: string;
  timestamp: number;
}

interface RepartidorScreenProps {
  cfg: AppConfig;
  onGoBack: () => void;
  triggerToast: (msg: string, type?: 'ok' | 'err') => void;
  isWorkerMode?: boolean;
  ownerUid: string;
}

export const RepartidorScreen: React.FC<RepartidorScreenProps> = ({ cfg, onGoBack, triggerToast, isWorkerMode, ownerUid }) => {
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [activeTab, setActiveTab] = useState<'ped' | 'cli' | 'cierr' | 'ia'>('ped');
  const [horaIni, setHoraIni] = useState<Date | null>(null);

  // Operational states
  const [cliHoy, setCliHoy] = useState<ClientSaleRecord[]>([]);
  const [cartRep, setCartRep] = useState<{ id: string; nombre: string; pr: number; icono: string; q: number }[]>([]); // { id, nombre, pr, icono, q }
  const [tipoRep, setTipoRep] = useState<'efectivo' | 'credito'>('efectivo');

  // Devoluciones / Mermas states
  const [devoluciones, setDevoluciones] = useState<Devolucion[]>([]);
  const [showDevolModal, setShowDevolModal] = useState(false);
  const [devolClienteName, setDevolClienteName] = useState('');
  const [selectedDevolProdId, setSelectedDevolProdId] = useState('');
  const [devolCant, setDevolCant] = useState<number>(1);
  
  // New Client Modal state
  const [showCliModal, setShowCliModal] = useState(false);
  const [newCliName, setNewCliName] = useState('');
  const [newCliType, setNewCliType] = useState('Abarrotes');
  const [newCliAddress, setNewCliAddress] = useState('');
  const [newCliPhone, setNewCliPhone] = useState('');
  const [selectedPresetClientId, setSelectedPresetClientId] = useState<string>('new');
  const [misClientes, setMisClientes] = useState<Client[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(false);

  // Route AI Chat state
  const [chatInp, setChatInp] = useState('');
  const [chatLogs, setChatLogs] = useState<{ role: 'bot' | 'usr'; text: string }[]>([
    { role: 'bot', text: '¡Hola! Soy tu asistente de ruta. Puedo predecir las ventas del día, analizar tus metas de cobro o darte consejos para reducir devoluciones hoy. ¿En qué te ayudo?' }
  ]);
  const [chatLoading, setChatLoading] = useState(false);

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const handleSelectSeller = (vnd: Seller) => {
    setSelectedSeller(vnd);
    setHoraIni(new Date());
    setCartRep([]);
    setTipoRep('efectivo');
    setActiveTab('ped');
    setSelectedPresetClientId('new');
    setNewCliName('');
    setNewCliType('Abarrotes');
    setNewCliAddress('');
    setNewCliPhone('');

    // Fetch clients for this seller
    setLoadingClientes(true);
    const qClients = query(collection(db, 'negocios', ownerUid, 'clientes'), where('vendedorId', '==', vnd.id));
    getDocs(qClients)
      .then((snap) => {
        const loaded: Client[] = [];
        snap.forEach((docSnap) => {
          loaded.push({ id: docSnap.id, ...docSnap.data() } as Client);
        });
        setMisClientes(loaded);
      })
      .catch((err) => {
        console.warn('Error loading clients from Firestore:', err);
      })
      .finally(() => {
        setLoadingClientes(false);
      });

    // 1. Reconstruct today's shift clients/sales from local rp_ventas to prevent data loss in offline mode
    const localSales = JSON.parse(localStorage.getItem('rp_ventas') || '[]');
    const activeSales = localSales.filter((s: any) => s.vendedorId === vnd.id);
    const mappedCliHoy: ClientSaleRecord[] = activeSales.map((s: any) => ({
      id: s.id,
      nombre: s.clienteNombre || 'Cliente',
      tipoNegocio: s.clienteTipo || 'Abarrotes',
      productos: (s.items || []).map((it: any) => ({
        id: it.id,
        nombre: it.nombre,
        pr: it.pr,
        icono: it.ic || '📦',
        q: it.q
      })),
      tipoCobro: s.tipoCobro === 'crédito' ? 'credito' : 'efectivo',
      total: s.monto || 0,
      hora: s.hora || new Date(s.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      timestamp: s.timestamp || Date.now()
    }));
    setCliHoy(mappedCliHoy);

    // 2. Load local mermas/devoluciones for this seller
    const localDevs = JSON.parse(localStorage.getItem('rp_devoluciones') || '[]');
    const activeDevs = (localDevs as Devolucion[]).filter((d: Devolucion) => d.vendedorId === vnd.id);
    setDevoluciones(activeDevs);

    triggerToast(`Ruta iniciada para ${vnd.nombre}`);
  };

  const handleRegDevol = async () => {
    if (!devolClienteName.trim()) {
      triggerToast('Escribe el nombre del cliente', 'err');
      return;
    }
    if (!selectedDevolProdId) {
      triggerToast('Selecciona un producto', 'err');
      return;
    }
    const cantVal = parseFloat(String(devolCant));
    if (isNaN(cantVal) || cantVal <= 0) {
      triggerToast('La cantidad debe ser mayor a 0', 'err');
      return;
    }

    const prod = cfg.productos.find(p => p.id === selectedDevolProdId);
    if (!prod) return;

    const devolId = 'D' + Date.now();

    const newDevol: Devolucion = {
      id: devolId,
      vendedorId: selectedSeller!.id,
      vendedorNombre: selectedSeller!.nombre,
      clienteId: 'C_ROUTE_' + Date.now(),
      clienteNombre: devolClienteName.trim(),
      productoId: prod.id,
      productoNombre: prod.nombre,
      cantidad: cantVal,
      timestamp: Date.now()
    };

    // 1. Guardar de forma local e inmediata para garantizar resiliencia OFFLINE completa
    try {
      // Save locally to local devoluciones list in localStorage
      const prevLocal = JSON.parse(localStorage.getItem('rp_devoluciones') || '[]');
      prevLocal.push(newDevol);
      localStorage.setItem('rp_devoluciones', JSON.stringify(prevLocal));

      // Append state to update immediate UI shift statistics
      setDevoluciones([...devoluciones, newDevol]);

      setDevolClienteName('');
      setSelectedDevolProdId('');
      setDevolCant(1);
      setShowDevolModal(false);
      triggerToast(`✓ Merma registrada: ${newDevol.cantidad} ${prod.unidad} de ${prod.nombre}`);
    } catch (e) {
      console.error('Error al guardar localmente la devolución:', e);
      triggerToast('Error con almacenamiento de merma local', 'err');
    }

    // 2. Sincronización en segundo plano con la nube sin bloquear el flujo real del repartidor
    setDoc(doc(db, 'negocios', ownerUid, 'devoluciones', devolId), newDevol)
      .then(() => {
        console.log(`✓ Merma ${devolId} sincronizada exitosamente con la nube.`);
      })
      .catch((err) => {
        console.warn(`Firestore backup stalled or offline for devoluciones/${devolId}:`, err);
        // No lanzamos error ni bloqueamos al repartidor. El cache offline de Firestore lo subirá cuando vuelva la señal.
      });
  };

  const handleAddCartRep = (prod: Product) => {
    const existing = cartRep.find(x => x.id === prod.id);
    if (existing) {
      setCartRep(cartRep.map(x => x.id === prod.id ? { ...x, q: x.q + 1 } : x));
    } else {
      setCartRep([...cartRep, { id: prod.id, nombre: prod.nombre, pr: prod.precio, icono: prod.icono || '📦', q: 1 }]);
    }
    triggerToast(`✓ ${prod.nombre} agregado`);
  };

  const handleRemoveCartRep = (index: number) => {
    const updated = [...cartRep];
    updated[index].q -= 1;
    if (updated[index].q <= 0) {
      updated.splice(index, 1);
    }
    setCartRep(updated);
  };

  const handlePresetClientChange = (clientId: string) => {
    setSelectedPresetClientId(clientId);
    if (clientId === 'new') {
      setNewCliName('');
      setNewCliType('Abarrotes');
      setNewCliAddress('');
      setNewCliPhone('');
    } else {
      const match = misClientes.find(c => c.id === clientId);
      if (match) {
        setNewCliName(match.nombre);
        setNewCliType(match.tipo || 'Abarrotes');
        setNewCliAddress(match.direccion || '');
        setNewCliPhone(match.telefono || '');
      }
    }
  };

  const handleRegCli = async () => {
    if (!newCliName.trim()) {
      triggerToast('Escribe el nombre del cliente', 'err');
      return;
    }
    if (cartRep.length === 0) {
      triggerToast('Agrega al menos un producto al pedido', 'err');
      return;
    }

    const tot = cartRep.reduce((sum, item) => sum + (item.pr * item.q), 0);
    const saleId = 'S' + Date.now();
    const nowStr = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

    let finalClientId = 'C_NEW_' + Date.now();
    let finalClientLat = 19.4326;
    let finalClientLng = -99.1332;

    if (selectedPresetClientId !== 'new') {
      const existingClient = misClientes.find(c => c.id === selectedPresetClientId);
      if (existingClient) {
        finalClientId = existingClient.id;
        finalClientLat = existingClient.latitude || 19.4326;
        finalClientLng = existingClient.longitude || -99.1332;
      }
    } else {
      // Create new client in their master route collection
      const seed = Date.now();
      const baseLat = 19.4326 + (seed % 100) * 0.0001;
      const baseLng = -99.1332 - (seed % 100) * 0.0001;
      finalClientLat = baseLat;
      finalClientLng = baseLng;

      if (navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000, maximumAge: 60000 });
          });
          finalClientLat = pos.coords.latitude;
          finalClientLng = pos.coords.longitude;
        } catch (geoErr) {
          console.warn('Geolocation mapping fallback engaged:', geoErr);
        }
      }

      const newClientDoc: Client = {
        id: finalClientId,
        nombre: newCliName.trim(),
        tipo: newCliType,
        vendedorId: selectedSeller!.id,
        vendedorNombre: selectedSeller!.nombre,
        latitude: finalClientLat,
        longitude: finalClientLng,
        direccion: newCliAddress.trim() || 'Dirección de Ruta',
        telefono: newCliPhone.trim() || 'Sin teléfono',
        timestamp: Date.now()
      };

      setMisClientes(prev => [newClientDoc, ...prev]);

      setDoc(doc(db, 'negocios', ownerUid, 'clientes', finalClientId), newClientDoc)
        .then(() => {
          console.log(`✓ Master Client ${finalClientId} registered on cloud route database.`);
        })
        .catch(err => {
          console.warn('Client registration background sync stalled:', err);
        });
    }

    const newCliRecord = {
      id: saleId,
      nombre: newCliName.trim(),
      tipoNegocio: newCliType,
      productos: [...cartRep],
      type: newCliType,
      tipoCobro: tipoRep,
      total: tot,
      hora: nowStr,
      timestamp: Date.now()
    };

    const ventaDocData = {
      id: saleId,
      vendedorId: selectedSeller!.id,
      vendedorNombre: selectedSeller!.nombre,
      clienteId: finalClientId,
      clienteNombre: newCliName.trim(),
      clienteTipo: newCliType,
      monto: tot,
      tipoCobro: (tipoRep === 'efectivo' ? 'efectivo' : 'crédito') as 'efectivo' | 'crédito',
      items: cartRep.map(item => ({
        id: item.id,
        nombre: item.nombre,
        q: item.q,
        pr: item.pr,
        ic: item.icono
      })),
      lat: finalClientLat,
      lng: finalClientLng,
      timestamp: Date.now(),
      validado: true,
      sincronizado: false
    };

    const validationResult = validateSale(ventaDocData);
    if (!validationResult.isValid) {
      triggerToast(`Fallo de Validación: ${validationResult.reason}`, 'err');
      return;
    }
    
    try {
      const prevLocal = JSON.parse(localStorage.getItem('rp_ventas') || '[]');
      prevLocal.push({
        ...ventaDocData,
        prod_resumen: cartRep.map(x => (x.icono || '📦') + x.nombre).slice(0, 2).join(', '),
        ts: Date.now(),
        hora: nowStr
      });
      localStorage.setItem('rp_ventas', JSON.stringify(prevLocal));

      setCliHoy([...cliHoy, newCliRecord]);
      setCartRep([]);
      setNewCliName('');
      setNewCliType('Abarrotes');
      setNewCliAddress('');
      setNewCliPhone('');
      setSelectedPresetClientId('new');
      setTipoRep('efectivo');
      setShowCliModal(false);
      triggerToast(`✓ Cliente registrado · ${formatPrice(tot)}`);
    } catch (e) {
      console.error('Error al guardar localmente de ruta:', e);
      triggerToast('Error con almacenamiento de ruta local', 'err');
    }

    const cleanDbData = {
      id: ventaDocData.id,
      vendedorId: ventaDocData.vendedorId,
      vendedorNombre: ventaDocData.vendedorNombre,
      clienteId: ventaDocData.clienteId,
      clienteNombre: ventaDocData.clienteNombre,
      clienteTipo: ventaDocData.clienteTipo,
      monto: ventaDocData.monto,
      tipoCobro: ventaDocData.tipoCobro,
      items: ventaDocData.items,
      timestamp: ventaDocData.timestamp,
      validado: true
    };

    setDoc(doc(db, 'negocios', ownerUid, 'ventas', saleId), cleanDbData)
      .then(() => {
        console.log(`✓ Venta de ruta ${saleId} sincronizada with cloud.`);
        try {
          const currentLocal = JSON.parse(localStorage.getItem('rp_ventas') || '[]');
          const idx = currentLocal.findIndex((x: any) => x.id === saleId);
          if (idx !== -1) {
            currentLocal[idx].sincronizado = true;
            localStorage.setItem('rp_ventas', JSON.stringify(currentLocal));
          }
        } catch (storageErr) {
          console.warn('Could not update sync flag in local cache:', storageErr);
        }
      })
      .catch((err) => {
        console.warn(`Firestore backup stalled or offline for ventas/${saleId}:`, err);
      });
  };

  const handleTerminarRuta = () => {
    setActiveTab('cierr');
    triggerToast('✓ Resumen de cierre generado');
  };

  const handleNuevaRuta = () => {
    setSelectedSeller(null);
    setHoraIni(null);
    setCliHoy([]);
    setCartRep([]);
  };

  const handleWhatsAppReport = () => {
    const tot = cliHoy.reduce((sum, c) => sum + c.total, 0);
    const msg = `*Reporte de Ruta — ${cfg.nombre}*\nVendedor: *${selectedSeller?.nombre}*\nClientes Atendidos: *${cliHoy.length}*\nCobrado en Ruta: *${formatPrice(tot)}*\nFecha: ${new Date().toLocaleDateString('es-MX')}\nApp: RoutePro Elite`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleAskAI = async (textOver?: string) => {
    const qStr = textOver || chatInp.trim();
    if (!qStr) return;
    if (!textOver) setChatInp('');

    const newLogs = [...chatLogs, { role: 'usr', text: qStr }];
    setChatLogs([...newLogs, { role: 'bot', text: '⏳ Generando sugerencia de ruta...' }]);
    setChatLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: qStr,
          config_negocio: cfg,
          ventas: cliHoy.map((c: ClientSaleRecord) => ({
            vendedor_nombre: selectedSeller?.nombre,
            cliente_nombre: c.nombre,
            cliente_tipo: c.tipoNegocio,
            monto: c.total,
            tipo_cobro: c.tipoCobro,
            productos: c.productos,
            hora: c.hora
          })),
          vendedores: [selectedSeller],
          chatHistory: chatLogs.slice(-4)
        })
      });
      const data = await response.json();
      setChatLogs([...newLogs, { role: 'bot', text: data.text || 'Sin respuesta del asesor de ruta.' }]);
    } catch (err) {
      setChatLogs([...newLogs, { role: 'bot', text: 'Asistencia sin conexión activa. Sigue registrando entregas normalmente — tus datos están guardados y se sincronizan cuando recuperes señal.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  const getShiftDuration = () => {
    if (!horaIni) return '0 min';
    const mins = Math.round((Date.now() - horaIni.getTime()) / 60000);
    if (mins >= 60) {
      return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    }
    return `${mins}m`;
  };

  const renderSellerList = () => {
    if (!cfg.vendedores || cfg.vendedores.length === 0) {
      return (
        <div className="text-center py-10 px-6">
          <div className="text-4xl opacity-30 mb-3">🛣</div>
          <div className="text-sm font-bold text-[#8A93A8]">Sin vendedores configurados.</div>
          <p className="text-xs text-[#3E4A60] mt-1">Configura tu personal en el panel de control primero.</p>
        </div>
      );
    }

    return (
      <div className="space-y-2.5">
        {cfg.vendedores.map((v) => (
          <div 
            key={v.id} 
            onClick={() => handleSelectSeller(v)}
            className="bg-[#111520] border border-white/5 rounded-xl p-4.5 cursor-pointer flex items-center justify-between gap-3 hover:bg-[#181D2B] hover:border-amber-500/20 active:scale-97 transition-all text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-display font-extrabold text-[#E8B04A] text-sm shrink-0">
              {v.nombre[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white truncate">{v.nombre}</div>
              <div className="text-[11px] text-[#8A93A8] mt-0.5">{v.ruta}</div>
            </div>
            <div className="text-[#3E4A60] font-bold text-lg">›</div>
          </div>
        ))}
      </div>
    );
  };

  // Main UI
  if (!selectedSeller) {
    return (
      <div className="min-h-screen bg-[#06080C] text-[#EEF1F8] flex flex-col font-sans">
        <div className="sticky top-0 z-50 h-14 bg-[#06080C]/94 backdrop-blur-md border-b border-white/5 px-4.5 flex items-center gap-3">
          {!isWorkerMode && (
            <button onClick={onGoBack} className="w-9 h-9 rounded-lg bg-[#111520] border border-white/5 flex items-center justify-center text-[#8A93A8] hover:text-[#EEF1F8] cursor-pointer">
              ←
            </button>
          )}
          <div className="text-left font-display font-bold text-sm tracking-wide">Iniciar Jornada</div>
        </div>
        <div className="flex-1 p-5 overflow-y-auto">
          <div className="mb-6 text-left">
            <h2 className="font-display text-xl font-extrabold text-white">¿Quién eres?</h2>
            <p className="text-xs text-[#8A93A8] mt-1.5 leading-relaxed">Selecciona tu perfil de repartidor para acceder a tu hoja de pedido, sincronizar cobros y registrar devoluciones territoriales.</p>
          </div>
          {renderSellerList()}
        </div>
      </div>
    );
  }

  const shiftTotal = cliHoy.reduce((sum, c) => sum + c.total, 0);

  return (
    <div className="min-h-screen bg-[#06080C] text-[#EEF1F8] flex flex-col font-sans pb-20 justify-between">
      {/* Driver Header */}
      <div className="sticky top-0 z-40 h-14 bg-[#06080C]/94 backdrop-blur-md border-b border-white/5 px-4.5 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 text-left min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#111520] border flex items-center justify-center font-display font-bold shrink-0 overflow-hidden" style={{ borderColor: `${cfg.color_principal || '#C9912A'}35` }}>
            {cfg.logo_url ? (
              <img src={cfg.logo_url} className="w-full h-full object-contain p-0.5" alt="Logo" referrerPolicy="no-referrer" />
            ) : (
              <span style={{ color: cfg.color_principal || '#C9912A' }} className="text-xs font-extrabold">{cfg.letra}</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate">{selectedSeller.nombre}</div>
            <div className="text-[10px] text-[#8A93A8] truncate">{selectedSeller.ruta}</div>
          </div>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/15 text-[10px] font-bold text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Sincronizado</span>
        </div>
      </div>

      {/* Driver KPIs */}
      <div className="px-4.5 pt-3.5 pb-1 shrink-0 grid grid-cols-3 gap-2">
        <div className="bg-[#111520] border border-white/5 rounded-xl p-2.5 text-center">
          <div className="text-xs font-bold text-emerald-400 tracking-wider">{formatPrice(cliHoy.filter(c => c.tipoCobro === 'efectivo').reduce((s, c) => s + c.total, 0))}</div>
          <div className="text-[9px] text-[#3E4A60] font-semibold uppercase tracking-wider mt-0.5">Efectivo</div>
        </div>
        <div className="bg-[#111520] border border-white/5 rounded-xl p-2.5 text-center">
          <div className="text-xs font-bold text-[#E8B04A] tracking-wider">{formatPrice(cliHoy.filter(c => c.tipoCobro === 'credito').reduce((s, c) => s + c.total, 0))}</div>
          <div className="text-[9px] text-[#3E4A60] font-semibold uppercase tracking-wider mt-0.5">A Crédito</div>
        </div>
        <div className="bg-[#111520] border border-white/5 rounded-xl p-2.5 text-center">
          <div className="text-xs font-bold text-red-400 tracking-wider">{devoluciones.length}</div>
          <div className="text-[9px] text-[#3E4A60] font-semibold uppercase tracking-wider mt-0.5">Mermas</div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-[#0B0E14] border-b border-white/5 flex p-1 mx-4.5 my-3.5 rounded-lg shrink-0">
        <button 
          onClick={() => setActiveTab('ped')} 
          className={`flex-1 py-1 px-2.5 rounded-md text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer ${activeTab === 'ped' ? 'bg-[#181D2B] text-[#E8B04A]' : 'text-[#3E4A60]'}`}
        >
          🛒 Pedidos
        </button>
        <button 
          onClick={() => setActiveTab('cli')} 
          className={`flex-1 py-1 px-2.5 rounded-md text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer ${activeTab === 'cli' ? 'bg-[#181D2B] text-[#E8B04A]' : 'text-[#3E4A60]'}`}
        >
          👥 Clientes
        </button>
        <button 
          onClick={() => setActiveTab('cierr')} 
          className={`flex-1 py-1 px-2.5 rounded-md text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer ${activeTab === 'cierr' ? 'bg-[#181D2B] text-[#E8B04A]' : 'text-[#3E4A60]'}`}
        >
          📋 Cierre
        </button>
        <button 
          onClick={() => setActiveTab('ia')} 
          className={`flex-1 py-1 px-2.5 rounded-md text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer ${activeTab === 'ia' ? 'bg-[#181D2B] text-[#E8B04A]' : 'text-[#3E4A60]'}`}
        >
          💬 Asistente IA
        </button>
      </div>

      {/* Screen body panels */}
      <div className="flex-1 overflow-y-auto px-4.5 text-left">
        {/* PANEL: PEDIDOS */}
        {activeTab === 'ped' && (
          <div className="space-y-4">
            {cliHoy.length === 0 ? (
              <div className="text-center py-7 bg-[#111520]/20 rounded-xl border border-dashed border-white/5">
                <div className="text-3xl opacity-20 mb-1.5">+</div>
                <div className="text-xs text-[#3E4A60]">Toca "+" abajo para registrar la primera entrega de hoy.</div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-[10px] font-mono text-[#3E4A60] uppercase tracking-wider font-bold">Historial de Clientes Visita en Turno</div>
                {cliHoy.map((c, i) => (
                  <div key={i} className="bg-[#111520] border border-white/5 rounded-xl p-3 flex items-center justify-between gap-3">
                    <div className="w-8.5 h-8.5 rounded-lg bg-[#181D2B] border border-amber-500/5 flex items-center justify-center font-display font-extrabold text-xs text-[#E8B04A] shrink-0">
                      {c.nombre[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                        {c.nombre}
                        {c.tipoNegocio && <span className="bg-[#E8B04A]/10 text-[#E8B04A] text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">{c.tipoNegocio}</span>}
                      </div>
                      <div className="text-[10px] text-[#8A93A8] mt-0.5">
                        {c.hora} · {c.tipoCobro === 'efectivo' ? '💵 Efectivo' : '📋 Crédito'}
                      </div>
                    </div>
                    <div className="text-xs font-bold text-[#E8B04A]">
                      {formatPrice(c.total)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => {
                  if (!cfg.productos || cfg.productos.length === 0) {
                    triggerToast('Configura productos en su catálogo de negocio primero', 'err');
                    return;
                  }
                  setShowCliModal(true);
                }}
                className="w-full py-3.5 bg-[#181D2B] hover:bg-[#1F2638] border border-white/5 text-[#8A93A8] hover:text-white rounded-xl text-[11px] font-bold tracking-wide transition-all cursor-pointer text-center"
              >
                + Registrar Entrega
              </button>
              
              <button 
                onClick={() => {
                  if (!cfg.productos || cfg.productos.length === 0) {
                    triggerToast('Configura productos en su catálogo de negocio primero', 'err');
                    return;
                  }
                  setShowDevolModal(true);
                }}
                className="w-full py-3.5 bg-red-950/10 hover:bg-red-950/20 border border-red-900/20 hover:border-red-500/30 text-[#8A93A8] hover:text-red-400 rounded-xl text-[11px] font-bold tracking-wide transition-all cursor-pointer text-center"
              >
                ♻️ Registrar Merma
              </button>
            </div>

            {devoluciones.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-white/5">
                <div className="text-[10px] font-mono text-[#3E4A60] uppercase tracking-wider font-bold text-left">Mermas / Devoluciones en Ruta</div>
                <div className="space-y-2">
                  {devoluciones.map((d) => (
                    <div key={d.id} className="bg-red-950/5 border border-red-900/10 rounded-xl p-3 flex items-center justify-between gap-3 text-left">
                      <div className="w-8 h-8 rounded bg-red-500/10 border border-red-500/20 flex items-center justify-center font-display font-extrabold text-xs text-red-400 shrink-0">
                        ♻️
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-white truncate">{d.clienteNombre}</div>
                        <div className="text-[10px] text-[#8A93A8] mt-0.5">
                          {d.cantidad} {cfg.productos.find(p => p.id === d.productoId)?.unidad || 'pzas'} de {d.productoNombre}
                        </div>
                      </div>
                      <div className="text-[10px] font-bold text-red-400/90 whitespace-nowrap bg-red-500/5 px-2 py-1 rounded border border-red-500/10">
                        Merma
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(cliHoy.length > 0 || devoluciones.length > 0) && (
              <div className="pt-4 border-t border-white/5 space-y-3.5">
                <div className="bg-[#111520] border border-white/5 rounded-xl p-3.5 flex justify-between items-center text-left">
                  <span className="text-xs font-medium text-[#8A93A8]">Total de Ventas Liquidadas</span>
                  <span className="text-sm font-bold text-[#E8B04A]">{formatPrice(shiftTotal)}</span>
                </div>
                <button 
                  onClick={handleTerminarRuta} 
                  className="w-full py-4.5 hover:brightness-105 rounded-xl text-xs font-extrabold tracking-wide text-[#0B0E14] bg-gradient-to-r from-emerald-500 to-emerald-400 active:scale-97 transition-all cursor-pointer block text-center"
                >
                  ✅ Terminar Turno y Generar Cierre
                </button>
              </div>
            )}
          </div>
        )}

        {/* PANEL: CLIENTES (DETAILED SHIFT LOG) */}
        {activeTab === 'cli' && (
          <div className="space-y-3">
            <div className="bg-[#111520] border border-white/5 rounded-xl p-4 text-center">
              <div className="text-xs font-bold text-white">Clientes del Día</div>
              <p className="text-[10px] text-[#8A93A8] mt-1">Lista consolidada de los clientes visitados en este turno activo.</p>
            </div>
            
            {cliHoy.length === 0 ? (
              <div className="text-center py-6 text-xs text-[#3E4A60]">Esperando que registres misiones de cobro.</div>
            ) : (
              cliHoy.map((c, i) => (
                <div key={i} className="bg-[#111520] border border-white/5 rounded-xl p-3 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-bold text-white truncate flex items-center gap-1.5 flex-1 min-w-0">
                      {c.nombre}
                      {c.tipoNegocio && <span className="bg-[#E8B04A]/10 text-[#E8B04A] text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">{c.tipoNegocio}</span>}
                    </div>
                    <span className="text-[10px] font-mono text-[#8A93A8] shrink-0">{c.hora}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {c.productos.map((p, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 text-[9px] bg-[#181D2B] border border-white/5 px-2 py-1 rounded text-[#8A93A8]">
                        <span>{p.icono}</span> 
                        <span>{p.nombre} ({p.q}x)</span>
                      </span>
                    ))}
                  </div>
                  <div className="flex justify-between items-center pt-2.5 border-t border-white/5">
                    <span className="text-[10px] text-[#3E4A60] font-bold uppercase tracking-wider">{c.tipoCobro === 'efectivo' ? 'Fondo Efectivo' : 'A Crédito'}</span>
                    <span className="text-xs font-bold text-[#E8B04A]">{formatPrice(c.total)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* PANEL: CIERRE */}
        {activeTab === 'cierr' && (
          <div className="space-y-5">
            <div className="font-display font-bold text-base text-white">Resumen del Turno de Ruta</div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-[#111520] border border-white/5 rounded-xl p-3 text-center">
                <div className="text-sm font-bold text-emerald-400">{formatPrice(shiftTotal)}</div>
                <div className="text-[9px] text-[#3E4A60] uppercase mt-0.5">Cobrado Total</div>
              </div>
              <div className="bg-[#111520] border border-white/5 rounded-xl p-3 text-center">
                <div className="text-sm font-bold text-sky-400">{cliHoy.length}</div>
                <div className="text-[9px] text-[#3E4A60] uppercase mt-0.5">Clientes Atendidos</div>
              </div>
              <div className="bg-[#111520] border border-white/5 rounded-xl p-3 text-center">
                <div className="text-sm font-bold text-[#8A93A8]">{getShiftDuration()}</div>
                <div className="text-[9px] text-[#3E4A60] uppercase mt-0.5">Duración</div>
              </div>
              <div className="bg-[#111520] border border-white/5 rounded-xl p-3 text-center">
                <div className="text-sm font-bold text-yellow-400">{devoluciones.length}</div>
                <div className="text-[9px] text-[#3E4A60] uppercase mt-0.5">Devoluciones</div>
              </div>
            </div>

            <div className="flex gap-2">
              <div className="flex-1 py-2 px-3 border border-white/5 rounded-xl bg-[#111520] text-xs font-semibold text-[#3E4A60] text-center select-none" title="Próximamente">
                🖨️ <span className="text-[9px]">Próximamente</span>
              </div>
              <div className="flex-1 py-2 px-3 border border-white/5 rounded-xl bg-[#111520] text-xs font-semibold text-[#3E4A60] text-center select-none" title="Próximamente">
                📥 <span className="text-[9px]">Próximamente</span>
              </div>
              <button onClick={handleWhatsAppReport} className="flex-1 py-2 px-3 border border-white/5 rounded-xl bg-green-500/10 border-green-500/20 text-green-400 text-xs font-bold transition-all cursor-pointer text-center">
                📱 WhatsApp
              </button>
            </div>

            <button 
              onClick={handleNuevaRuta} 
              className="w-full py-4.5 hover:brightness-105 rounded-xl text-xs font-extrabold tracking-wide text-ink cursor-pointer bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 transition-all text-center block"
            >
              🔄 Nueva Ruta / Nueva Jornada
            </button>
          </div>
        )}

        {/* PANEL: ASISTENTE IA */}
        {activeTab === 'ia' && (
          <div className="space-y-4 flex flex-col h-[340px] justify-between">
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1.5">
              {chatLogs.map((log, idx) => (
                <div 
                  key={idx} 
                  className={`flex ${log.role === 'usr' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`p-3 rounded-2xl max-w-[85%] text-xs leading-relaxed text-left ${log.role === 'usr' ? 'bg-[#181D2B] text-white' : 'bg-amber-500/5 border border-amber-500/10 text-amber-100'}`}>
                    {log.role === 'bot' && <span className="block text-[8px] font-mono text-[#C9912A] uppercase font-bold tracking-wider mb-1">RoutePro AI</span>}
                    {log.text}
                  </div>
                </div>
              ))}
            </div>

            <div className="shrink-0 space-y-2">
              {/* Quick drivers prompts */}
              <div className="flex gap-2 overflow-x-auto pb-1 invisible-scrollbar">
                <button 
                  onClick={() => handleAskAI('¿Cómo predigo mi inventario de mañana?')} 
                  className="bg-[#111520] border border-white/5 rounded-full px-3.5 py-1.5 text-[10px] text-[#8A93A8] whitespace-nowrap active:scale-95 transition-all text-left cursor-pointer hover:bg-[#181D2B]"
                >
                  💡 Predecir carga mañana
                </button>
                <button 
                  onClick={() => handleAskAI('Dame consejos para mermas mínimas')} 
                  className="bg-[#111520] border border-white/5 rounded-full px-3.5 py-1.5 text-[10px] text-[#8A93A8] whitespace-nowrap active:scale-95 transition-all text-left cursor-pointer hover:bg-[#181D2B]"
                >
                  🛡️ Consejos mermas
                </button>
                <button 
                  onClick={() => handleAskAI('¿Qué clientes tienen menor ticket?')} 
                  className="bg-[#111520] border border-white/5 rounded-full px-3.5 py-1.5 text-[10px] text-[#8A93A8] whitespace-nowrap active:scale-95 transition-all text-left cursor-pointer hover:bg-[#181D2B]"
                >
                  📊 Clientes bajos
                </button>
              </div>

              <div className="flex gap-1.5 bg-[#0B0E14] border border-white/5 rounded-lg p-1.5">
                <input 
                  type="text" 
                  value={chatInp} 
                  onChange={(e) => setChatInp(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
                  className="flex-1 bg-transparent p-1.5 text-xs focus:outline-none placeholder-[#3E4A60] text-white"
                  placeholder="Ej: ¿Qué productos vendí más hoy?"
                />
                <button 
                  onClick={() => handleAskAI()} 
                  className="w-8 h-8 rounded-lg bg-[#E8B04A] text-[#06080C] text-xs font-bold hover:brightness-110 flex items-center justify-center shrink-0 active:scale-95 cursor-pointer"
                >
                  →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Driver Bottom Menu buttons */}
      <div className="fixed bottom-0 left-0 right-0 h-16 border-t border-white/5 bg-[#0B0E14]/94 backdrop-blur-md px-5 flex items-center justify-around z-30 shrink-0">
        <button 
          onClick={() => setActiveTab('ped')} 
          className={`flex flex-col items-center justify-center gap-1.5 flex-1 py-1.5 cursor-pointer transition-all ${activeTab === 'ped' ? 'text-[#E8B04A]' : 'text-[#3E4A60]'}`}
        >
          <span className="text-base text-current">🛒</span>
          <span className="text-[8px] font-bold tracking-widest uppercase">Reparto</span>
        </button>
        <button 
          onClick={() => setActiveTab('cli')} 
          className={`flex flex-col items-center justify-center gap-1.5 flex-1 py-1.5 cursor-pointer transition-all ${activeTab === 'cli' ? 'text-[#E8B04A]' : 'text-[#3E4A60]'}`}
        >
          <span className="text-base text-current">👥</span>
          <span className="text-[8px] font-bold tracking-widest uppercase">Bitácora</span>
        </button>
        <button 
          onClick={() => setActiveTab('cierr')} 
          className={`flex flex-col items-center justify-center gap-1.5 flex-1 py-1.5 cursor-pointer transition-all ${activeTab === 'cierr' ? 'text-[#E8B04A]' : 'text-[#3E4A60]'}`}
        >
          <span className="text-base text-current">📋</span>
          <span className="text-[8px] font-bold tracking-widest uppercase">Cierre</span>
        </button>
        <button 
          onClick={() => setActiveTab('ia')} 
          className={`flex flex-col items-center justify-center gap-1.5 flex-1 py-1.5 cursor-pointer transition-all ${activeTab === 'ia' ? 'text-[#E8B04A]' : 'text-[#3E4A60]'}`}
        >
          <span className="text-base text-current">💬</span>
          <span className="text-[8px] font-bold tracking-widest uppercase">Asistente</span>
        </button>
      </div>

      {/* MODAL: REGISTER NEW CLIENT */}
      {showCliModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 animate-fade-in text-left">
          <div className="bg-[#111520] border border-white/10 rounded-t-2xl sm:rounded-2xl p-5.5 w-full sm:max-w-md max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="font-display font-bold text-base text-white">Registrar Entrega de Ruta</div>
            
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-mono text-[#3E4A60] uppercase tracking-wider font-bold">Seleccionar Cliente de tu Ruta</label>
              <select
                value={selectedPresetClientId}
                onChange={(e) => handlePresetClientChange(e.target.value)}
                className="bg-[#181D2B] border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="new">➕ REGISTRAR NUEVO CLIENTE (Guarda ubicación GPS)</option>
                {misClientes.map(c => (
                  <option key={c.id} value={c.id}>
                    👤 {c.nombre} ({c.tipo || 'Abarrotes'})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-mono text-[#3E4A60] uppercase tracking-wider font-bold">Nombre del Cliente</label>
              <input 
                type="text" 
                value={newCliName} 
                onChange={(e) => setNewCliName(e.target.value)} 
                disabled={selectedPresetClientId !== 'new'}
                className="bg-[#181D2B] border border-white/5 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-amber-500 disabled:opacity-50"
                placeholder="Ej: Abarrotes Doña Rosa"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-mono text-[#3E4A60] uppercase tracking-wider font-bold">Tipo de Negocio / Giro</label>
              {selectedPresetClientId !== 'new' ? (
                <div className="text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/10 inline-block w-fit">
                  {newCliType}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {['Abarrotes', 'Miscelánea', 'Depósito', 'Materias Primas', 'Restaurante', 'Otro'].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNewCliType(t)}
                      className={`px-3 py-1.5 text-[10px] font-bold rounded-lg cursor-pointer transition-all ${newCliType === t ? 'bg-[#E8B04A] text-black shadow-[0_0_10px_rgba(232,176,74,0.3)]' : 'bg-[#181D2B] border border-white/5 text-[#8A93A8] hover:text-white'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedPresetClientId === 'new' && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-mono text-[#3E4A60] uppercase tracking-wider font-bold">Dirección (Opcional)</label>
                  <input 
                    type="text" 
                    value={newCliAddress} 
                    onChange={(e) => setNewCliAddress(e.target.value)} 
                    className="bg-[#181D2B] border border-white/5 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    placeholder="Calle, Número y Colonia"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-mono text-[#3E4A60] uppercase tracking-wider font-bold">Teléfono (Opcional)</label>
                  <input 
                    type="text" 
                    value={newCliPhone} 
                    onChange={(e) => setNewCliPhone(e.target.value)} 
                    className="bg-[#181D2B] border border-white/5 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    placeholder="Ej: 5512345678"
                  />
                </div>
              </>
            )}

            {/* Configured Products Grid to dynamically click & add */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-mono text-[#3E4A60] uppercase tracking-wider font-bold">Selecciona Productos</label>
              <div className="grid grid-cols-4 gap-1.5 max-h-[160px] overflow-y-auto">
                {cfg.productos.map((prod) => (
                  <div 
                    key={prod.id}
                    onClick={() => handleAddCartRep(prod)}
                    className="bg-[#181D2B] border border-white/5 rounded-xl p-2.5 flex flex-col items-center gap-1.5 hover:bg-amber-500/10 hover:border-amber-500/20 cursor-pointer active:scale-95 transition-all"
                  >
                    <span className="text-xl">{prod.icono || '📦'}</span>
                    <span className="text-[8px] text-white font-bold leading-tight truncate w-full text-center">{prod.nombre}</span>
                    <span className="text-[8px] text-[#8A93A8] font-semibold">{formatPrice(prod.precio)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Shopping Cart List */}
            {cartRep.length > 0 && (
              <div className="space-y-1">
                <label className="text-[9px] font-mono text-[#3E4A60] uppercase tracking-wider font-bold">Artículos Cargados ({cartRep.reduce((sum, item) => sum + item.q, 0)}x)</label>
                <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                  {cartRep.map((item, idx) => {
                    const prodRef = cfg.productos.find(p => p.id === item.id);
                    return (
                      <div key={idx} className="bg-[#111520] border border-white/5 rounded-lg py-1.5 px-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 flex-1 min-w-[50%]">
                          <span className="shrink-0">{item.icono}</span>
                          <span className="font-bold text-white truncate">{item.nombre}</span>
                          <span className="text-[10px] text-[#8A93A8] shrink-0">{formatPrice(item.pr)} c/u</span>
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                          {prodRef?.piezasPorCaja && (
                            <button 
                              onClick={() => {
                                const updated = [...cartRep];
                                updated[idx].q += (prodRef.piezasPorCaja || 1) - 1; // It already added 1 on click, but for a new click +caja
                                setCartRep(updated);
                              }}
                              className="text-[9px] font-bold bg-[#181D2B] border border-white/5 text-[#E8B04A] px-2 py-1 rounded cursor-pointer shrink-0"
                            >
                              +Caja ({prodRef.piezasPorCaja})
                            </button>
                          )}
                          <div className="flex border border-white/5 bg-[#0B0E14] rounded overflow-hidden w-16">
                            <input 
                              type="number" 
                              value={item.q === 0 ? '' : item.q} 
                              onChange={(e) => {
                                const valStr = e.target.value;
                                const newQ = valStr === '' ? 0 : parseInt(valStr);
                                const updated = [...cartRep];
                                updated[idx].q = isNaN(newQ) ? 0 : newQ;
                                setCartRep(updated);
                              }}
                              className="w-full bg-transparent text-center text-[10px] text-[#E8B04A] font-bold p-1 focus:outline-none"
                            />
                          </div>
                          <button onClick={() => handleRemoveCartRep(idx)} className="text-red-400 hover:text-red-300 w-6 h-6 flex items-center justify-center shrink-0 cursor-pointer">✕</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Formas de cobro */}
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-mono text-[#3E4A60] uppercase tracking-wider font-bold">Forma de Cobro</label>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  type="button" 
                  onClick={() => setTipoRep('efectivo')}
                  className={`py-2 px-3 text-xs font-bold rounded-lg cursor-pointer text-center transition-all ${tipoRep === 'efectivo' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-[#181D2B] border border-white/5 text-[#8A93A8]'}`}
                >
                  💵 Efectivo
                </button>
                <button 
                  type="button" 
                  onClick={() => setTipoRep('credito')}
                  className={`py-2 px-3 text-xs font-bold rounded-lg cursor-pointer text-center transition-all ${tipoRep === 'credito' ? 'bg-amber-500/10 border border-[#C9912A]/20 text-[#E8B04A]' : 'bg-[#181D2B] border border-white/5 text-[#8A93A8]'}`}
                >
                  📋 Crédito
                </button>
              </div>
            </div>

            {/* Total Display */}
            <div className="bg-[#1F2638]/20 border border-[#C9912A]/10 p-3.5 rounded-xl text-center">
              <div className="text-[9px] uppercase tracking-widest text-[#3E4A60] font-bold mb-1">Monto de Liquidación</div>
              <div className="text-xl font-bold tracking-wider text-[#E8B04A]">{formatPrice(cartRep.reduce((sum, item) => sum + (item.pr * item.q), 0))}</div>
            </div>

            <div className="flex gap-2.5">
              <button onClick={() => setShowCliModal(false)} className="flex-1 py-3 bg-[#181D2B] hover:bg-[#1F2638] rounded-xl text-xs font-bold text-[#8A93A8] hover:text-white cursor-pointer active:scale-97 transition-all text-center">
                Cancelar
              </button>
              <button onClick={handleRegCli} className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-[#10B981] font-bold text-xs text-[#06080C] hover:brightness-110 rounded-xl cursor-pointer active:scale-97 transition-all text-center">
                Registrar Cliente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTER MERMA / DEVOLUCION */}
      {showDevolModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 animate-fade-in text-left">
          <div className="bg-[#111520] border border-white/10 rounded-t-2xl sm:rounded-2xl p-5.5 w-full sm:max-w-md max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="font-display font-bold text-base text-white flex items-center gap-2">
              <span>♻️</span>
              <span>Registrar Merma / Devolución</span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-mono text-[#3E4A60] uppercase tracking-wider font-bold">Cliente / Origen</label>
              <input 
                type="text" 
                value={devolClienteName} 
                onChange={(e) => setDevolClienteName(e.target.value)} 
                className="bg-[#181D2B] border border-white/5 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-red-500"
                placeholder="Ej: Abarrotes Doña Rosa / Merma Ruta"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-mono text-[#3E4A60] uppercase tracking-wider font-bold">Producto</label>
              <select 
                value={selectedDevolProdId}
                onChange={(e) => setSelectedDevolProdId(e.target.value)}
                className="bg-[#181D2B] border border-white/5 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-red-500 cursor-pointer"
              >
                <option value="">-- Selecciona el Producto --</option>
                {cfg.productos.map((prod) => (
                  <option key={prod.id} value={prod.id}>
                    {prod.icono || '📦'} {prod.nombre} (${(prod.precio / 100).toFixed(0)} c/u)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-mono text-[#3E4A60] uppercase tracking-wider font-bold">Cantidad Devuelta</label>
              <input 
                type="number" 
                step="any"
                min="0.01"
                value={devolCant} 
                onChange={(e) => setDevolCant(parseFloat(e.target.value) || 0)} 
                className="bg-[#181D2B] border border-white/5 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-red-500"
                placeholder="Ej: 5"
              />
            </div>

            <div className="flex gap-2.5 pt-1.5">
              <button 
                onClick={() => {
                  setShowDevolModal(false);
                  setDevolClienteName('');
                  setSelectedDevolProdId('');
                  setDevolCant(1);
                }}
                className="flex-1 py-3 bg-[#181D2B] hover:bg-[#1F2638] rounded-xl text-xs font-bold text-[#8A93A8] hover:text-white cursor-pointer active:scale-97 transition-all text-center"
              >
                Cancelar
              </button>
              <button 
                onClick={handleRegDevol} 
                className="flex-1 py-3 bg-gradient-to-r from-red-500 to-rose-600 font-bold text-xs text-white hover:brightness-110 rounded-xl cursor-pointer active:scale-97 transition-all text-center"
              >
                Registrar Merma
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
