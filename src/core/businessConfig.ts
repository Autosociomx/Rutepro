import type { BusinessModule, ID } from './domain';

export interface ModuleFlags {
  local: boolean;
  routes: boolean;
  web: boolean;
  growth: boolean;
}

export interface StationConfig {
  id: ID;
  name: string;
  type: 'kitchen' | 'bar' | 'counter' | 'printer' | 'other';
  printerId?: ID;
  productCategoryIds?: ID[];
}

export interface RouteConfig {
  id: ID;
  name: string;
  driverId?: ID;
  vehicleId?: ID;
  customerIds?: ID[];
}

export interface BusinessConfig {
  version: number;
  tenantId: ID;
  businessId: ID;
  businessName: string;
  vertical: string;
  modules: ModuleFlags;
  stations: StationConfig[];
  routes: RouteConfig[];
  enabledPaymentMethods: Array<'cash' | 'card' | 'transfer' | 'wallet' | 'credit'>;
  settings: Record<string, unknown>;
  updatedAt: number;
}

export const isModuleEnabled = (
  config: BusinessConfig,
  module: BusinessModule,
): boolean => config.modules[module] === true;

export function validateBusinessConfig(config: BusinessConfig): string[] {
  const errors: string[] = [];

  if (!config.tenantId) errors.push('tenantId requerido');
  if (!config.businessId) errors.push('businessId requerido');
  if (!config.businessName.trim()) errors.push('businessName requerido');
  if (!Number.isInteger(config.version) || config.version < 1) errors.push('version inválida');

  if (!Object.values(config.modules).some(Boolean)) {
    errors.push('Debe existir al menos un módulo habilitado');
  }

  if (config.modules.routes && config.routes.length === 0) {
    errors.push('El módulo routes requiere al menos una ruta configurada');
  }

  if (config.modules.local && config.stations.length === 0) {
    errors.push('El módulo local requiere al menos una estación configurada');
  }

  return errors;
}
