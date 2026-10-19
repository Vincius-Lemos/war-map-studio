import fs from 'node:fs';
import type { FastifyInstance } from 'fastify';
import type { Scene } from '../../../../packages/shared/src/scene.js';
import { SCENE_ID, SceneStore } from '../storage/scenes.js';
import { validateScene } from '../scene-validation.js';
import type { ExportFn, ExportFormat } from '../export/exporter.js';
import type { ExportQueue, ExportJob } from '../export/queue.js';
import { slugify } from '../util.js';

const FORMATS: Record<ExportFormat, string> = { webm: 'video/webm', mp4: 'video/mp4' };
const JOB_ID = /^[0-9a-f-]{36}$/;
const MAX_SECONDS = 3600;

export interface ExportRoutesOptions {
  store: SceneStore;
  queue: ExportQueue;
  /** null = pacote de exportação ainda não existe: POST responde 501. */
  exporter: ExportFn | null;
  basePath: string;
  rateLimit: number;
}

function publicJob(base: string, job: ExportJob) {
  const url = `${base}/api/export/${job.id}`;
  return {
    jobId: job.id,
    status: job.status,
    format: job.format,
    seconds: job.seconds,
    error: job.error,
    statusUrl: url,
    fileUrl: job.status === 'done' ? `${url}/file` : null,
  };
}

export async function exportRoutes(app: FastifyInstance, opts: ExportRoutesOptions): Promise<void> {
  const { store, queue, exporter, basePath } = opts;
  const rate = { config: { rateLimit: { max: opts.rateLimit, timeWindow: '1 minute' } } };

  app.post<{ Body: { sceneId?: unknown; scene?: unknown; seconds?: unknown; format?: unknown } }>(
    '/api/export',
    rate,
    async (req, reply) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const format = body.format;
      if (format !== 'webm' && format !== 'mp4') return reply.code(400).send({ error: 'format deve ser webm ou mp4' });
      const seconds = body.seconds;
      if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0 || seconds > MAX_SECONDS) {
        return reply.code(400).send({ error: `seconds deve ser um número entre 0 e ${MAX_SECONDS}` });
      }

      let scene: Scene;
      let sceneId: string | null = null;
      if (typeof body.sceneId === 'string') {
        if (!SCENE_ID.test(body.sceneId)) return reply.code(400).send({ error: 'Id de cena inválido' });
        const rec = await store.get(body.sceneId);
        if (!rec) return reply.code(404).send({ error: 'Cena não encontrada' });
        scene = rec.scene;
        sceneId = rec.id;
      } else if (body.scene !== undefined) {
        const v = await validateScene(body.scene);
        if (!v.ok) return reply.code(400).send({ error: 'Cena inválida', details: v.errors });
        scene = v.scene;
      } else {
        return reply.code(400).send({ error: 'Informe sceneId ou scene' });
      }

      if (!exporter) return reply.code(501).send({ error: 'Exportação ainda não disponível neste servidor' });

      const job = queue.submit({
        format,
        seconds,
        sceneId,
        fileName: `${slugify(scene.title ?? '')}-${Math.round(seconds)}s.${format}`,
        scene,
      });
      if (!job) return reply.code(429).send({ error: 'Fila de exportação cheia; tente novamente depois' });
      return reply.code(202).header('Location', `${basePath}/api/export/${job.id}`).send(publicJob(basePath, job));
    },
  );

  app.get<{ Params: { jobId: string } }>('/api/export/:jobId', async (req, reply) => {
    if (!JOB_ID.test(req.params.jobId)) return reply.code(400).send({ error: 'Id de job inválido' });
    const job = queue.get(req.params.jobId);
    if (!job) return reply.code(404).send({ error: 'Job não encontrado' });
    return publicJob(basePath, job);
  });

  app.get<{ Params: { jobId: string } }>('/api/export/:jobId/file', async (req, reply) => {
    if (!JOB_ID.test(req.params.jobId)) return reply.code(400).send({ error: 'Id de job inválido' });
    const job = queue.get(req.params.jobId);
    if (!job) return reply.code(404).send({ error: 'Job não encontrado' });
    if (job.status !== 'done') return reply.code(409).send({ error: 'Exportação não concluída', status: job.status });
    reply.header('Content-Disposition', `attachment; filename="${job.fileName}"`);
    reply.header('Cache-Control', 'no-store');
    reply.type(FORMATS[job.format]);
    return reply.send(fs.createReadStream(job.filePath));
  });
}
