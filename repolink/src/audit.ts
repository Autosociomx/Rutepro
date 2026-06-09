import fs from 'fs';
import path from 'path';
import { AgentIdentity } from './auth.js';

export interface AuditEntry {
  ts: number;                    // unix timestamp
  sessionId: string;
  agentId: string;
  provider: string;
  operation: string;             // read_file | write_file | commit | push | parlamento_read | parlamento_write
  target: string | null;        // file path, commit hash, etc.
  success: boolean;
  meta?: Record<string, unknown>;
}

let logDir: string;
let logFile: string;

export function initAudit(dir: string) {
  logDir = dir;
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  logFile = path.join(logDir, `audit-${date}.ndjson`);
}

// Append-only — nunca sobreescribe, siempre agrega al final
export function logOp(agent: AgentIdentity, operation: string, target: string | null, success: boolean, meta?: Record<string, unknown>) {
  const entry: AuditEntry = {
    ts: Date.now(),
    sessionId: agent.sessionId,
    agentId: agent.agentId,
    provider: agent.provider,
    operation,
    target,
    success,
    meta
  };
  fs.appendFileSync(logFile, JSON.stringify(entry) + '\n', 'utf8');
}

// Lectura del dataset completo (para análisis futuro)
export function readAuditLog(date?: string): AuditEntry[] {
  const file = date
    ? path.join(logDir, `audit-${date}.ndjson`)
    : logFile;
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as AuditEntry);
}
