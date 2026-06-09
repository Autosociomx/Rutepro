import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, doc, setDoc, addDoc } from 'firebase/firestore';
import { Product, Seller, AppConfig } from '../types';

interface ClientSaleRecord {
  id: string;
  nombre: string;
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
}

export const RepartidorScreen: React.FC<RepartidorScreenProps> = ({ cfg, onGoBack, triggerToast }) => {
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [activeTab, setActiveTab] = useState<'ped' | 'cli' | 'cierr' | 'ia'>('ped');
  const [horaIni, setHoraIni] = useState<Date | null>(null);

  // Operational states
  const [cliHoy, setCliHoy] = useState<ClientSaleRecord[]>([]);
  const [cartRep, setCartRep] = useState<{ id: string; nombre: string; pr: number; icono: string; q: number }[]>([]); // { id, nombre, pr, icono, q }
  const [tipoRep, setTipoRep] = useState<'efectivo' | 'credito'>('efectivo');
  
  // New Client Modal state
  const [showCliModal, setShowCliModal] = useState(false);
  const [newCliName, setNewCliName] = useState('');

  // Devoluciones state
  const [devolucionesHoy, setDevolucionesHoy] = useState(0);
  const [showDevModal, setShowDevModal] = useState(false);
  const [devProd, setDevProd] = useState<{ id: string; nombre: string; icono: string } | null>(null);
  const [devQty, setDevQty] = useState('1');
  const [devClientName, setDevClientName] = useState('');

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
    setCliHoy([]);
    setCartRep([]);
    setTipoRep('efectivo');
    setDevolucionesHoy(0);
    setActiveTab('ped');
    triggerToast(`Ruta iniciada para ${vnd.nombre}`);
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

    const newCliRecord = {
      id: saleId,
      nombre: newCliName.trim(),
      productos: [...cartRep],
      tipoCobro: tipoRep,
      total: tot,
      hora: nowStr,
      timestamp: Date.now()
    };

    try {
      // Direct Firestore sync to lock in the audit logs in real-time
      const ventaDocData = {
        id: saleId,
        vendedorId: selectedSeller.id,
        vendedorNombre: selectedSeller.nombre,
        clienteId: 'C_ROUTE_' + Date.now(),
        clienteNombre: newCliName.trim(),
        monto: tot,
        tipoCobro: tipoRep === 'efectivo' ? 'efectivo' : 'crédito',
        items: cartRep.map(item => ({
          id: item.id,
          nombre: item.nombre,
          q: item.q,
          pr: item.pr,
          ic: item.icono
        })),
        timestamp: Date.now()
      };
      
      try {
        await setDoc(doc(db, 'ventas', saleId), ventaDocData);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `ventas/${saleId}`);
      }

      // Save locally to local sales lists in localStorage
      const prevLocal = JSON.parse(localStorage.getItem('rp_ventas') || '[]');
      prevLocal.push({
        ...ventaDocData,
        prod_resumen: cartRep.map(x => (x.icono || '📦') + x.nombre).slice(0, 2).join(', '),
        ts: Date.now(),
        hora: nowStr
      });
      localStorage.setItem('rp_ventas', JSON.stringify(prevLocal));

      // Append to active UI shift statistics
      setCliHoy([...cliHoy, newCliRecord]);
      setCartRep([]);
      setNewCliName('');
      setTipoRep('efectivo');
      setShowCliModal(false);
      triggerToast(`✓ Cliente registrado · ${formatPrice(tot)}`);
    } catch (e: any) {
      console.error(e);
      triggerToast('Error al escribir en la base de datos', 'err');
    }
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
    setDevolucionesHoy(0);
  };

  const handleRegDevolucion = async () => {
    if (!devProd) {
      triggerToast('Selecciona un producto a devolver', 'err');
      return;
    }
    const qty = parseInt(devQty) || 0;
    if (qty <= 0) {
      triggerToast('Ingresa una cantidad válida', 'err');
      return;
    }

    const devId = 'D' + Date.now();
    const devDoc = {
      id: devId,
      vendedorId: selectedSeller!.id,
      vendedorNombre: selectedSeller!.nombre,
      clienteId: 'C_DEV_' + Date.now(),
      clienteNombre: devClientName.trim() || 'Cliente sin nombre',
      productoId: devProd.id,
      productoNombre: devProd.nombre,
      cantidad: qty,
      timestamp: Date.now()
    };

    try {
      await addDoc(collection(db, 'devoluciones'), devDoc);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'devoluciones');
    }

    setDevolucionesHoy(prev => prev + 1);
    setDevProd(null);
    setDevQty('1');
    setDevClientName('');
    setShowDevModal(false);
    triggerToast(`↩ Devolución registrada: ${devProd.nombre} (${qty}x)`);
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
          ventas: cliHoy.map((c: any) => ({
            vendedor_nombre: selectedSeller?.nombre,
            cliente_nombre: c.nombre,
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
      setChatLogs([...newLogs, { role: 'bot', text: 'Asistencia offline: ¡Sigue con el excelente trabajo en tu zona de reparto! Configura tu GEMINI_API_KEY para habilitar asesoría en ruta completa.' }]);
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
          <button onClick={onGoBack} className="w-9 h-9 rounded-lg bg-[#111520] border border-white/5 flex items-center justify-center text-[#8A93A8] hover:text-[#EEF1F8] cursor-pointer">
            ←
          </button>
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
          <div className="text-xs font-bold text-[#E8B04A] tracking-wider">{formatPrice(shiftTotal)}</div>
          <div className="text-[9px] text-[#3E4A60] font-semibold uppercase tracking-wider mt-0.5">Cobrado</div>
        </div>
        <div className="bg-[#111520] border border-white/5 rounded-xl p-2.5 text-center">
          <div className="text-xs font-bold text-[#EEF1F8] tracking-wider">{cliHoy.length}</div>
          <div className="text-[9px] text-[#3E4A60] font-semibold uppercase tracking-wider mt-0.5">Clientes</div>
        </div>
        <div
          className="bg-[#111520] border border-white/5 rounded-xl p-2.5 text-center cursor-pointer hover:bg-[#181D2B] transition-all"
          onClick={() => setShowDevModal(true)}
        >
          <div className="text-xs font-bold text-red-400 tracking-wider">{devolucionesHoy}</div>
          <div className="text-[9px] text-[#3E4A60] font-semibold uppercase tracking-wider mt-0.5">↩ Devolver</div>
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
                      <div className="text-xs font-bold text-white truncate">{c.nombre}</div>
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

            <button 
              onClick={() => {
                if (!cfg.productos || cfg.productos.length === 0) {
                  triggerToast('Configura productos en su catálogo de negocio primero', 'err');
                  return;
                }
                setShowCliModal(true);
              }}
              className="w-full py-3.5 bg-[#181D2B] hover:bg-[#1F2638] border border-white/5 text-[#8A93A8] hover:text-white rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer text-center"
            >
              + Agregar Entrega a Cliente
            </button>

            {cliHoy.length > 0 && (
              <div className="pt-4 border-t border-white/5 space-y-3.5">
                <div className="bg-[#111520] border border-white/5 rounded-xl p-3.5 flex justify-between items-center">
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
                    <span className="text-xs font-bold text-white">{c.nombre}</span>
                    <span className="text-[10px] font-mono text-[#8A93A8]">{c.hora}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {c.productos.map((p: any, idx: number) => (
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
                <div className="text-sm font-bold text-yellow-400">{devolucionesHoy}</div>
                <div className="text-[9px] text-[#3E4A60] uppercase mt-0.5">Devoluciones</div>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => triggerToast('🖨️ Conectando impresora Bluetooth térmica...')} className="flex-1 py-2 px-3 border border-white/5 rounded-xl bg-[#111520] text-xs font-semibold hover:bg-[#181D2B] text-white transition-all cursor-pointer text-center">
                🖨️ Ticket
              </button>
              <button onClick={() => triggerToast('📥 Exportando archivo de Liquidación CSV...')} className="flex-1 py-2 px-3 border border-white/5 rounded-xl bg-[#111520] text-xs font-semibold hover:bg-[#181D2B] text-white transition-all cursor-pointer text-center">
                📥 CSV
              </button>
              <button onClick={handleWhatsAppReport} className="flex-1 py-2 px-3 border border-white/5 rounded-xl bg-green-500/10 border-green-500/20 text-green-400 text-xs font-bold transition-all cursor-pointer text-center">
                📱 WhatsApp
              </button>
            </div>

            <div className="flex gap-2.5">
              <button
                onClick={handleNuevaRuta}
                className="flex-1 py-4.5 hover:brightness-105 rounded-xl text-xs font-extrabold tracking-wide cursor-pointer bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 transition-all text-center"
              >
                🔄 Nueva Ruta
              </button>
              <button
                onClick={onGoBack}
                className="flex-1 py-4.5 hover:brightness-105 rounded-xl text-xs font-extrabold tracking-wide cursor-pointer bg-[#111520] border border-white/10 text-[#8A93A8] hover:text-white transition-all text-center"
              >
                🏠 Salir al Inicio
              </button>
            </div>
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
              <label className="text-[9px] font-mono text-[#3E4A60] uppercase tracking-wider font-bold">Nombre del Cliente</label>
              <input 
                type="text" 
                value={newCliName} 
                onChange={(e) => setNewCliName(e.target.value)} 
                className="bg-[#181D2B] border border-white/5 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                placeholder="Ej: Abarrotes Doña Rosa"
              />
            </div>

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
                  {cartRep.map((item, idx) => (
                    <div key={idx} className="bg-[#111520] border border-white/5 rounded-lg py-1.5 px-3 flex items-center justify-between gap-3 text-xs">
                      <span className="shrink-0">{item.icono}</span>
                      <span className="flex-1 font-bold text-white text-left truncate">{item.nombre}</span>
                      <span className="text-[10px] text-[#8A93A8]">{formatPrice(item.pr)} c/u</span>
                      <span className="font-mono text-[10px] text-[#E8B04A] font-bold bg-[#181D2B] border border-white/5 rounded px-2.5 py-0.5 shrink-0">{item.q}x</span>
                      <button onClick={() => handleRemoveCartRep(idx)} className="text-red-400 hover:text-red-300 ml-1 shrink-0">✕</button>
                    </div>
                  ))}
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

      {/* MODAL: REGISTRAR DEVOLUCION */}
      {showDevModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 animate-fade-in text-left">
          <div className="bg-[#111520] border border-white/10 rounded-t-2xl sm:rounded-2xl p-5.5 w-full sm:max-w-md space-y-4 shadow-2xl">
            <div className="font-display font-bold text-base text-white">Registrar Devolución</div>

            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-mono text-[#3E4A60] uppercase tracking-wider font-bold">Cliente</label>
              <input
                type="text"
                value={devClientName}
                onChange={(e) => setDevClientName(e.target.value)}
                className="bg-[#181D2B] border border-white/5 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-red-500"
                placeholder="Ej: Abarrotes Doña Rosa"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-mono text-[#3E4A60] uppercase tracking-wider font-bold">Producto devuelto</label>
              <div className="grid grid-cols-4 gap-1.5 max-h-[140px] overflow-y-auto">
                {cfg.productos.map((prod) => (
                  <div
                    key={prod.id}
                    onClick={() => setDevProd({ id: prod.id, nombre: prod.nombre, icono: prod.icono || '📦' })}
                    className={`rounded-xl p-2 flex flex-col items-center gap-1 cursor-pointer transition-all active:scale-95 ${devProd?.id === prod.id ? 'bg-red-500/15 border border-red-500/30' : 'bg-[#181D2B] border border-white/5 hover:bg-red-500/10'}`}
                  >
                    <span className="text-xl">{prod.icono || '📦'}</span>
                    <span className="text-[8px] text-white font-bold truncate w-full text-center leading-tight">{prod.nombre}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-mono text-[#3E4A60] uppercase tracking-wider font-bold">Cantidad devuelta</label>
              <input
                type="number"
                min="1"
                value={devQty}
                onChange={(e) => setDevQty(e.target.value)}
                className="bg-[#181D2B] border border-white/5 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-red-500 w-full"
              />
            </div>

            <div className="flex gap-2.5">
              <button onClick={() => setShowDevModal(false)} className="flex-1 py-3 bg-[#181D2B] hover:bg-[#1F2638] rounded-xl text-xs font-bold text-[#8A93A8] hover:text-white cursor-pointer active:scale-97 transition-all text-center">
                Cancelar
              </button>
              <button onClick={handleRegDevolucion} className="flex-1 py-3 bg-red-500/80 hover:bg-red-500 font-bold text-xs text-white rounded-xl cursor-pointer active:scale-97 transition-all text-center">
                ↩ Confirmar Devolución
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
