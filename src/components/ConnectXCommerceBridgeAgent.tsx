import { useEffect } from 'react';
import type { CommerceOrder } from '../core/commerce';
import { commerceOrderToLocalState } from '../core/commerceLocalBridge';

const PROCESSED_KEY = 'cx_commerce_bridge_processed_v1';
const COMMERCE_KEY = 'cx_commerce_orders_v1';
const LOCAL_KEY = 'cx_local_orders_v1';

const readArray = <T,>(key: string): T[] => {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const stationFor = (productId: string): string => {
  const id = productId.toLowerCase();
  if (/agua|refresco|bebida|horchata|jamaica/.test(id)) return 'bebidas';
  if (/elote|esquite|tosti/.test(id)) return 'elotes';
  if (/tamal/.test(id)) return 'tamales';
  if (/tostada/.test(id)) return 'tostadas';
  return 'antojos';
};

export function ConnectXCommerceBridgeAgent() {
  useEffect(() => {
    const bridge = () => {
      const orders = readArray<CommerceOrder>(COMMERCE_KEY);
      const processed = new Set(readArray<string>(PROCESSED_KEY));
      const local = readArray<any>(LOCAL_KEY);
      let changed = false;

      for (const order of orders) {
        if (processed.has(order.id)) continue;
        const state = commerceOrderToLocalState(order, {
          defaultLocationId: 'mora-01',
          resolveStation: stationFor,
          idFactory: prefix => `${prefix}-${crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`}`,
        });
        if (!state) continue;
        local.push({ state, seq: local.length + 1, source: 'commerce', commerceOrderId: order.id });
        processed.add(order.id);
        changed = true;
      }

      if (changed) {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(local));
        localStorage.setItem(PROCESSED_KEY, JSON.stringify([...processed]));
        window.dispatchEvent(new CustomEvent('connectx:commerce-bridged'));
      }
    };

    bridge();
    const interval = window.setInterval(bridge, 3_000);
    window.addEventListener('storage', bridge);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('storage', bridge);
    };
  }, []);

  return null;
}
