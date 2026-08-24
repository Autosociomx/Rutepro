import type { AppConfig as LegacyRouteProConfig } from '../types';
import type { BusinessConfig } from './businessConfig';

/**
 * Transitional adapter.
 * Converts the current RoutePro global config into the new ConnectX BusinessConfig
 * without changing the existing application runtime yet.
 */
export function fromLegacyRouteProConfig(
  legacy: LegacyRouteProConfig,
  input: {
    tenantId: string;
    businessId: string;
    vertical?: string;
    updatedAt?: number;
  },
): BusinessConfig {
  return {
    version: 1,
    tenantId: input.tenantId,
    businessId: input.businessId,
    businessName: legacy.nombre || 'Mi Negocio',
    vertical: input.vertical || 'distribution',
    modules: {
      local: false,
      routes: true,
      web: false,
      growth: false,
    },
    stations: [],
    routes: (legacy.vendedores || []).map((seller) => ({
      id: seller.ruta || seller.id,
      name: seller.ruta || `Ruta ${seller.nombre}`,
      driverId: seller.rol === 'cajero' ? undefined : seller.id,
      customerIds: [],
    })),
    enabledPaymentMethods: ['cash', 'credit'],
    settings: {
      legacy: {
        source: 'routepro',
        logoUrl: legacy.logo_url || null,
        primaryColor: legacy.color_principal,
        subtitle: legacy.subtitulo,
        products: legacy.productos,
        sellers: legacy.vendedores,
      },
    },
    updatedAt: input.updatedAt || Date.now(),
  };
}
