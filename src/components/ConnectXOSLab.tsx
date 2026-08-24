import { useMemo, useState } from 'react';
import { ArrowLeftRight, Boxes, BrainCircuit, CheckCircle2, ChefHat, CircleDollarSign, MapPinned, PackageCheck, Route, Store, Truck, WifiOff } from 'lucide-react';
import { money } from '../core/money';
import { createIntelligence } from '../core/intelligence';
import { createLocalOrder, createProductionTasks, transitionOrder, type LocalAggregateState } from '../core/localEngine';
import { closeRoute, initialRouteState, recordSale, registerLoad, startRoute, type RouteAggregateState } from '../core/routeEngine';

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const fmt = (cents: number) => currency.format(cents / 100);

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-slate-300">{children}</span>;
}

export function ConnectXOSLab() {
  const [mode, setMode] = useState<'routes' | 'local'>('routes');
  const [routeState, setRouteState] = useState<RouteAggregateState>(() => initialRouteState());
  const [localState, setLocalState] = useState<LocalAggregateState>({ tasks: [], printJobs: [] });
  const [log, setLog] = useState<string[]>(['ConnectX Core iniciado en modo determinista']);

  const intelligence = useMemo(() => createIntelligence(), []);
  const [suggestion, setSuggestion] = useState<string>('Sin cálculo todavía');

  const append = (message: string) => setLog(prev => [message, ...prev].slice(0, 12));

  const startDemoRoute = () => {
    const started = startRoute(initialRouteState(), {
      id: `run-${Date.now()}`,
      tenantId: 'connectx-demo',
      businessId: 'la-favorita-demo',
      routeId: 'ruta-centro',
      driverId: 'repartidor-01',
      vehicleId: 'unidad-01',
      startedAt: Date.now(),
    });
    if (!started.ok) return append(`Error: ${started.error}`);
    const loaded = registerLoad(started.value, {
      id: `load-${Date.now()}`,
      createdAt: Date.now(),
      authorizedBy: 'owner-demo',
      authorizedAt: Date.now(),
      items: [
        { productId: 'tortilla', productName: 'Tortilla', quantity: 140, unit: 'kg' },
        { productId: 'tostada', productName: 'Tostada', quantity: 24, unit: 'paquete' },
      ],
    });
    if (!loaded.ok) return append(`Error: ${loaded.error}`);
    setRouteState(loaded.value);
    append('Ruta iniciada con carga autorizada');
  };

  const addRouteSale = () => {
    const saleNumber = routeState.sales.length + 1;
    const result = recordSale(routeState, {
      id: `sale-${Date.now()}`,
      customerId: `cliente-${saleNumber}`,
      paymentMethod: saleNumber % 3 === 0 ? 'credit' : 'cash',
      creditAmountCents: saleNumber % 3 === 0 ? 26000 : undefined,
      idempotencyKey: `demo-device-${Date.now()}`,
      createdAt: Date.now(),
      items: [
        {
          productId: 'tortilla',
          productName: 'Tortilla',
          quantityDelivered: 12,
          quantityReturned: saleNumber % 4 === 0 ? 1 : 0,
          unitPrice: money(2600),
        },
      ],
    });
    if (!result.ok) return append(`Venta rechazada: ${result.error}`);
    setRouteState(result.value);
    append(`Venta ${saleNumber} registrada ${saleNumber % 3 === 0 ? 'a crédito' : 'en efectivo'}`);
  };

  const closeDemoRoute = () => {
    const expected = routeState.sales.reduce((total, sale) => {
      if (sale.paymentMethod === 'credit') return total;
      return total + sale.total.amountCents;
    }, 0);
    const result = closeRoute(routeState, {
      cashDeliveredCents: expected,
      expensesCents: 0,
      closedBy: 'owner-demo',
      closedAt: Date.now(),
    });
    if (!result.ok) return append(`Cierre rechazado: ${result.error}`);
    setRouteState(result.value);
    append('Ruta cerrada y conciliada');
  };

  const calculateLoad = async () => {
    const result = await intelligence.recommendRouteLoad({
      routeId: 'ruta-centro',
      dayOfWeek: new Date().getDay(),
      products: [{ id: 'tortilla', businessId: 'la-favorita-demo', name: 'Tortilla', unit: 'kg', priceCents: 2600, active: true }],
      historicalSales: routeState.sales,
    });
    const first = result[0];
    setSuggestion(first ? `${first.suggestedQuantity} kg · ${(first.confidence * 100).toFixed(0)}% confianza` : 'Sin datos');
    append('Carga sugerida calculada sin depender de IA externa');
  };

  const createDemoOrder = () => {
    const created = createLocalOrder({
      id: `order-${Date.now()}`,
      tenantId: 'connectx-demo',
      businessId: 'campestre-demo',
      locationId: 'mora-01',
      tableLabel: 'Mesa 7',
      waiterId: 'mesera-02',
      createdAt: Date.now(),
      items: [
        { productId: 'pozole', productName: 'Pozole', quantity: 1, unitPrice: money(9000), stationId: 'antojos', personLabel: 'Persona 1' },
        { productId: 'tostielote', productName: 'Tostielote', quantity: 1, unitPrice: money(6500), stationId: 'elotes', personLabel: 'Persona 2' },
        { productId: 'agua', productName: 'Agua fresca', quantity: 2, unitPrice: money(2000), stationId: 'bebidas', personLabel: 'Persona 1' },
      ],
    });
    if (!created.ok) return append(`Comanda rechazada: ${created.error}`);
    const sent = transitionOrder(created.value, 'sent', Date.now());
    if (!sent.ok) return append(`Error de estado: ${sent.error}`);
    let sequence = 0;
    const tasks = createProductionTasks(sent.value, () => `task-${++sequence}`);
    if (!tasks.ok) return append(`Error de producción: ${tasks.error}`);
    setLocalState(tasks.value);
    append(`Comanda enviada a ${tasks.value.tasks.length} estaciones`);
  };

  const grossRoute = routeState.sales.reduce((total, sale) => total + sale.total.amountCents, 0);
  const creditRoute = routeState.sales.reduce((total, sale) => total + (sale.creditAmount?.amountCents ?? 0), 0);
  const localTotal = localState.order?.items.reduce((total, item) => total + item.unitPrice.amountCents * item.quantity, 0) ?? 0;

  return (
    <div className="min-h-screen bg-[#090b0f] text-slate-100">
      <header className="sticky top-0 z-20 border-b border-white/8 bg-[#090b0f]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-300 text-sm font-black text-slate-950">CX</div>
              <span className="font-semibold tracking-tight">ConnectX Negocio OS</span>
              <Pill>Core v0.1</Pill>
            </div>
            <p className="mt-1 text-xs text-slate-500">Laboratorio funcional · IA opcional · operación determinista</p>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <Pill><WifiOff className="mr-1 inline h-3 w-3" /> Offline-first</Pill>
            <Pill><BrainCircuit className="mr-1 inline h-3 w-3" /> Hybrid intelligence</Pill>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-7">
        <div className="mb-7 grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
          <section className="rounded-[28px] border border-white/8 bg-gradient-to-br from-white/[0.055] to-transparent p-6 md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Sistema operativo para PyMEs reales</p>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-[-0.035em] text-white md:text-5xl">Una sola arquitectura para operar dentro del local y fuera, en territorio.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400 md:text-base">Este laboratorio ejecuta el nuevo núcleo sin depender de servicios de IA. Cuando existe un proveedor de IA, se enchufa como capa de mejora; si falla, el negocio sigue vendiendo.</p>
          </section>

          <aside className="rounded-[28px] border border-white/8 bg-[#0d1118] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Inteligencia operativa</p>
            <div className="mt-5 flex items-start gap-3">
              <div className="rounded-2xl bg-amber-300/10 p-3 text-amber-300"><BrainCircuit className="h-5 w-5" /></div>
              <div>
                <p className="font-medium text-white">Carga sugerida</p>
                <p className="mt-1 text-sm text-slate-400">{suggestion}</p>
              </div>
            </div>
            <button onClick={calculateLoad} className="mt-5 w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200">Calcular con motor disponible</button>
          </aside>
        </div>

        <div className="mb-5 flex w-fit rounded-2xl border border-white/8 bg-white/[0.035] p-1">
          <button onClick={() => setMode('routes')} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${mode === 'routes' ? 'bg-white text-slate-950' : 'text-slate-400 hover:text-white'}`}><Route className="h-4 w-4" /> Rutas</button>
          <button onClick={() => setMode('local')} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${mode === 'local' ? 'bg-white text-slate-950' : 'text-slate-400 hover:text-white'}`}><Store className="h-4 w-4" /> Local</button>
        </div>

        {mode === 'routes' ? (
          <div className="grid gap-5 lg:grid-cols-[1fr_.36fr]">
            <section className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Estado" value={routeState.run?.status ?? 'Sin iniciar'} hint="Máquina de estados" />
                <Metric label="Ventas" value={String(routeState.sales.length)} hint="Idempotentes" />
                <Metric label="Venta bruta" value={fmt(grossRoute)} hint="Registrada en ruta" />
                <Metric label="Crédito" value={fmt(creditRoute)} hint="Cartera creada" />
              </div>

              <div className="rounded-[26px] border border-white/8 bg-[#0d1118] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">Route Engine</p>
                    <p className="mt-1 text-xs text-slate-500">María Belén + La Favorita + RoutePro</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={startDemoRoute} className="rounded-xl border border-white/10 px-3.5 py-2 text-sm text-slate-200 hover:bg-white/5"><Truck className="mr-1.5 inline h-4 w-4" /> Iniciar + cargar</button>
                    <button onClick={addRouteSale} disabled={routeState.run?.status !== 'active'} className="rounded-xl bg-amber-300 px-3.5 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-30"><CircleDollarSign className="mr-1.5 inline h-4 w-4" /> Registrar venta</button>
                    <button onClick={closeDemoRoute} disabled={routeState.run?.status !== 'active'} className="rounded-xl border border-white/10 px-3.5 py-2 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-30"><PackageCheck className="mr-1.5 inline h-4 w-4" /> Cerrar ruta</button>
                  </div>
                </div>

                <div className="mt-5 overflow-hidden rounded-2xl border border-white/8">
                  <div className="grid grid-cols-[1fr_.6fr_.6fr] bg-white/[0.035] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500"><span>Cliente</span><span>Modo</span><span className="text-right">Total</span></div>
                  {routeState.sales.length === 0 ? <div className="px-4 py-10 text-center text-sm text-slate-600">Inicia una ruta y registra ventas para probar el motor.</div> : routeState.sales.map((sale, index) => (
                    <div key={sale.id} className="grid grid-cols-[1fr_.6fr_.6fr] border-t border-white/6 px-4 py-3 text-sm"><span>Cliente {index + 1}</span><span className="text-slate-400">{sale.paymentMethod}</span><span className="text-right font-medium">{fmt(sale.total.amountCents)}</span></div>
                  ))}
                </div>
              </div>
            </section>

            <aside className="rounded-[26px] border border-white/8 bg-[#0d1118] p-5">
              <div className="flex items-center gap-2"><MapPinned className="h-4 w-4 text-amber-300" /><p className="font-semibold">Bitácora</p></div>
              <div className="mt-4 space-y-3">
                {log.map((entry, index) => <div key={`${entry}-${index}`} className="flex gap-3 text-xs leading-5 text-slate-400"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300/70" />{entry}</div>)}
              </div>
            </aside>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1fr_.36fr]">
            <section className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Orden" value={localState.order?.status ?? 'Sin pedido'} hint={localState.order?.tableLabel ?? 'Campestre demo'} />
                <Metric label="Productos" value={String(localState.order?.items.length ?? 0)} hint="Agrupados por persona" />
                <Metric label="Estaciones" value={String(localState.tasks.length)} hint="Ruteo automático" />
                <Metric label="Cuenta" value={fmt(localTotal)} hint="Una cuenta consolidada" />
              </div>

              <div className="rounded-[26px] border border-white/8 bg-[#0d1118] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><p className="font-semibold">ConnectX Local Engine</p><p className="mt-1 text-xs text-slate-500">Pedido → estación → producción → entrega → cobro</p></div>
                  <button onClick={createDemoOrder} className="rounded-xl bg-amber-300 px-4 py-2.5 text-sm font-semibold text-slate-950"><ChefHat className="mr-1.5 inline h-4 w-4" /> Crear comanda demo</button>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  {localState.tasks.length === 0 ? <div className="col-span-full rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-600">La comanda aparecerá dividida por estación de trabajo.</div> : localState.tasks.map(task => (
                    <div key={task.id} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                      <Boxes className="h-5 w-5 text-amber-300" />
                      <p className="mt-3 font-medium capitalize">{task.stationId}</p>
                      <p className="mt-1 text-xs text-slate-500">{task.itemIndexes.length} partida(s) · {task.status}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <aside className="rounded-[26px] border border-white/8 bg-[#0d1118] p-5">
              <div className="flex items-center gap-2"><ArrowLeftRight className="h-4 w-4 text-amber-300" /><p className="font-semibold">Principio</p></div>
              <div className="mt-5 space-y-4 text-sm leading-6 text-slate-400">
                <p>La interfaz cambia según el negocio. El núcleo no.</p>
                <p className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-400" /> Un catálogo, múltiples canales.</p>
                <p className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-400" /> Eventos auditables e idempotentes.</p>
                <p className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-400" /> IA mejora, pero nunca bloquea operación.</p>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
