import { useMemo } from 'react';
import { ArrowRight, BrainCircuit, Globe2, LayoutDashboard, Route, Settings2, Store } from 'lucide-react';
import type { BusinessConfig } from '../core/businessConfig';

const modules = [
  { key: 'local', title: 'ConnectX Local', description: 'Mesas, comandas, producción, mostrador, impresión y caja.', icon: Store, href: '?connectx_local=1' },
  { key: 'routes', title: 'ConnectX Rutas', description: 'Carga, reparto, GPS, venta, devolución, fiado y cierre.', icon: Route, href: '?connectx_routes=1' },
  { key: 'web', title: 'ConnectX Web', description: 'Catálogo público, pedido directo y atribución de campaña.', icon: Globe2, href: '?connectx_store=1' },
  { key: 'growth', title: 'ConnectX Growth', description: 'Datos, contenido, creativos, campañas y control humano.', icon: BrainCircuit, href: '?connectx_growth=1' },
] as const;

export function ConnectXHome() {
  const config = useMemo<BusinessConfig | null>(() => {
    try {
      const raw = localStorage.getItem('cx_business_config_v1');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const businessName = config?.businessName || 'ConnectX Negocio OS';

  return (
    <div className="min-h-screen bg-[#f4f2ec] text-slate-950">
      <header className="border-b border-black/5 bg-[#f4f2ec]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-950 font-black text-white">CX</div><div><p className="font-semibold">{businessName}</p><p className="text-xs text-slate-500">ConnectX Negocio OS</p></div></div>
          <a href="?connectx_setup=1" className="flex items-center gap-2 rounded-2xl border border-black/8 bg-white px-4 py-2.5 text-sm font-semibold"><Settings2 className="h-4 w-4" /> Configurar</a>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-10 md:py-14">
        <section className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
          <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Control operativo</p><h1 className="mt-3 max-w-4xl text-5xl font-semibold tracking-[-0.05em] md:text-7xl">Un negocio. Una configuración. Todos sus flujos.</h1><p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">Local, rutas, comercio y crecimiento comparten catálogo, clientes, ventas, pagos y auditoría. La IA es una capa opcional, no el punto único de falla.</p></div>
          <aside className="rounded-[30px] bg-slate-950 p-6 text-white md:p-8"><LayoutDashboard className="h-6 w-6 text-amber-300" /><p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Estado de configuración</p><p className="mt-2 text-2xl font-semibold">{config ? 'Negocio configurado' : 'Configurar negocio'}</p><p className="mt-3 text-sm leading-6 text-slate-400">{config ? `${config.vertical} · versión ${config.version}` : 'Crea primero un BusinessConfig para activar los módulos adecuados.'}</p><a href="?connectx_setup=1" className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-amber-300 px-4 py-3 text-sm font-semibold text-slate-950">{config ? 'Editar configuración' : 'Comenzar'} <ArrowRight className="h-4 w-4" /></a></aside>
        </section>

        <section className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {modules.map(module => {
            const Icon = module.icon;
            const enabled = config ? Boolean(config.modules[module.key]) : true;
            return <a key={module.key} href={module.href} className={`group flex min-h-72 flex-col rounded-[28px] border p-5 transition ${enabled ? 'border-black/7 bg-white hover:-translate-y-1 hover:shadow-xl hover:shadow-black/5' : 'pointer-events-none border-black/5 bg-black/[0.025] opacity-45'}`}><div className="flex items-center justify-between"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100"><Icon className="h-5 w-5" /></div><span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{enabled ? 'Activo' : 'Desactivado'}</span></div><div className="mt-auto"><h2 className="text-xl font-semibold tracking-tight">{module.title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{module.description}</p><div className="mt-5 flex items-center gap-2 text-sm font-semibold">Abrir <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></div></div></a>;
          })}
        </section>
      </main>
    </div>
  );
}
