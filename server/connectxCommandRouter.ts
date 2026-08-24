import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { CommandEnvelope, CommandResponse } from '../src/core/contracts';

interface JournalRecord {
  envelope: CommandEnvelope;
  receivedAt: number;
}

const dataDir = path.resolve(process.cwd(), '.connectx-data');
const journalPath = path.join(dataDir, 'commands.ndjson');
const idempotencyPath = path.join(dataDir, 'idempotency.json');

async function ensureStore(): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  try { await fs.access(journalPath); } catch { await fs.writeFile(journalPath, '', 'utf8'); }
  try { await fs.access(idempotencyPath); } catch { await fs.writeFile(idempotencyPath, '{}', 'utf8'); }
}

async function readIdempotency(): Promise<Record<string, number>> {
  await ensureStore();
  try {
    return JSON.parse(await fs.readFile(idempotencyPath, 'utf8')) as Record<string, number>;
  } catch {
    return {};
  }
}

async function appendCommand(envelope: CommandEnvelope): Promise<{ duplicate: boolean }> {
  await ensureStore();
  const index = await readIdempotency();
  const compoundKey = `${envelope.context.businessId}:${envelope.context.idempotencyKey}`;
  if (index[compoundKey]) return { duplicate: true };

  const record: JournalRecord = { envelope, receivedAt: Date.now() };
  await fs.appendFile(journalPath, `${JSON.stringify(record)}\n`, 'utf8');
  index[compoundKey] = record.receivedAt;
  await fs.writeFile(idempotencyPath, JSON.stringify(index), 'utf8');
  return { duplicate: false };
}

const validCommandTypes = new Set([
  'route.start',
  'route.load.register',
  'route.sale.record',
  'route.close',
  'local.order.create',
  'local.order.transition',
  'payment.collect',
]);

function validateEnvelope(value: unknown): value is CommandEnvelope {
  if (!value || typeof value !== 'object') return false;
  const envelope = value as Partial<CommandEnvelope>;
  if (envelope.schemaVersion !== 1 || typeof envelope.type !== 'string' || !validCommandTypes.has(envelope.type)) return false;
  const context = envelope.context;
  if (!context || typeof context !== 'object') return false;
  return Boolean(
    context.tenantId && context.businessId && context.userId && context.deviceId &&
    context.requestId && context.idempotencyKey && Number.isFinite(context.occurredAt),
  );
}

export function createConnectXCommandRouter(): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'connectx-command-journal', timestamp: Date.now() });
  });

  router.post('/commands', async (req, res) => {
    const envelope = req.body;
    if (!validateEnvelope(envelope)) {
      const body: CommandResponse = {
        ok: false,
        code: 'INVALID_COMMAND',
        message: 'Comando inválido o versión de contrato no soportada.',
        retryable: false,
        serverTime: Date.now(),
      };
      return res.status(400).json(body);
    }

    try {
      const { duplicate } = await appendCommand(envelope);
      const body: CommandResponse = {
        ok: true,
        duplicate,
        result: { requestId: envelope.context.requestId, type: envelope.type },
        serverTime: Date.now(),
      };
      return res.status(duplicate ? 200 : 202).json(body);
    } catch (error) {
      const body: CommandResponse = {
        ok: false,
        code: 'PERSISTENCE_ERROR',
        message: error instanceof Error ? error.message : 'No se pudo persistir el comando.',
        retryable: true,
        serverTime: Date.now(),
      };
      return res.status(503).json(body);
    }
  });

  return router;
}
