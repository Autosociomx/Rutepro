import React, { useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Product, Seller, AppConfig } from '../types';

interface MostradorScreenProps {
  cfg: AppConfig;
  onGoBack: () => void;
  triggerToast: (msg: string, type?: 'ok' | 'err') => void;
}

export const MostradorScreen: React.FC<MostradorScreenProps> = ({ cfg, onGoBack, triggerToast }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [cartMos, setCartMos] = useState<{ id: string; nombre: string; pr: number; icono: string; q: number }[]>([]); // { id, nombre, pr, icono, q }
  const [paymentType, setPaymentType] = useState<'efectivo' | 'tarjeta'>('efectivo');
  const [showOptionsModal, setShowOptionsModal] = useState(false);

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

  const handleCobrar = async () => {
    if (cartMos.length === 0) {
      triggerToast('Agrega productos al carrito para cobrar', 'err');
      return;
    }

    const tot = cartMos.reduce((sum, item) => sum + (item.pr * item.q), 0);
    const saleId = 'S' + Date.now();
    const nowStr = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

    const saleDocData = {
      id: saleId,
      vendedorId: 'v_mostrador',
      vendedorNombre: 'Mostrador local',
      clienteId: 'C_WALKIN_' + Date.now(),
      clienteNombre: 'Cliente de Mostrador',
      monto: tot,
      tipoCobro: 'efectivo', // mapped for simplicity
      items: cartMos.map(item => ({
        id: item.id,
        nombre: item.nombre,
        q: item.q,
        pr: item.pr,
        ic: item.icono
      })),
      timestamp: Date.now()
    };

    try {
      // Sync into global collections
      try {
        await setDoc(doc(db, 'ventas', saleId), saleDocData);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `ventas/${saleId}`);
      }

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
    } catch (err: any) {
      console.error(err);
      triggerToast('Error registrando venta en el servidor', 'err');
    }
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
          <div>
            <div className="text-xs font-bold text-white truncate">{cfg.nombre}</div>
            <div className="text-[10px] text-[#8A93A8] mt-0.5">Mostrador Registradora</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400">
            <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
            <span>Punto de Venta Listo</span>
          </div>
          <button 
            onClick={() => setShowOptionsModal(true)} 
            className="w-8.5 h-8.5 rounded-md bg-[#111520] border border-white/5 flex items-center justify-center text-[#8A93A8] hover:text-white transition-all text-xs cursor-pointer"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* POS Content Body Split layout */}
      <div className="flex-1 flex overflow-hidden p-3.5 gap-3.5 max-h-[calc(100vh-56px)] select-none">
        {/* Left Side: Product catalog with search bar */}
        <div className="flex-1 flex flex-col gap-3 min-w-0 h-full overflow-hidden">
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

        {/* Right Side: Shopping Cart sidebar */}
        <div className="w-[280px] shrink-0 bg-[#0B0E14] border border-white/5 rounded-xl p-3.5 flex flex-col h-full justify-between overflow-hidden">
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
                cartMos.map((item, idx) => (
                  <div key={idx} className="bg-[#111520] border border-white/5 rounded-lg p-2.5 flex items-center justify-between gap-2 animate-fade-in text-left">
                    <span className="text-lg shrink-0">{item.icono}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-bold text-white truncate">{item.nombre}</div>
                      <div className="text-[9px] text-[#8A93A8] mt-0.5">{formatPrice(item.pr)} c/u</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 select-none">
                      <button 
                        onClick={() => handleChangeQty(idx, -1)} 
                        className="w-5 h-5 rounded bg-[#181D2B]/80 text-[#8A93A8] border border-white/5 text-[10px] flex items-center justify-center hover:bg-[#1F2638] cursor-pointer"
                      >
                        −
                      </button>
                      <span className="font-mono text-[10px] leading-none text-white font-bold w-4.5 text-center">{item.q}</span>
                      <button 
                        onClick={() => handleChangeQty(idx, 1)} 
                        className="w-5 h-5 rounded bg-[#181D2B]/80 text-[#8A93A8] border border-white/5 text-[10px] flex items-center justify-center hover:bg-[#1F2638] cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))
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
                onClick={handleCobrar}
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
              <button 
                onClick={() => {
                  setShowOptionsModal(false);
                  onGoBack();
                }}
                className="w-full py-2.5 bg-[#181D2B] hover:bg-amber-500/10 hover:text-amber-300 rounded-lg text-xs font-bold text-[#8A93A8] border border-white/5 transition-all text-center cursor-pointer"
              >
                Salir al Menú de Inicio
              </button>
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
    </div>
  );
};
