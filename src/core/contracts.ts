export interface RequestContext {
  tenantId: string;
  businessId: string;
  locationId?: string;
  userId: string;
  deviceId: string;
  requestId: string;
  idempotencyKey: string;
  occurredAt: number;
}

export interface CommandEnvelope<TType extends string = string, TPayload = unknown> {
  schemaVersion: 1;
  type: TType;
  context: RequestContext;
  payload: TPayload;
}

export interface CommandAccepted<TResult = unknown> {
  ok: true;
  duplicate: boolean;
  result: TResult;
  serverTime: number;
}

export interface CommandRejected {
  ok: false;
  code: string;
  message: string;
  retryable: boolean;
  serverTime: number;
  details?: Record<string, unknown>;
}

export type CommandResponse<TResult = unknown> = CommandAccepted<TResult> | CommandRejected;

export type CoreCommand =
  | CommandEnvelope<'route.start', { routeId: string; driverId: string; vehicleId?: string }>
  | CommandEnvelope<'route.load.register', { runId: string; items: Array<{ productId: string; quantity: number; unit: string }> }>
  | CommandEnvelope<'route.sale.record', { runId: string; customerId: string; paymentMethod: string; items: Array<{ productId: string; quantityDelivered: number; quantityReturned: number; unitPriceCents: number }> }>
  | CommandEnvelope<'route.close', { runId: string; cashDeliveredCents: number; expensesCents: number }>
  | CommandEnvelope<'local.order.create', { locationId: string; tableLabel?: string; waiterId?: string; items: Array<{ productId: string; quantity: number; unitPriceCents: number; stationId: string; personLabel?: string }> }>
  | CommandEnvelope<'local.order.transition', { orderId: string; status: string }>
  | CommandEnvelope<'payment.collect', { saleId: string; method: string; amountCents: number; externalReference?: string }>;
