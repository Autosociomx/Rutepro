import 'dotenv/config';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { requireAgent } from './auth.js';
import { registerAgentsFromEnv } from './auth.js';
import { initAudit, logOp } from './audit.js';
import { initGit, listFiles, readFile, writeFile, commitChanges, pushBranch, getLog, ensureAgentBranch } from './git.js';
import { initParlamento, addEntry, getStatus, readRaw } from './parlamento.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REPO_PATH = process.env.REPO_PATH || process.cwd();
const PORT = parseInt(process.env.PORT || '4000');
const AUDIT_DIR = process.env.AUDIT_LOG_DIR || path.join(__dirname, '../../logs');

// — Init
registerAgentsFromEnv();
initAudit(AUDIT_DIR);
initGit(REPO_PATH);
initParlamento(REPO_PATH);

const app = express();
app.use(express.json({ limit: '2mb' }));

// Dogma #5: Rate limiting por IP/agente
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: parseInt(process.env.RATE_LIMIT_PER_HOUR || '60'),
  message: { error: 'Límite de operaciones alcanzado. Espera antes de continuar.' },
  keyGenerator: (req) => (req.headers['x-agent-key'] as string) || req.ip || 'unknown'
});
app.use('/repo', limiter);
app.use('/parlamento', limiter);

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (_, res) => {
  res.json({ status: 'ok', ts: Date.now(), repo: REPO_PATH });
});

// ── Schemas (públicos, para que cualquier IA descargue su definición) ─────────
app.get('/schemas/:provider', (req, res) => {
  const provider = req.params.provider; // claude | gemini | openai
  try {
    const file = path.join(__dirname, 'schemas', `${provider}.json`);
    const schema = JSON.parse(readFileSync(file, 'utf8'));
    res.json(schema);
  } catch {
    res.status(404).json({ error: `Schema no encontrado para: ${provider}` });
  }
});

// ── Repo — Lectura (segura, sin restricción de scope) ────────────────────────
app.get('/repo/files', requireAgent, async (req, res) => {
  const agent = (req as any).agent;
  try {
    const files = await listFiles(req.query.path as string);
    logOp(agent, 'list_files', req.query.path as string || '/', true);
    res.json({ files });
  } catch (e: any) {
    logOp(agent, 'list_files', null, false, { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.get('/repo/file', requireAgent, async (req, res) => {
  const agent = (req as any).agent;
  const filePath = req.query.path as string;
  if (!filePath) return res.status(400).json({ error: 'Se requiere ?path=' });
  try {
    const content = await readFile(filePath);
    logOp(agent, 'read_file', filePath, true);
    res.json({ path: filePath, content });
  } catch (e: any) {
    logOp(agent, 'read_file', filePath, false, { error: e.message });
    res.status(404).json({ error: e.message });
  }
});

app.get('/repo/log', requireAgent, async (req, res) => {
  const agent = (req as any).agent;
  const limit = parseInt(req.query.limit as string || '10');
  try {
    const log = await getLog(limit);
    logOp(agent, 'git_log', null, true);
    res.json({ log });
  } catch (e: any) {
    logOp(agent, 'git_log', null, false, { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// ── Repo — Escritura (scope + rama validados) ─────────────────────────────────
app.post('/repo/file', requireAgent, async (req, res) => {
  const agent = (req as any).agent;
  const { path: filePath, content } = req.body;
  if (!filePath || content === undefined) {
    return res.status(400).json({ error: 'Se requieren path y content' });
  }
  try {
    await ensureAgentBranch(agent);
    await writeFile(agent, filePath, content);
    logOp(agent, 'write_file', filePath, true, { bytes: content.length });
    res.json({ ok: true, path: filePath, branch: agent.branch });
  } catch (e: any) {
    logOp(agent, 'write_file', filePath, false, { error: e.message });
    res.status(403).json({ error: e.message });
  }
});

app.post('/repo/commit', requireAgent, async (req, res) => {
  const agent = (req as any).agent;
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Se requiere message' });
  try {
    const hash = await commitChanges(agent, message);
    logOp(agent, 'commit', hash, true, { message });
    res.json({ ok: true, commit: hash, agent: agent.agentId });
  } catch (e: any) {
    logOp(agent, 'commit', null, false, { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.post('/repo/push', requireAgent, async (req, res) => {
  const agent = (req as any).agent;
  try {
    await pushBranch(agent);
    logOp(agent, 'push', agent.branch, true);
    res.json({ ok: true, branch: agent.branch });
  } catch (e: any) {
    logOp(agent, 'push', agent.branch, false, { error: e.message });
    res.status(403).json({ error: e.message });
  }
});

// ── Parlamento ────────────────────────────────────────────────────────────────
app.get('/parlamento', requireAgent, (req, res) => {
  const agent = (req as any).agent;
  try {
    const raw = readRaw();
    logOp(agent, 'parlamento_read', 'PARLAMENTO.md', true);
    res.json({ content: raw });
  } catch (e: any) {
    logOp(agent, 'parlamento_read', 'PARLAMENTO.md', false, { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.get('/parlamento/status', requireAgent, (req, res) => {
  const agent = (req as any).agent;
  try {
    const status = getStatus();
    logOp(agent, 'parlamento_status', null, true);
    res.json(status);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/parlamento/entry', requireAgent, (req, res) => {
  const agent = (req as any).agent;
  const { files_modified, what_was_done, pending_for_other, notes, last_commit } = req.body;
  if (!files_modified || !what_was_done || !pending_for_other || !last_commit) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }
  try {
    addEntry(agent, {
      filesModified: files_modified,
      whatWasDone: what_was_done,
      pendingForOther: pending_for_other,
      notes: notes || '',
      lastCommit: last_commit
    });
    logOp(agent, 'parlamento_write', 'PARLAMENTO.md', true);
    res.json({ ok: true, agentId: agent.agentId });
  } catch (e: any) {
    logOp(agent, 'parlamento_write', 'PARLAMENTO.md', false, { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// ── Dataset (endpoint futuro para análisis) ───────────────────────────────────
app.get('/audit/stats', requireAgent, (req, res) => {
  res.json({
    message: 'Dataset analytics — próximamente disponible',
    hint: 'Los logs están en NDJSON en el directorio de audit'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🪑 RepoLink AI corriendo en http://localhost:${PORT}`);
  console.log(`   Repo: ${REPO_PATH}`);
  console.log(`   Schemas: GET /schemas/claude | /schemas/gemini | /schemas/openai\n`);
});
