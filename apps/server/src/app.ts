import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCompress from '@fastify/compress';
import rateLimit from '@fastify/rate-limit';
import type { Config } from './config.js';
import { registerCors, registerSecurityHeaders } from './security.js';
import { SceneStore } from './storage/scenes.js';
import { geoRoutes } from './routes/geo.js';
import { sceneRoutes } from './routes/scenes.js';
import { exportRoutes } from './routes/export.js';
import { ExportQueue } from './export/queue.js';
import type { ExportFn } from './export/exporter.js';
import { loadExporter } from './export/exporter.js';

export interface BuildOptions {
  config: Config;
  /** Exportador injetado (testes). Se omitido, carrega @map-draw/export quando existir. */
  exporter?: ExportFn | null;
  logger?: boolean;
}

export interface BuiltApp {
  app: FastifyInstance;
  queue: ExportQueue;
}

const SENSITIVE_HEADERS = ['req.headers["x-token"]', 'req.headers.authorization', 'req.headers.cookie'];

/** Monta a aplicação Fastify (sem abrir porta). */
export async function buildApp(opts: BuildOptions): Promise<BuiltApp> {
  const { config } = opts;
  const app = Fastify({
    trustProxy: config.trustProxy === 'true' ? true : config.trustProxy === 'false' ? false : config.trustProxy,
    bodyLimit: config.bodyLimitBytes,
    logger: opts.logger === false
      ? false
      : { level: config.logLevel, redact: { paths: SENSITIVE_HEADERS, censor: '[redacted]' } },
  });

  const base = config.basePath;
  const exporter = opts.exporter !== undefined
    ? opts.exporter
    : await loadExporter((m) => app.log.warn(m));

  // Erros: sem stack, sem caminhos do sistema.
  app.setErrorHandler((err, req, reply) => {
    const e = err as { statusCode?: number; code?: string };
    const status = e.statusCode && e.statusCode >= 400 ? e.statusCode : 500;
    if (status >= 500) {
      req.log.error({ err }, 'erro interno');
      return reply.code(500).send({ error: 'Erro interno' });
    }
    let msg = http.STATUS_CODES[status] ?? 'Erro';
    if (e.code === 'FST_ERR_CTP_BODY_TOO_LARGE') msg = 'Corpo grande demais (limite de 20 MB)';
    else if (e.code?.startsWith('FST_ERR_CTP_INVALID') || e.code === 'FST_ERR_CTP_EMPTY_JSON_BODY') msg = 'JSON inválido';
    else if (status === 429) msg = 'Muitas requisições; aguarde um pouco';
    return reply.code(status).send({ error: msg });
  });

  registerSecurityHeaders(app);
  registerCors(app, config.corsOrigins);

  await app.register(fastifyCompress, { threshold: 1024 });
  await app.register(rateLimit, { global: false });

  const queue = new ExportQueue({
    exportsDir: config.exportsDir,
    maxPending: config.exportMaxPending,
    timeoutMs: config.exportTimeoutMs,
    ttlMs: 60 * 60 * 1000,
    run: async (job, scene) => {
      if (!exporter) throw new Error('exportador indisponível');
      await exporter({ scene, seconds: job.seconds, format: job.format, outputPath: job.filePath });
    },
    onError: (job, err) => app.log.error({ jobId: job.id, err: String((err as Error)?.message ?? err) }, 'falha na exportação'),
  });
  queue.start();
  app.addHook('onClose', async () => queue.stop());

  const store = new SceneStore(config.scenesDir);

  // Tudo abaixo fica sob o prefixo BASE_PATH (ex.: /mapas/api/...).
  await app.register(
    async (scope) => {
      await scope.register(async (api) => {
        api.get('/api/health', async () => ({ ok: true }));
        await api.register(geoRoutes, { geoDir: config.geoDir });
        await api.register(sceneRoutes, { store, adminToken: config.adminToken });
        await api.register(exportRoutes, { store, queue, exporter, basePath: base, rateLimit: config.exportRateLimit });
      }, { prefix: base });

      // Site estático (build do Vite).
      const indexFile = path.join(config.webDist, 'index.html');
      const hasSite = fs.existsSync(indexFile);
      if (!hasSite) app.log.warn('site não compilado: WEB_DIST sem index.html');
      if (hasSite) {
        await scope.register(fastifyStatic, {
          root: config.webDist,
          prefix: `${base}/`,
          index: ['index.html'],
          decorateReply: true,
          cacheControl: false,
          setHeaders(reply, filePath) {
            const file = path.basename(filePath);
            if (file === 'index.html') {
              reply.header('Cache-Control', 'no-cache');
            } else if (filePath.split(path.sep).includes('assets') || /\.[0-9a-f]{8,}\./.test(file)) {
              // Assets do Vite têm hash no nome: cache longo e imutável.
              reply.header('Cache-Control', 'public, max-age=31536000, immutable');
            } else {
              reply.header('Cache-Control', 'public, max-age=3600');
            }
          },
        });
      }
      if (base) scope.get(base, async (_req, reply) => reply.redirect(`${base}/`));

      scope.setNotFoundHandler(async (req, reply) => {
        const url = req.url.split('?')[0];
        const isApi = url === `${base}/api` || url.startsWith(`${base}/api/`);
        const wantsPage = (req.method === 'GET' || req.method === 'HEAD')
          && hasSite
          && (base === '' ? true : url.startsWith(`${base}/`))
          && !url.startsWith(`${base}/assets/`)
          && !path.posix.extname(url);
        if (!isApi && wantsPage) {
          reply.header('Cache-Control', 'no-cache');
          return reply.type('text/html; charset=utf-8').sendFile('index.html');
        }
        return reply.code(404).send({ error: 'Não encontrado' });
      });
    },
    { prefix: '' },
  );

  return { app, queue };
}
