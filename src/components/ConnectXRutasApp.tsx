import { useEffect, useMemo, useState } from 'react';
import { BrainCircuit, CheckCircle2, CircleDollarSign, CloudOff, CreditCard, MapPin, PackageOpen, Route, Truck, UserRound, WalletCards } from 'lucide-react';
import type { BusinessConfig } from '../core/businessConfig';
import { createIntelligence } from '../core/intelligence';
import { money } from '../core/money';
import { closeRoute, initialRouteState, recordSale, recordStop, registerLoad, startRoute, type RouteAggregateState } from '../core/routeEngine';

interface RouteProduct {
  id: string;
  name: string;
  unit: string;
  priceCents: number;
  loadQuantity: number;
}

interface RouteCustomer {
  id: string;
  name: string;
  address: string;
  routeId: string;
}

const STORAGE = 'cx_route_session_v1';
const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

const products: RouteProduct[] = [
  { id: 'pan-blanco', name: 'Pan blanco', unit: 'pza', priceCents: 700, loadQuantity: 180 },
  { id: 'pan-dulce', name: 'Pan dulce', unit: 'pza', priceCents: 1200, loadQuantity: 120 },
  { id: 'tortilla', name: 'Tortilla', unit: 'kg', priceCents: 2600, loadQuantity: 140 },
  { id: 'tostada', name: 'Tostadas', unit: 'paq', priceCents: 3500, loadQuantity: 30 },
];

const defaultCustomers: RouteCustomer[] = [
  { id: 'c-1', name: 'Abarrotes Lupita', address: 'Centro', routeId: 'route-1' },
  { id: 'c-2', name: 'Tienda San Juan', address: 'Col. Morelos', routeId: 'route-1' },
  { id: 'c-3', name: 'Mini Súper Mora', address: 'Zona Norte', routeId: 'route-1' },
  { id: 'c-4', name: 'Abarrotes El Puente', address: 'Zona Oriente', routeId: 'route-1' },
];

function readSession(): RouteAggregateState {
  try {
    const raw = localStorage.getItem(STORAGE);
    return raw ? JSON.parse(raw) : initialRouteState();
  } catch {
    return initialRouteState();
  }
}

export function ConnectXRutasApp() {
  const [state, setState] = useState<RouteAggregateState>(() => readSession());
  const [online, setOnline] = useState(navigator.onLine);
  const [selectedCustomer, setSelectedCustomer] = useState<RouteCustomer>(defaultCustomers[0]);
  const [cart, setCart] = useState<Record<string, { delivered: number; returned: number }>>({});
  const [payment, setPayment] = useState<'cash' | 'credit' | 'transfer'>('cash');
  const [toast, setToast] = useState('');
  const [recommendation, setRecommendation] = useState('Sin cálculo');
  const intelligence = useMemo(() => createIntelligence(), []);

  const config = useMemo<BusinessConfig | null>(() => {
    try {
      const raw = localStorage.getItem('cx_business_config_v1');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const routes = config?.routes?.length ? config.routes : [{ id: 'route-1', name: 'Ruta 1' }];
  const activeRoute = routes[0];

  useEffect(() => {
    localStorage.setItem(STORAGE, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2300);
  };

  const beginRoute = () => {
    const started = startRoute(initialRouteState(), {
      id: `run-${crypto.randomUUID?.() || Date.now()}`,
      tenantId: config?.tenantId || 'connectx',
      businessId: config?.businessId || 'routepro',
      routeId: activeRoute.id,
      driverId: activeRoute.driverId || 'driver-demo',
      vehicleId: activeRoute.vehicleId || 'unit-01',
      startedAt: Date.now(),
    });
    if (!started.ok) return notify(`No se pudo iniciar: ${started.error}`);
    const loaded = registerLoad(started.value, {
      id: `load-${Date.now()}`,
      items: products.map(product => ({ productId: product.id, productName: product.name, quantity: product.loadQuantity, unit: product.unit })),
      authorizedBy: 'owner-demo',
      authorizedAt: Date.now(),
      createdAt: Date.now(),
    });
    if (!loaded.ok) return notify(`Carga rechazada: ${loaded.error}`);
    setState(loaded.value);
    notify(`${activeRoute.name} iniciada con carga autorizada`);
  };

  const setQuantity = (productId: string, field: 'delivered' | 'returned', value: number) => {
    setCart(current => ({
      ...current,
      [productId]: { delivered: current[productId]?.delivered || 0, returned: current[productId]?.returned || 0, [field]: Math.max(0, value) },
    }));
  };

  const saleTotal = products.reduce((sum, product) => {
    const row = cart[product.id];
    if (!row) return sum;
    return sum + Math.max(0, row.delivered - row.returned) * product.priceCents;
  }, 0);

  const saveSale = () => {
    if (state.run?.status !== 'active') return notify('Primero inicia una ruta');
    const items = products.flatMap(product => {
      const row = cart[product.id];
      if (!row || row.delivered <= 0) return [];
      return [{
        productId: product.id,
        productName: product.name,
        quantityDelivered: row.delivered,
        quantityReturned: Math.min(row.returned, row.delivered),
        unitPrice: money(product.priceCents),
      }];
    });
    if (!items.length) return notify('Captura al menos un producto');

    const stop = recordStop(state, {
      id: `stop-${Date.now()}`,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      visitedAt: Date.now(),
      outcome: 'sale',
    });
    if (!stop.ok) return notify(`Parada rechazada: ${stop.error}`);

    const key = `sale-${crypto.randomUUID?.() || Date.now()}`;
    const sale = recordSale(stop.value, {
      id: key,
      customerId: selectedCustomer.id,
      items,
      paymentMethod: payment,
      creditAmountCents: payment === 'credit' ? saleTotal : undefined,
      idempotencyKey: key,
      createdAt: Date.now(),
    });
    if (!sale.ok) return notify(`Venta rechazada: ${sale.error}`);
    setState(sale.value);
    setCart({});
    notify(`${currency.format(saleTotal / 100)} registrado ${online ? 'y listo para sincronizar' : 'sin conexión'}`);
  };

  const calculateRecommendation = async () => {
    const recs = await intelligence.recommendRouteLoad({
      routeId: activeRoute.id,
      dayOfWeek: new Date().getDay(),
      products: products.map(product => ({ id: product.id, businessId: config?.businessId || 'routepro', name: product.name, unit: product.unit, priceCents: product.priceCents, active: true })),
      historicalSales: state.sales,
    });
    const first = recs[0];
    setRecommendation(first ? `${first.suggestedQuantity} ${products.find(p => p.id === first.productId)?.unit || ''} de ${products.find(p => p.id === first.productId)?.name || first.productId}` : 'Sin datos');
    notify('Sugerencia calculada por el motor disponible');
  };

  const finishRoute = () => {
    const cashExpected = state.sales.reduce((sum, sale) => sale.paymentMethod === 'credit' ? sum : sum + sale.total.amountCents, 0);
    const close = closeRoute(state, {
      cashDeliveredCents: cashExpected,
      expensesCents: 0,
      closedBy: 'owner-demo',
      closedAt: Date.now(),
    });
    if (!close.ok) return notify(`Cierre rechazado: ${close.error}`);
    setState(close.value);
    notify('Ruta cerrada y conciliada');
  };

  const gross = state.sales.reduce((sum, sale) => sum + sale.total.amountCents, 0);
  const credit = state.sales.reduce((sum, sale) => sum + (sale.creditAmount?.amountCents || 0), 0);
  const returned = state.sales.reduce((sum, sale) => sum + sale.items.reduce((inner, item) => inner + item.quantityReturned, 0), 0);

  return (
    <div className="min-h-screen bg-[#091016] text-white">
      <header className="sticky top-0 z-30 border-b border-white/8 bg-[#091016]/94 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-300 text-slate-950"><Route className="h-5 w-5" /></div><div><p className="font-semibold">ConnectX Rutas</p><p className="text-xs text-slate-500">María Belén + La Favorita + RoutePro</p></div></div>
          <div className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${online ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-300/10 text-amber-300'}`}>{online ? <CheckCircle2 className="h-4 w-4" /> : <CloudOff className="h-4 w-4" />}{online ? 'En línea' : 'Modo offline'}</div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4 md:p-6">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[['Estado', state.run?.status || 'Sin iniciar'], ['Ventas', String(state.sales.length)], ['Venta bruta', currency.format(gross / 100)], ['Crédito', currency.format(credit / 100)]].map(([label,value]) => <div key={label} className="rounded-2xl border border-white/8 bg-white/[0.035] p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>)}
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[.7fr_1.25fr_.55fr]">
          <aside className="rounded-[28px] border border-white/8 bg-[#0e1720] p-5">
            <div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-wider text-slate-500">Ruta activa</p><h2 className="mt-1 text-xl font-semibold">{activeRoute.name}</h2></div><Truck className="h-5 w-5 text-amber-300" /></div>
            <button disabled={state.run?.status === 'active'} onClick={beginRoute} className="mt-5 w-full rounded-2xl bg-amber-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-30">Iniciar y cargar</button>
            <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-slate-500">Clientes</p>
            <div className="mt-3 space-y-2">{defaultCustomers.map(customer => <button key={customer.id} onClick={() => setSelectedCustomer(customer)} className={`w-full rounded-2xl border p-3 text-left ${selectedCustomer.id === customer.id ? 'border-amber-300/40 bg-amber-300/8' : 'border-white/8 bg-white/[0.025]'}`}><div className="flex gap-3"><UserRound className="mt-0.5 h-4 w-4 text-slate-500" /><div><p className="text-sm font-medium">{customer.name}</p><p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3 w-3" />{customer.address}</p></div></div></button>)}</div>
          </aside>

          <section className="rounded-[28px] border border-white/8 bg-[#0e1720] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-wider text-slate-500">Venta en parada</p><h2 className="mt-1 text-xl font-semibold">{selectedCustomer.name}</h2></div><span className="rounded-full bg-white/6 px-3 py-1.5 text-xs text-slate-400">Devolución incluida</span></div>
            <div className="mt-5 overflow-hidden rounded-2xl border border-white/8">
              <div className="grid grid-cols-[1fr_84px_84px] bg-white/[0.035] px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500"><span>Producto</span><span>Entrega</span><span>Regresa</span></div>
              {products.map(product => { const row = cart[product.id] || { delivered: 0, returned: 0 }; return <div key={product.id} className="grid grid-cols-[1fr_84px_84px] items-center border-t border-white/6 px-3 py-3"><div><p className="text-sm font-medium">{product.name}</p><p className="text-xs text-slate-500">{currency.format(product.priceCents / 100)} / {product.unit}</p></div><input aria-label={`Entrega ${product.name}`} type="number" min="0" value={row.delivered || ''} onChange={event => setQuantity(product.id,'delivered',Number(event.target.value) || 0)} className="w-16 rounded-lg border border-white/8 bg-white/5 px-2 py-2 text-center text-sm outline-none" /><input aria-label={`Regresa ${product.name}`} type="number" min="0" value={row.returned || ''} onChange={event => setQuantity(product.id,'returned',Number(event.target.value) || 0)} className="w-16 rounded-lg border border-white/8 bg-white/5 px-2 py-2 text-center text-sm outline-none" /></div>; })}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs text-slate-500">Total neto</p><p className="mt-1 text-3xl font-semibold tracking-tight">{currency.format(saleTotal / 100)}</p></div><div className="flex rounded-2xl bg-white/5 p-1">{([['cash','Efectivo',CircleDollarSign],['credit','Fiado',CreditCard],['transfer','Transferencia',WalletCards]] as const).map(([key,label,Icon]) => <button key={key} onClick={() => setPayment(key)} className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold ${payment === key ? 'bg-white text-slate-950' : 'text-slate-400'}`}><Icon className="h-3.5 w-3.5" />{label}</button>)}</div></div>
            <button onClick={saveSale} disabled={saleTotal <= 0 || state.run?.status !== 'active'} className="mt-5 w-full rounded-2xl bg-white px-4 py-3.5 text-sm font-semibold text-slate-950 disabled:opacity-25">Registrar venta</button>
          </section>

          <aside className="space-y-4">
            <div className="rounded-[28px] border border-white/8 bg-[#0e1720] p-5"><div className="flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-amber-300" /><p className="font-semibold">Carga mañana</p></div><p className="mt-4 text-xl font-semibold">{recommendation}</p><p className="mt-2 text-xs leading-5 text-slate-500">Funciona con reglas locales. Si hay IA disponible, puede mejorar la recomendación.</p><button onClick={calculateRecommendation} className="mt-5 w-full rounded-xl border border-white/10 px-3 py-2.5 text-xs font-semibold">Calcular</button></div>
            <div className="rounded-[28px] border border-white/8 bg-[#0e1720] p-5"><div className="flex items-center gap-2"><PackageOpen className="h-5 w-5 text-amber-300" /><p className="font-semibold">Control</p></div><div className="mt-4 space-y-3 text-sm"><div className="flex justify-between"><span className="text-slate-500">Devuelto</span><span>{returned.toFixed(1)}</span></div><div className="flex justify-between"><span className="text-slate-500">Paradas</span><span>{state.stops.length}</span></div><div className="flex justify-between"><span className="text-slate-500">Diferencia</span><span>{currency.format((state.close?.difference.amountCents || 0) / 100)}</span></div></div><button onClick={finishRoute} disabled={state.run?.status !== 'active'} className="mt-5 w-full rounded-xl bg-emerald-400 px-3 py-2.5 text-xs font-semibold text-emerald-950 disabled:opacity-25">Cerrar y conciliar</button></div>
          </aside>
        </section>
      </main>
      {toast && <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-white px-4 py-2.5 text-xs font-semibold text-slate-950 shadow-xl">{toast}</div>}
    </div>
  );
}
