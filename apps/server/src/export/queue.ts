import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Scene } from '../../../../packages/shared/src/scene.js';
import type { ExportFormat } from './exporter.js';

export type JobStatus = 'queued' | 'running' | 'done' | 'error';

export interface ExportJob {
  id: string;
  status: JobStatus;
  format: ExportFormat;
  seconds: number;
  sceneId: string | null;
  fileName: string;
  filePath: string;
  createdAt: number;
  finishedAt: number | null;
  error: string | null;
}

interface Entry {
  job: ExportJob;
  scene: Scene;
}

export interface QueueOptions {
  /** Executa uma exportação e grava o arquivo em job.filePath. Deve lançar erro em caso de falha. */
  run: (job: ExportJob, scene: Scene) => Promise<void>;
  maxPending: number;
  timeoutMs: number;
  /** Tempo que um job concluído fica disponível para download. */
  ttlMs: number;
  onError: (job: ExportJob, err: unknown) => void;
  exportsDir: string;
}

/** Fila em memória: uma exportação por vez, para não estourar a memória do servidor. */
export class ExportQueue {
  private readonly jobs = new Map<string, Entry>();
  private readonly waiting: Entry[] = [];
  private busy = false;
  private sweeper: NodeJS.Timeout | null = null;

  constructor(private readonly opts: QueueOptions) {}

  start(): void {
    fs.mkdirSync(this.opts.exportsDir, { recursive: true });
    this.sweeper = setInterval(() => void this.sweep(), 60_000);
    this.sweeper.unref();
  }

  async stop(): Promise<void> {
    if (this.sweeper) clearInterval(this.sweeper);
    this.sweeper = null;
  }

  /** Retorna null quando a fila está cheia. */
  submit(params: { format: ExportFormat; seconds: number; sceneId: string | null; fileName: string; scene: Scene }): ExportJob | null {
    if (this.waiting.length >= this.opts.maxPending) return null;
    const id = randomUUID();
    const job: ExportJob = {
      id,
      status: 'queued',
      format: params.format,
      seconds: params.seconds,
      sceneId: params.sceneId,
      fileName: params.fileName,
      filePath: path.join(this.opts.exportsDir, `${id}.${params.format}`),
      createdAt: Date.now(),
      finishedAt: null,
      error: null,
    };
    const entry: Entry = { job, scene: params.scene };
    this.jobs.set(id, entry);
    this.waiting.push(entry);
    this.pump();
    return job;
  }

  get(id: string): ExportJob | undefined {
    return this.jobs.get(id)?.job;
  }

  private pump(): void {
    if (this.busy) return;
    const next = this.waiting.shift();
    if (!next) return;
    this.busy = true;
    next.job.status = 'running';
    withTimeout(this.opts.run(next.job, next.scene), this.opts.timeoutMs)
      .then(async () => {
        const st = await fs.promises.stat(next.job.filePath).catch(() => null);
        if (!st || st.size === 0) throw new Error('arquivo de saída ausente');
        next.job.status = 'done';
      })
      .catch((err: unknown) => {
        next.job.status = 'error';
        next.job.error = 'Falha na exportação';
        this.opts.onError(next.job, err);
      })
      .finally(() => {
        next.job.finishedAt = Date.now();
        this.busy = false;
        this.pump();
      });
  }

  /** Remove jobs concluídos após o TTL, junto com o arquivo gerado. */
  async sweep(now = Date.now()): Promise<void> {
    for (const [id, { job }] of this.jobs) {
      if (job.finishedAt === null || now - job.finishedAt < this.opts.ttlMs) continue;
      this.jobs.delete(id);
      await fs.promises.rm(job.filePath, { force: true }).catch(() => {});
    }
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('tempo esgotado')), ms);
  });
  return Promise.race([p, limit]).finally(() => clearTimeout(timer));
}
