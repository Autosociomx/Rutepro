import { useEffect, useState } from 'react';
import type { LocalAggregateState } from '../core/localEngine';
import type { RouteAggregateState } from '../core/routeEngine';
import { discoverLocalCommands, discoverRouteCommands } from '../core/syncDiscovery';
import { BrowserCommandDelivery } from '../core/useOfflineCommandQueue';

const delivery = new BrowserCommandDelivery();
const DISCOVERY_KEY = 'cx_sync_discovery_v1';

const readSeen = (): Set<string> => {
  try {
    const raw = localStorage.getItem(DISCOVERY_KEY);
    const parsed = raw ? JSON.parse(raw) : { keys: [] };
    return new Set(Array.isArray(parsed.keys) ? parsed.keys : []);
  } catch {
    return new Set();
  }
};

const saveSeen = (seen: Set<string>) => {
  localStorage.setItem(DISCOVERY_KEY, JSON.stringify({ keys: [...seen].slice(-20_000) }));
};

const readLocalOrders = (): Array<{ state: LocalAggregateState }> => {
  try {
    const raw = localStorage.getItem('cx_local_orders_v1');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const readRouteState = (): RouteAggregateState => {
  try {
    const raw = localStorage.getItem('cx_route_session_v1');
    return raw ? JSON.parse(raw) : { stops: [], sales: [], processedKeys: [] };
  } catch {
    return { stops: [], sales: [], processedKeys: [] };
  }
};

export function ConnectXSyncAgent() {
  const [pending, setPending] = useState(0);
  const [lastSync, setLastSync] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const discoverAndFlush = async () => {
      try {
        const seen = readSeen();
        const commands = [
          ...discoverLocalCommands(readLocalOrders(), seen),
          ...discoverRouteCommands(readRouteState(), seen),
        ];

        for (const command of commands) await delivery.enqueue(command);
        saveSeen(seen);

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          if (!cancelled) setPending(commands.length);
          return;
        }

        const result = await delivery.queue.flush();
        if (!cancelled) {
          setPending(result.pending);
          if (result.synced > 0) setLastSync(Date.now());
        }
      } catch {
        // Foreground sales must not depend on cloud availability.
      }
    };

    const onOnline = () => void discoverAndFlush();
    window.addEventListener('online', onOnline);
    void discoverAndFlush();
    const interval = window.setInterval(discoverAndFlush, 5_000);

    return () => {
      cancelled = true;
      window.removeEventListener('online', onOnline);
      window.clearInterval(interval);
    };
  }, []);

  if (pending === 0 && !lastSync) return null;

  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-[100] rounded-full border border-black/10 bg-white/90 px-3 py-1.5 text-[10px] font-semibold text-slate-600 shadow-lg backdrop-blur-md">
      {pending > 0 ? `${pending} operación(es) pendientes` : `Sincronizado ${new Date(lastSync!).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`}
    </div>
  );
}
