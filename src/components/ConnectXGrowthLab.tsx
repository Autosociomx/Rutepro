import { useMemo, useState } from 'react';
import { BrainCircuit, CheckCircle2, Image, Megaphone, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import type { BusinessConfig } from '../core/businessConfig';
import type { CommerceOrder } from '../core/commerce';
import { planNextContent } from '../core/contentPlanner';
import { HybridCreativeProvider, HttpCreativeProvider, TemplateCreativeProvider, type GeneratedCreative } from '../core/creativePipeline';
import { approveCampaign, createCampaign, transitionCampaign } from '../core/growthEngine';
import type { Campaign } from '../core/growth';

export function ConnectXGrowthLab() {
  const [useAI, setUseAI] = useState(true);
  const [creative, setCreative] = useState<GeneratedCreative | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [message, setMessage] = useState('');

  const config = useMemo<BusinessConfig | null>(() => {
    try {
      const raw = localStorage.getItem('cx_business_config_v1');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const orders = useMemo<CommerceOrder[]>(() => {
    try {
      const raw = localStorage.getItem('cx_commerce_orders_v1');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, []);

  const products = useMemo(() => {
    const map = new Map<string, { id: string; businessId: string; name: string; unit: string; priceCents: number; active: boolean }>();
    orders.forEach(order => order.items.forEach(item => {
      map.set(item.productId, { id: item.productId, businessId: order.businessId, name: item.productName, unit: 'pza', priceCents: item.unitPrice.amountCents, active: true });
    }));
    if (map.size === 0) {
      map.set('elote', { id: 'elote', businessId: config?.businessId || 'mora', name: 'Elote preparado', unit: 'pza', priceCents: 3500, active: true });
    }
    return [...map.values()];
  }, [orders, config]);

  const performance = useMemo(() => products.map(product => {
    let units = 0;
    let revenueCents = 0;
    let lastSoldAt = 0;
    orders.forEach(order => order.items.filter(item => item.productId === product.id).forEach(item => {
      units += item.quantity;
      revenueCents += item.quantity * item.unitPrice.amountCents;
      lastSoldAt = Math.max(lastSoldAt, order.createdAt);
    }));
    return { productId: product.id, units, revenueCents, lastSoldAt: lastSoldAt || undefined };
  }), [products, orders]);

  const plan = useMemo(() => planNextContent({
    businessId: config?.businessId || 'mora',
    products,
    performance,
    cadenceDays: 3,
    now: Date.now(),
  }), [config, products, performance]);

  const selectedProduct = products.find(product => product.id === plan?.productId) || products[0];

  const generateCreative = async () => {
    if (!selectedProduct) return;
    setMessage('Generando pieza...');
    const provider = new HybridCreativeProvider(
      new TemplateCreativeProvider(),
      useAI ? new HttpCreativeProvider() : undefined,
    );
    const result = await provider.generate({
      businessName: config?.businessName || 'Mi Negocio',
      productName: selectedProduct.name,
      headline: selectedProduct.name,
      subheadline: plan?.angle || 'Una promoción basada en datos reales.',
      priceLabel: new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(selectedProduct.priceCents / 100),
      callToAction: 'Pide directo',
      brandColor: '#E5B84B',
      format: 'square',
    });
    setCreative(result);
    setMessage(result.source === 'ai' ? 'Creativo generado con IA. Pendiente de aprobación.' : 'IA no disponible o desactivada. Creativo generado con plantilla local.');
  };

  const buildCampaign = () => {
    if (!selectedProduct) return;
    const result = createCampaign({
      id: `campaign-${Date.now()}`,
      tenantId: config?.tenantId || 'connectx',
      businessId: config?.businessId || 'mora',
      name: `Impulso · ${selectedProduct.name}`,
      objective: 'sales',
      productIds: [selectedProduct.id],
      channels: ['instagram', 'facebook'],
      budgetCents: 300_000,
      createdBy: 'owner-demo',
      createdAt: Date.now(),
    });
    if (result.ok) {
      setCampaign(result.value);
      setMessage('Campaña creada como borrador. Nadie publica sin aprobación humana.');
    }
  };

  const approveAndActivate = () => {
    if (!campaign) return;
    const approved = approveCampaign(campaign, 'owner-demo', Date.now());
    if (!approved.ok) return;
    const active = transitionCampaign(approved.value, 'active');
    if (!active.ok) return;
    setCampaign(active.value);
    setMessage('Campaña aprobada y activada en el modelo. La publicación externa se conecta mediante adaptador de canal.');
  };

  const totalRevenue = performance.reduce((sum, row) => sum + row.revenueCents, 0);

  return (
    <div className="min-h-screen bg-[#0b0e13] text-white">
      <main className="mx-auto max-w-7xl px-5 py-8 md:py-12">
        <header className="flex flex-wrap items-start justify-between gap-5">
          <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">ConnectX Growth</p><h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] md:text-5xl">Datos que vuelven a convertirse en demanda.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Planifica contenido cada 2–3 días, genera creativos con IA cuando existe y cae a plantillas locales cuando no. Nada se publica sin aprobación.</p></div>
          <button onClick={() => setUseAI(value => !value)} className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold ${useAI ? 'bg-amber-300 text-slate-950' : 'bg-white/8 text-slate-300'}`}><BrainCircuit className="h-4 w-4" /> IA {useAI ? 'preferida' : 'desactivada'}</button>
        </header>

        <div className="mt-9 grid gap-4 md:grid-cols-3">
          <div className="rounded-[26px] border border-white/8 bg-white/[0.035] p-5"><p className="text-xs uppercase tracking-wider text-slate-500">Pedidos observados</p><p className="mt-2 text-3xl font-semibold">{orders.length}</p><p className="mt-2 text-xs text-slate-500">ConnectX Commerce local</p></div>
          <div className="rounded-[26px] border border-white/8 bg-white/[0.035] p-5"><p className="text-xs uppercase tracking-wider text-slate-500">Ingresos atribuibles</p><p className="mt-2 text-3xl font-semibold">{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(totalRevenue / 100)}</p><p className="mt-2 text-xs text-slate-500">Base para priorizar productos</p></div>
          <div className="rounded-[26px] border border-white/8 bg-white/[0.035] p-5"><p className="text-xs uppercase tracking-wider text-slate-500">Cadencia</p><p className="mt-2 text-3xl font-semibold">3 días</p><p className="mt-2 text-xs text-slate-500">Regla configurable por negocio</p></div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[.72fr_1.28fr]">
          <section className="rounded-[28px] border border-white/8 bg-[#10141c] p-6">
            <div className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-amber-300" /><h2 className="font-semibold">Próxima oportunidad</h2></div>
            {plan && selectedProduct ? <div className="mt-5"><p className="text-2xl font-semibold tracking-tight">{selectedProduct.name}</p><p className="mt-3 text-sm leading-6 text-slate-400">{plan.angle}</p><div className="mt-4 rounded-2xl bg-white/[0.04] p-4 text-xs leading-5 text-slate-400">{plan.evidence}</div><p className="mt-4 text-xs text-slate-500">Próxima pieza: {new Date(plan.dueAt).toLocaleDateString('es-MX')}</p></div> : <p className="mt-5 text-sm text-slate-500">Sin catálogo suficiente.</p>}
            <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"><button onClick={generateCreative} className="flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950"><Sparkles className="h-4 w-4" /> Generar creativo</button><button onClick={buildCampaign} className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200"><RefreshCw className="h-4 w-4" /> Crear campaña</button></div>
          </section>

          <section className="rounded-[28px] border border-white/8 bg-[#10141c] p-6">
            <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Image className="h-5 w-5 text-amber-300" /><h2 className="font-semibold">Creative Studio</h2></div>{creative && <span className="rounded-full bg-white/8 px-2.5 py-1 text-[10px] uppercase tracking-wider text-slate-400">{creative.source}</span>}</div>
            <div className="mt-5 grid min-h-[360px] place-items-center overflow-hidden rounded-[24px] bg-black/30">
              {creative ? <img src={creative.uri} alt="Creativo generado" className="h-full max-h-[520px] w-full object-contain" /> : <div className="text-center"><Image className="mx-auto h-9 w-9 text-slate-700" /><p className="mt-3 text-sm text-slate-600">Genera una pieza para evaluar composición, mensaje y CTA.</p></div>}
            </div>
          </section>
        </div>

        <section className="mt-5 rounded-[28px] border border-white/8 bg-[#10141c] p-6">
          <div className="flex flex-wrap items-center justify-between gap-4"><div><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-400" /><h2 className="font-semibold">Control humano</h2></div><p className="mt-2 text-sm text-slate-500">{campaign ? `${campaign.name} · ${campaign.status}` : 'Todavía no existe campaña.'}</p></div>{campaign && campaign.status === 'draft' && <button onClick={approveAndActivate} className="flex items-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-emerald-950"><CheckCircle2 className="h-4 w-4" /> Aprobar y activar</button>}</div>
          {message && <p className="mt-4 rounded-2xl bg-white/[0.035] px-4 py-3 text-xs leading-5 text-slate-400">{message}</p>}
        </section>
      </main>
    </div>
  );
}
