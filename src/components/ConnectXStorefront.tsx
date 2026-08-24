import { useMemo, useState } from 'react';
import { CheckCircle2, Minus, Plus, ShoppingBag, Store, X } from 'lucide-react';
import { createCommerceOrder, transitionCommerceOrder } from '../core/commerceEngine';
import { money } from '../core/money';
import type { BusinessConfig } from '../core/businessConfig';

interface StoreProduct {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  category: string;
}

const fallbackProducts: StoreProduct[] = [
  { id: 'pozole', name: 'Pozole', description: 'Receta tradicional, porción individual.', priceCents: 9000, category: 'Antojitos' },
  { id: 'tostada', name: 'Tostada', description: 'Crujiente y preparada al momento.', priceCents: 4500, category: 'Antojitos' },
  { id: 'tostielote', name: 'Tostielote', description: 'Elote preparado sobre tostito.', priceCents: 6500, category: 'Elotes' },
  { id: 'elote', name: 'Elote preparado', description: 'Crema, queso y chile al gusto.', priceCents: 3500, category: 'Elotes' },
  { id: 'agua', name: 'Agua fresca', description: 'Horchata o jamaica.', priceCents: 2000, category: 'Bebidas' },
];

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

export function ConnectXStorefront() {
  const config = useMemo<BusinessConfig | null>(() => {
    try {
      const raw = localStorage.getItem('cx_business_config_v1');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const products = useMemo<StoreProduct[]>(() => {
    const suggested = config?.settings?.suggestedCatalog;
    if (!Array.isArray(suggested) || suggested.length === 0) return fallbackProducts;
    return suggested.map((item: any, index) => ({
      id: item.id || `product-${index + 1}`,
      name: item.nombre || `Producto ${index + 1}`,
      description: item.descripcion || item.unidad || 'Disponible para pedido.',
      priceCents: Number(item.precio || 0) > 1000 ? Number(item.precio) : Math.round(Number(item.precio || 0) * 100),
      category: item.categoria || 'Menú',
    })).filter(product => product.priceCents >= 0);
  }, [config]);

  const [cart, setCart] = useState<Record<string, number>>({});
  const [openCart, setOpenCart] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [fulfillment, setFulfillment] = useState<'pickup' | 'delivery'>('pickup');
  const [address, setAddress] = useState('');
  const [complete, setComplete] = useState<string | null>(null);

  const quantity = Object.values(cart).reduce((sum, value) => sum + value, 0);
  const totalCents = products.reduce((sum, product) => sum + product.priceCents * (cart[product.id] || 0), 0);
  const businessName = config?.businessName || 'Campestre de Mora';

  const changeQuantity = (id: string, delta: number) => {
    setCart(current => {
      const next = Math.max(0, (current[id] || 0) + delta);
      const updated = { ...current, [id]: next };
      if (next === 0) delete updated[id];
      return updated;
    });
  };

  const checkout = () => {
    const items = products
      .filter(product => (cart[product.id] || 0) > 0)
      .map(product => ({
        productId: product.id,
        productName: product.name,
        quantity: cart[product.id],
        unitPrice: money(product.priceCents),
      }));

    const params = new URLSearchParams(window.location.search);
    const order = createCommerceOrder({
      id: `web-${crypto.randomUUID?.() || Date.now()}`,
      tenantId: config?.tenantId || 'connectx',
      businessId: config?.businessId || 'mora',
      channel: 'web',
      fulfillment,
      customerName: name.trim() || undefined,
      customerPhone: phone.trim() || undefined,
      deliveryAddress: fulfillment === 'delivery' ? address.trim() : undefined,
      campaignId: params.get('cid') || undefined,
      items,
      createdAt: Date.now(),
    });

    if (!order.ok) return;
    const submitted = transitionCommerceOrder(order.value, 'submitted', Date.now());
    if (!submitted.ok) return;

    const existing = JSON.parse(localStorage.getItem('cx_commerce_orders_v1') || '[]');
    existing.push(submitted.value);
    localStorage.setItem('cx_commerce_orders_v1', JSON.stringify(existing));
    setComplete(submitted.value.id);
    setCart({});
  };

  if (complete) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f5f1e8] px-5 text-slate-950">
        <div className="w-full max-w-md rounded-[32px] bg-white p-8 text-center shadow-xl shadow-black/5">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-7 w-7" /></div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">Pedido recibido</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Folio <span className="font-mono text-slate-800">{complete.slice(-10)}</span>. El pedido ya quedó registrado en ConnectX Commerce.</p>
          <button onClick={() => setComplete(null)} className="mt-6 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Hacer otro pedido</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f1e8] text-slate-950">
      <header className="border-b border-black/5 bg-[#f5f1e8]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-950 text-white"><Store className="h-5 w-5" /></div><div><p className="font-semibold tracking-tight">{businessName}</p><p className="text-xs text-slate-500">Pedido directo · ConnectX</p></div></div>
          <button onClick={() => setOpenCart(true)} className="relative flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"><ShoppingBag className="h-4 w-4" /> Pedido{quantity > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-amber-300 px-1 text-[10px] text-slate-950">{quantity}</span>}</button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10">
        <section className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Menú digital</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] md:text-6xl">Pide directamente al negocio.</h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600">El mismo catálogo que usa la operación. Sin volver a capturar precios, productos ni promociones en otro sistema.</p>
        </section>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map(product => {
            const count = cart[product.id] || 0;
            return (
              <article key={product.id} className="flex min-h-64 flex-col rounded-[28px] border border-black/7 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{product.category}</span><span className="font-semibold">{currency.format(product.priceCents / 100)}</span></div>
                <div className="mt-auto pt-12"><h2 className="text-xl font-semibold tracking-tight">{product.name}</h2><p className="mt-2 min-h-10 text-sm leading-5 text-slate-500">{product.description}</p>
                  <div className="mt-5 flex items-center justify-between">
                    {count === 0 ? <button onClick={() => changeQuantity(product.id, 1)} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Agregar</button> : <div className="flex items-center gap-2 rounded-xl bg-slate-100 p-1"><button onClick={() => changeQuantity(product.id, -1)} className="grid h-8 w-8 place-items-center rounded-lg bg-white"><Minus className="h-4 w-4" /></button><span className="w-6 text-center text-sm font-semibold">{count}</span><button onClick={() => changeQuantity(product.id, 1)} className="grid h-8 w-8 place-items-center rounded-lg bg-slate-950 text-white"><Plus className="h-4 w-4" /></button></div>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </main>

      {openCart && (
        <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-sm">
          <div className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Tu pedido</p><h2 className="mt-1 text-2xl font-semibold">{currency.format(totalCents / 100)}</h2></div><button onClick={() => setOpenCart(false)} className="grid h-10 w-10 place-items-center rounded-full bg-slate-100"><X className="h-4 w-4" /></button></div>

            <div className="mt-6 space-y-3">{products.filter(product => cart[product.id]).map(product => <div key={product.id} className="flex items-center justify-between rounded-2xl bg-slate-50 p-4"><div><p className="text-sm font-semibold">{product.name}</p><p className="mt-1 text-xs text-slate-500">{cart[product.id]} × {currency.format(product.priceCents / 100)}</p></div><span className="text-sm font-medium">{currency.format(product.priceCents * cart[product.id] / 100)}</span></div>)}</div>

            <div className="mt-7 grid gap-4">
              <input value={name} onChange={event => setName(event.target.value)} placeholder="Nombre" className="rounded-2xl border border-slate-200 px-4 py-3.5 outline-none focus:border-slate-400" />
              <input value={phone} onChange={event => setPhone(event.target.value)} placeholder="WhatsApp / teléfono" className="rounded-2xl border border-slate-200 px-4 py-3.5 outline-none focus:border-slate-400" />
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1"><button onClick={() => setFulfillment('pickup')} className={`rounded-xl px-3 py-2.5 text-sm font-medium ${fulfillment === 'pickup' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Recoger</button><button onClick={() => setFulfillment('delivery')} className={`rounded-xl px-3 py-2.5 text-sm font-medium ${fulfillment === 'delivery' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Envío</button></div>
              {fulfillment === 'delivery' && <textarea value={address} onChange={event => setAddress(event.target.value)} placeholder="Dirección de entrega" rows={3} className="resize-none rounded-2xl border border-slate-200 px-4 py-3.5 outline-none focus:border-slate-400" />}
              <button disabled={quantity === 0 || (fulfillment === 'delivery' && !address.trim())} onClick={checkout} className="rounded-2xl bg-slate-950 px-5 py-4 text-sm font-semibold text-white disabled:opacity-40">Enviar pedido · {currency.format(totalCents / 100)}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
