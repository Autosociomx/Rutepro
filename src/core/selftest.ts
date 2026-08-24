import assert from 'node:assert/strict';
import { money } from './money';
import { createIntelligence } from './intelligence';
import { createLocalOrder, createProductionTasks, transitionOrder } from './localEngine';
import { closeRoute, initialRouteState, recordSale, registerLoad, startRoute } from './routeEngine';

const now = 1_725_000_000_000;

async function testRouteEngine() {
  let state = initialRouteState();
  const started = startRoute(state, {
    id: 'run-1', tenantId: 'tenant-1', businessId: 'biz-1', routeId: 'route-1', driverId: 'driver-1', startedAt: now,
  });
  assert.equal(started.ok, true);
  if (!started.ok) throw new Error(started.error);
  state = started.value;

  const loaded = registerLoad(state, {
    id: 'load-1', createdAt: now, items: [{ productId: 'tortilla', productName: 'Tortilla', quantity: 100, unit: 'kg' }],
  });
  assert.equal(loaded.ok, true);
  if (!loaded.ok) throw new Error(loaded.error);
  state = loaded.value;

  const sale = recordSale(state, {
    id: 'sale-1', customerId: 'client-1', paymentMethod: 'cash', idempotencyKey: 'device-1-sale-1', createdAt: now,
    items: [{ productId: 'tortilla', productName: 'Tortilla', quantityDelivered: 10, quantityReturned: 2, unitPrice: money(2500) }],
  });
  assert.equal(sale.ok, true);
  if (!sale.ok) throw new Error(sale.error);
  state = sale.value;
  assert.equal(state.sales[0].total.amountCents, 20_000);

  const duplicate = recordSale(state, {
    id: 'sale-1b', customerId: 'client-1', paymentMethod: 'cash', idempotencyKey: 'device-1-sale-1', createdAt: now,
    items: [{ productId: 'tortilla', productName: 'Tortilla', quantityDelivered: 1, quantityReturned: 0, unitPrice: money(2500) }],
  });
  assert.equal(duplicate.ok, false);

  const closed = closeRoute(state, { cashDeliveredCents: 20_000, expensesCents: 0, closedBy: 'owner-1', closedAt: now + 1000 });
  assert.equal(closed.ok, true);
  if (!closed.ok) throw new Error(closed.error);
  assert.equal(closed.value.close?.difference.amountCents, 0);
}

async function testLocalEngine() {
  const created = createLocalOrder({
    id: 'order-1', tenantId: 'tenant-1', businessId: 'mora', locationId: 'local-1', waiterId: 'waiter-1', createdAt: now,
    items: [
      { productId: 'pozole', productName: 'Pozole', quantity: 1, unitPrice: money(9000), stationId: 'antojos' },
      { productId: 'agua', productName: 'Agua', quantity: 2, unitPrice: money(2000), stationId: 'bebidas' },
    ],
  });
  assert.equal(created.ok, true);
  if (!created.ok) throw new Error(created.error);

  const sent = transitionOrder(created.value, 'sent', now + 1);
  assert.equal(sent.ok, true);
  if (!sent.ok) throw new Error(sent.error);

  let seq = 0;
  const tasks = createProductionTasks(sent.value, () => `task-${++seq}`);
  assert.equal(tasks.ok, true);
  if (!tasks.ok) throw new Error(tasks.error);
  assert.equal(tasks.value.tasks.length, 2);
}

async function testNoAiFallback() {
  const intelligence = createIntelligence();
  const result = await intelligence.recommendRouteLoad({
    routeId: 'route-1', dayOfWeek: 1,
    products: [{ id: 'p1', businessId: 'biz-1', name: 'Pan', unit: 'pza', priceCents: 1000, active: true }],
    historicalSales: [],
  });
  assert.equal(result.length, 1);
  assert.equal(intelligence.name, 'hybrid-intelligence');
}

await testRouteEngine();
await testLocalEngine();
await testNoAiFallback();
console.log('ConnectX Negocio OS core self-test: OK');
