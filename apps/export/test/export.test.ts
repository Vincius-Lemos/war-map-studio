import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import type { Scene } from '../../../packages/shared/src/scene.js';
import { exportScene, ExportError } from '../src/index.js';

const execFileAsync = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const mockHtml = await readFile(join(here, 'fixtures', 'mock-app.html'), 'utf8');

/* Cena mínima e válida segundo packages/shared/src/scene.ts. */
const scene: Scene = {
  title: 'Teste',
  startDate: '2022-02-24T00:00',
  durationH: 48,
  year: null,
  mapType: 'country',
  region: { lon0: -10, lat0: 35, lon1: 40, lat1: 60 },
  symbolStyle: 'nato',
  unitSize: 1,
  showLabels: true,
  showTrails: true,
  showAllFlags: false,
  factions: [{ id: 'a', name: 'Força A', color: '#2e7d32', affil: 'friend' }],
  units: [],
  arrows: [],
  events: [],
  territories: [],
  orgFlags: [],
  overlay: null,
};

function startMockServer(): Promise<{ server: Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(mockHtml);
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

async function probe(file: string): Promise<{ duration: number; frames: number; width: number; height: number; codec: string }> {
  const bin = process.env.FFPROBE_PATH || 'ffprobe';
  const { stdout } = await execFileAsync(bin, [
    '-v', 'error', '-count_frames', '-select_streams', 'v:0',
    '-show_entries', 'stream=codec_name,width,height,nb_read_frames:format=duration',
    '-of', 'json', file,
  ]);
  const json = JSON.parse(stdout) as {
    streams: { codec_name: string; width: number; height: number; nb_read_frames: string }[];
    format: { duration: string };
  };
  const s = json.streams[0];
  return {
    duration: Number(json.format.duration),
    frames: Number(s.nb_read_frames),
    width: s.width,
    height: s.height,
    codec: s.codec_name,
  };
}

test('exporta 3 s a 30 fps (90 quadros) em mp4 e webm', async (t) => {
  const { server, baseUrl } = await startMockServer();
  const dir = await mkdtemp(join(tmpdir(), 'map-export-test-'));
  try {
    for (const format of ['mp4', 'webm'] as const) {
      await t.test(format, async () => {
        const out = join(dir, `saida.${format}`);
        let lastDone = 0;
        await exportScene(scene, {
          seconds: 3, fps: 30, width: 640, height: 360, format, out, baseUrl,
          onProgress: (done, total) => {
            assert.equal(total, 90);
            lastDone = done;
          },
        });
        assert.equal(lastDone, 90);
        const info = await stat(out);
        assert.ok(info.size > 1000, 'arquivo de saída vazio');
        const p = await probe(out);
        assert.ok(Math.abs(p.duration - 3) < 0.05, `duração ${p.duration} s, esperado ~3 s`);
        assert.equal(p.frames, 90);
        assert.equal(p.width, 640);
        assert.equal(p.height, 360);
        assert.equal(p.codec, format === 'mp4' ? 'h264' : 'vp9');
      });
    }
  } finally {
    server.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test('erro claro quando a página não expõe window.__mapa', async () => {
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<!doctype html><title>x</title><p>sem api</p>');
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const port = (server.address() as { port: number }).port;
  const dir = await mkdtemp(join(tmpdir(), 'map-export-test-'));
  try {
    await assert.rejects(
      exportScene(scene, { seconds: 1, fps: 30, width: 320, height: 180, format: 'mp4', out: join(dir, 'x.mp4'), baseUrl: `http://127.0.0.1:${port}` }),
      (err: unknown) => err instanceof ExportError && /window\.__mapa/.test(err.message) && !/[A-Za-z]:\\|\/Users\//.test(err.message),
    );
  } finally {
    server.close();
    await rm(dir, { recursive: true, force: true });
  }
});
