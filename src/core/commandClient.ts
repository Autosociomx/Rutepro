import type { CommandEnvelope, CommandResponse } from './contracts';
import type { CommandTransport, OfflineCommand } from './offlineQueue';

export class HttpCommandClient implements CommandTransport {
  constructor(private readonly endpoint = '/api/connectx/commands') {}

  async send(command: OfflineCommand): Promise<{ accepted: boolean; duplicate?: boolean }> {
    const envelope: CommandEnvelope = {
      schemaVersion: 1,
      type: command.type,
      context: {
        tenantId: 'connectx',
        businessId: command.businessId,
        userId: 'offline-user',
        deviceId: command.deviceId,
        requestId: command.id,
        idempotencyKey: command.idempotencyKey,
        occurredAt: command.createdAt,
      },
      payload: command.payload,
    };

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': command.idempotencyKey,
      },
      body: JSON.stringify(envelope),
    });

    const body = await response.json() as CommandResponse;
    if (!response.ok || !body.ok) {
      const message = body && !body.ok ? body.message : `Command endpoint failed: ${response.status}`;
      throw new Error(message);
    }
    return { accepted: true, duplicate: body.duplicate };
  }
}
