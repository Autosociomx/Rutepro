export type OfflineQueueStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface OfflineCommand<TPayload = unknown> {
  id: string;
  idempotencyKey: string;
  businessId: string;
  deviceId: string;
  type: string;
  payload: TPayload;
  createdAt: number;
  attempts: number;
  status: OfflineQueueStatus;
  lastError?: string;
}

export interface QueueStorage {
  load(): Promise<OfflineCommand[]>;
  save(commands: OfflineCommand[]): Promise<void>;
}

export interface CommandTransport {
  send(command: OfflineCommand): Promise<{ accepted: boolean; duplicate?: boolean }>;
}

export class LocalStorageQueueStorage implements QueueStorage {
  constructor(private readonly key = 'cx_offline_commands_v1') {}

  async load(): Promise<OfflineCommand[]> {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(this.key);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async save(commands: OfflineCommand[]): Promise<void> {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(this.key, JSON.stringify(commands));
  }
}

export class OfflineCommandQueue {
  constructor(
    private readonly storage: QueueStorage,
    private readonly transport: CommandTransport,
  ) {}

  async enqueue<TPayload>(command: Omit<OfflineCommand<TPayload>, 'attempts' | 'status'>): Promise<void> {
    const commands = await this.storage.load();
    if (commands.some(item => item.idempotencyKey === command.idempotencyKey)) return;
    commands.push({ ...command, attempts: 0, status: 'pending' });
    await this.storage.save(commands);
  }

  async flush(): Promise<{ synced: number; failed: number; pending: number }> {
    const commands = await this.storage.load();
    let synced = 0;
    let failed = 0;

    for (const command of commands) {
      if (command.status === 'synced') continue;
      command.status = 'syncing';
      command.attempts += 1;
      try {
        const result = await this.transport.send(command);
        if (result.accepted || result.duplicate) {
          command.status = 'synced';
          command.lastError = undefined;
          synced += 1;
        } else {
          command.status = 'failed';
          command.lastError = 'Transport rejected command';
          failed += 1;
        }
      } catch (error) {
        command.status = 'failed';
        command.lastError = error instanceof Error ? error.message : 'Unknown sync error';
        failed += 1;
      }
    }

    const compacted = commands.filter(command => command.status !== 'synced');
    await this.storage.save(compacted);
    return { synced, failed, pending: compacted.length };
  }
}
