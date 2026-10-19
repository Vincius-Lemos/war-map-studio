import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildApp, type BuiltApp } from '../src/app.js';
import type { ExportFn } from '../src/export/exporter.js';
import { tempConfig, sampleScene } from './helpers.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const cleanups: Array<() => void> = [];
const apps: BuiltApp[] = [];
after(async () => {
  for (const a of apps) await a.app.close();
  for (const c of cleanups) c();
});

async function make(exporter: ExportFn | null, extra: Parameters<typeof tempConfig>[0] = {}): Promise<BuiltApp> {
  const t = tempConfig(extra);
  cleanups.push(t.cleanup);
  const built = await buildApp({ config: t.config, logger: false, exporter });
  apps.push(built);
  return built;
}

async function waitDone(built: BuiltApp, jobId: string): Promise<Record<string, unknown>> {
  for (let i = 0; i < 200; i++) {
    const res = await built.app.inject({ method: 'GET', url: `/api/export/${jobId}` });
    const body = JSON.parse(res.body);
    if (body.status === 'done' || body.status === 'error') return body;
    await sleep(10);
  }
  throw new Error('timeout no teste');
}

const okExporter: ExportFn = async ({ outputPath }) => {
  await sleep(20);
  fs.writeFileSync(outputPath, 'video-falso');
};

test('sem pacote de exportacao, POST responde 501', async () => {
  const b = await make(null);
  const res = await b.app.inject({ method: 'POST', url: '/api/export', payload: { scene: sampleScene(), seconds: 5, format: 'webm' } });
  assert.equal(res.statusCode, 501);
  assert.equal(typeof JSON.parse(res.body).error, 'string');
});

test('validacao do corpo de /api/export', async () => {
  const b = await make(okExporter);
  const cases: Array<Record<string, unknown>> = [
    { scene: sampleScene(), seconds: 5, format: 'avi' },
    { scene: sampleScene(), seconds: 0, format: 'webm' },
    { scene: sampleScene(), seconds: 99999, format: 'webm' },
    { seconds: 5, format: 'mp4' },
    { scene: { title: 1 }, seconds: 5, format: 'mp4' },
    { sceneId: '../etc', seconds: 5, format: 'mp4' },
  ];
  for (const payload of cases) {
    const res = await b.app.inject({ method: 'POST', url: '/api/export', payload });
    assert.ok([400, 404].includes(res.statusCode), JSON.stringify(payload) + ' -> ' + res.statusCode);
  }
});

test('POST com cena inline responde 202 e o arquivo fica disponivel', async () => {
  const b = await make(okExporter);
  const res = await b.app.inject({ method: 'POST', url: '/api/export', payload: { scene: sampleScene('Ataque Norte'), seconds: 3, format: 'webm' } });
  assert.equal(res.statusCode, 202);
  const job = JSON.parse(res.body);
  assert.match(job.jobId, /^[0-9a-f-]{36}$/);
  assert.equal(job.statusUrl, `/api/export/${job.jobId}`);

  const done = await waitDone(b, job.jobId);
  assert.equal(done.status, 'done');
  assert.equal(done.fileUrl, `/api/export/${job.jobId}/file`);

  const file = await b.app.inject({ method: 'GET', url: `/api/export/${job.jobId}/file` });
  assert.equal(file.statusCode, 200);
  assert.equal(file.headers['content-type'], 'video/webm');
  assert.match(String(file.headers['content-disposition']), /^attachment; filename="ataque-norte-3s\.webm"$/);
  assert.equal(file.body, 'video-falso');
});

test('POST com sceneId usa a cena salva', async () => {
  const b = await make(okExporter);
  const saved = await b.app.inject({ method: 'POST', url: '/api/scenes', payload: sampleScene('Salva') });
  const id = JSON.parse(saved.body).id;
  const res = await b.app.inject({ method: 'POST', url: '/api/export', payload: { sceneId: id, seconds: 2, format: 'mp4' } });
  assert.equal(res.statusCode, 202);
  const done = await waitDone(b, JSON.parse(res.body).jobId);
  assert.equal(done.status, 'done');

  const missing = await b.app.inject({ method: 'POST', url: '/api/export', payload: { sceneId: 'nao-existe-1', seconds: 2, format: 'mp4' } });
  assert.equal(missing.statusCode, 404);
});

test('jobs rodam um por vez', async () => {
  let running = 0;
  let maxRunning = 0;
  const exporter: ExportFn = async ({ outputPath }) => {
    running++;
    maxRunning = Math.max(maxRunning, running);
    await sleep(30);
    running--;
    fs.writeFileSync(outputPath, 'x');
  };
  const b = await make(exporter);
  const ids: string[] = [];
  for (let i = 0; i < 3; i++) {
    const r = await b.app.inject({ method: 'POST', url: '/api/export', payload: { scene: sampleScene(), seconds: 1, format: 'webm' } });
    assert.equal(r.statusCode, 202);
    ids.push(JSON.parse(r.body).jobId);
  }
  for (const id of ids) assert.equal((await waitDone(b, id)).status, 'done');
  assert.equal(maxRunning, 1);
});

test('fila cheia responde 429', async () => {
  const slow: ExportFn = async ({ outputPath }) => {
    await sleep(200);
    fs.writeFileSync(outputPath, 'x');
  };
  const b = await make(slow, { exportMaxPending: 1 });
  const payload = { scene: sampleScene(), seconds: 1, format: 'webm' };
  const codes: number[] = [];
  for (let i = 0; i < 3; i++) codes.push((await b.app.inject({ method: 'POST', url: '/api/export', payload })).statusCode);
  assert.deepEqual(codes, [202, 202, 429]);
});

test('rate limit por IP em /api/export', async () => {
  const b = await make(okExporter, { exportRateLimit: 2 });
  const payload = { scene: sampleScene(), seconds: 1, format: 'webm' };
  const codes: number[] = [];
  for (let i = 0; i < 3; i++) {
    codes.push((await b.app.inject({ method: 'POST', url: '/api/export', payload, remoteAddress: '10.0.0.7' })).statusCode);
  }
  assert.deepEqual(codes, [202, 202, 429]);
  const other = await b.app.inject({ method: 'POST', url: '/api/export', payload, remoteAddress: '10.0.0.8' });
  assert.equal(other.statusCode, 202);
});

test('job inexistente e arquivo antes de concluir', async () => {
  const b = await make(okExporter);
  const bad = await b.app.inject({ method: 'GET', url: '/api/export/nao-e-uuid' });
  assert.equal(bad.statusCode, 400);
  const none = await b.app.inject({ method: 'GET', url: '/api/export/00000000-0000-4000-8000-000000000000' });
  assert.equal(none.statusCode, 404);
  const fileNone = await b.app.inject({ method: 'GET', url: '/api/export/00000000-0000-4000-8000-000000000000/file' });
  assert.equal(fileNone.statusCode, 404);
});

test('falha do exportador vira status error sem vazar detalhes', async () => {
  const failing: ExportFn = async () => {
    throw new Error('ffmpeg falhou em C:\\segredo\\caminho');
  };
  const b = await make(failing);
  const res = await b.app.inject({ method: 'POST', url: '/api/export', payload: { scene: sampleScene(), seconds: 1, format: 'webm' } });
  const done = await waitDone(b, JSON.parse(res.body).jobId);
  assert.equal(done.status, 'error');
  assert.equal(done.error, 'Falha na exportação');
  assert.ok(!JSON.stringify(done).includes('segredo'));
});
