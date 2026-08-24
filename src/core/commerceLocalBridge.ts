import type { CommerceOrder } from './commerce';
import { createLocalOrder, createProductionTasks, transitionOrder, type LocalAggregateState } from './localEngine';

export interface CommerceLocalBridgeOptions {
  defaultLocationId: string;
  resolveStation(productId: string): string;
  idFactory(prefix: string): string;
}

export function commerceOrderToLocalState(
  order: CommerceOrder,
  options: CommerceLocalBridgeOptions,
): LocalAggregateState | null {
  if (order.status !== 'submitted' && order.status !== 'accepted') return null;

  const created = createLocalOrder({
    id: `local-${order.id}`,
    tenantId: order.tenantId,
    businessId: order.businessId,
    locationId: order.locationId || options.defaultLocationId,
    customerId: order.customerId,
    tableLabel: order.fulfillment === 'table' ? order.tableLabel : order.fulfillment === 'pickup' ? 'Pedido Web · Recoger' : 'Pedido Web · Envío',
    createdAt: order.createdAt,
    items: order.items.map(item => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      stationId: options.resolveStation(item.productId),
      notes: item.notes,
      modifiers: item.modifiers,
      personLabel: order.customerName || 'Cliente web',
    })),
  });
  if (!created.ok) return null;

  const sent = transitionOrder(created.value, 'sent', Date.now());
  if (!sent.ok) return null;

  const tasks = createProductionTasks(sent.value, () => options.idFactory('task'));
  return tasks.ok ? tasks.value : sent.value;
}
