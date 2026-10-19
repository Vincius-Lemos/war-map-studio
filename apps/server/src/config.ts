import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Raiz do pacote apps/server (funciona com tsx, que roda o código-fonte). */
export const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export interface Config {
  port: number;
  host: string;
  /** Prefixo público (ex.: '/mapas'), sem barra final. Vazio = raiz. */
  basePath: string;
  webDist: string;
  geoDir: string;
  scenesDir: string;
  exportsDir: string;
  adminToken: string | null;
  /** Origens extras permitidas no CORS. O próprio host é sempre aceito. */
  corsOrigins: string[];
  trustProxy: string;
  bodyLimitBytes: number;
  exportMaxPending: number;
  exportTimeoutMs: number;
  exportRateLimit: number;
  logLevel: string;
}

type Env = Record<string, string | undefined>;

function read(source: Env, name: string): string | undefined {
  const v = source[name];
  return v === undefined || v.trim() === '' ? undefined : v.trim();
}

function intOf(source: Env, name: string, def: number): number {
  const raw = read(source, name);
  if (raw === undefined) return def;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${name} invalido`);
  return n;
}

export function normalizeBasePath(raw: string | undefined): string {
  if (!raw || raw === '/') return '';
  const p = `/${raw.replace(/^\/+/, '').replace(/\/+$/, '')}`;
  if (!/^\/[A-Za-z0-9._~-]+(\/[A-Za-z0-9._~-]+)*$/.test(p)) throw new Error('BASE_PATH invalido');
  return p;
}

/** Lê a configuração das variáveis de ambiente. Caminhos relativos resolvem a partir de apps/server. */
export function loadConfig(source: Env = process.env): Config {
  const originsRaw = read(source, 'CORS_ORIGIN');
  return {
    port: intOf(source, 'PORT', 8787),
    host: read(source, 'HOST') ?? '0.0.0.0',
    basePath: normalizeBasePath(read(source, 'BASE_PATH')),
    webDist: path.resolve(SERVER_ROOT, read(source, 'WEB_DIST') ?? '../web/dist'),
    geoDir: path.resolve(SERVER_ROOT, read(source, 'GEO_DIR') ?? '../../data/out'),
    scenesDir: path.resolve(SERVER_ROOT, read(source, 'SCENES_DIR') ?? 'storage/scenes'),
    exportsDir: path.resolve(SERVER_ROOT, read(source, 'EXPORTS_DIR') ?? 'storage/exports'),
    adminToken: read(source, 'ADMIN_TOKEN') ?? null,
    corsOrigins: originsRaw ? originsRaw.split(',').map((s) => s.trim()).filter(Boolean) : [],
    trustProxy: read(source, 'TRUST_PROXY') ?? 'loopback',
    bodyLimitBytes: 20 * 1024 * 1024,
    exportMaxPending: intOf(source, 'EXPORT_MAX_PENDING', 4),
    exportTimeoutMs: intOf(source, 'EXPORT_TIMEOUT_MS', 30 * 60 * 1000),
    exportRateLimit: intOf(source, 'EXPORT_RATE_LIMIT', 6),
    logLevel: read(source, 'LOG_LEVEL') ?? 'info',
  };
}
