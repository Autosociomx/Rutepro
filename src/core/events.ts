import type { ID } from './domain';

export type DomainEventType =
  | 'order.created'
  | 'order.sent'
  | 'production.started'
  | 'production.completed'
  | 'sale.completed'
  | 'payment.received'
  | 'cash.closed'
  | 'route.started'
  | 'route.stop.completed'
  | 'delivery.completed'
  | 'return.registered'
  | 'credit.created'
  | 'credit.payment_received'
  | 'inventory.moved'
  | 'campaign.created'
  | 'creative.generated'
  | 'web.order.created';

export interface DomainEvent<TPayload = Record<string, unknown>> {
  eventId: ID;
  type: DomainEventType;
  tenantId: ID;
  businessId: ID;
  locationId?: ID;
  actorId?: ID;
  deviceId?: ID;
  idempotencyKey?: string;
  occurredAt: number;
  payload: TPayload;
}

export interface AuditRecord {
  id: ID;
  tenantId: ID;
  businessId: ID;
  actorId?: ID;
  action: string;
  resourceType: string;
  resourceId: ID;
  before?: unknown;
  after?: unknown;
  occurredAt: number;
  deviceId?: ID;
  latitude?: number;
  longitude?: number;
}
