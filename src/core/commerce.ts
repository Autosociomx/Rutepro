import type { ID, Money, PaymentMethod } from './domain';

export type CommerceChannel = 'web' | 'qr' | 'whatsapp' | 'social';
export type FulfillmentMode = 'pickup' | 'delivery' | 'table';
export type CommerceOrderStatus = 'cart' | 'submitted' | 'accepted' | 'preparing' | 'ready' | 'completed' | 'cancelled';

export interface CommerceOrderItem {
  productId: ID;
  productName: string;
  quantity: number;
  unitPrice: Money;
  modifiers?: Array<{ id: ID; name: string; priceDeltaCents?: number }>;
  notes?: string;
}

export interface CommerceOrder {
  id: ID;
  tenantId: ID;
  businessId: ID;
  locationId?: ID;
  channel: CommerceChannel;
  fulfillment: FulfillmentMode;
  customerId?: ID;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  tableLabel?: string;
  items: CommerceOrderItem[];
  subtotal: Money;
  discount: Money;
  total: Money;
  paymentMethod?: PaymentMethod;
  campaignId?: ID;
  status: CommerceOrderStatus;
  createdAt: number;
  updatedAt: number;
}
