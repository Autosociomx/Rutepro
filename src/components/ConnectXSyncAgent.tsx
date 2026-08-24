import { useEffect, useState } from 'react';
import { BrowserCommandDelivery } from '../core/useOfflineCommandQueue';

const delivery = new BrowserCommandDelivery();

export function ConnectXSyncAgent() {
  const [pending, setPending] = useState(0);
  const [lastSync, setLastSync] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const flush = async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      try {
        const result = await delivery.queue.flush();
        if (!cancelled) {
          setPending(result.pending);
          if (result.synced > 0) setLastSync(Date.now());
        }
      } catch {
        // The foreground application must never fail because sync is unavailable.
      }
    };

    const onOnline = () => void flush();
    window.addEventListener('online', onOnline);
    void flush();
    const interval = window.setInterval(flush, 15_000);

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
