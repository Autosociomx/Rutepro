import type { LocalAggregateState } from './localEngine';
import type { RouteAggregateState } from './routeEngine';
import type { QueueCommandInput } from './useOfflineCommandQueue';

export interface SyncDiscoveryState {
  seenKeys: string[];
}

export const discoverLocalCommands = (
  records: Array<{ state: LocalAggregateState }>,
  seen: Set<string>,
): Array<QueueCommandInput> => {
  const commands: Array<QueueCommandInput> = [];
  for (const record of records) {
    const order = record.state?.order;
    if (!order) continue;
    const key = `local.order.create:${order.businessId}:${order.id}`;
    if (seen.has(key)) continue;
    commands.push({
      id: `cmd-${order.id}`,
      idempotencyKey: key,
      businessId: order.businessId,
      deviceId: 'browser-local',
      type: 'local.order.create',
      createdAt: order.createdAt,
      payload: {
        orderId: order.id,
        locationId: order.locationId,
        tableLabel: order.tableLabel,
        waiterId: order.waiterId,
        customerId: order.customerId,
        status: order.status,
        items: order.items.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPriceCents: item.unitPrice.amountCents,
          stationId: item.stationId,
          personLabel: item.personLabel,
          notes: item.notes,
          modifiers: item.modifiers,
        })),
      },
    });
    seen.add(key);
  }
  return commands;
};

export const discoverRouteCommands = (
  state: RouteAggregateState,
  seen: Set<string>,
): Array<QueueCommandInput> => {
  if (!state.run) return [];
  const commands: Array<QueueCommandInput> = [];
  const businessId = state.run.businessId;

  const startKey = `route.start:${businessId}:${state.run.id}`;
  if (!seen.has(startKey)) {
    commands.push({
      id: `cmd-${state.run.id}-start`,
      idempotencyKey: startKey,
      businessId,
      deviceId: 'browser-route',
      type: 'route.start',
      createdAt: state.run.startedAt,
      payload: { runId: state.run.id, routeId: state.run.routeId, driverId: state.run.driverId, vehicleId: state.run.vehicleId },
    });
    seen.add(startKey);
  }

  if (state.load) {
    const key = `route.load.register:${businessId}:${state.load.id}`;
    if (!seen.has(key)) {
      commands.push({
        id: `cmd-${state.load.id}`,
        idempotencyKey: key,
        businessId,
        deviceId: 'browser-route',
        type: 'route.load.register',
        createdAt: state.load.createdAt,
        payload: { runId: state.run.id, loadId: state.load.id, authorizedBy: state.load.authorizedBy, authorizedAt: state.load.authorizedAt, items: state.load.items },
      });
      seen.add(key);
    }
  }

  for (const sale of state.sales ?? []) {
    const key = `route.sale.record:${businessId}:${sale.idempotencyKey || sale.id}`;
    if (seen.has(key)) continue;
    commands.push({
      id: `cmd-${sale.id}`,
      idempotencyKey: key,
      businessId,
      deviceId: 'browser-route',
      type: 'route.sale.record',
      createdAt: sale.createdAt,
      payload: {
        runId: state.run.id,
        saleId: sale.id,
        customerId: sale.customerId,
        paymentMethod: sale.paymentMethod,
        creditAmountCents: sale.creditAmount?.amountCents,
        totalCents: sale.total.amountCents,
        items: sale.items.map(item => ({ productId: item.productId, productName: item.productName, quantityDelivered: item.quantityDelivered, quantityReturned: item.quantityReturned, unitPriceCents: item.unitPrice.amountCents })),
      },
    });
    seen.add(key);
  }

  if (state.close) {
    const key = `route.close:${businessId}:${state.run.id}`;
    if (!seen.has(key)) {
      commands.push({
        id: `cmd-${state.run.id}-close`,
        idempotencyKey: key,
        businessId,
        deviceId: 'browser-route',
        type: 'route.close',
        createdAt: state.close.closedAt,
        payload: {
          runId: state.run.id,
          grossSalesCents: state.close.grossSales.amountCents,
          cashSalesCents: state.close.cashSales.amountCents,
          nonCashSalesCents: state.close.nonCashSales.amountCents,
          cashExpectedCents: state.close.cashExpected.amountCents,
          cashDeliveredCents: state.close.cashDelivered.amountCents,
          creditCreatedCents: state.close.creditCreated.amountCents,
          returnsValueCents: state.close.returnsValue.amountCents,
          expensesCents: state.close.expenses.amountCents,
          differenceCents: state.close.difference.amountCents,
          closedBy: state.close.closedBy,
        },
      });
      seen.add(key);
    }
  }

  return commands;
};
