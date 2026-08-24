import type { ID, Money } from './domain';

export type LocalOrderStatus = 'draft' | 'sent' | 'preparing' | 'ready' | 'delivered' | 'paid' | 'cancelled';

export interface LocalOrderItem {
  productId: ID;
  productName: string;
  quantity: number;
  unitPrice: Money;
  stationId: ID;
  personLabel?: string;
  notes?: string;
  modifiers?: Array<{ id: ID; name: string; priceDeltaCents?: number }>;
}

export interface LocalOrder {
  id: ID;
  tenantId: ID;
  businessId: ID;
  locationId: ID;
  tableLabel?: string;
  waiterId?: ID;
  customerId?: ID;
  status: LocalOrderStatus;
  items: LocalOrderItem[];
  createdAt: number;
  updatedAt: number;
}

export interface ProductionTask {
  id: ID;
  orderId: ID;
  stationId: ID;
  itemIndexes: number[];
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  startedAt?: number;
  completedAt?: number;
}

export interface PrintJob {
  id: ID;
  businessId: ID;
  printerId: ID;
  orderId: ID;
  template: 'production' | 'account' | 'receipt';
  status: 'pending' | 'printing' | 'printed' | 'failed';
  attempts: number;
  createdAt: number;
  printedAt?: number;
}
