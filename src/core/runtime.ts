import type { BusinessConfig } from './businessConfig';
import type { DomainEvent } from './events';
import type { EventStore } from './eventStore';
import type { IntelligenceProvider, LoadRecommendationInput, ProductLoadRecommendation } from './intelligence';
import { createIntelligence } from './intelligence';
import { LocalEventStore } from './eventStore';

export interface Clock {
  now(): number;
}

export interface IdGenerator {
  next(prefix?: string): string;
}

export interface BusinessConfigRepository {
  get(businessId: string): Promise<BusinessConfig | null>;
  save(config: BusinessConfig): Promise<void>;
}

export class BrowserBusinessConfigRepository implements BusinessConfigRepository {
  constructor(private readonly keyPrefix = 'cx_business_config_v1:') {}

  async get(businessId: string): Promise<BusinessConfig | null> {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(`${this.keyPrefix}${businessId}`) || localStorage.getItem('cx_business_config_v1');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as BusinessConfig;
    } catch {
      return null;
    }
  }

  async save(config: BusinessConfig): Promise<void> {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(`${this.keyPrefix}${config.businessId}`, JSON.stringify(config));
    localStorage.setItem('cx_business_config_v1', JSON.stringify(config));
  }
}

export const systemClock: Clock = { now: () => Date.now() };

export const cryptoIdGenerator: IdGenerator = {
  next(prefix = 'cx') {
    const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `${prefix}-${random}`;
  },
};

export interface ConnectXRuntimeOptions {
  configRepository?: BusinessConfigRepository;
  eventStore?: EventStore;
  intelligence?: IntelligenceProvider;
  clock?: Clock;
  ids?: IdGenerator;
}

export class ConnectXRuntime {
  readonly configRepository: BusinessConfigRepository;
  readonly eventStore: EventStore;
  readonly intelligence: IntelligenceProvider;
  readonly clock: Clock;
  readonly ids: IdGenerator;

  constructor(options: ConnectXRuntimeOptions = {}) {
    this.configRepository = options.configRepository ?? new BrowserBusinessConfigRepository();
    this.eventStore = options.eventStore ?? new LocalEventStore();
    this.intelligence = options.intelligence ?? createIntelligence();
    this.clock = options.clock ?? systemClock;
    this.ids = options.ids ?? cryptoIdGenerator;
  }

  async emit<TPayload extends Record<string, unknown>>(
    event: Omit<DomainEvent<TPayload>, 'eventId' | 'occurredAt'> & { occurredAt?: number },
  ): Promise<DomainEvent<TPayload>> {
    const normalized: DomainEvent<TPayload> = {
      ...event,
      eventId: this.ids.next('evt'),
      occurredAt: event.occurredAt ?? this.clock.now(),
    };
    await this.eventStore.append(normalized);
    return normalized;
  }

  recommendRouteLoad(input: LoadRecommendationInput): Promise<ProductLoadRecommendation[]> {
    return this.intelligence.recommendRouteLoad(input);
  }
}
