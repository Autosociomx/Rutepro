import { useMemo, useState } from 'react';
import { BrainCircuit, Building2, Check, ChevronRight, Route, Sparkles, Store, WandSparkles } from 'lucide-react';
import { createBusinessTemplate, type VerticalTemplate } from '../core/templates';
import { validateBusinessConfig, type BusinessConfig } from '../core/businessConfig';

interface GeneratedConfigResponse {
  nombre?: string;
  subtitulo?: string;
  productos?: Array<{ id?: string; nombre?: string; precio?: number; unidad?: string }>;
  vendedores?: Array<{ id?: string; nombre?: string; ruta?: string }>;
}

const templateOptions: Array<{ id: VerticalTemplate; title: string; description: string; icon: typeof Store }> = [
  { id: 'restaurant', title: 'Restaurante / local', description: 'Mesas, comandas, estaciones, cocina y caja.', icon: Store },
  { id: 'bakery_routes', title: 'Panadería con rutas', description: 'Carga, reparto, devolución, crédito y cierre.', icon: Route },
  { id: 'tortilleria_routes', title: 'Tortillería con rutas', description: 'Venta por kilo, cartera, devolución y rutas.', icon: Route },
  { id: 'distribution', title: 'Distribución', description: 'Catálogo, vehículos, clientes y venta en territorio.', icon: Building2 },
];

export function ConnectXSetup() {
  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [template, setTemplate] = useState<VerticalTemplate>('restaurant');
  const [routesCount, setRoutesCount] = useState(1);
  const [useAI, setUseAI] = useState(true);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState<BusinessConfig | null>(null);
  const [message, setMessage] = useState('');

  const normalizedId = useMemo(() => {
    const base = businessName.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return base || `negocio-${Date.now()}`;
  }, [businessName]);

  const buildDeterministic = (): BusinessConfig => {
    const config = createBusinessTemplate(template, normalizedId, businessName.trim() || 'Mi negocio');
    if (config.modules.routes) {
      config.routes = Array.from({ length: Math.max(1, routesCount) }, (_, index) => ({
        id: `route-${index + 1}`,
        name: `Ruta ${index + 1}`,
      }));
    }
    return config;
  };

  const generate = async () => {
    setLoading(true);
    setMessage('');
    let config = buildDeterministic();

    if (useAI && description.trim()) {
      try {
        const response = await fetch('/api/generate-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: `${businessName}. ${description}` }),
        });
        if (response.ok) {
          const ai = await response.json() as GeneratedConfigResponse;
          config = {
            ...config,
            businessName: ai.nombre?.trim() || config.businessName,
            settings: {
              ...config.settings,
              aiSetup: true,
              aiSubtitle: ai.subtitulo,
              suggestedCatalog: ai.productos ?? [],
              suggestedSellers: ai.vendedores ?? [],
            },
          };
          setMessage('Configuración enriquecida por IA y validada por reglas locales.');
        } else {
          setMessage('IA no disponible. Se generó una configuración determinista completa.');
        }
      } catch {
        setMessage('Sin conexión a IA. El configurador continuó en modo local.');
      }
    } else {
      setMessage('Configuración generada sin IA.');
    }

    const errors = validateBusinessConfig(config);
    if (errors.length) {
      setMessage(`Configuración inválida: ${errors.join(', ')}`);
      setLoading(false);
      return;
    }

    localStorage.setItem('cx_business_config_v1', JSON.stringify(config));
    setGenerated(config);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#f4f2ec] text-slate-950">
      <main className="mx-auto max-w-6xl px-5 py-8 md:py-14">
        <div className="grid gap-7 lg:grid-cols-[.78fr_1.22fr]">
          <section className="rounded-[32px] bg-[#11151c] p-7 text-white md:p-10">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-300 font-black text-slate-950">CX</div>
              <div><p className="font-semibold">ConnectX Negocio OS</p><p className="text-xs text-slate-500">Configurador maestro</p></div>
            </div>
            <h1 className="mt-10 text-4xl font-semibold tracking-[-0.04em] md:text-5xl">Configura una vez. Opera en todos tus canales.</h1>
            <p className="mt-5 max-w-md text-sm leading-6 text-slate-400">La IA puede acelerar el alta, pero la configuración final siempre pasa por reglas deterministas. Si la IA o internet fallan, el negocio sigue funcionando.</p>

            <div className="mt-9 space-y-4">
              {['Operación del local o rutas', 'Catálogo y métodos de pago', 'Reglas por giro', 'IA opcional con fallback local'].map((item, index) => (
                <div key={item} className="flex items-center gap-3 text-sm text-slate-300"><span className="grid h-6 w-6 place-items-center rounded-full border border-white/10 text-[10px] text-amber-300">{index + 1}</span>{item}</div>
              ))}
            </div>
          </section>

          <section className="rounded-[32px] border border-black/8 bg-white p-6 shadow-sm md:p-9">
            <div className="flex items-center justify-between gap-4">
              <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Nuevo negocio</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">Diseña su operación</h2></div>
              <button onClick={() => setUseAI(value => !value)} className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${useAI ? 'bg-amber-100 text-amber-950' : 'bg-slate-100 text-slate-500'}`}><BrainCircuit className="h-4 w-4" /> IA {useAI ? 'activa' : 'opcional'}</button>
            </div>

            <div className="mt-7 grid gap-4">
              <label className="grid gap-2 text-sm font-medium">Nombre del negocio<input value={businessName} onChange={event => setBusinessName(event.target.value)} placeholder="Ej. Panadería María Belén" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none transition focus:border-slate-400" /></label>
              <label className="grid gap-2 text-sm font-medium">Describe cómo trabaja<textarea value={description} onChange={event => setDescription(event.target.value)} rows={3} placeholder="Tenemos 8 rutas, cada vendedor carga por la mañana, vendemos efectivo y fiado..." className="resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none transition focus:border-slate-400" /></label>
            </div>

            <div className="mt-6">
              <p className="text-sm font-medium">Modelo operativo</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {templateOptions.map(option => {
                  const Icon = option.icon;
                  const selected = template === option.id;
                  return <button key={option.id} onClick={() => setTemplate(option.id)} className={`rounded-2xl border p-4 text-left transition ${selected ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white hover:bg-slate-50'}`}><div className="flex items-center justify-between"><Icon className={`h-5 w-5 ${selected ? 'text-amber-300' : 'text-slate-500'}`} />{selected && <Check className="h-4 w-4 text-amber-300" />}</div><p className="mt-3 text-sm font-semibold">{option.title}</p><p className={`mt-1 text-xs leading-5 ${selected ? 'text-slate-400' : 'text-slate-500'}`}>{option.description}</p></button>;
                })}
              </div>
            </div>

            {(template === 'bakery_routes' || template === 'tortilleria_routes' || template === 'distribution') && (
              <label className="mt-5 grid gap-2 text-sm font-medium">Número de rutas<input type="number" min={1} max={100} value={routesCount} onChange={event => setRoutesCount(Math.max(1, Number(event.target.value) || 1))} className="w-32 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none" /></label>
            )}

            <button onClick={generate} disabled={loading || !businessName.trim()} className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">{loading ? <Sparkles className="h-4 w-4 animate-pulse" /> : useAI ? <WandSparkles className="h-4 w-4 text-amber-300" /> : <ChevronRight className="h-4 w-4" />}{loading ? 'Construyendo configuración...' : 'Generar negocio'}</button>

            {message && <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">{message}</p>}

            {generated && (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900"><Check className="h-4 w-4" /> Configuración lista</p>
                <p className="mt-2 text-xs leading-5 text-emerald-800">{generated.businessName} · {generated.vertical} · {generated.routes.length} ruta(s) · módulos {Object.entries(generated.modules).filter(([, enabled]) => enabled).map(([name]) => name).join(', ')}</p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
