import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, setDoc, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Product, Seller, Venta, VentaItem, AppConfig, Devolucion, MysteryAudit, Abono, Client } from '../types';

interface AdminScreenProps {
  cfg: AppConfig;
  onGoBack: () => void;
  triggerToast: (msg: string, type?: 'ok' | 'err') => void;
  onGoConfig?: () => void;
  onCerrarSesion?: () => void;
}

export const AdminScreen: React.FC<AdminScreenProps> = ({ cfg, onGoBack, triggerToast, onGoConfig, onCerrarSesion }) => {
  // Navigation & Tabs consolidated under Administrative Settings Gear, while main screen is AI Chat Dashboard!
  const [showConfigMenu, setShowConfigMenu] = useState(false);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [devoluciones, setDevoluciones] = useState<Devolucion[]>([]);
  const [mysteryAudits, setMysteryAudits] = useState<MysteryAudit[]>([]);
  const [abonos, setAbonos] = useState<Abono[]>([]);
  const [dbClientes, setDbClientes] = useState<Client[]>([]);

  // Detailed modal cards state
  const [selectedCardDetails, setSelectedCardDetails] = useState<'ventas' | 'clientes' | 'saldo' | 'rutas' | null>(null);
  
  // Structured Route / Clients Sequence Map Tracking
  const [clientSubTab, setClientSubTab] = useState<'rutas' | 'cartera'>('rutas');
  const [selectedRouteSellerId, setSelectedRouteSellerId] = useState<string>('');
  const [selectedStopIndex, setSelectedStopIndex] = useState<number>(0);

  // Client Ledger detailed inspection
  const [selectedClientLedger, setSelectedClientLedger] = useState<any | null>(null);
  const [clientSearchInp, setClientSearchInp] = useState('');
  const [abonoMontoPesos, setAbonoMontoPesos] = useState('');
  const [isSubmittingAbono, setIsSubmittingAbono] = useState(false);

  // AI chat states
  const [chatInp, setChatInp] = useState('');
  const [chatLogs, setChatLogs] = useState<{ role: 'bot' | 'usr'; text: string }[]>([
    { role: 'bot', text: `¡Hola! Soy tu Gerente Digital de RoutePro Elite. Sincronizando en tiempo real tu Centro de Distribución (CDS) y personal. ¿Qué reporte financiero o auditoría de deudas deseas verificar hoy?` }
  ]);
  const [chatLoading, setChatLoading] = useState(false);

  // Administrative control states
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [isWiping, setIsWiping] = useState(false);

  // Mystery Auditing subscreen states
  const [showMysteryModal, setShowMysteryModal] = useState(false);
  const [mSelectedSellerId, setMSelectedSellerId] = useState('');
  const [mAuditorName, setMAuditorName] = useState('Auditor Incógnito #1');
  const [mCheckCobro, setMCheckCobro] = useState(true);
  const [mCheckRecibo, setMCheckRecibo] = useState(true);
  const [mCheckPresentacion, setMCheckPresentacion] = useState(true);
  const [mCheckTrato, setMCheckTrato] = useState(true);
  const [mNotas, setMNotas] = useState('');
  const [isSubmittingAudit, setIsSubmittingAudit] = useState(false);

  // Current real-time clock
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }));
      setCurrentDate(now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedCardDetails === 'clientes' && !selectedRouteSellerId && cfg.vendedores && cfg.vendedores.length > 0) {
      setSelectedRouteSellerId(cfg.vendedores[0].id);
      setSelectedStopIndex(0);
    }
  }, [selectedCardDetails, cfg.vendedores, selectedRouteSellerId]);

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  // Multi-route client sequence mapping with fallbacks and real coordinates
  const getRouteBreadcrumbs = (sellerId: string) => {
    const seller = cfg.vendedores.find(v => v.id === sellerId);
    if (!seller) return [];

    // Filter master clients registered for this seller/route in real-time
    const sellerClients = dbClientes.filter(c => c.vendedorId === sellerId);
    
    // Sort them by their sequential timestamp order
    sellerClients.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    // Map to integrated stops
    const mappedStops = sellerClients.map((c, idx) => {
      // Find today's sales for this client
      const todaySales = ventas.filter(
        v => v.vendedorId === sellerId && (v.clienteId === c.id || v.clienteNombre?.toLowerCase() === c.nombre.trim().toLowerCase())
      );
      const isVisited = todaySales.length > 0;
      const totalAmount = todaySales.reduce((acc, v) => acc + v.monto, 0);
      const firstSale = todaySales[todaySales.length - 1]; // oldest sale of today
      const horaStr = firstSale 
        ? new Date(firstSale.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
        : 'Por visitar';

      const creditDebt = todaySales.some(v => v.tipoCobro === 'crédito') ? totalAmount : 0;

      return {
        index: idx + 1,
        id: c.id,
        nombre: c.nombre,
        tipo: c.tipo || 'Abarrotes',
        direccion: c.direccion || 'Dirección de Ruta',
        telefono: c.telefono || 'Sin teléfono',
        horaVisita: horaStr,
        totalVendido: totalAmount,
        tipoCobro: isVisited ? (todaySales[0].tipoCobro === 'crédito' ? 'credito' : 'efectivo') : 'efectivo',
        isReal: true,
        latitude: c.latitude || 19.4326,
        longitude: c.longitude || -99.1332,
        saldoDeuda: creditDebt,
        tip: c.tipo === 'Cremería' 
          ? 'Preguntar por Doña Martha para firmar duplicados contables.'
          : c.tipo === 'Restaurante'
          ? 'Entregar por el andén trasero y recibir pago con el cajero.'
          : 'Tocar timbre o preguntar por el dueño para entrega directa.',
        x: 80 + (idx * 55) % 240, // default grid spacing
        y: 60 + (idx * 35) % 120
      };
    });

    // If there are real clients, normalize their coordinates mathematical projection on SVG map!
    if (mappedStops.length > 1) {
      const lats = mappedStops.map(s => s.latitude);
      const lngs = mappedStops.map(s => s.longitude);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);

      const latDiff = maxLat - minLat;
      const lngDiff = maxLng - minLng;

      mappedStops.forEach((s) => {
        if (lngDiff > 0.00001) {
          s.x = 80 + ((s.longitude - minLng) / lngDiff) * 230;
        } else {
          s.x = 180;
        }
        if (latDiff > 0.00001) {
          s.y = 170 - ((s.latitude - minLat) / latDiff) * 120;
        } else {
          s.y = 110;
        }
      });
    } else if (mappedStops.length === 1) {
      // Center single client node
      mappedStops[0].x = 180;
      mappedStops[0].y = 110;
    }

    // Fallback block if seller has no registered clients yet to maintain high-contrast layout
    if (mappedStops.length === 0) {
      const fallbackClientNames = [
        { name: 'Abarrotes Don Pepe', tipo: 'Minisuper', tip: 'Tocar timbre lateral si el portón principal de hierro está cerrado.', x: 100, y: 70 },
        { name: 'Tienda La Esquina', tipo: 'Abarrotes', tip: 'Entrar por el callejón de carga. Cobro inmediato preferente.', x: 170, y: 55 },
        { name: 'Cremería San Andrés', tipo: 'Cremería', tip: 'Preguntar por Doña Martha para firmar duplicados contables.', x: 240, y: 110 },
        { name: 'MiniSúper Express Gaby', tipo: 'Minisuper', tip: 'Inspeccionar mermas de tostadas y resurtir inventario.', x: 300, y: 140 },
        { name: 'Lonchería El Sabor', tipo: 'Restaurante', tip: 'Estacionar en andén de descarga; el chef recibe personalmente.', x: 210, y: 195 }
      ];

      return fallbackClientNames.map((preset, i) => {
        const customizedName = `${preset.name} (${seller.ruta || 'Ruta ' + seller.id})`;
        return {
          index: i + 1,
          id: `fb_${sellerId}_${i}`,
          nombre: customizedName,
          tipo: preset.tipo,
          direccion: `Blvd. Ecatepec #${310 + i * 36}, Zona ${seller.ruta || 'Centro'}`,
          telefono: `55-3210-${8745 + i}`,
          horaVisita: `${8 + i}:15 AM`,
          totalVendido: 0,
          tipoCobro: 'efectivo',
          isReal: false,
          latitude: 19.4326 + i * 0.005,
          longitude: -99.1332 + i * 0.005,
          saldoDeuda: (i % 2 === 0) ? 38000 : 0,
          tip: preset.tip,
          x: preset.x,
          y: preset.y
        };
      });
    }

    return mappedStops;
  };

  const handleCopyRouteToClipboard = (sellerId: string) => {
    const seller = cfg.vendedores.find(v => v.id === sellerId);
    if (!seller) return;
    
    const stops = getRouteBreadcrumbs(sellerId);
    const dateStr = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
    
    let text = `🚚 *ROUTEPRO ELITE - HOJA DE SUPLENCIA DE RUTA* 🚚\n`;
    text += `--------------------------------------------------\n`;
    text += `📅 *FECHA OPERATIVA:* ${dateStr.toUpperCase()}\n`;
    text += `🛣️ *CANAL/RUTA:* ${seller.ruta || 'Distribución Libre'}\n`;
    text += `👤 *CHOFER TITULAR:* ${seller.nombre}\n`;
    text += `🏢 *CENTRO DE DISTRIBUCIÓN:* CDS Matriz Central\n`;
    text += `--------------------------------------------------\n\n`;
    text += `📍 *0. CDS (INICIO DE RUTA) - CARGA SUGERIDA INICIAL:*\n`;
    
    // Suggest loading products based on catalog
    const loadItems = cfg.productos.slice(0, 3).map(p => `  • ${p.icono || '📦'} [${p.unidad}] ${p.nombre} (Cargar: 25 unids aprox)`).join('\n');
    text += `${loadItems}\n\n`;
    
    text += `🚶‍♂️ *SECUENCIA DE MINUTAS / CLIENTES (MIGAJAS DE PAN):*\n\n`;
    
    stops.forEach((st) => {
      text += `📍 *PARADA #${st.index}: ${st.nombre}* (${st.tipo})\n`;
      text += `   🏠 Dirección: ${st.direccion}\n`;
      text += `   📞 Teléfono: ${st.telefono}\n`;
      text += `   📝 Consigna del Chofer: ${st.tip}\n`;
      if (st.saldoDeuda > 0) {
        text += `   ⚠️ COBRAR ADVERSO: ${formatPrice(st.saldoDeuda)} (Crédito vencido)\n`;
      } else {
        text += `   ✅ Contado / Sin saldo acumulado.\n`;
      }
      text += `\n`;
    });
    
    text += `--------------------------------------------------\n`;
    text += `📲 *Para reportar incidencias o cobros de abonos, favor de registrar la boleta directamente en la terminal de RoutePro en calle.*`;

    navigator.clipboard.writeText(text).then(() => {
      triggerToast('✓ ¡Ruta completa copiada al portapapeles! Lista para WhatsApp.', 'ok');
    }).catch(err => {
      console.warn('Could not copy:', err);
      triggerToast('Error al copiar al portapapeles', 'err');
    });
  };

  // 1. Subscribe to Sales Collection in real-time
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

      // Merge offline cache ventas
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
      localStorage.setItem('rp_ventas', JSON.stringify(mergedSales));
    }, (error) => {
      console.warn('Real-time sales sync offline fallback:', error);
      const localSales = JSON.parse(localStorage.getItem('rp_ventas') || '[]');
      setVentas(localSales);
    });

    return () => unsub();
  }, []);

  // 2. Subscribe to Mermas (Devoluciones)
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
    }, (error) => {
      console.warn('Real-time devoluciones offline:', error);
      const localDevols = JSON.parse(localStorage.getItem('rp_devoluciones') || '[]');
      setDevoluciones(localDevols);
    });

    return () => unsub();
  }, []);

  // 3. Subscribe to Mystery Audits
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
      console.warn('Real-time mystery audits offline:', error);
      const local = JSON.parse(localStorage.getItem('rp_mystery_audits') || '[]');
      setMysteryAudits(local);
    });

    return () => unsub();
  }, []);

  // 4. Subscribe to Payments (Abonos) Sincronizados
  useEffect(() => {
    const q = query(collection(db, 'abonos'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const paymentsList: Abono[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        paymentsList.push({
          id: docSnap.id,
          clienteNombre: d.clienteNombre || '',
          monto: Number(d.monto) || 0,
          fecha: d.fecha || '',
          timestamp: d.timestamp || Date.now(),
          recibidoPor: d.recibidoPor || 'Administrador (Cdis)'
        });
      });
      setAbonos(paymentsList);
      localStorage.setItem('rp_abonos', JSON.stringify(paymentsList));
    }, (error) => {
      console.warn('Real-time payments sync fallback:', error);
      const local = JSON.parse(localStorage.getItem('rp_abonos') || '[]');
      setAbonos(local);
    });

    return () => unsub();
  }, []);

  // 5. Subscribe to Master Clients Collection
  useEffect(() => {
    const q = query(collection(db, 'clientes'));
    const unsub = onSnapshot(q, (snapshot) => {
      const clientsList: Client[] = [];
      snapshot.forEach((docSnap) => {
        clientsList.push({ id: docSnap.id, ...docSnap.data() } as Client);
      });
      setDbClientes(clientsList);
      localStorage.setItem('rp_clientes', JSON.stringify(clientsList));
    }, (error) => {
      console.warn('Real-time clients sync error:', error);
      const local = JSON.parse(localStorage.getItem('rp_clientes') || '[]');
      setDbClientes(local);
    });

    return () => unsub();
  }, []);

  // Group and compute client transaction accounts, credit ledger balances and historic purchases
  const getClientesLedger = () => {
    const ledgerTable: { [key: string]: { nombre: string; total_compras: number; total_abonos: number; saldo_actual: number; visitas_totales: number; compras: Venta[]; abonos_detalles: Abono[] } } = {};

    ventas.forEach((v) => {
      const cName = v.clienteNombre?.trim() || 'Cliente General';
      if (!ledgerTable[cName]) {
        ledgerTable[cName] = { 
          nombre: cName, 
          total_compras: 0, 
          total_abonos: 0, 
          saldo_actual: 0, 
          visitas_totales: 0, 
          compras: [],
          abonos_detalles: []
        };
      }
      ledgerTable[cName].visitas_totales += 1;
      ledgerTable[cName].compras.push(v);
      
      // Accumulate granted credit amount
      if (v.tipoCobro === 'crédito') {
        ledgerTable[cName].total_compras += v.monto || 0;
      }
    });

    abonos.forEach((ab) => {
      const cName = ab.clienteNombre?.trim();
      if (!ledgerTable[cName]) {
        ledgerTable[cName] = { 
          nombre: cName, 
          total_compras: 0, 
          total_abonos: 0, 
          saldo_actual: 0, 
          visitas_totales: 0, 
          compras: [],
          abonos_detalles: []
        };
      }
      ledgerTable[cName].total_abonos += ab.monto || 0;
      ledgerTable[cName].abonos_detalles.push(ab);
    });

    // Compute outstanding balances
    for (const key in ledgerTable) {
      ledgerTable[key].saldo_actual = Math.max(0, ledgerTable[key].total_compras - ledgerTable[key].total_abonos);
      // Sort purchases chronologically
      ledgerTable[key].compras.sort((a, b) => b.timestamp - a.timestamp);
      ledgerTable[key].abonos_detalles.sort((a, b) => b.timestamp - a.timestamp);
    }

    return Object.values(ledgerTable).sort((a, b) => b.saldo_actual - a.saldo_actual);
  };

  const computedLedgerList = getClientesLedger();

  // Metrics calculations for the 4 key cards
  const totalCobrado = ventas.reduce((sum, v) => sum + (v.monto || 0), 0);
  const totalPedidos = ventas.length;
  
  // Total unique customers encountered
  const totalUniqueClientsCount = computedLedgerList.length;
  
  // Accounts receivable / Outstanding pending credit amount
  const totalPendingBalanceCents = computedLedgerList.reduce((sum, c) => sum + c.saldo_actual, 0);
  const totalClientsWithDebtCount = computedLedgerList.filter(c => c.saldo_actual > 0).length;

  // Active delivery persons/routes
  const activeSellersInVentas = new Set(
    ventas
      .filter(v => v.vendedorId !== 'v_mostrador')
      .map(v => v.vendedorId)
  );
  const activeRoutesCount = activeSellersInVentas.size || cfg.vendedores?.filter(v => v.rol !== 'cajero').length || 0;

  // Top products calculation
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

  // AI execution routine sending context questions
  const handleAskAI = async (textOver?: string) => {
    const qStr = textOver || chatInp.trim();
    if (!qStr) return;
    if (!textOver) setChatInp('');

    const newLogs = [...chatLogs, { role: 'usr', text: qStr }];
    setChatLogs([...newLogs, { role: 'bot', text: '⏳ Consultando telemetría del Centro de Distribución...' }]);
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
          abonos: abonos,
          clientesLedger: computedLedgerList,
          chatHistory: chatLogs.slice(-6)
        })
      });
      const data = await response.json();
      setChatLogs([...newLogs, { role: 'bot', text: data.text || 'Sin respuesta del asesor.' }]);
    } catch (err) {
      setChatLogs([...newLogs, { role: 'bot', text: `Asesoría offline: El balance del día registra cobros por ${formatPrice(totalCobrado)} en ${totalPedidos} pedidos. El saldo pendiente de cobros créditarios es de ${formatPrice(totalPendingBalanceCents)} de ${totalClientsWithDebtCount} clientes deudores.` }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Safe reset routine
  const handleWipeData = async () => {
    setIsWiping(true);
    triggerToast('🗑️ Eliminando transacciones de la nube y caches...');
    try {
      localStorage.removeItem('rp_ventas');
      localStorage.removeItem('rp_devoluciones');
      localStorage.removeItem('rp_mystery_audits');
      localStorage.removeItem('rp_abonos');
      setVentas([]);
      setDevoluciones([]);
      setMysteryAudits([]);
      setAbonos([]);

      const vSnap = await getDocs(query(collection(db, 'ventas')));
      const dSnap = await getDocs(query(collection(db, 'devoluciones')));
      const mSnap = await getDocs(query(collection(db, 'mystery_audits')));
      const abSnap = await getDocs(query(collection(db, 'abonos')));

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
      abSnap.forEach((docSnap) => {
        batch.delete(doc(db, 'abonos', docSnap.id));
      });

      await batch.commit();

      triggerToast('✓ Balance, cuentas y auditorías restauradas en ceros.', 'ok');
      setShowWipeConfirm(false);
      setShowConfigMenu(false);
    } catch (e: any) {
      console.error(e);
      triggerToast('Error al limpiar registros de la nube', 'err');
    } finally {
      setIsWiping(false);
    }
  };

  // Abonos (Credit Payment) register handler
  const handleRegisterAbonoForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientLedger) return;
    const pesos = parseFloat(abonoMontoPesos);
    if (isNaN(pesos) || pesos <= 0) {
      triggerToast('Ingresa una cantidad válida superior a $0.00 pesos', 'err');
      return;
    }
    const cents = Math.round(pesos * 100);
    if (cents > selectedClientLedger.saldo_actual) {
      triggerToast(`El abono supera el saldo deudor actual de ${formatPrice(selectedClientLedger.saldo_actual)}`, 'err');
      return;
    }

    setIsSubmittingAbono(true);
    triggerToast('⏳ Sincronizando pago con la nube...');

    const abonoId = 'AB_' + Date.now();
    const abonoObj: Abono = {
      id: abonoId,
      clienteNombre: selectedClientLedger.nombre,
      monto: cents,
      fecha: new Date().toLocaleDateString('es-MX'),
      timestamp: Date.now(),
      recibidoPor: 'Matriz (Caja Central)'
    };

    try {
      await setDoc(doc(db, 'abonos', abonoId), abonoObj);
      
      // Update local storage payment lists immediately to avoid stale interface
      const prevAbonos = JSON.parse(localStorage.getItem('rp_abonos') || '[]');
      const updatedAbonos = [abonoObj, ...prevAbonos];
      localStorage.setItem('rp_abonos', JSON.stringify(updatedAbonos));
      setAbonos(updatedAbonos);

      triggerToast(`✓ ¡Abono de ${formatPrice(cents)} aplicado de forma exitosa a ${selectedClientLedger.nombre}!`, 'ok');
      
      // Recast computed ledger selection
      const updatedLedger = getClientesLedger();
      const match = updatedLedger.find(c => c.nombre === selectedClientLedger.nombre);
      if (match) {
        setSelectedClientLedger(match);
      } else {
        setSelectedClientLedger(null);
      }
      setAbonoMontoPesos('');
    } catch (err) {
      console.error(err);
      triggerToast('Fallo al cargar abono en Firestore', 'err');
    } finally {
      setIsSubmittingAbono(false);
    }
  };

  // Mystery Auditing handler
  const handleCreateMysteryAudit = async () => {
    if (!mSelectedSellerId) {
      triggerToast('Selecciona un vendedor para auditar.', 'err');
      return;
    }
    const targetSeller = cfg.vendedores.find(v => v.id === mSelectedSellerId);
    if (!targetSeller) {
      triggerToast('Vendedor no encontrado.', 'err');
      return;
    }

    setIsSubmittingAudit(true);
    triggerToast('⏳ Sincronizando auditoría misteriosa...');

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
      await setDoc(doc(db, 'mystery_audits', auditId), auditObj);
      const prev = JSON.parse(localStorage.getItem('rp_mystery_audits') || '[]');
      localStorage.setItem('rp_mystery_audits', JSON.stringify([auditObj, ...prev]));
      
      triggerToast('✓ Auditoría misteriosa sincronizada en vivo con la comandancia.', 'ok');
      setShowMysteryModal(false);
      
      setMNotas('');
      setMAuditorName('Auditor Incógnito #1');
      setMCheckCobro(true);
      setMCheckRecibo(true);
      setMCheckPresentacion(true);
      setMCheckTrato(true);
    } catch (err) {
      console.error(err);
      triggerToast('Error al registrar auditoría', 'err');
    } finally {
      setIsSubmittingAudit(false);
    }
  };

  // Filter client list based on search word
  const filteredLedgers = computedLedgerList.filter(l => 
    l.nombre.toLowerCase().includes(clientSearchInp.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#06080C] text-[#EEF1F8] flex flex-col font-sans relative pb-8">
      
      {/* Dynamic Header: RoutePro Phone Aesthetic */}
      <div 
        className="sticky top-0 z-40 bg-[#06080C]/90 backdrop-blur-md border-b px-4.5 py-3 flex items-center justify-between shadow-lg"
        style={{ borderColor: `${cfg.color_principal}20` }}
      >
        <div className="flex items-center gap-2.5 text-left min-w-0">
          <div 
            className="w-9 h-9 rounded-lg bg-[#111520] border flex items-center justify-center font-display font-bold shrink-0 overflow-hidden"
            style={{ borderColor: `${cfg.color_principal}35` }}
          >
            {cfg.logo_url ? (
              <img src={cfg.logo_url} className="w-full h-full object-contain p-0.5" alt="Logo" referrerPolicy="no-referrer" />
            ) : (
              <span className="text-sm" style={{ color: cfg.color_principal }}>{cfg.letra || 'TN'}</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate">{cfg.nombre}</div>
            <div className="text-[9px] text-gray-400 tracking-wider flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Cdis Conectado</span>
            </div>
          </div>
        </div>

        {/* Dynamic local date/clock indicator */}
        <div className="text-right hidden sm:block">
          <div className="text-xs font-bold text-white shrink-0 font-mono">{currentTime}</div>
          <div className="text-[8px] text-gray-500 uppercase tracking-wide font-medium mt-0.5">{currentDate}</div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Action Menu button */}
          <button 
            onClick={() => setShowConfigMenu(!showConfigMenu)}
            className="w-9 h-9 rounded-lg bg-[#111520] hover:bg-[#1C2235] border border-white/5 flex items-center justify-center text-gray-300 hover:text-white transition-all text-xs cursor-pointer relative"
          >
            ⚙️
          </button>
          
          <button 
            onClick={onGoBack} 
            className="w-9 h-9 rounded-lg bg-[#111520] hover:bg-slate-800 border border-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-all text-xs cursor-pointer"
          >
            ←
          </button>
        </div>
      </div>

      {/* ADMIN CONTROL ACCORDION POPUP PANEL */}
      {showConfigMenu && (
        <div className="bg-[#0B0E14] border-b border-white/5 p-4.5 space-y-3 animate-fade-in absolute top-14 left-0 right-0 z-40 shadow-2xl">
          <div className="text-left pb-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#EEF1F8]">Centro de Operaciones Corporativas</h4>
            <p className="text-[10px] text-gray-400 leading-normal mt-0.5">Auditoría, control de flotillas y mermas en vivo.</p>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => {
                setShowConfigMenu(false);
                setSelectedCardDetails('rutas');
              }}
              className="p-3 bg-[#111520] border border-white/5 rounded-xl hover:bg-[#181D2B] text-left text-xs text-white cursor-pointer transition-all"
            >
              🚚 Flotilla y Rutas
            </button>
            <button 
              onClick={() => {
                setShowConfigMenu(false);
                if (cfg.vendedores.length > 0) {
                  setMSelectedSellerId(cfg.vendedores[0].id);
                }
                setShowMysteryModal(true);
              }}
              className="p-3 bg-[#111520] border border-white/5 rounded-xl hover:bg-[#181D2B] text-left text-xs text-amber-300 cursor-pointer transition-all"
            >
              🕵️‍♂️ Cliente Misterioso
            </button>
            <button 
              onClick={() => {
                setShowConfigMenu(false);
                onGoConfig?.();
              }}
              className="p-3 bg-[#111520] border border-white/5 rounded-xl hover:bg-[#181D2B] text-left text-xs text-gray-300 cursor-pointer transition-all"
            >
              🛠️ Cambiar Catálogo / Precios
            </button>
            <button 
              onClick={() => {
                setShowConfigMenu(false);
                setShowWipeConfirm(true);
              }}
              className="p-3 bg-red-650/10 border border-red-500/20 rounded-xl hover:bg-red-650/20 text-left text-xs text-red-400 cursor-pointer transition-all"
            >
              🧹 Limpiar Base a Cerdos ($0)
            </button>
          </div>

          <button 
            onClick={() => {
              setShowConfigMenu(false);
              setShowExitConfirm(true);
            }}
            className="w-full py-2.5 bg-red-600 font-bold hover:bg-red-500 rounded-xl text-xs text-white cursor-pointer transition-all text-center"
          >
            🚪 Cambiar de Negocio / Salir de Demostración
          </button>
        </div>
      )}

      {/* Main Container Layout */}
      <div className="flex-1 max-w-lg mx-auto w-full px-4 pt-4 space-y-4">
        
        {/* Welcoming Greeting Slogan */}
        <div className="text-left space-y-1 py-1">
          <div className="text-sm font-display font-medium text-gray-400">¡Buenos días, Administrador!</div>
          <h2 className="text-xl font-display font-extrabold text-white tracking-tight leading-none">Aquí tienes el resumen de hoy</h2>
          <p className="text-[10px] text-gray-500 font-mono mt-0.5" style={{ color: `${cfg.color_principal}E0` }}>{cfg.subtitulo || 'RoutePro Elite Shift Control'}</p>
        </div>

        {/* THE 3 KEY METRICS DIRECT CARDS */}
        <div className="grid grid-cols-2 gap-2.5">
          
          {/* Card 1: Sales of the day (occupies col-span-2) */}
          <div 
            onClick={() => setSelectedCardDetails('ventas')}
            className="col-span-2 bg-[#111520] border border-white/5 rounded-2xl p-4.5 text-left cursor-pointer hover:border-emerald-500/20 hover:bg-[#151A28] transition-all relative group overflow-hidden active:scale-97 select-none"
          >
            <div className="absolute top-2.5 right-3.5 text-lg opacity-80 group-hover:scale-110 transition-transform">📈</div>
            <div className="text-xs font-mono font-bold text-gray-400 tracking-wide uppercase">Ventas del Día</div>
            <div className="text-lg font-extrabold text-emerald-400 mt-2 tracking-tight">{formatPrice(totalCobrado)}</div>
            <div className="text-[9px] text-gray-500 mt-1 flex items-center gap-1 font-medium font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{totalPedidos} transacciones hoy</span>
            </div>
            <div className="mt-2 text-[8px] text-emerald-300 font-semibold flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <span>Examinar reporte detallado</span>
              <span>→</span>
            </div>
          </div>

          {/* Card 2: Daily Routes & Sequence Maps (absorbed Clients) */}
          <div 
            onClick={() => {
              setSelectedCardDetails('rutas');
              if (cfg.vendedores && cfg.vendedores.length > 0) {
                setSelectedRouteSellerId(cfg.vendedores[0].id);
                setSelectedStopIndex(0);
              }
            }}
            className="col-span-1 bg-[#111520] border border-white/5 rounded-2xl p-4.5 text-left cursor-pointer hover:border-purple-500/20 hover:bg-[#151A28] transition-all relative group overflow-hidden active:scale-97 select-none"
          >
            <div className="absolute top-2.5 right-3.5 text-lg opacity-80 group-hover:scale-110 transition-transform">🗺️</div>
            <div className="text-xs font-mono font-bold text-gray-400 tracking-wide uppercase">Rutas del Día</div>
            <div className="text-lg font-extrabold text-purple-400 mt-2 tracking-tight">{activeRoutesCount} en curso</div>
            <div className="text-[9px] text-gray-500 mt-1 flex items-center gap-1 font-medium font-mono">
              <span>Mapas, Secuencias y Clientes</span>
            </div>
            <div className="mt-2 text-[8px] text-purple-300 font-semibold flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <span>Ir al ruteo</span>
              <span>→</span>
            </div>
          </div>

          {/* Card 3: Pending Balance ("El Fiado") */}
          <div 
            onClick={() => setSelectedCardDetails('saldo')}
            className="col-span-1 bg-[#111520] border border-white/5 rounded-2xl p-4.5 text-left cursor-pointer hover:border-amber-500/20 hover:bg-[#151A28] transition-all relative group overflow-hidden active:scale-97 select-none"
          >
            <div className="absolute top-2.5 right-3.5 text-lg opacity-80 group-hover:scale-110 transition-transform">💵</div>
            <div className="text-xs font-mono font-bold text-gray-400 tracking-wide uppercase">Saldo Pendiente</div>
            <div className="text-lg font-extrabold text-amber-500 mt-2 tracking-tight">{formatPrice(totalPendingBalanceCents)}</div>
            <div className="text-[9px] text-gray-500 mt-1 flex items-center gap-1 font-medium font-mono text-amber-500/85">
              <span>{totalClientsWithDebtCount} deudores</span>
            </div>
            <div className="mt-2 text-[8px] text-amber-300 font-semibold flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <span>Abonos y Cobros</span>
              <span>→</span>
            </div>
          </div>

        </div>

        {/* REAL-TIME ARTIFICIAL INTELLIGENCE CHATBOT INTERFACE */}
        <div 
          className="bg-[#111520] border rounded-2xl flex flex-col h-[380px] justify-between overflow-hidden shadow-xl"
          style={{ borderColor: `${cfg.color_principal}25` }}
        >
          {/* AI Banner */}
          <div className="bg-[#161B28] px-4.5 py-2.5 border-b border-white/5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm">🧠</span>
              <div className="text-left">
                <div className="text-xs font-bold text-white uppercase tracking-wider">Gerente Virtual Inteligente</div>
                <div className="text-[9px] text-gray-400">Analista financiero sin alucinaciones</div>
              </div>
            </div>
            <span className="text-[8px] font-mono font-extrabold text-slate-900 px-2 py-0.5 rounded uppercase select-none font-bold" style={{ backgroundColor: cfg.color_principal }}>
              IA Activa
            </span>
          </div>

          {/* Chat Stream Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-white/5">
            {chatLogs.map((log, idx) => (
              <div 
                key={idx} 
                className={`flex ${log.role === 'usr' ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`p-3 rounded-2xl max-w-[85%] text-xs leading-relaxed text-left ${log.role === 'usr' ? 'bg-[#1D2536] text-white border border-white/5' : 'bg-[#15132B]/60 border text-[#E4E8F4]'}`}
                  style={{ borderColor: log.role === 'bot' ? `${cfg.color_principal}20` : 'transparent' }}
                >
                  {log.role === 'bot' && (
                    <span 
                      className="block text-[8px] font-mono uppercase font-extrabold tracking-wider mb-1"
                      style={{ color: cfg.color_principal }}
                    >
                      RoutePro AI · Asistente
                    </span>
                  )}
                  {log.text}
                </div>
              </div>
            ))}
          </div>

          {/* AI Shortcuts prompt sliders */}
          <div className="shrink-0 space-y-1 bg-[#151925]/30 p-2 border-t border-white/5">
            <div className="flex gap-1.5 overflow-x-auto pb-1 select-none no-scrollbar">
              <button 
                onClick={() => handleAskAI('¿Qué ruta/vendedor de reparto vendió más hoy?')} 
                className="bg-[#181E2B] hover:bg-[#1F273D] border border-white/5 rounded-full px-3 py-1.5 text-[9px] text-gray-300 font-semibold whitespace-nowrap active:scale-95 transition-all text-left cursor-pointer"
              >
                📈 Mejor ruta hoy
              </button>
              <button 
                onClick={() => handleAskAI('¿Quiénes son mis deudores y cuánto me debe cada cliente?')} 
                className="bg-[#181E2B] hover:bg-[#1F273D] border border-white/5 rounded-full px-3 py-1.5 text-[9px] text-gray-300 font-semibold whitespace-nowrap active:scale-95 transition-all text-left cursor-pointer"
              >
                💵 Listar deudas de crédito
              </button>
              <button 
                onClick={() => handleAskAI('Dame el reporte resumido del día para mandar por WhatsApp con formato corporativo')} 
                className="bg-[#181E2B] hover:bg-[#1F273D] border border-white/5 rounded-full px-3 py-1.5 text-[9px] text-gray-300 font-semibold whitespace-nowrap active:scale-95 transition-all text-left cursor-pointer"
              >
                💬 WhatsApp del día
              </button>
              <button 
                onClick={() => handleAskAI('¿Cuánto efectivo acumulado total tenemos en terminales de reparto?')} 
                className="bg-[#181E2B] hover:bg-[#1F273D] border border-white/5 rounded-full px-3 py-1.5 text-[9px] text-gray-300 font-semibold whitespace-nowrap active:scale-95 transition-all text-left cursor-pointer"
              >
                💰 Efectivo en tránsito
              </button>
            </div>

            {/* Input form bar */}
            <div className="flex gap-1.5 bg-[#0B0E14] border border-white/5 rounded-xl p-1.5">
              <input 
                type="text" 
                value={chatInp} 
                onChange={(e) => setChatInp(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
                className="flex-1 bg-transparent px-2.5 py-1.5 text-xs focus:outline-none placeholder-gray-500 text-white"
                placeholder="Escribe tu consulta financiera o de créditos..."
              />
              <button 
                onClick={() => handleAskAI()} 
                disabled={chatLoading}
                className="w-8.5 h-8.5 rounded-lg font-bold hover:brightness-110 flex items-center justify-center shrink-0 active:scale-95 cursor-pointer text-slate-900 text-sm disabled:opacity-45"
                style={{ backgroundColor: cfg.color_principal }}
              >
                🚀
              </button>
            </div>
          </div>
        </div>

        {/* EXTRA DISPUTE RESOLUTION HELPER CARD */}
        <div className="p-4 rounded-2xl bg-[#111520] border border-white/5 text-left flex gap-3.5 items-start">
          <span className="text-xl">🛡️</span>
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-white">Soporte Aclaratorio Antidisputas</h4>
            <p className="text-[10px] text-gray-400 leading-relaxed">
              Resuelve discrepancias contables con deudores al instante. Pulsa en la tarjeta <strong>SALDO PENDIENTE</strong> para imprimir y verificar tickets históricos consolidados con firmas, choferes y desglose de mercancías.
            </p>
          </div>
        </div>

      </div>

      {/* DETAILED INTERACTIVE BOTTOM DIALER DRAWER MODALS */}
      {selectedCardDetails && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4.5 animate-fade-in">
          
          <div className="bg-[#111520] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Drawer Header */}
            <div className="sticky top-0 bg-[#161B28] px-5 py-3.5 border-b border-white/5 flex items-center justify-between shrink-0">
              <div className="text-left">
                <span className="text-[9px] tracking-wider font-mono uppercase font-extrabold" style={{ color: cfg.color_principal }}>
                  RoutePro Elite Telemetría
                </span>
                <h3 className="font-display font-extrabold text-white text-sm uppercase mt-0.5">
                  {selectedCardDetails === 'ventas' && '📊 Reporte de Ventas de Hoy'}
                  {selectedCardDetails === 'saldo' && '💵 Cartera "El Fiado" y Saldos Pendientes'}
                  {selectedCardDetails === 'rutas' && '🚚 Rutas del Día, Mapas y Clientes'}
                </h3>
              </div>
              <button 
                onClick={() => {
                  setSelectedCardDetails(null);
                  setSelectedClientLedger(null);
                  setClientSearchInp('');
                }}
                className="bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Scrollable drawer body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-left">
              
              {/* DETAILS B: VENTAS REPORT */}
              {selectedCardDetails === 'ventas' && (
                <div className="space-y-4">
                  {/* Visual Timeline SVG and KPI metrics */}
                  <div className="grid grid-cols-2 gap-2 bg-[#0C101A] p-3 rounded-xl border border-white/5 text-center">
                    <div>
                      <div className="text-[#00C896] font-mono font-bold text-base">{formatPrice(totalCobrado)}</div>
                      <div className="text-[8px] uppercase font-bold text-gray-500 mt-0.5">Cobro Total</div>
                    </div>
                    <div>
                      <div className="text-sky-400 font-mono font-bold text-base">{totalPedidos}</div>
                      <div className="text-[8px] uppercase font-bold text-gray-500 mt-0.5">Entregas Hechas</div>
                    </div>
                  </div>

                  {/* Top Articles Progress Indicators */}
                  <div className="p-4 bg-[#0B0E14] border border-white/5 rounded-xl space-y-3">
                    <div className="text-xs font-bold text-white uppercase tracking-wider">Top Artículos Surtidos Hoy</div>
                    <div className="space-y-2.5">
                      {topProducts.length === 0 ? (
                        <div className="text-center py-2 text-[10px] text-gray-500">Sin transmisiones de ruta en cola</div>
                      ) : (
                        topProducts.map((p, index) => {
                          const pct = Math.round((p.totalCents / maxProductRevenue) * 100);
                          return (
                            <div key={index} className="space-y-1">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-300 font-medium truncate">{p.icono} {p.nombre}</span>
                                <span className="font-bold text-[#E8B04A] font-mono">{formatPrice(p.totalCents)} <span className="text-[9px] text-gray-500">({p.qty}x)</span></span>
                              </div>
                              <div className="h-1 bg-[#181D2B] rounded-full overflow-hidden">
                                <div 
                                  className="h-full rounded-full"
                                  style={{ width: `${pct}%`, backgroundColor: cfg.color_principal }}
                                />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Complete transactions list of today */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Historial de Boletas de Venta</div>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                      {ventas.length === 0 ? (
                        <div className="text-center py-5 text-[10px] text-gray-500">Ninguna venta registrada todavía hoy.</div>
                      ) : (
                        ventas.map((v) => (
                          <div key={v.id} className="bg-[#181D2B] border border-white/5 p-3 rounded-lg flex justify-between items-start text-xs">
                            <div className="space-y-1">
                              <div className="font-bold text-white flex items-center gap-1.5">
                                <span>{v.clienteNombre}</span>
                                {v.tipoCobro === 'crédito' && (
                                  <span className="bg-amber-500/10 text-amber-400 text-[8px] font-mono px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Crédito Unpaid</span>
                                )}
                              </div>
                              <div className="text-[10px] text-gray-400">
                                Surtido por: {v.vendedorNombre} · {new Date(v.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                            <span className="font-mono font-bold text-[#E8B04A]">{formatPrice(v.monto)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>
              )}

              {/* DETAILS C: OUTSTANDING CREDITS ("EL FIADO") */}
              {selectedCardDetails === 'saldo' && (
                <div className="space-y-4">
                  
                  {/* Summary aggregate stats of due accounts */}
                  <div className="bg-amber-500/5 border border-amber-500/10 p-3.5 rounded-xl flex gap-3 text-xs text-amber-200">
                    <span className="text-sm">💡</span>
                    <p className="leading-relaxed">
                      Total en cartera vencida / saldo por cobrar asignado en calle: <strong>{formatPrice(totalPendingBalanceCents)}</strong> distribuido en <strong>{totalClientsWithDebtCount} deudores</strong>.
                    </p>
                  </div>

                  {/* Filter / Search section */}
                  <div className="flex gap-2 bg-[#0B0E14] border border-white/5 rounded-xl p-2 items-center">
                    <span className="pl-1.5 text-xs">🔍</span>
                    <input 
                      type="text"
                      value={clientSearchInp}
                      onChange={(e) => setClientSearchInp(e.target.value)}
                      className="flex-1 bg-transparent text-xs text-white focus:outline-none placeholder-gray-500"
                      placeholder="Buscar cliente deudor por nombre..."
                    />
                    {clientSearchInp && (
                      <button onClick={() => setClientSearchInp('')} className="bg-white/5 text-gray-400 hover:text-white px-2 rounded-lg text-[10px] cursor-pointer">Limpiar</button>
                    )}
                  </div>

                  {/* Client ledgers results scroll list */}
                  <div className="space-y-2 max-h-[290px] overflow-y-auto pr-1">
                    {filteredLedgers.filter(l => l.saldo_actual > 0).length === 0 ? (
                      <div className="text-center py-8 text-[10px] text-gray-500">Ningún cliente deudor coincide con la búsqueda.</div>
                    ) : (
                      filteredLedgers
                        .filter(l => l.saldo_actual > 0)
                        .map((l, idx) => (
                          <div 
                            key={idx} 
                            onClick={() => setSelectedClientLedger(l)}
                            className={`border rounded-xl p-3.5 flex justify-between items-center cursor-pointer transition-all active:scale-97 text-xs ${selectedClientLedger?.nombre === l.nombre ? 'bg-indigo-950/10 border-indigo-500/30' : 'bg-[#181D2B] border-white/5 hover:bg-[#1E2536]'}`}
                          >
                            <div className="space-y-1 text-left min-w-0">
                              <div className="font-bold text-white flex items-center gap-1.5">
                                <span className="truncate">{l.nombre}</span>
                                <span className="bg-amber-500/10 text-amber-400 text-[8px] px-1.5 py-0.5 rounded font-mono font-bold uppercase shrink-0">Deuda activa</span>
                              </div>
                              <div className="text-[10px] text-gray-400 font-mono">
                                Visitas hechas: {l.visitas_totales} · Último chofer: {l.compras[0]?.vendedorNombre || 'N/A'}
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div className="text-gray-400 text-[9px] font-mono">Saldo Deuda</div>
                              <div className="text-sm font-bold font-mono mt-0.5 text-amber-500">
                                {formatPrice(l.saldo_actual)}
                              </div>
                            </div>
                          </div>
                        ))
                    )}
                  </div>

                  {/* DETAILED DOUBLE-SIGNED VERIFICATION TICKET WINDOW & PAYMENTS RECONCILIATION */}
                  {selectedClientLedger && (
                    <div className="bg-[#0C101A] border border-white/10 p-5 rounded-2xl space-y-4.5 mt-2.5 animate-slide-up text-left">
                      
                      <div className="flex justify-between items-start border-b border-white/10 pb-3">
                        <div>
                          <span className="text-[9px] text-indigo-400 uppercase font-mono font-extrabold tracking-wider">Historial Verificable Oficial</span>
                          <h4 className="text-sm font-bold text-white mt-0.5">Historial Contable: {selectedClientLedger.nombre}</h4>
                        </div>
                        <button 
                          onClick={() => setSelectedClientLedger(null)}
                          className="text-xs bg-white/5 hover:bg-white/10 text-gray-400 px-2 py-0.5 rounded hover:text-white cursor-pointer"
                        >
                          Cerrar boleta
                        </button>
                      </div>

                      {/* Unified physical statement ticker style */}
                      <div className="bg-[#111520] border border-white/5 p-4 rounded-xl space-y-3 font-mono text-[9px]">
                        <div className="text-center border-b border-white/5 pb-2">
                          <div className="text-[10px] font-extrabold text-[#E8B04A] uppercase tracking-wide">RoutePro Elite Compliance</div>
                          <div className="text-gray-500 text-[8px] uppercase mt-0.5">Comprobante Certificado Antidesacuerdos</div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-gray-400">
                            <span>CLIENTE DEUDOR:</span>
                            <span className="font-extrabold text-white text-[10px]">{selectedClientLedger.nombre}</span>
                          </div>
                          <div className="flex justify-between text-gray-400">
                            <span>REGISTROS ASOCIADOS:</span>
                            <span className="text-white">{selectedClientLedger.compras.length} boletas</span>
                          </div>
                          <div className="flex justify-between text-gray-450">
                            <span>MONTO HISTÓRICO CRÉDITOS:</span>
                            <span className="text-white">{formatPrice(selectedClientLedger.total_compras)}</span>
                          </div>
                          <div className="flex justify-between text-gray-450">
                            <span>PAGOS/ABONOS REGISTRADOS:</span>
                            <span className="text-emerald-400 font-bold">-{formatPrice(selectedClientLedger.total_abonos)}</span>
                          </div>
                          <div className="flex justify-between border-t border-white/5 pt-1.5 text-xs">
                            <span className="text-amber-500 font-extrabold">SALDO DEUDOR PENDIENTE:</span>
                            <span className="text-amber-400 font-extrabold">{formatPrice(selectedClientLedger.saldo_actual)}</span>
                          </div>
                        </div>

                        {/* Purchases History lists for dispute checkout */}
                        <div className="space-y-1.5 pt-2">
                          <div className="text-[8px] text-gray-500 uppercase tracking-wider font-extrabold">Desglose Cronológico de Rutas:</div>
                          
                          <div className="space-y-1 max-h-[140px] overflow-y-auto bg-[#070A11] p-1.5 rounded border border-white/5">
                            {selectedClientLedger.compras.map((compra: Venta, index: number) => (
                              <div key={index} className="border-b border-white/5 pb-1 last:border-0 pt-1 last:pb-0 text-[8px]">
                                <div className="flex justify-between font-bold text-gray-300">
                                  <span>📅 {new Date(compra.timestamp).toLocaleDateString('es-MX')} ({compra.vendedorNombre})</span>
                                  <span className={compra.tipoCobro === 'crédito' ? 'text-amber-400' : 'text-gray-400'}>{formatPrice(compra.monto)} [{compra.tipoCobro === 'crédito' ? 'CRÉDITO' : 'EFECTIVO'}]</span>
                                </div>
                                <div className="text-gray-500 mt-0.5">
                                  Detalles: {compra.items.map(it => `${it.q}x ${it.nombre}`).join(', ')}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Abonos Payments list */}
                        {selectedClientLedger.abonos_detalles.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <div className="text-[8px] text-emerald-500 uppercase tracking-wider font-extrabold">Historial de Abonos Recibidos:</div>
                            <div className="space-y-1 bg-[#070A11] p-1.5 rounded border border-emerald-500/10">
                              {selectedClientLedger.abonos_detalles.map((pago: Abono, index: number) => (
                                <div key={index} className="flex justify-between text-[8px] text-gray-400">
                                  <span>🟢 {pago.fecha} · Surtidor: {pago.recibidoPor}</span>
                                  <span className="font-bold text-emerald-400">+{formatPrice(pago.monto)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="text-center pt-2 border-t border-white/5">
                          <button 
                            onClick={() => {
                              window.print();
                            }}
                            className="bg-purple-900/40 hover:bg-purple-900/60 text-[8px] text-purple-300 font-bold px-3 py-1 rounded-lg border border-purple-500/20 active:scale-95 cursor-pointer mt-1"
                          >
                            🖨️ Imprimir / Compartir Historial Aclaratorio
                          </button>
                        </div>
                      </div>

                      {/* QUICK DEBT ABONO CREATOR FORM */}
                      {selectedClientLedger.saldo_actual > 0 && (
                        <form onSubmit={handleRegisterAbonoForm} className="space-y-2 pt-2 border-t border-white/5">
                          <div className="text-[10px] font-mono text-[#E8B04A] font-extrabold uppercase tracking-wide">Cobrar / Abonar Saldo de Caja:</div>
                          <div className="flex gap-2.5">
                            <div className="flex-1 bg-[#0B0E14] border border-white/10 rounded-xl px-3 py-2 flex items-center justify-between">
                              <span className="text-xs text-gray-400 pr-1.5">$</span>
                              <input 
                                type="number" 
                                step="0.01"
                                value={abonoMontoPesos}
                                onChange={(e) => setAbonoMontoPesos(e.target.value)}
                                placeholder="Ej: 150.00"
                                className="bg-transparent text-xs text-white focus:outline-none w-full"
                              />
                              <span className="text-[9px] text-gray-500">M.N.</span>
                            </div>
                            <button 
                              type="submit" 
                              disabled={isSubmittingAbono}
                              className="font-extrabold bg-[#00C896] hover:bg-emerald-400 text-slate-900 text-xs px-5 rounded-xl cursor-pointer active:scale-95 transition-all flex items-center justify-center shrink-0 disabled:opacity-45"
                            >
                              {isSubmittingAbono ? 'Cargando...' : '✓ Aplicar Abono'}
                            </button>
                          </div>
                        </form>
                      )}

                    </div>
                  )}

                </div>
              )}

              {/* DETAILS D: DAILY ROUTES MONITORING (ABSORBED CLIENT LAYOUTS & MAPS) */}
              {selectedCardDetails === 'rutas' && (
                <div className="space-y-4">
                  
                  {/* SELECTOR FOR THE ROUTE CHANNELS */}
                  <div className="space-y-2">
                    <label className="block text-[10px] text-[#E8B04A] font-mono font-extrabold uppercase tracking-widest">
                      1. Seleccionar canal de reparto ({cfg.vendedores.length} Rutas del Negocio):
                    </label>
                    <div className="flex gap-2 overflow-x-auto pb-1.5 select-none no-scrollbar">
                      {cfg.vendedores.map(v => {
                        const isActive = selectedRouteSellerId === v.id;
                        const stopsList = getRouteBreadcrumbs(v.id);
                        const realCount = stopsList.filter(s => s.isReal).length;
                        return (
                          <button
                            key={v.id}
                            onClick={() => {
                              setSelectedRouteSellerId(v.id);
                              setSelectedStopIndex(0);
                              setSelectedClientLedger(null);
                            }}
                            className={`flex items-center gap-2 border rounded-xl px-3 py-2 transition-all cursor-pointer active:scale-95 shrink-0 text-xs ${isActive ? 'bg-[#181D2B]' : 'bg-[#06080C]/50 border-white/5 hover:bg-[#0E121E]'}`}
                            style={isActive ? { borderColor: `${cfg.color_principal}70` } : {}}
                          >
                            <div className="w-6.5 h-6.5 rounded-lg flex items-center justify-center font-bold text-[10px]" style={{ backgroundColor: `${cfg.color_principal}15`, color: cfg.color_principal }}>
                              {v.nombre[0]?.toUpperCase() || 'R'}
                            </div>
                            <div className="text-left">
                              <span className="font-bold text-white block leading-tight text-[11px]">{v.nombre}</span>
                              <div className="flex items-center gap-1.5 text-[8px] mt-0.5 font-mono">
                                <span className="text-gray-500">{v.ruta || 'Ruta Libre'}</span>
                                {realCount > 0 && <span className="text-emerald-400 font-extrabold">• {realCount} visitas hoy</span>}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* SUB-TABS UNDER ROUTE: MAP / CUSTOMERS LIST / METRICS PANEL */}
                  <div className="flex gap-1 bg-[#0B0E14] p-1 rounded-xl border border-white/5 select-none shrink-0 text-[10px] uppercase font-bold text-center">
                    <button
                      onClick={() => {
                        setClientSubTab('rutas');
                        setSelectedClientLedger(null);
                      }}
                      className={`flex-1 py-1.5 rounded-lg cursor-pointer transition-all ${clientSubTab === 'rutas' ? 'text-white' : 'text-gray-500 hover:text-white'}`}
                      style={clientSubTab === 'rutas' ? { backgroundColor: `${cfg.color_principal}20`, color: '#EEF1F8', border: `1px solid ${cfg.color_principal}35` } : {}}
                    >
                      🗺️ Secuencia y Mapa ("Migajajo")
                    </button>
                    <button
                      onClick={() => {
                        setClientSubTab('cartera');
                        setSelectedClientLedger(null);
                      }}
                      className={`flex-1 py-1.5 rounded-lg cursor-pointer transition-all ${clientSubTab === 'cartera' ? 'text-white' : 'text-gray-500 hover:text-white'}`}
                      style={clientSubTab === 'cartera' ? { backgroundColor: `${cfg.color_principal}20`, color: '#EEF1F8', border: `1px solid ${cfg.color_principal}35` } : {}}
                    >
                      👥 Clientes de esta Ruta
                    </button>
                    <button
                      onClick={() => {
                        setClientSubTab('metas');
                        setSelectedClientLedger(null);
                      }}
                      className={`flex-1 py-1.5 rounded-lg cursor-pointer transition-all ${clientSubTab === 'metas' ? 'text-white' : 'text-gray-500 hover:text-white'}`}
                      style={clientSubTab === 'metas' ? { backgroundColor: `${cfg.color_principal}20`, color: '#EEF1F8', border: `1px solid ${cfg.color_principal}35` } : {}}
                    >
                      📊 Desempeño
                    </button>
                  </div>

                  {/* TAB 1: INTERACTIVE ROUTE MAP SEQUENCE */}
                  {clientSubTab === 'rutas' && (
                    <div className="space-y-4">
                      {/* STYLIZED EMBED VECTOR GRAPH INTERACTIVE MAP OF BREADCRUMBS */}
                      <div className="border border-white/10 rounded-2xl bg-[#070910] overflow-hidden relative group">
                        <div className="absolute top-2.5 left-2.5 bg-black/75 border border-white/10 px-2 py-1 rounded font-mono text-[7px] text-gray-400 uppercase tracking-widest pointer-events-none z-10 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Mapa Satelital de Ruta: {cfg.vendedores.find(v => v.id === selectedRouteSellerId)?.ruta || 'Buscando...'}
                        </div>

                        <div className="w-full aspect-[16/9] min-h-[200px]">
                          <svg viewBox="0 0 380 220" className="w-full h-full text-white overflow-visible select-none font-sans" style={{ background: '#070A11' }}>
                            <defs>
                              <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor={cfg.color_principal} stopOpacity="1" />
                                <stop offset="100%" stopColor="#4F46E5" stopOpacity="0.8" />
                              </linearGradient>
                              <filter id="svgGlow" x="-25%" y="-25%" width="150%" height="150%">
                                <feGaussianBlur stdDeviation="3.5" result="blur" />
                                <feMerge>
                                  <feMergeNode in="blur" />
                                  <feMergeNode in="SourceGraphic" />
                                </feMerge>
                              </filter>
                            </defs>

                            {/* Background Grid Lines */}
                            <line x1="10" y1="35" x2="370" y2="35" stroke="rgba(255,255,255,0.015)" strokeWidth="1" />
                            <line x1="10" y1="80" x2="370" y2="80" stroke="rgba(255,255,255,0.015)" strokeWidth="1" />
                            <line x1="10" y1="125" x2="370" y2="125" stroke="rgba(255,255,255,0.015)" strokeWidth="1" />
                            <line x1="10" y1="170" x2="370" y2="170" stroke="rgba(255,255,255,0.015)" strokeWidth="1" />

                            {/* Starting Anchor Node: Centro de Distribución (CDS) */}
                            <g transform="translate(40, 110)">
                              <circle r="15" fill={`${cfg.color_principal}12`} className="animate-pulse" />
                              <circle r="10" fill="url(#glowGrad)" filter="url(#svgGlow)" />
                              <path d="M-5 4 L-5 -3 L0 -6 L5 -3 L5 4 Z" fill="#06080C" stroke="#fff" strokeWidth="1.2" />
                              <rect x="-2" y="1" width="4" height="3" fill="#EEF1F8" />
                              <text x="0" y="22" fill={cfg.color_principal} fontSize="7" fontWeight="900" textAnchor="middle" letterSpacing="0.4">CDS MATRIZ</text>
                            </g>

                            {/* Route lines linking CDS to the path stops */}
                            {getRouteBreadcrumbs(selectedRouteSellerId).length > 0 && (
                              <line 
                                x1="40" 
                                y1="110" 
                                x2={getRouteBreadcrumbs(selectedRouteSellerId)[0].x} 
                                y2={getRouteBreadcrumbs(selectedRouteSellerId)[0].y} 
                                stroke="url(#glowGrad)" 
                                strokeWidth="2.5" 
                                strokeDasharray="5,4" 
                              />
                            )}

                            {getRouteBreadcrumbs(selectedRouteSellerId).map((st, idx, array) => {
                              if (idx < array.length - 1) {
                                const nextSt = array[idx + 1];
                                return (
                                  <line 
                                    key={`line_${idx}`}
                                    x1={st.x} 
                                    y1={st.y} 
                                    x2={nextSt.x} 
                                    y2={nextSt.y} 
                                    stroke="url(#glowGrad)" 
                                    strokeWidth="2.5" 
                                    strokeDasharray="5,4.5" 
                                    className="opacity-75"
                                  />
                                );
                              }
                              return null;
                            })}

                            {/* Stop Pins rendering representing customer nodes along sequence */}
                            {getRouteBreadcrumbs(selectedRouteSellerId).map((st, idx) => {
                              const isSelected = selectedStopIndex === idx;
                              const isReal = st.isReal;
                              const pinColor = isReal ? '#10B981' : (st.saldoDeuda > 0 ? '#F59E0B' : '#8A93A8');
                              
                              return (
                                <g 
                                  key={`pin_${st.id}`} 
                                  transform={`translate(${st.x}, ${st.y})`}
                                  className="cursor-pointer transition-all"
                                  onClick={() => setSelectedStopIndex(idx)}
                                >
                                  {isSelected && (
                                    <circle r="14" fill={`${cfg.color_principal}22`} stroke={cfg.color_principal} strokeWidth="1.2" strokeDasharray="3,3" />
                                  )}
                                  <circle r="9" fill={isSelected ? cfg.color_principal : '#111520'} stroke={pinColor} strokeWidth="2" filter={isSelected ? 'url(#svgGlow)' : ''} />
                                  <text 
                                    x="0" 
                                    y="3" 
                                    fill={isSelected ? '#06080C' : '#EEF1F8'} 
                                    fontSize="8" 
                                    fontWeight="900" 
                                    textAnchor="middle"
                                  >
                                    {st.index}
                                  </text>

                                  {/* Fast mini floating description */}
                                  {isSelected && (
                                    <g transform="translate(0, -15)">
                                      <rect x="-45" y="-12" width="90" height="15" rx="4" fill="#181D2B" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8" />
                                      <text x="0" y="-2" fill="#fff" fontSize="6.5" fontWeight="bold" textAnchor="middle">
                                        {st.nombre.length > 18 ? st.nombre.substring(0, 16) + '..' : st.nombre}
                                      </text>
                                    </g>
                                  )}
                                </g>
                              );
                            })}
                          </svg>
                        </div>
                      </div>

                      {/* ACTIVE SELECTION DETAIL CARD & DIRECTIVES */}
                      {getRouteBreadcrumbs(selectedRouteSellerId)[selectedStopIndex] && (() => {
                        const st = getRouteBreadcrumbs(selectedRouteSellerId)[selectedStopIndex];
                        return (
                          <div className="bg-[#181D2B] border border-white/5 rounded-2xl p-4.5 space-y-3">
                            
                            {/* Sequence bar and basic metadata */}
                            <div className="flex justify-between items-start border-b border-white/5 pb-2">
                              <div>
                                <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-widest block leading-none">
                                  🚩 Secuencia de Parada #{st.index}
                                </span>
                                <h4 className="text-xs font-bold text-white mt-1 flex items-center gap-1.5 flex-wrap">
                                  {st.nombre}
                                  <span className="text-[8px] bg-white/5 text-gray-400 px-1.5 py-0.5 rounded uppercase font-mono font-medium">{st.tipo}</span>
                                </h4>
                              </div>
                              <div className="text-right">
                                <span className="text-[7px] font-mono text-gray-500 block leading-tight font-bold">PRED. RETORNO</span>
                                <span className="text-xs font-bold text-emerald-400 font-mono block">{st.horaVisita}</span>
                              </div>
                            </div>

                            {/* Target data boxes */}
                            <div className="grid grid-cols-2 gap-2.5 text-xs text-left">
                              <div className="bg-[#0B0E14] border border-white/5 p-2 rounded-xl space-y-1">
                                <span className="text-[8px] font-mono font-bold text-gray-500 uppercase tracking-wider block">Consigna de calle / Dirección</span>
                                <p className="text-[10px] text-gray-300 leading-normal">{st.direccion}</p>
                              </div>
                              <div className="bg-[#0B0E14] border border-white/5 p-2 rounded-xl space-y-1">
                                <span className="text-[8px] font-mono font-bold text-gray-500 uppercase tracking-wider block">Contacto directo</span>
                                <p className="text-[10px] text-gray-300 font-mono">{st.telefono}</p>
                              </div>
                            </div>

                            {/* Driver directive tip ("Sapo de chofer, migaja de pan") */}
                            <div className="bg-purple-950/10 border border-purple-500/20 px-3 py-2.5 rounded-xl flex gap-2.5 text-xs text-left">
                              <span className="text-sm shrink-0">💡</span>
                              <div>
                                <span className="text-[8px] uppercase font-mono font-extrabold text-[#E8B04A] block tracking-wider">Recomendación para Suplentes / Surtidores:</span>
                                <p className="text-[10px] text-purple-200 mt-0.5 leading-normal">{st.tip}</p>
                              </div>
                            </div>

                            {/* Financial status at Stop */}
                            <div className="bg-[#0B0E14] border border-white/5 rounded-xl p-2.5 flex justify-between items-center text-xs">
                              <div className="text-left font-mono">
                                <span className="text-[8px] text-gray-500 uppercase block">Cobro en parada</span>
                                <span className="text-gray-300 text-[10px] mt-0.5 block">
                                  Historial: {st.totalVendido > 0 ? formatPrice(st.totalVendido) : 'Venta Regular'} [{st.tipoCobro === 'crédito' ? 'CRÉDITO' : 'CONTADO'}]
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-[8px] text-amber-500 font-mono uppercase block">Saldo Pendiente</span>
                                <span className={`text-xs font-bold font-mono mt-0.5 block ${st.saldoDeuda > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                  {st.saldoDeuda > 0 ? formatPrice(st.saldoDeuda) : '$0.00'}
                                </span>
                              </div>
                            </div>

                            {/* Controller sliders buttons */}
                            <div className="flex gap-2">
                              <button
                                onClick={() => setSelectedStopIndex((prev) => (prev + 1) % getRouteBreadcrumbs(selectedRouteSellerId).length)}
                                className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-2 px-3 rounded-lg text-xs active:scale-95 transition-all text-center cursor-pointer"
                              >
                                Siguiente parada ➔
                              </button>
                              
                              <button
                                onClick={() => handleCopyRouteToClipboard(selectedRouteSellerId)}
                                className="bg-indigo-600 hover:bg-indigo-500 font-extrabold text-white px-3.5 py-2 rounded-lg text-xs active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
                              >
                                📋 Copiar la Ruta en Migajas
                              </button>
                            </div>

                            <div className="text-center pt-1">
                              <a 
                                href={`https://wa.me/?text=${encodeURIComponent(
                                  `🚚 *ROUTEPRO HOJA DE RUTA* 🚚\n` +
                                  `Vendedor: ${cfg.vendedores.find(v => v.id === selectedRouteSellerId)?.nombre}\n` +
                                  `Ruta: ${cfg.vendedores.find(v => v.id === selectedRouteSellerId)?.ruta}\n` +
                                  `Parada: #${st.index} - ${st.nombre}\n` +
                                  `Dirección: ${st.direccion}\n` +
                                  `Consigna: ${st.tip}\n` +
                                  `Monto sugerido carga: ${st.totalVendido > 0 ? formatPrice(st.totalVendido) : 'Venta Libre'}`
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[9px] text-[#00C896] hover:underline font-mono font-bold"
                              >
                                💬 Compartir indicaciones del cliente por WhatsApp
                              </a>
                            </div>

                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* TAB 2: DETAILED CUSTOMERS LIST IN THIS SPECIFIC ROUTE */}
                  {clientSubTab === 'cartera' && (
                    <div className="space-y-3">
                      <div className="bg-[#0C101A] border border-white/5 rounded-xl p-3 text-left">
                        <span className="text-[10px] text-gray-400 font-mono font-bold leading-none block uppercase">Directorio Secuencial de Clientes</span>
                        <p className="text-[10px] text-gray-500 mt-1">
                          Direcciones georreferenciadas y estados de cuenta de la ruta de: <strong>{cfg.vendedores.find(v => v.id === selectedRouteSellerId)?.nombre}</strong>.
                        </p>
                      </div>

                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                        {getRouteBreadcrumbs(selectedRouteSellerId).map((st, idx) => (
                          <div 
                            key={idx}
                            onClick={() => setSelectedStopIndex(idx)}
                            className={`border rounded-xl p-3 flex justify-between items-center cursor-pointer transition-all active:scale-97 text-xs ${selectedStopIndex === idx ? 'bg-indigo-950/20 border-indigo-500/30' : 'bg-[#181D2B] border-white/5 hover:bg-[#1E2536]'}`}
                          >
                            <div className="text-left min-w-0 space-y-1 flex-1 pr-2">
                              <div className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                                <span className="bg-[#E8B04A]/10 text-[#E8B04A] text-[8px] font-mono px-1.5 py-0.5 rounded font-bold">#{st.index}</span>
                                <span className="truncate">{st.nombre}</span>
                              </div>
                              <div className="text-[9px] text-gray-400 truncate">
                                📍 {st.direccion}
                              </div>
                              <div className="text-[8px] text-indigo-400 font-mono flex items-center gap-1">
                                <span>📞 {st.telefono}</span>
                                <span>·</span>
                                <span>Visita: {st.horaVisita}</span>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div className="text-gray-500 text-[8px] font-mono uppercase font-bold">Saldo</div>
                              <div className={`text-xs font-bold font-mono mt-0.5 ${st.saldoDeuda > 0 ? 'text-amber-500' : 'text-emerald-400'}`}>
                                {st.saldoDeuda > 0 ? formatPrice(st.saldoDeuda) : '$0.00'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: DAILY FINANCIAL METRICS AND ROAD COMPLIANCE PROGRESS */}
                  {clientSubTab === 'metas' && (() => {
                    const seller = cfg.vendedores.find(v => v.id === selectedRouteSellerId);
                    if (!seller) return null;
                    const vndSales = ventas.filter(x => x.vendedorId === seller.id);
                    const vndTot = vndSales.reduce((sum, item) => sum + (item.monto || 0), 0);
                    const dailyGoal = seller.meta_diaria || 500000;
                    const progressPct = Math.min(100, Math.round((vndTot / dailyGoal) * 100));

                    return (
                      <div className="bg-[#181D2B] border border-white/5 p-4 rounded-xl space-y-3 text-left">
                        <div className="flex justify-between items-start gap-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8.5 h-8.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-extrabold flex items-center justify-center text-sm shrink-0">
                              {seller.nombre[0]?.toUpperCase()}
                            </div>
                            <div className="text-left min-w-0">
                              <span className="text-xs font-bold text-white truncate block">{seller.nombre}</span>
                              <span className="text-[9px] text-gray-400 font-medium font-mono">Zona: {seller.ruta || 'Distribución'} · {seller.rol === 'repartidor' ? 'Repartidor' : 'Cajero'}</span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-xs font-bold text-[#E8B04A] font-mono block">{formatPrice(vndTot)}</span>
                            <span className="text-[9px] text-gray-500 font-bold">{vndSales.length} entregas de hoy</span>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-[9px] text-gray-400">
                            <span>Meta Diaria de Cobro (${(dailyGoal / 100).toFixed(0)} M.N.)</span>
                            <span className="font-extrabold text-[#10B981]">{progressPct}%</span>
                          </div>
                          <div className="h-1.5 bg-[#0B0E14] rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-emerald-500 to-[#10B981] rounded-full"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>

                        <div className="bg-[#0B0E14] p-3 rounded-lg border border-white/5 space-y-2 mt-2 font-mono text-[9px]">
                          <span className="text-[#E8B04A] font-bold block">AUDITORÍA ADVERTIDA:</span>
                          <div className="flex justify-between text-gray-400">
                            <span>ENTREGAS REGISTRADAS:</span>
                            <span className="text-white">{vndSales.length} boletas</span>
                          </div>
                          <div className="flex justify-between text-gray-400">
                            <span>EFECTIVO COBRADO:</span>
                            <span className="text-white">{formatPrice(vndSales.filter(s => s.tipoCobro === 'efectivo').reduce((sum, s) => sum + s.monto, 0))}</span>
                          </div>
                          <div className="flex justify-between text-gray-450">
                            <span>CRÉDITO EXPEDIDO:</span>
                            <span className="text-amber-400 font-bold">{formatPrice(vndSales.filter(s => s.tipoCobro === 'crédito').reduce((sum, s) => sum + s.monto, 0))}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                </div>
              )}

            </div>

            {/* Bottom button of drawer */}
            <div className="sticky bottom-0 bg-[#161B28] p-4.5 border-t border-white/5 shrink-0">
              <button 
                onClick={() => {
                  setSelectedCardDetails(null);
                  setSelectedClientLedger(null);
                  setClientSearchInp('');
                }}
                className="w-full py-3 bg-[#1D2536] hover:bg-slate-800 text-xs font-bold text-white rounded-xl cursor-pointer active:scale-95 transition-all text-center"
              >
                Cerrar Reporte
              </button>
            </div>

          </div>

        </div>
      )}

      {/* CONFIRM ACTIONS MODALS */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-[#111520] border border-red-500/20 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-5 text-center">
            <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto text-2xl border border-red-500/20">
              🚪
            </div>
            <div className="space-y-2 text-center">
              <div className="font-display font-bold text-base text-white">¿Salir de la Demostración?</div>
              <p className="text-gray-400 text-xs leading-relaxed text-center">
                ¿Estás seguro de que deseas salir de <strong>{cfg.nombre || 'el negocio actual'}</strong>?
                <br /><br />
                <span className="text-red-400/80 font-medium text-center">Se borrará toda la arquitectura actual y tu progreso no guardado. Volverás al setup inicial.</span>
              </p>
            </div>
            
            <div className="flex gap-2.5 pt-2">
              <button 
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-3 bg-[#181D2B] hover:bg-[#1F2638] rounded-xl text-xs font-bold text-gray-300 border border-white/5 cursor-pointer active:scale-95 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  setShowExitConfirm(false);
                  onCerrarSesion?.();
                }}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 rounded-xl text-xs font-bold text-white cursor-pointer active:scale-95 transition-all text-center"
              >
                Sí, Salir
              </button>
            </div>
          </div>
        </div>
      )}

      {showWipeConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-[#111520] border border-amber-500/20 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-5 text-center">
            <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto text-2xl border border-amber-500/20">
              🧹
            </div>
            <div className="space-y-2 text-center">
              <div className="font-display font-bold text-base text-white">¿Borrar Registros y Reestablecer Balance?</div>
              <p className="text-gray-400 text-xs leading-relaxed text-center">
                Esta acción es inmediata e irreversible para la base de datos de <strong>{cfg.nombre}</strong>.
                <br /><br />
                <span className="text-amber-400 font-medium text-center">Reseteará el saldo a $0.00, limpiando el registro de ventas, pagos y mermas para iniciar una demostración limpia desde cero.</span>
              </p>
            </div>
            
            <div className="flex gap-2.5 pt-2">
              <button 
                onClick={() => setShowWipeConfirm(false)}
                disabled={isWiping}
                className="flex-1 py-3 bg-[#181D2B] hover:bg-[#1F2638] rounded-xl text-xs font-bold text-gray-300 border border-white/5 cursor-pointer disabled:opacity-40"
              >
                Cancelar
              </button>
              <button 
                onClick={handleWipeData}
                disabled={isWiping}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 rounded-xl text-xs font-bold text-black cursor-pointer disabled:opacity-40 text-center font-bold"
              >
                {isWiping ? 'Borrando...' : 'Sí, Limpiar Todo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MYSTERY SHOP FORM MODAL */}
      {showMysteryModal && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#111520] border border-[#E8B04A]/20 rounded-2xl p-5 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex justify-between items-start border-b border-white/5 pb-3">
              <div className="text-left">
                <h3 className="font-display font-bold text-white text-sm">Nueva Auditoría de Cliente Misterioso</h3>
                <p className="text-[10px] text-gray-400">Inspección encubierta de estándares operativos en ruta</p>
              </div>
              <button 
                onClick={() => setShowMysteryModal(false)}
                className="text-gray-400 hover:text-white transition-colors cursor-pointer text-sm font-bold p-1 bg-white/5 rounded"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-left">
              <div className="space-y-1.5">
                <label className="block text-gray-400 font-semibold text-[10px] uppercase tracking-wider">Vendedor a Auditar</label>
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

              <div className="space-y-1.5">
                <label className="block text-gray-400 font-semibold text-[10px] uppercase tracking-wider">Nombre del Auditor Encubierto</label>
                <input 
                  type="text"
                  value={mAuditorName}
                  onChange={(e) => setMAuditorName(e.target.value)}
                  className="w-full bg-[#181D2B] border border-white/10 text-white rounded-lg p-2.5 text-xs focus:ring-1"
                />
              </div>

              <div className="space-y-2 bg-[#0C101A] border border-white/5 p-3 rounded-xl">
                <span className="block text-[10px] text-amber-400 font-extrabold uppercase tracking-wide mb-1.5">Estándares de Evaluación</span>
                
                <label className="flex items-center gap-2.5 py-1 cursor-pointer select-none">
                  <input type="checkbox" checked={mCheckCobro} onChange={(e) => setMCheckCobro(e.target.checked)} className="rounded border-white/10 bg-[#181D2B] text-amber-500" />
                  <div>
                    <span className="text-white font-bold block text-[11px]">Cobro de Precios del Catálogo</span>
                    <span className="text-[9px] text-gray-500 block">¿Respetó las tarifas oficiales del catálogo de {cfg.nombre}?</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 py-1 cursor-pointer select-none">
                  <input type="checkbox" checked={mCheckRecibo} onChange={(e) => setMCheckRecibo(e.target.checked)} className="rounded border-white/10 bg-[#181D2B] text-amber-500" />
                  <div>
                    <span className="text-white font-bold block text-[11px]">Entrega de Ticket / Recibo</span>
                    <span className="text-[9px] text-gray-500 block">¿Se entregó el comprobante y registró la venta en pantalla?</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 py-1 cursor-pointer select-none">
                  <input type="checkbox" checked={mCheckPresentacion} onChange={(e) => setMCheckPresentacion(e.target.checked)} className="rounded border-white/10 bg-[#181D2B] text-amber-500" />
                  <div>
                    <span className="text-white font-bold block text-[11px]">Presentación y Limpieza</span>
                    <span className="text-[9px] text-gray-500 block">¿La presentación cumple el estándar estipulado?</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 py-1 cursor-pointer select-none">
                  <input type="checkbox" checked={mCheckTrato} onChange={(e) => setMCheckTrato(e.target.checked)} className="rounded border-white/10 bg-[#181D2B] text-amber-500" />
                  <div>
                    <span className="text-white font-bold block text-[11px]">Trato Cortés y Ágil</span>
                    <span className="text-[9px] text-gray-500 block">¿Se mostró con amabilidad y brindó cortesía al cliente?</span>
                  </div>
                </label>
              </div>

              <div className="space-y-1.5">
                <label className="block text-gray-400 font-semibold text-[10px] uppercase tracking-wider">Observaciones y Notas Operativas</label>
                <textarea 
                  value={mNotas}
                  onChange={(e) => setMNotas(e.target.value)}
                  rows={2}
                  className="w-full bg-[#181D2B] border border-white/10 text-white rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button 
                onClick={() => setShowMysteryModal(false)}
                disabled={isSubmittingAudit}
                className="flex-1 py-2.5 bg-[#181D2B] rounded-xl text-xs font-bold text-gray-300 border border-white/5 cursor-pointer disabled:opacity-45 text-center"
              >
                Cancelar
              </button>
              <button 
                onClick={handleCreateMysteryAudit}
                disabled={isSubmittingAudit}
                className="flex-1 py-2.5 text-slate-900 font-extrabold rounded-xl text-xs cursor-pointer text-center disabled:opacity-45"
                style={{ backgroundColor: cfg.color_principal }}
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
