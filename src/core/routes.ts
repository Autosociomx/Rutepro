import type { ID, Money, PaymentMethod } from './domain';

export interface RouteRun {
  id: ID;
  tenantId: ID;
  businessId: ID;
  routeId: ID;
  driverId: ID;
  vehicleId?: ID;
  startedAt: number;
  closedAt?: number;
  status: 'planned' | 'active' | 'closed' | 'cancelled';
}

export interface LoadItem {
  productId: ID;
  productName: string;
  quantity: number;
  unit: string;
}

export interface RouteLoad {
  id: ID;
  runId: ID;
  items: LoadItem[];
  authorizedBy?: ID;
  authorizedAt?: number;
  createdAt: number;
}

export interface RouteStopResult {
  id: ID;
  runId: ID;
  customerId: ID;
  customerName: string;
  latitude?: number;
  longitude?: number;
  visitedAt: number;
  outcome: 'sale' | 'no_sale' | 'closed' | 'skipped';
}

export interface DeliveryItem {
  productId: ID;
  productName: string;
  quantityDelivered: number;
  quantityReturned: number;
  unitPrice: Money;
}

export interface RouteSale {
  id: ID;
  runId: ID;
  customerId: ID;
  items: DeliveryItem[];
  total: Money;
  paymentMethod: PaymentMethod;
  creditAmount?: Money;
  idempotencyKey: string;
  createdAt: number;
}

export interface RouteClose {
  runId: ID;
  grossSales: Money;
  cashSales: Money;
  nonCashSales: Money;
  cashExpected: Money;
  cashDelivered: Money;
  creditCreated: Money;
  returnsValue: Money;
  expenses: Money;
  difference: Money;
  closedBy: ID;
  closedAt: number;
}
