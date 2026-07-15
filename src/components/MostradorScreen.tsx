import React, { useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Product, Seller, AppConfig } from '../types';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { validateSale } from '../utils/syncEngine';

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

interface MostradorScreenProps {
  cfg: AppConfig;
  onGoBack: () => void;
  triggerToast: (msg: string, type?: 'ok' | 'err') => void;
  isWorkerMode?: boolean;
  ownerUid: string;
}

export const MostradorScreen: React.FC<MostradorScreenProps> = ({ cfg, onGoBack, triggerToast, isWorkerMode, ownerUid }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [cartMos, setCartMos] = useState<{ id: string; nombre: string; pr: number; icono: string; q: number }[]>([]); // { id, nombre, pr, icono, q }
  const [paymentType, setPaymentType] = useState<'efectivo' | 'tarjeta'>('efectivo');
  const [showOptionsModal, setShowOptionsModal] = useState(false);

  // Identify cajeros/ambos role sellers, fallback to first/any seller
  const cashiersList = cfg.vendedores.filter(v => v.rol === 'cajero' || v.rol === 'ambos');
  const availableCashiers = cashiersList.length > 0 ? cashiersList : cfg.vendedores;
  const [selectedCajero, setSelectedCajero] = useState<Seller | null>(() => availableCashiers[0] || null);
  
  // Geolocation states
  const [showGeoModal, setShowGeoModal] = useState(false);
  const [geoLoc, setGeoLoc] = useState<google.maps.LatLngLiteral | null>(null);
  const [geoStatus, setGeoStatus] = useState<'requesting' | 'valid' | 'invalid' | 'error'>('requesting');

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const handleAddMos = (prod: Product) => {
    const existing = cartMos.find(x => x.id === prod.id);
    if (existing) {
      setCartMos(cartMos.map(x => x.id === prod.id ? { ...x, q: x.q + 1 } : x));
    } else {
      setCartMos([...cartMos, { id: prod.id, nombre: prod.nombre, pr: prod.precio, icono: prod.icono || '📦', q: 1 }]);
    }
    triggerToast(`✓ ${prod.nombre} agregado`);
  };

  const handleChangeQty = (index: number, delta: number) => {
    const updated = [...cartMos];
    updated[index].q += delta;
    if (updated[index].q <= 0) {
      updated.splice(index, 1);
    }
    setCartMos(updated);
  };

  const handleLimpCart = () => {
    if (cartMos.length === 0) return;
    setCartMos([]);
    triggerToast('✓ Los productos del carrito han sido retirados');
  };

  const initCobro = () => {
    if (cartMos.length === 0) {
      triggerToast('Agrega productos al carrito para cobrar', 'err');
      return;
    }
    setShowGeoModal(true);
    setGeoStatus('requesting');
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGeoLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setGeoStatus('valid');
        },
        (err) => {
          console.error(err);
          setGeoStatus('error');
        }
      );
    } else {
      setGeoStatus('error');
    }
  };

  const executeCobro = async () => {
    const tot = cartMos.reduce((sum, item) => sum + (item.pr * item.q), 0);
    const saleId = 'S' + Date.now();
    const nowStr = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

    const activeCajero = selectedCajero || { id: 'v_mostrador', nombre: 'Mostrador local', rol: 'cajero', ruta: 'Mostrador' };

    const saleDocData = {
      id: saleId,
      vendedorId: activeCajero.id,
      vendedorNombre: activeCajero.nombre,
      clienteId: 'C_WALKIN_' + Date.now(),
      clienteNombre: 'Cliente de Mostrador',
      monto: tot,
      tipoCobro: paymentType === 'tarjeta' ? 'crédito' : 'efectivo' as const,
      items: cartMos.map(item => ({
        id: item.id,
        nombre: item.nombre,
        q: item.q,
        pr: item.pr,
        ic: item.icono
      })),
      timestamp: Date.now(),
      validado: true, // Mark validated 
      sincronizado: false // marked unsynced initially
    };

    // Real-time client-side live validation before commit
    const validationResult = validateSale(saleDocData);
    if (!validationResult.isValid) {
      triggerToast(`Fallo de Validación: ${validationResult.reason}`, 'err');
      return;
    }

    // 1. Guardar de forma local e inmediata para evitar cualquier bloqueo en mostrador OFFLINE
    try {
      // Log locally inside localStorage cache
      const prevLocal = JSON.parse(localStorage.getItem('rp_ventas') || '[]');
      prevLocal.push({
        ...saleDocData,
        prod_resumen: cartMos.map(x => (x.icono || '📦') + x.nombre).slice(0, 2).join(', '),
        ts: Date.now(),
        hora: nowStr
      });
      localStorage.setItem('rp_ventas', JSON.stringify(prevLocal));

      triggerToast(`✓ Cobro exitoso por ${formatPrice(tot)}`);
      setCartMos([]);
      setShowGeoModal(false);
    } catch (err: any) {
      console.error(err);
      triggerToast('Error con almacenamiento de venta local', 'err');
    }

    // 2. Sincronización en segundo plano con la nube sin retrasar la transacción real en mostrador
    const cleanDbData = {
      id: saleDocData.id,
      vendedorId: saleDocData.vendedorId,
      vendedorNombre: saleDocData.vendedorNombre,
      clienteId: saleDocData.clienteId,
      clienteNombre: saleDocData.clienteNombre,
      monto: saleDocData.monto,
      tipoCobro: saleDocData.tipoCobro,
      items: saleDocData.items,
      timestamp: saleDocData.timestamp,
      validado: true
    };

    setDoc(doc(db, 'negocios', ownerUid, 'ventas', saleId), cleanDbData)
      .then(() => {
        console.log(`✓ Venta de mostrador ${saleId} sincronizada con la nube.`);
        // Mark as synchronized in local storage
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
        // El cache offline robusto de Firestore sincronizará cuando consiga internet.
      });
  };

  const handleImpTicket = () => {
    if (cartMos.length === 0) {
      triggerToast('Carrito vacío', 'err');
      return;
    }

    const tot = cartMos.reduce((sum, item) => sum + (item.pr * item.q), 0);
    const ticketItems = cartMos.map(x => `${x.icono || '📦'} ${x.nombre} x${x.q} = ${formatPrice(x.pr * x.q)}`).join('\n');

    const w = window.open('', '_blank');
    if (!w) {
      triggerToast('La ventana emergente fue bloqueada por el navegador', 'err');
      return;
    }

    w.document.write(`
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            @page { size: 58mm auto; margin: 0; }
            body { 
              width: 58mm; 
              margin: 0; 
              padding: 4mm; 
              font-family: 'Courier New', monospace; 
              font-size: 10px; 
              line-height: 1.4;
              color: #000;
              background: #fff;
            }
            .center { text-align: center; margin: 2mm 0; }
            .line { border-top: 1px dashed #000; margin: 2mm 0; }
            .bold { font-size: 13px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="center bold">${cfg.nombre}</div>
          <div class="center">${cfg.subtitulo}</div>
          <div class="center">${new Date().toLocaleString('es-MX')}</div>
          <div class="line"></div>
          <div style="white-space:pre-wrap;">${ticketItems}</div>
          <div class="line"></div>
          <div class="center bold">TOTAL: ${formatPrice(tot)}</div>
          <div class="center" style="font-size: 8px; font-weight: bold;">MÉTODO: ${paymentType.toUpperCase()}</div>
          <div class="center" style="margin-top: 5mm; font-size: 9px;">¡Gracias por su preferencia!</div>
        </body>
      </html>
    `);
    w.document.close();
    setTimeout(() => {
      w.print();
    }, 450);
  };

  const filteredProducts = searchQuery.trim() === ''
    ? cfg.productos
    : cfg.productos.filter(p => p.nombre.toLowerCase().includes(searchQuery.toLowerCase()));

  const totalCartValue = cartMos.reduce((sum, item) => sum + (item.pr * item.q), 0);

  return (
    <div className="min-h-screen bg-[#06080C] text-[#EEF1F8] flex flex-col font-sans">
      {/* POS Topbar */}
      <div className="sticky top-0 z-40 h-14 bg-[#06080C]/94 backdrop-blur-md border-b border-white/5 px-4.5 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 text-left min-w-0">
          <div 
            className="w-9 h-9 rounded-lg bg-[#111520] border flex items-center justify-center font-display font-bold shrink-0 overflow-hidden"
            style={{ borderColor: `${cfg.color_principal || '#00C896'}35` }}
          >
            {cfg.logo_url ? (
              <img src={cfg.logo_url} className="w-full h-full object-contain p-0.5" alt="Logo" referrerPolicy="no-referrer" />
            ) : (
              <span style={{ color: cfg.color_principal || '#00C896' }} className="text-xs font-extrabold">{cfg.letra}</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate">{cfg.nombre}</div>
            {availableCashiers.length > 1 ? (
              <select
                value={selectedCajero?.id || ''}
                onChange={(e) => {
                  const target = availableCashiers.find(x => x.id === e.target.value);
                  if (target) setSelectedCajero(target);
                }}
                className="bg-[#111520] border border-white/10 text-[10px] text-emerald-400 font-bold rounded px-1.5 py-0.5 mt-0.5 focus:outline-none cursor-pointer max-w-[140px]"
              >
                {availableCashiers.map(c => (
                  <option key={c.id} value={c.id} className="text-white bg-[#111520]">{c.nombre}</option>
                ))}
              </select>
            ) : (
              <div className="text-[10px] text-[#8A93A8] mt-0.5">
                Cajero: <span className="text-emerald-400 font-bold">{selectedCajero?.nombre || 'Mostrador local'}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400">
            <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
            <span>Punto de Venta Listo</span>
          </div>
          {!isWorkerMode && (
            <button
              onClick={onGoBack}
              className="w-8.5 h-8.5 rounded-md bg-[#111520] border border-white/5 flex items-center justify-center text-[#8A93A8] hover:text-white transition-all text-xs cursor-pointer"
              title="Volver"
            >
              ←
            </button>
          )}
          <button
            onClick={() => setShowOptionsModal(true)}
            className="w-8.5 h-8.5 rounded-md bg-[#111520] border border-white/5 flex items-center justify-center text-[#8A93A8] hover:text-white transition-all text-xs cursor-pointer"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* POS Content Body Split layout — apilado en móvil, lado a lado desde tablet */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden p-3.5 gap-3.5 max-h-[calc(100vh-56px)] select-none">
        {/* Left Side: Product catalog with search bar */}
        <div className="flex-1 flex flex-col gap-3 min-w-0 min-h-0 h-full overflow-hidden">
          <div className="relative shrink-0 text-left">
            <input 
              type="text" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              placeholder="🔍  Buscar por nombre de producto..." 
              className="bg-[#181D2B] border border-white/5 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 w-full placeholder-[#3E4A60]"
            />
          </div>

          <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 align-content-start pr-1">
            {filteredProducts.length === 0 ? (
              <div className="col-span-full text-center py-12 text-[#3E4A60] text-xs font-medium">
                No se encontraron artículos coincidiendo con la búsqueda.
              </div>
            ) : (
              filteredProducts.map((p) => (
                <div 
                  key={p.id}
                  onClick={() => handleAddMos(p)}
                  className="bg-[#111520] border border-white/5 hover:bg-amber-500/5 hover:border-amber-500/20 cursor-pointer p-4 rounded-xl flex flex-col items-center justify-center gap-2.5 active:scale-95 transition-all text-center group"
                >
                  <div className="text-3xl w-11 h-11 bg-[#181D2B] rounded-lg flex items-center justify-center border border-white/5">
                    {p.icono || '📦'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-[#EEF1F8] group-hover:text-amber-300 truncate w-full px-1.5">{p.nombre}</div>
                    <div className="text-[10px] text-[#8A93A8] font-semibold mt-0.5">{formatPrice(p.precio)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Shopping Cart sidebar — franja fija en móvil, columna completa desde tablet */}
        <div className="w-full md:w-[280px] shrink-0 h-[46vh] md:h-full bg-[#0B0E14] border border-white/5 rounded-xl p-3.5 flex flex-col justify-between overflow-hidden">
          <div className="flex flex-col gap-3.5 flex-1 overflow-hidden h-full">
            <div className="flex justify-between items-center shrink-0">
              <span className="font-display font-bold text-xs text-white">Carrito de Compra</span>
              <button 
                onClick={handleLimpCart} 
                className="text-[10px] text-red-400 font-bold hover:text-red-300 active:scale-95 transition-all cursor-pointer"
              >
                Limpiar todo
              </button>
            </div>

            {/* Cart products scroll */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 select-text">
              {cartMos.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-30 py-10">
                  <span className="text-3xl mb-2.5">🛒</span>
                  <div className="text-[10px] font-bold text-[#EEF1F8]">Carrito Vacío</div>
                  <p className="text-[9px] text-[#8A93A8] max-w-[140px] mt-1 leading-relaxed">Selecciona un producto del catálogo para cargarlo.</p>
                </div>
              ) : (
                cartMos.map((item, idx) => {
                  const prodRef = cfg.productos.find(p => p.id === item.id);
                  return (
                    <div key={idx} className="bg-[#111520] border border-white/5 rounded-lg p-2 flex flex-wrap items-center justify-between gap-2 animate-fade-in text-left">
                      <div className="flex items-center gap-2 flex-1 min-w-[50%]">
                        <span className="text-lg shrink-0">{item.icono}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-bold text-white truncate">{item.nombre}</div>
                          <div className="text-[9px] text-[#8A93A8] mt-0.5">{formatPrice(item.pr)} c/u</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 justify-end shrink-0 select-none">
                        {prodRef?.piezasPorCaja && (
                          <button 
                            onClick={() => handleChangeQty(idx, (prodRef.piezasPorCaja || 1) - 1)}
                            className="text-[9px] font-bold bg-[#181D2B] border border-white/5 text-[#E8B04A] px-2 py-1 rounded cursor-pointer"
                          >
                            +Caja ({prodRef.piezasPorCaja})
                          </button>
                        )}
                        <div className="flex border border-white/5 bg-[#0B0E14] rounded overflow-hidden w-16">
                          <button 
                            onClick={() => handleChangeQty(idx, -1)} 
                            className="w-5 flex items-center justify-center bg-[#181D2B]/80 text-[#8A93A8] hover:bg-[#1F2638] cursor-pointer text-xs"
                          >
                            -
                          </button>
                          <input 
                            type="number" 
                            value={item.q === 0 ? '' : item.q} 
                            onChange={(e) => {
                              const valStr = e.target.value;
                              const newQ = valStr === '' ? 0 : parseInt(valStr);
                              const updated = [...cartMos];
                              updated[idx].q = isNaN(newQ) ? 0 : newQ;
                              setCartMos(updated);
                            }}
                            className="w-full bg-transparent text-center text-[10px] text-white font-bold px-0 focus:outline-none"
                          />
                          <button 
                            onClick={() => handleChangeQty(idx, 1)} 
                            className="w-5 flex items-center justify-center bg-[#181D2B]/80 text-[#8A93A8] hover:bg-[#1F2638] cursor-pointer text-xs"
                          >
                            +
                          </button>
                        </div>
                        <button onClick={() => {
                          const updated = [...cartMos];
                          updated.splice(idx, 1);
                          setCartMos(updated);
                        }} className="text-red-400 hover:text-red-300 w-5 flex items-center justify-center shrink-0 cursor-pointer">✕</button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Cart totals & charge button block */}
          <div className="shrink-0 pt-3 border-t border-white/5 space-y-3">
            <div className="bg-[#1F2638]/20 border border-emerald-500/10 p-3 rounded-xl text-center">
              <div className="text-[9px] uppercase tracking-widest text-[#3E4A60] font-bold mb-0.5">Total a Liquidar</div>
              <div className="text-xl font-bold tracking-tight text-[#E8B04A]">{formatPrice(totalCartValue)}</div>
            </div>

            {/* Payment selections */}
            <div className="grid grid-cols-2 gap-1.5 shrink-0 text-xs">
              <button 
                onClick={() => setPaymentType('efectivo')}
                className={`py-2 px-1 rounded-md text-[10px] font-semibold cursor-pointer transition-all ${paymentType === 'efectivo' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-[#181D2B] border border-white/5 text-[#8A93A8]'}`}
              >
                💵 Efectivo
              </button>
              <button 
                onClick={() => setPaymentType('tarjeta')}
                className={`py-2 px-1 rounded-md text-[10px] font-semibold cursor-pointer transition-all ${paymentType === 'tarjeta' ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400' : 'bg-[#181D2B] border border-white/5 text-[#8A93A8]'}`}
              >
                💳 Tarjeta
              </button>
            </div>

            <div className="space-y-1.5 shrink-0">
              <button 
                onClick={initCobro}
                className="w-full py-3 bg-[#00C896] hover:brightness-105 active:scale-97 text-[#06080C] font-extrabold text-xs tracking-wide rounded-lg cursor-pointer text-center"
              >
                ✓ Cobrar Venta
              </button>
              <button 
                onClick={handleImpTicket}
                className="w-full py-2 bg-[#181D2B] hover:bg-[#1F2638] text-[#8A93A8] hover:text-white border border-white/5 font-semibold text-[10px] tracking-wide rounded-lg cursor-pointer text-center"
              >
                🖨️ Imprimir Ticket de Compra
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* OPTIONS DIALOG PANEL OVERLAY */}
      {showOptionsModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111520] border border-white/10 p-5.5 rounded-2xl max-w-xs w-full space-y-3 shadow-2xl text-left animate-fade-in">
            <div className="font-display font-bold text-sm text-white">Cerradura y Opciones</div>
            <div className="space-y-2 pt-1">
              {!isWorkerMode && (
                <button
                  onClick={() => {
                    setShowOptionsModal(false);
                    onGoBack();
                  }}
                  className="w-full py-2.5 bg-[#181D2B] hover:bg-amber-500/10 hover:text-amber-300 rounded-lg text-xs font-bold text-[#8A93A8] border border-white/5 transition-all text-center cursor-pointer"
                >
                  Salir al Menú de Inicio
                </button>
              )}
              <button 
                onClick={() => setShowOptionsModal(false)}
                className="w-full py-2.5 bg-[#181D2B] hover:bg-[#1F2638] rounded-lg text-xs font-bold text-[#8A93A8] transition-all text-center cursor-pointer"
              >
                Cerrar Ventana
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GEO VALIDATION MAP MODAL */}
      {showGeoModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#111520] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col h-[500px] animate-fade-in">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <div className="font-display font-bold text-sm text-white">Verificación de Tienda (Geo-fencing)</div>
              <button onClick={() => setShowGeoModal(false)} className="text-[#8A93A8] hover:text-white cursor-pointer font-bold text-lg leading-none">&times;</button>
            </div>

            <div className="flex-1 bg-[#181D2B] relative">
              {geoStatus === 'requesting' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-[#8A93A8] space-y-3">
                  <div className="w-8 h-8 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
                  <div className="font-mono text-xs">Adquiriendo señal GPS...</div>
                </div>
              )}
              {hasValidKey ? (
                <APIProvider apiKey={API_KEY} version="weekly">
                  <div className="w-full h-full relative">
                    <Map
                      defaultCenter={geoLoc || { lat: 19.4326, lng: -99.1332 }}
                      defaultZoom={15}
                      mapId="DEMO_MAP_ID"
                      internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                      style={{ width: '100%', height: '100%' }}
                      gestureHandling="greedy"
                    >
                      {geoLoc && (
                        <AdvancedMarker position={geoLoc}>
                          <Pin background="#10B981" glyphColor="#fff" borderColor="#059669" />
                        </AdvancedMarker>
                      )}
                    </Map>
                  </div>
                </APIProvider>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-[#8A93A8] space-y-2 px-6 text-center">
                  <span className="text-2xl">🗺️</span>
                  <div className="font-mono text-[10px]">Google Maps API Key requerida para ver el mapa real.</div>
                  <div className="text-[9px] opacity-70">El GPS seguirá funcionando internamente.</div>
                </div>
              )}
            </div>

            <div className="p-4 bg-[#0A0D14] space-y-3">
              <div className="text-xs text-[#8A93A8]">
                {geoStatus === 'valid' && "📍 Ubicación validada. Te encuentras dentro del perímetro de la tienda (0m demo)."}
                {geoStatus === 'invalid' && "⚠️ Estás fuera del perímetro autorizado (100m). La operación será rechazada."}
                {geoStatus === 'error' && "⚠️ No se pudo obtener tu ubicación. Verifica permisos."}
              </div>
              
              <div className="flex gap-2">
                {geoStatus === 'valid' && (
                  <>
                    <button 
                      onClick={() => setGeoStatus('invalid')}
                      className="flex-1 py-3 bg-[#181D2B] hover:bg-[#1F2638] text-[#8A93A8] text-[10px] font-bold rounded-xl transition-all cursor-pointer border border-white/5"
                    >
                      Simular Fallo
                    </button>
                    <button 
                      onClick={executeCobro}
                      className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-[#06080C] text-[11px] font-extrabold rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
                    >
                      Confirmar Venta
                    </button>
                  </>
                )}
                
                {geoStatus === 'invalid' && (
                  <button 
                    onClick={() => {
                      setShowGeoModal(false);
                      triggerToast('Operación denegada por seguridad (Fuera de rango)', 'err');
                    }}
                    className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[11px] font-extrabold rounded-xl transition-all cursor-pointer border border-red-500/20"
                  >
                    Cerrar Operación
                  </button>
                )}

                {geoStatus === 'error' && (
                  <button 
                    onClick={executeCobro}
                    className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-[#06080C] text-[11px] font-extrabold rounded-xl transition-all cursor-pointer shadow-lg shadow-amber-500/20"
                  >
                    Vender Forzadamente (Offline)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
