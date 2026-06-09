import fs from 'fs';
import path from 'path';
import { AgentIdentity } from './auth.js';

// Basado en las estructuras de ciencias-politicas/Consejo.tsx:
// AgentProposal → ParlamentoEntry
// AgentCritique → pending[] para la otra silla
// AgentVote     → tabla de verificación de sincronía

export interface ParlamentoEntry {
  ts: number;
  agentId: string;
  provider: string;
  sessionId: string;
  filesModified: string[];
  whatWasDone: string[];
  pendingForOther: string[];
  notes: string;
  lastCommit: string;
}

export interface ParlamentoStatus {
  lastEntry: ParlamentoEntry | null;
  allAgents: string[];
  pendingItems: string[];
  verified: boolean;
}

let parlamenroPath: string;

export function initParlamento(repoPath: string) {
  parlamenroPath = path.join(repoPath, 'PARLAMENTO.md');
}

// Append-only — igual que el audit log, nunca se sobreescribe historia
export function addEntry(agent: AgentIdentity, entry: Omit<ParlamentoEntry, 'ts' | 'agentId' | 'provider' | 'sessionId'>): void {
  const full: ParlamentoEntry = {
    ts: Date.now(),
    agentId: agent.agentId,
    provider: agent.provider,
    sessionId: agent.sessionId,
    ...entry
  };

  const section = formatEntry(full);

  // Insertar antes del marcador de cierre del registro
  let current = fs.existsSync(parlamenroPath) ? fs.readFileSync(parlamenroPath, 'utf8') : '';
  const marker = '> *Próxima silla en trabajar: agrega tu entrada abajo siguiendo el mismo formato.*';

  if (current.includes(marker)) {
    current = current.replace(marker, section + '\n\n' + marker);
  } else {
    current += '\n\n' + section;
  }

  fs.writeFileSync(parlamenroPath, current, 'utf8');
}

export function getStatus(): ParlamentoStatus {
  if (!fs.existsSync(parlamenroPath)) {
    return { lastEntry: null, allAgents: [], pendingItems: [], verified: false };
  }

  const content = fs.readFileSync(parlamenroPath, 'utf8');
  const agentMatches = [...content.matchAll(/### \[(\w+)\]/g)];
  const allAgents = [...new Set(agentMatches.map(m => m[1]))];

  const pendingMatches = [...content.matchAll(/- \[ \] (.+)/g)];
  const pendingItems = pendingMatches.map(m => m[1]);

  return {
    lastEntry: null,
    allAgents,
    pendingItems,
    verified: content.includes('✓ Sincronizado')
  };
}

export function readRaw(): string {
  if (!fs.existsSync(parlamenroPath)) return '# PARLAMENTO.md no encontrado';
  return fs.readFileSync(parlamenroPath, 'utf8');
}

function formatEntry(e: ParlamentoEntry): string {
  const date = new Date(e.ts).toISOString().slice(0, 10);
  const done = e.whatWasDone.map(d => `- ${d}`).join('\n');
  const pending = e.pendingForOther.map(p => `- [ ] ${p}`).join('\n');
  const files = e.filesModified.map(f => `- \`${f}\``).join('\n');

  return `---

### [${e.agentId}] — ${date}

**Session:** \`${e.sessionId}\` | **Último commit:** \`${e.lastCommit}\`

**Archivos modificados:**
${files}

**Qué se hizo:**
${done}

**Pendiente para la otra silla:**
${pending}

**Notas:**
${e.notes}`;
}
