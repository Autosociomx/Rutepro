import simpleGit, { SimpleGit } from 'simple-git';
import fs from 'fs';
import path from 'path';
import { AgentIdentity, canWrite } from './auth.js';

let git: SimpleGit;
let repoPath: string;
const PROTECTED_BRANCH = process.env.PROTECTED_BRANCH || 'main';

export function initGit(rPath: string) {
  repoPath = rPath;
  git = simpleGit(repoPath);
}

export async function listFiles(subPath = ''): Promise<string[]> {
  const result = await git.raw(['ls-files', subPath || '.']);
  return result.split('\n').filter(Boolean);
}

export async function readFile(filePath: string): Promise<string> {
  const abs = path.join(repoPath, filePath);
  if (!fs.existsSync(abs)) throw new Error(`Archivo no encontrado: ${filePath}`);
  return fs.readFileSync(abs, 'utf8');
}

export async function writeFile(agent: AgentIdentity, filePath: string, content: string): Promise<void> {
  // Dogma #1: verificar scope del agente
  if (!canWrite(agent, filePath)) {
    throw new Error(`Agente ${agent.agentId} no tiene permiso para escribir: ${filePath}`);
  }

  // Dogma #3: verificar que estamos en la rama del agente, no en main
  const current = await git.revparse(['--abbrev-ref', 'HEAD']);
  if (current.trim() === PROTECTED_BRANCH) {
    throw new Error(`Escritura directa a '${PROTECTED_BRANCH}' no permitida. Usa la rama del agente: ${agent.branch}`);
  }

  const abs = path.join(repoPath, filePath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
}

export async function commitChanges(agent: AgentIdentity, message: string): Promise<string> {
  // Dogma #4: firma del agente en cada commit
  const fullMessage = `${message}\n\nAI-Agent: ${agent.agentId}\nProvider: ${agent.provider}\nSession: ${agent.sessionId}`;
  await git.add('.');
  const result = await git.commit(fullMessage, { '--author': `${agent.agentId} Bot <ai@repolink.ai>` });
  return result.commit;
}

export async function pushBranch(agent: AgentIdentity): Promise<void> {
  const current = await git.revparse(['--abbrev-ref', 'HEAD']);
  if (current.trim() === PROTECTED_BRANCH) {
    throw new Error(`Push directo a '${PROTECTED_BRANCH}' no permitido. Abre un PR.`);
  }
  await git.push('origin', current.trim(), ['--set-upstream']);
}

export async function getLog(limit = 10): Promise<Array<{ hash: string; message: string; author: string; date: string }>> {
  const log = await git.log({ maxCount: limit });
  return log.all.map(c => ({
    hash: c.hash.slice(0, 7),
    message: c.message,
    author: c.author_name,
    date: c.date
  }));
}

export async function ensureAgentBranch(agent: AgentIdentity): Promise<void> {
  const branches = await git.branchLocal();
  if (!branches.all.includes(agent.branch)) {
    await git.checkoutLocalBranch(agent.branch);
  } else {
    await git.checkout(agent.branch);
  }
}
