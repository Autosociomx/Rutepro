import { Request, Response, NextFunction } from 'express';

export interface AgentIdentity {
  agentId: string;       // e.g. "CLAUDE", "GEMINI", "OPENAI"
  provider: string;      // e.g. "anthropic", "google", "openai"
  allowedPaths: string[];// glob patterns this agent can write to
  branch: string;        // agent's working branch
  sessionId: string;     // unique per session
}

const AGENT_REGISTRY: Record<string, AgentIdentity> = {};

export function registerAgentsFromEnv() {
  const prefix = 'AGENT_KEY_';
  for (const [key, token] of Object.entries(process.env)) {
    if (!key.startsWith(prefix) || !token) continue;
    const agentId = key.replace(prefix, '').toUpperCase();
    AGENT_REGISTRY[token] = {
      agentId,
      provider: agentId.toLowerCase(),
      allowedPaths: (process.env[`AGENT_SCOPE_${agentId}`] || '*').split(','),
      branch: `${agentId.toLowerCase()}/work`,
      sessionId: `${agentId}-${Date.now()}`
    };
  }
  console.log(`[Auth] ${Object.keys(AGENT_REGISTRY).length} agentes registrados.`);
}

export function resolveAgent(token: string): AgentIdentity | null {
  return AGENT_REGISTRY[token] ?? null;
}

// Middleware: valida API key y adjunta identidad al request
export function requireAgent(req: Request, res: Response, next: NextFunction) {
  const token = (req.headers['x-agent-key'] as string) || req.query.key as string;
  if (!token) {
    return res.status(401).json({ error: 'Se requiere x-agent-key header' });
  }
  const agent = resolveAgent(token);
  if (!agent) {
    return res.status(403).json({ error: 'API key no reconocida' });
  }
  (req as any).agent = agent;
  next();
}

// Verifica que el agente tiene permiso para tocar un path específico
export function canWrite(agent: AgentIdentity, filePath: string): boolean {
  if (agent.allowedPaths.includes('*')) return true;
  return agent.allowedPaths.some(pattern => {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(filePath);
  });
}
