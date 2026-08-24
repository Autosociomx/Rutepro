export type ID = string;

export type BusinessModule = 'local' | 'routes' | 'web' | 'growth';

export interface TenantRef {
  tenantId: ID;
  businessId: ID;
  locationId?: ID;
}

export interface Business {
  id: ID;
  tenantId: ID;
  name: string;
  slug: string;
  vertical: string;
  currency: 'MXN' | string;
  timezone: string;
  createdAt: number;
}

export interface Location {
  id: ID;
  businessId: ID;
  name: string;
  type: 'store' | 'kitchen' | 'warehouse' | 'branch' | 'other';
  address?: string;
  latitude?: number;
  longitude?: number;
}

export interface Membership {
  id: ID;
  tenantId: ID;
  businessId: ID;
  userId: ID;
  role: 'owner' | 'manager' | 'cashier' | 'waiter' | 'kitchen' | 'driver' | 'marketing' | 'accountant' | 'support';
  permissions: string[];
  locationIds?: ID[];
  active: boolean;
}

export interface Product {
  id: ID;
  businessId: ID;
  categoryId?: ID;
  name: string;
  sku?: string;
  unit: string;
  priceCents: number;
  active: boolean;
}

export interface Customer {
  id: ID;
  businessId: ID;
  name: string;
  phone?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  routeId?: ID;
  active: boolean;
}

export interface Money {
  amountCents: number;
  currency: string;
}

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'wallet' | 'credit';

export interface Payment {
  id: ID;
  businessId: ID;
  saleId: ID;
  method: PaymentMethod;
  amount: Money;
  receivedBy: ID;
  createdAt: number;
}
