import type { BusinessConfig, StationConfig } from './businessConfig';

export interface LegacyMoraKitchen {
  numero: number;
  nombre?: string;
  impresoraId?: string;
}

export interface LegacyMoraSection {
  id?: string;
  nombre?: string;
  cocina?: number;
}

export interface LegacyMoraConfig {
  nombre?: string;
  cocinas?: LegacyMoraKitchen[];
  secciones?: LegacyMoraSection[];
  metodosPago?: string[];
}

const normalizePayment = (value: string): BusinessConfig['enabledPaymentMethods'][number] | undefined => {
  const normalized = value.toLowerCase().trim();
  if (normalized.includes('efect')) return 'cash';
  if (normalized.includes('tarjet')) return 'card';
  if (normalized.includes('transfer')) return 'transfer';
  if (normalized.includes('wallet') || normalized.includes('mercado')) return 'wallet';
  if (normalized.includes('fiado') || normalized.includes('credito') || normalized.includes('crédito')) return 'credit';
  return undefined;
};

export function legacyMoraToBusinessConfig(
  businessId: string,
  source: LegacyMoraConfig,
  tenantId = 'connectx',
): BusinessConfig {
  const kitchens = source.cocinas ?? [];
  const stations: StationConfig[] = kitchens.map(kitchen => ({
    id: `station-kitchen-${kitchen.numero}`,
    name: kitchen.nombre?.trim() || `Cocina ${kitchen.numero}`,
    type: 'kitchen',
    printerId: kitchen.impresoraId,
  }));

  if (stations.length === 0) {
    stations.push({ id: 'station-default', name: 'Producción', type: 'kitchen' });
  }

  const enabledPaymentMethods = Array.from(new Set(
    (source.metodosPago ?? ['efectivo'])
      .map(normalizePayment)
      .filter((value): value is BusinessConfig['enabledPaymentMethods'][number] => Boolean(value)),
  ));

  return {
    version: 1,
    tenantId,
    businessId,
    businessName: source.nombre?.trim() || 'ConnectX Local',
    vertical: 'restaurant',
    modules: { local: true, routes: false, web: true, growth: false },
    stations,
    routes: [],
    enabledPaymentMethods: enabledPaymentMethods.length ? enabledPaymentMethods : ['cash'],
    settings: {
      migrationSource: 'legacy-mora',
      sections: source.secciones ?? [],
      customerMenu: true,
    },
    updatedAt: Date.now(),
  };
}
