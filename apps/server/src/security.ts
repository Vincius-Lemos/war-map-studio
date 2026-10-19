import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { safeEqual } from './util.js';

/** Cabeçalhos de segurança simples (estilo helmet, sem CSP para não quebrar o mapa). */
export function registerSecurityHeaders(app: FastifyInstance): void {
  app.addHook('onRequest', async (_req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'SAMEORIGIN');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  });
}

function sameHostOrigin(origin: string, host: string | undefined): boolean {
  if (!host) return false;
  try {
    const u = new URL(origin);
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.host === host;
  } catch {
    return false;
  }
}

/**
 * CORS restrito: aceita CORS_ORIGIN (lista) e, por padrão, apenas a origem igual ao Host da requisição.
 * Requisições sem cabeçalho Origin (mesmo site) não recebem cabeçalhos CORS.
 */
export function registerCors(app: FastifyInstance, allowed: string[]): void {
  app.addHook('onRequest', async (req, reply) => {
    const origin = req.headers.origin;
    if (typeof origin !== 'string') return;
    const ok = allowed.includes(origin) || sameHostOrigin(origin, req.headers.host);
    if (!ok) {
      if (req.method === 'OPTIONS') return reply.code(204).send();
      return;
    }
    reply.header('Access-Control-Allow-Origin', origin);
    reply.header('Vary', 'Origin');
    reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type,X-Token');
    reply.header('Access-Control-Max-Age', '600');
    if (req.method === 'OPTIONS') return reply.code(204).send();
  });
}

/**
 * Gancho de autenticação para escrita. Se ADMIN_TOKEN estiver definido, exige o header X-Token igual a ele.
 * Sem ADMIN_TOKEN, a escrita fica aberta (modo atual, sem autenticação).
 */
export function requireWriteToken(adminToken: string | null) {
  return async function check(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!adminToken) return;
    const sent = req.headers['x-token'];
    if (typeof sent !== 'string' || !safeEqual(sent, adminToken)) {
      return reply.code(401).send({ error: 'Não autorizado' });
    }
  };
}
