import type { BusinessConfig } from './businessConfig';

export type VerticalTemplate = 'restaurant' | 'bakery_routes' | 'tortilleria_routes' | 'distribution';

export function createBusinessTemplate(
  template: VerticalTemplate,
  businessId: string,
  businessName: string,
  tenantId = 'connectx',
): BusinessConfig {
  const base = {
    version: 1,
    tenantId,
    businessId,
    businessName,
    updatedAt: Date.now(),
  };

  switch (template) {
    case 'restaurant':
      return {
        ...base,
        vertical: 'restaurant',
        modules: { local: true, routes: false, web: true, growth: true },
        stations: [
          { id: 'station-kitchen', name: 'Cocina', type: 'kitchen' },
          { id: 'station-drinks', name: 'Bebidas', type: 'bar' },
          { id: 'station-counter', name: 'Mostrador', type: 'counter' },
        ],
        routes: [],
        enabledPaymentMethods: ['cash', 'card', 'transfer', 'wallet'],
        settings: {
          tablesEnabled: true,
          peoplePerTableEnabled: true,
          printingEnabled: true,
          onlineOrdersEnabled: true,
        },
      };
    case 'bakery_routes':
      return {
        ...base,
        vertical: 'bakery',
        modules: { local: true, routes: true, web: false, growth: false },
        stations: [{ id: 'station-counter', name: 'Mostrador', type: 'counter' }],
        routes: [{ id: 'route-1', name: 'Ruta 1' }],
        enabledPaymentMethods: ['cash', 'transfer', 'credit'],
        settings: {
          initialLoadRequired: true,
          returnsEnabled: true,
          creditEnabled: true,
          tomorrowOrderEnabled: true,
        },
      };
    case 'tortilleria_routes':
      return {
        ...base,
        vertical: 'tortilleria',
        modules: { local: true, routes: true, web: false, growth: false },
        stations: [{ id: 'station-counter', name: 'Mostrador', type: 'counter' }],
        routes: [{ id: 'route-1', name: 'Ruta 1' }],
        enabledPaymentMethods: ['cash', 'transfer', 'credit'],
        settings: {
          weightedProductsEnabled: true,
          initialLoadRequired: true,
          returnsEnabled: true,
          creditEnabled: true,
        },
      };
    case 'distribution':
      return {
        ...base,
        vertical: 'distribution',
        modules: { local: false, routes: true, web: false, growth: false },
        stations: [],
        routes: [{ id: 'route-1', name: 'Ruta 1' }],
        enabledPaymentMethods: ['cash', 'card', 'transfer', 'credit'],
        settings: {
          initialLoadRequired: true,
          returnsEnabled: true,
          creditEnabled: true,
          gpsEnabled: true,
        },
      };
  }
}
