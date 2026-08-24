import type { ID, Money, PaymentMethod } from './domain';
import type { DeliveryItem, RouteClose, RouteLoad, RouteRun, RouteSale, RouteStopResult } from './routes';
import { addMoney, money, multiplyMoney, subtractMoney, zeroMoney } from './money';
import { err, ok, type Result } from './result';

export type RouteEngineError =
  | 'RUN_ALREADY_STARTED'
  | 'RUN_NOT_ACTIVE'
  | 'RUN_ALREADY_CLOSED'
  | 'LOAD_ALREADY_REGISTERED'
  | 'LOAD_NOT_REGISTERED'
  | 'INVALID_LOAD'
  | 'INVALID_SALE'
  | 'DUPLICATE_OPERATION'
  | 'INVALID_CLOSE';

export interface RouteAggregateState {
  run?: RouteRun;
  load?: RouteLoad;
  stops: RouteStopResult[];
  sales: RouteSale[];
  close?: RouteClose;
  processedKeys: string[];
}

export interface StartRouteInput {
  id: ID;
  tenantId: ID;
  businessId: ID;
  routeId: ID;
  driverId: ID;
  vehicleId?: ID;
  startedAt: number;
}

export interface RegisterLoadInput {
  id: ID;
  items: RouteLoad['items'];
  authorizedBy?: ID;
  authorizedAt?: number;
  createdAt: number;
}

export interface RecordSaleInput {
  id: ID;
  customerId: ID;
  items: DeliveryItem[];
  paymentMethod: PaymentMethod;
  creditAmountCents?: number;
  idempotencyKey: string;
  createdAt: number;
}

export interface RecordStopInput {
  id: ID;
  customerId: ID;
  customerName: string;
  latitude?: number;
  longitude?: number;
  visitedAt: number;
  outcome: RouteStopResult['outcome'];
}

export interface CloseRouteInput {
  cashDeliveredCents: number;
  expensesCents: number;
  closedBy: ID;
  closedAt: number;
}

export const initialRouteState = (): RouteAggregateState => ({
  stops: [],
  sales: [],
  processedKeys: [],
});

export function startRoute(
  state: RouteAggregateState,
  input: StartRouteInput,
): Result<RouteAggregateState, RouteEngineError> {
  if (state.run && state.run.status !== 'cancelled') return err('RUN_ALREADY_STARTED');
  const run: RouteRun = {
    id: input.id,
    tenantId: input.tenantId,
    businessId: input.businessId,
    routeId: input.routeId,
    driverId: input.driverId,
    vehicleId: input.vehicleId,
    startedAt: input.startedAt,
    status: 'active',
  };
  return ok({ ...initialRouteState(), run });
}

export function registerLoad(
  state: RouteAggregateState,
  input: RegisterLoadInput,
): Result<RouteAggregateState, RouteEngineError> {
  if (!state.run || state.run.status !== 'active') return err('RUN_NOT_ACTIVE');
  if (state.load) return err('LOAD_ALREADY_REGISTERED');
  if (!input.items.length || input.items.some(i => i.quantity < 0 || !Number.isFinite(i.quantity))) {
    return err('INVALID_LOAD');
  }
  const load: RouteLoad = {
    id: input.id,
    runId: state.run.id,
    items: input.items,
    authorizedBy: input.authorizedBy,
    authorizedAt: input.authorizedAt,
    createdAt: input.createdAt,
  };
  return ok({ ...state, load });
}

export function recordStop(
  state: RouteAggregateState,
  input: RecordStopInput,
): Result<RouteAggregateState, RouteEngineError> {
  if (!state.run || state.run.status !== 'active') return err('RUN_NOT_ACTIVE');
  const stop: RouteStopResult = { ...input, runId: state.run.id };
  return ok({ ...state, stops: [...state.stops, stop] });
}

export function calculateSaleTotal(items: DeliveryItem[], currency = 'MXN'): Money {
  return items.reduce((total, item) => {
    const netQuantity = item.quantityDelivered - item.quantityReturned;
    if (netQuantity < 0) throw new Error('Returned quantity exceeds delivered quantity');
    return addMoney(total, multiplyMoney(item.unitPrice, netQuantity));
  }, zeroMoney(currency));
}

export function recordSale(
  state: RouteAggregateState,
  input: RecordSaleInput,
): Result<RouteAggregateState, RouteEngineError> {
  if (!state.run || state.run.status !== 'active') return err('RUN_NOT_ACTIVE');
  if (!state.load) return err('LOAD_NOT_REGISTERED');
  if (state.processedKeys.includes(input.idempotencyKey)) return err('DUPLICATE_OPERATION');
  if (!input.items.length || input.items.some(i => i.quantityDelivered < 0 || i.quantityReturned < 0 || i.quantityReturned > i.quantityDelivered)) {
    return err('INVALID_SALE');
  }

  let total: Money;
  try {
    total = calculateSaleTotal(input.items);
  } catch {
    return err('INVALID_SALE');
  }

  const creditAmount = input.creditAmountCents === undefined
    ? undefined
    : money(input.creditAmountCents, total.currency);

  if (creditAmount && (creditAmount.amountCents < 0 || creditAmount.amountCents > total.amountCents)) {
    return err('INVALID_SALE');
  }

  if (input.paymentMethod === 'credit' && (!creditAmount || creditAmount.amountCents !== total.amountCents)) {
    return err('INVALID_SALE');
  }

  const sale: RouteSale = {
    id: input.id,
    runId: state.run.id,
    customerId: input.customerId,
    items: input.items,
    total,
    paymentMethod: input.paymentMethod,
    creditAmount,
    idempotencyKey: input.idempotencyKey,
    createdAt: input.createdAt,
  };

  return ok({
    ...state,
    sales: [...state.sales, sale],
    processedKeys: [...state.processedKeys, input.idempotencyKey],
  });
}

export function closeRoute(
  state: RouteAggregateState,
  input: CloseRouteInput,
): Result<RouteAggregateState, RouteEngineError> {
  if (!state.run) return err('RUN_NOT_ACTIVE');
  if (state.run.status === 'closed' || state.close) return err('RUN_ALREADY_CLOSED');
  if (state.run.status !== 'active') return err('RUN_NOT_ACTIVE');
  if (input.cashDeliveredCents < 0 || input.expensesCents < 0) return err('INVALID_CLOSE');

  const currency = state.sales[0]?.total.currency ?? 'MXN';
  const grossSales = state.sales.reduce((acc, sale) => addMoney(acc, sale.total), zeroMoney(currency));
  const creditCreated = state.sales.reduce(
    (acc, sale) => addMoney(acc, sale.creditAmount ?? zeroMoney(currency)),
    zeroMoney(currency),
  );
  const returnsValue = state.sales.reduce((acc, sale) => {
    const value = sale.items.reduce(
      (saleReturn, item) => addMoney(saleReturn, multiplyMoney(item.unitPrice, item.quantityReturned)),
      zeroMoney(currency),
    );
    return addMoney(acc, value);
  }, zeroMoney(currency));
  const expenses = money(input.expensesCents, currency);
  const cashExpected = subtractMoney(subtractMoney(grossSales, creditCreated), expenses);
  const cashDelivered = money(input.cashDeliveredCents, currency);
  const difference = subtractMoney(cashDelivered, cashExpected);

  const close: RouteClose = {
    runId: state.run.id,
    grossSales,
    cashExpected,
    cashDelivered,
    creditCreated,
    returnsValue,
    expenses,
    difference,
    closedBy: input.closedBy,
    closedAt: input.closedAt,
  };

  const run: RouteRun = { ...state.run, status: 'closed', closedAt: input.closedAt };
  return ok({ ...state, run, close });
}
