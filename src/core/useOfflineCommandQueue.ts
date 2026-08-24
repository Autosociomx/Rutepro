import { HttpCommandClient } from './commandClient';
import { LocalStorageQueueStorage, OfflineCommandQueue } from './offlineQueue';

export interface QueueCommandInput<TPayload = unknown> {
  businessId: string;
  deviceId: string;
  type: string;
  payload: TPayload;
  idempotencyKey?: string;
  id?: string;
  createdAt?: number;
}

const makeId = (prefix: string): string => {
  const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${suffix}`;
};

export class BrowserCommandDelivery {
  readonly queue: OfflineCommandQueue;

  constructor(endpoint = '/api/connectx/commands') {
    this.queue = new OfflineCommandQueue(
      new LocalStorageQueueStorage('cx_offline_commands_v1'),
      new HttpCommandClient(endpoint),
    );
  }

  async enqueue<TPayload>(input: QueueCommandInput<TPayload>): Promise<string> {
    const id = input.id ?? makeId('cmd');
    const idempotencyKey = input.idempotencyKey ?? makeId('idem');
    await this.queue.enqueue({
      id,
      idempotencyKey,
      businessId: input.businessId,
      deviceId: input.deviceId,
      type: input.type,
      payload: input.payload,
      createdAt: input.createdAt ?? Date.now(),
    });
    return idempotencyKey;
  }

  async enqueueAndTryFlush<TPayload>(input: QueueCommandInput<TPayload>) {
    const idempotencyKey = await this.enqueue(input);
    const online = typeof navigator === 'undefined' ? true : navigator.onLine;
    const sync = online ? await this.queue.flush() : { synced: 0, failed: 0, pending: 1 };
    return { idempotencyKey, ...sync };
  }
}

export const connectXCommandDelivery = new BrowserCommandDelivery();
