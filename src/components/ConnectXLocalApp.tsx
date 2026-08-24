import { useMemo, useState } from 'react';
import { ChefHat, Check, CircleDollarSign, Minus, Plus, Printer, ReceiptText, Store, Users } from 'lucide-react';
import { money } from '../core/money';
import { areAllTasksReady, createLocalOrder, createPrintJobs, createProductionTasks, transitionOrder, updateProductionTask, type LocalAggregateState } from '../core/localEngine';

interface MenuProduct {
  id: string;
  name: string;
  priceCents: number;
  category: string;
  stationId: string;
}

interface PersistedLocalOrder {
  state: LocalAggregateState;
  seq: number;
}

const demoMenu: MenuProduct[] = [
  { id: 'pozole', name: 'Pozole', priceCents: 9000, category: 'Antojitos', stationId: 'antojos' },
  { id: 'sope', name: 'Sope', priceCents: 3500, category: 'Antojitos', stationId: 'antojos' },
  { id: 'taco', name: 'Taco', priceCents: 3000, category: 'Antojitos', stationId: 'antojos' },
  { id: 'tostada', name: 'Tostada', priceCents: 4500, category: 'Tostadas', stationId: 'tostadas' },
  { id: 'tamal', name: 'Tamal de elote', priceCents: 1800, category: 'Tamales', stationId: 'tamales' },
  { id: 'elote', name: 'Elote preparado', priceCents: 3500, category: 'Elotes', stationId: 'elotes' },
  { id: 'esquite', name: 'Esquite', priceCents: 3000, category: 'Elotes', stationId: 'elotes' },
  { id: 'agua', name: 'Agua fresca', priceCents: 2000, category: 'Bebidas', stationId: 'bebidas' },
];

const moneyFmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const storageKey = 'cx_local_orders_v1';

const readOrders = (): PersistedLocalOrder[] => {
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export function ConnectXLocalApp() {
  const [tab, setTab] = useState<'service' | 'production' | 'cash'>('service');
  const [orders, setOrders] = useState<PersistedLocalOrder[]>(() => readOrders());
  const [table, setTable] = useState('Mesa 1');
  const [person, setPerson] = useState('Persona 1');
  const [category, setCategory] = useState('Antojitos');
  const [cart, setCart] = useState<Array<MenuProduct & { quantity: number; personLabel: string }>>([]);
  const [toast, setToast] = useState('');

  const categories = useMemo(() => [...new Set(demoMenu.map(item => item.category))], []);
  const cartTotal = cart.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);

  const save = (next: PersistedLocalOrder[]) => {
    setOrders(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2200);
  };

  const addProduct = (product: MenuProduct) => {
    const index = cart.findIndex(item => item.id === product.id && item.personLabel === person);
    if (index >= 0) {
      setCart(cart.map((item, i) => i === index ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { ...product, quantity: 1, personLabel: person }]);
    }
  };

  const changeCart = (index: number, delta: number) => {
    setCart(current => current.flatMap((item, i) => {
      if (i !== index) return [item];
      const quantity = item.quantity + delta;
      return quantity > 0 ? [{ ...item, quantity }] : [];
    }));
  };

  const sendOrder = () => {
    const created = createLocalOrder({
      id: `order-${crypto.randomUUID?.() || Date.now()}`,
      tenantId: 'connectx',
      businessId: 'mora',
      locationId: 'mora-01',
      tableLabel: table,
      waiterId: 'waiter-demo',
      createdAt: Date.now(),
      items: cart.map(item => ({
        productId: item.id,
        productName: item.name,
        quantity: item.quantity,
        unitPrice: money(item.priceCents),
        stationId: item.stationId,
        personLabel: item.personLabel,
      })),
    });
    if (!created.ok) return notify(`No se pudo enviar: ${created.error}`);
    const sent = transitionOrder(created.value, 'sent', Date.now());
    if (!sent.ok) return notify(`Estado inválido: ${sent.error}`);
    let seq = 0;
    const tasks = createProductionTasks(sent.value, () => `task-${Date.now()}-${++seq}`);
    if (!tasks.ok) return notify(`Producción inválida: ${tasks.error}`);
    const printed = createPrintJobs(tasks.value, {
      antojos: 'printer-antojos', tostadas: 'printer-tostadas', tamales: 'printer-tamales', elotes: 'printer-elotes', bebidas: 'printer-bebidas',
    }, () => `print-${Date.now()}-${++seq}`, Date.now());
    const finalState = printed.ok ? printed.value : tasks.value;
    const next = [...orders, { state: finalState, seq: orders.length + 1 }];
    save(next);
    setCart([]);
    notify(`Comanda enviada a ${finalState.tasks.length} estación(es)`);
  };

  const setTaskStatus = (orderId: string, taskId: string, status: 'preparing' | 'ready') => {
    const next = orders.map(record => {
      if (record.state.order?.id !== orderId) return record;
      const updated = updateProductionTask(record.state, taskId, status, Date.now());
      if (!updated.ok) return record;
      let state = updated.value;
      if (areAllTasksReady(state) && state.order && state.order.status !== 'ready') {
        const ready = transitionOrder(state, 'ready', Date.now());
        if (ready.ok) state = ready.value;
      } else if (status === 'preparing' && state.order?.status === 'sent') {
        const preparing = transitionOrder(state, 'preparing', Date.now());
        if (preparing.ok) state = preparing.value;
      }
      return { ...record, state };
    });
    save(next);
  };

  const settleOrder = (orderId: string) => {
    const next = orders.map(record => {
      if (record.state.order?.id !== orderId || !record.state.order) return record;
      let state = record.state;
      if (state.order.status === 'ready') {
        const delivered = transitionOrder(state, 'delivered', Date.now());
        if (delivered.ok) state = delivered.value;
      }
      if (state.order?.status === 'delivered') {
        const paid = transitionOrder(state, 'paid', Date.now());
        if (paid.ok) state = paid.value;
      }
      return { ...record, state };
    });
    save(next);
    notify('Cuenta cerrada');
  };

  const orderTotal = (record: PersistedLocalOrder) => record.state.order?.items.reduce((sum, item) => sum + item.unitPrice.amountCents * item.quantity, 0) ?? 0;

  const openOrders = orders.filter(record => record.state.order && !['paid', 'cancelled'].includes(record.state.order.status));
  const paidOrders = orders.filter(record => record.state.order?.status === 'paid');
  const paidTotal = paidOrders.reduce((sum, record) => sum + orderTotal(record), 0);

  return (
    <div className="min-h-screen bg-[#f3f1ec] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-[#f3f1ec]/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-950 text-white"><Store className="h-5 w-5" /></div><div><p className="font-semibold">ConnectX Local</p><p className="text-xs text-slate-500">Campestre · operación en establecimiento</p></div></div>
          <div className="flex rounded-2xl bg-white p-1 shadow-sm">
            {[['service','Servicio'],['production','Producción'],['cash','Caja']].map(([key,label]) => <button key={key} onClick={() => setTab(key as typeof tab)} className={`rounded-xl px-3 py-2 text-xs font-semibold md:px-4 ${tab === key ? 'bg-slate-950 text-white' : 'text-slate-500'}`}>{label}</button>)}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4 md:p-6">
        {tab === 'service' && (
          <div className="grid gap-5 xl:grid-cols-[.7fr_1.35fr_.75fr]">
            <section className="rounded-[28px] bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2"><Users className="h-5 w-5" /><h2 className="font-semibold">Mesa y persona</h2></div>
              <div className="mt-5 grid grid-cols-3 gap-2">{Array.from({ length: 12 }, (_, i) => `Mesa ${i + 1}`).map(value => <button key={value} onClick={() => setTable(value)} className={`rounded-xl px-2 py-3 text-xs font-semibold ${table === value ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600'}`}>{value}</button>)}</div>
              <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-slate-400">Persona</p>
              <div className="mt-2 grid grid-cols-2 gap-2">{[1,2,3,4].map(value => { const label = `Persona ${value}`; return <button key={label} onClick={() => setPerson(label)} className={`rounded-xl px-3 py-3 text-sm font-semibold ${person === label ? 'bg-amber-300 text-slate-950' : 'bg-slate-100 text-slate-600'}`}>{label}</button>; })}</div>
            </section>

            <section className="rounded-[28px] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap gap-2">{categories.map(value => <button key={value} onClick={() => setCategory(value)} className={`rounded-full px-3 py-2 text-xs font-semibold ${category === value ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-500'}`}>{value}</button>)}</div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{demoMenu.filter(item => item.category === category).map(product => <button key={product.id} onClick={() => addProduct(product)} className="min-h-36 rounded-2xl border border-black/6 bg-[#faf9f6] p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"><p className="text-sm font-semibold">{product.name}</p><p className="mt-2 text-xl font-semibold">{moneyFmt.format(product.priceCents / 100)}</p><p className="mt-5 text-[10px] uppercase tracking-wider text-slate-400">→ {product.stationId}</p></button>)}</div>
            </section>

            <aside className="rounded-[28px] bg-slate-950 p-5 text-white shadow-sm">
              <div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-wider text-slate-500">Comanda</p><h2 className="mt-1 text-xl font-semibold">{table}</h2></div><ReceiptText className="h-5 w-5 text-amber-300" /></div>
              <div className="mt-5 space-y-3">{cart.length === 0 ? <p className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-600">Selecciona productos.</p> : cart.map((item,index) => <div key={`${item.id}-${item.personLabel}`} className="rounded-2xl bg-white/[0.06] p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium">{item.name}</p><p className="mt-1 text-xs text-slate-500">{item.personLabel} · {item.stationId}</p></div><p className="text-sm font-semibold">{moneyFmt.format(item.priceCents * item.quantity / 100)}</p></div><div className="mt-3 flex items-center gap-2"><button onClick={() => changeCart(index,-1)} className="grid h-8 w-8 place-items-center rounded-lg bg-white/8"><Minus className="h-3.5 w-3.5" /></button><span className="w-7 text-center text-sm">{item.quantity}</span><button onClick={() => changeCart(index,1)} className="grid h-8 w-8 place-items-center rounded-lg bg-white text-slate-950"><Plus className="h-3.5 w-3.5" /></button></div></div>)}</div>
              <div className="mt-6 border-t border-white/10 pt-4"><div className="flex justify-between text-sm"><span className="text-slate-400">Total</span><span className="text-xl font-semibold">{moneyFmt.format(cartTotal / 100)}</span></div><button onClick={sendOrder} disabled={!cart.length} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-300 px-4 py-3.5 text-sm font-semibold text-slate-950 disabled:opacity-30"><Printer className="h-4 w-4" /> Enviar comanda</button></div>
            </aside>
          </div>
        )}

        {tab === 'production' && (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{openOrders.flatMap(record => record.state.tasks.map(task => {
            const items = task.itemIndexes.map(index => record.state.order?.items[index]).filter(Boolean);
            return <article key={task.id} className="rounded-[26px] bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{task.stationId}</p><h2 className="mt-1 text-xl font-semibold">{record.state.order?.tableLabel}</h2></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${task.status === 'ready' ? 'bg-emerald-100 text-emerald-800' : task.status === 'preparing' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>{task.status}</span></div><div className="mt-4 space-y-2">{items.map((item:any,index) => <div key={index} className="rounded-xl bg-slate-50 px-3 py-2.5"><p className="text-sm font-semibold">{item.quantity} × {item.productName}</p><p className="text-xs text-slate-500">{item.personLabel}</p></div>)}</div><div className="mt-5 grid grid-cols-2 gap-2"><button onClick={() => setTaskStatus(record.state.order!.id, task.id, 'preparing')} className="rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-semibold">Preparando</button><button onClick={() => setTaskStatus(record.state.order!.id, task.id, 'ready')} className="rounded-xl bg-emerald-500 px-3 py-2.5 text-xs font-semibold text-white">Listo</button></div></article>;
          }))}{openOrders.length === 0 && <div className="col-span-full rounded-[28px] bg-white px-6 py-20 text-center"><ChefHat className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm text-slate-500">No hay comandas pendientes.</p></div>}</div>
        )}

        {tab === 'cash' && (
          <div className="grid gap-5 lg:grid-cols-[1fr_.38fr]">
            <section className="rounded-[28px] bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><CircleDollarSign className="h-5 w-5" /><h2 className="font-semibold">Cuentas abiertas</h2></div><div className="mt-5 space-y-3">{openOrders.map(record => <div key={record.state.order!.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4"><div><p className="font-semibold">{record.state.order?.tableLabel}</p><p className="mt-1 text-xs text-slate-500">{record.state.order?.status} · {record.state.order?.items.length} partidas</p></div><div className="flex items-center gap-3"><span className="font-semibold">{moneyFmt.format(orderTotal(record) / 100)}</span><button disabled={record.state.order?.status !== 'ready' && record.state.order?.status !== 'delivered'} onClick={() => settleOrder(record.state.order!.id)} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-25">Cobrar</button></div></div>)}{openOrders.length === 0 && <p className="py-12 text-center text-sm text-slate-400">Sin cuentas abiertas.</p>}</div></section>
            <aside className="rounded-[28px] bg-slate-950 p-6 text-white"><p className="text-xs uppercase tracking-wider text-slate-500">Corte acumulado</p><p className="mt-3 text-4xl font-semibold tracking-tight">{moneyFmt.format(paidTotal / 100)}</p><p className="mt-2 text-sm text-slate-500">{paidOrders.length} cuenta(s) cobradas</p><div className="mt-8 space-y-3 text-sm text-slate-300"><p className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> Flujo por estados</p><p className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> Separación por persona</p><p className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> Ruteo por estación</p></div></aside>
          </div>
        )}
      </main>

      {toast && <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white shadow-xl">{toast}</div>}
    </div>
  );
}
