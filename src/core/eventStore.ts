import type { DomainEvent } from './events';

export interface EventStore {
  append(event: DomainEvent): Promise<void>;
  listByBusiness(businessId: string, limit?: number): Promise<DomainEvent[]>;
  hasIdempotencyKey(businessId: string, key: string): Promise<boolean>;
}

export class LocalEventStore implements EventStore {
  constructor(private readonly storageKey = 'cx_domain_events_v1') {}

  private read(): DomainEvent[] {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private write(events: DomainEvent[]): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(this.storageKey, JSON.stringify(events));
  }

  async append(event: DomainEvent): Promise<void> {
    const events = this.read();
    if (events.some(existing => existing.eventId === event.eventId)) return;
    if (event.idempotencyKey && events.some(existing =>
      existing.businessId === event.businessId && existing.idempotencyKey === event.idempotencyKey,
    )) return;
    events.push(event);
    this.write(events.slice(-10_000));
  }

  async listByBusiness(businessId: string, limit = 250): Promise<DomainEvent[]> {
    return this.read()
      .filter(event => event.businessId === businessId)
      .sort((a, b) => b.occurredAt - a.occurredAt)
      .slice(0, limit);
  }

  async hasIdempotencyKey(businessId: string, key: string): Promise<boolean> {
    return this.read().some(event => event.businessId === businessId && event.idempotencyKey === key);
  }
}
