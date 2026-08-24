import type { CommerceOrder, CommerceOrderItem, CommerceOrderStatus, FulfillmentMode, CommerceChannel } from './commerce';
import { addMoney, money, multiplyMoney, subtractMoney, zeroMoney } from './money';
import { err, ok, type Result } from './result';

export type CommerceError = 'EMPTY_CART' | 'INVALID_ITEM' | 'INVALID_DISCOUNT' | 'INVALID_TRANSITION' | 'DELIVERY_ADDRESS_REQUIRED';

const transitions: Record<CommerceOrderStatus, CommerceOrderStatus[]> = {
  cart: ['submitted', 'cancelled'],
  submitted: ['accepted', 'cancelled'],
  accepted: ['preparing', 'ready', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export interface CreateCommerceOrderInput {
  id: string;
  tenantId: string;
  businessId: string;
  locationId?: string;
  channel: CommerceChannel;
  fulfillment: FulfillmentMode;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  tableLabel?: string;
  items: CommerceOrderItem[];
  discountCents?: number;
  campaignId?: string;
  createdAt: number;
}

export function createCommerceOrder(input: CreateCommerceOrderInput): Result<CommerceOrder, CommerceError> {
  if (!input.items.length) return err('EMPTY_CART');
  if (input.fulfillment === 'delivery' && !input.deliveryAddress?.trim()) return err('DELIVERY_ADDRESS_REQUIRED');
  if (input.items.some(item => item.quantity <= 0 || item.unitPrice.amountCents < 0)) return err('INVALID_ITEM');

  const currency = input.items[0]?.unitPrice.currency ?? 'MXN';
  const subtotal = input.items.reduce(
    (sum, item) => addMoney(sum, multiplyMoney(item.unitPrice, item.quantity)),
    zeroMoney(currency),
  );
  const discount = money(input.discountCents ?? 0, currency);
  if (discount.amountCents < 0 || discount.amountCents > subtotal.amountCents) return err('INVALID_DISCOUNT');
  const total = subtractMoney(subtotal, discount);

  return ok({
    id: input.id,
    tenantId: input.tenantId,
    businessId: input.businessId,
    locationId: input.locationId,
    channel: input.channel,
    fulfillment: input.fulfillment,
    customerId: input.customerId,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    deliveryAddress: input.deliveryAddress,
    tableLabel: input.tableLabel,
    items: input.items,
    subtotal,
    discount,
    total,
    campaignId: input.campaignId,
    status: 'cart',
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  });
}

export function transitionCommerceOrder(
  order: CommerceOrder,
  next: CommerceOrderStatus,
  at: number,
): Result<CommerceOrder, CommerceError> {
  if (!transitions[order.status].includes(next)) return err('INVALID_TRANSITION', { from: order.status, to: next });
  return ok({ ...order, status: next, updatedAt: at });
}
