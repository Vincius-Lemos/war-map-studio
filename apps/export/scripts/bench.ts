/* Mede o fps real de captura+codificação.
   Uso: npx tsx scripts/bench.ts [--seconds 60] [--format mp4|webm] [--base http://127.0.0.1:8787] [--scene cena.json]
   Sem --base, usa a página mock de teste (não representa o custo de renderizar 260 países). */
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { exportScene, type VideoFormat } from '../src/index.js';
import type { Scene } from '../../../packages/shared/src/scene.js';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (k: string, d: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };

const seconds = Number(arg('seconds', '60'));
const format = arg('format', 'mp4') as VideoFormat;
const sceneFile = arg('scene', '');

const scene: Scene = sceneFile
  ? (JSON.parse(readFileSync(sceneFile, 'utf8')) as Scene)
  : ({ title: 'bench', startDate: '', durationH: 48, year: null, mapType: 'country',
      region: { lon0: -10, lat0: 35, lon1: 40, lat1: 60 }, symbolStyle: 'nato', unitSize: 1,
      showLabels: true, showTrails: true, showAllFlags: false, factions: [], units: [], arrows: [],
      events: [], territories: [], orgFlags: [], overlay: null } as Scene);

let baseUrl = arg('base', '');
let server: ReturnType<typeof createServer> | undefined;
if (!baseUrl) {
  const html = await readFile(join(here, '..', 'test', 'fixtures', 'mock-app.html'), 'utf8');
  server = createServer((_req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(html); });
  await new Promise<void>((r) => server!.listen(0, '127.0.0.1', () => r()));
  baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}

const out = join(tmpdir(), `map-bench-${Date.now()}.${format}`);
const total = seconds * 30;
const t0 = Date.now();
let firstFrameAt = 0;
await exportScene(scene, {
  seconds, fps: 30, width: 1920, height: 1080, format, out, baseUrl,
  onProgress: (done) => { if (done === 1) firstFrameAt = Date.now(); },
});
const elapsed = (Date.now() - t0) / 1000;
const loop = (Date.now() - firstFrameAt) / 1000;
console.log(JSON.stringify({
  format, seconds, frames: total, totalSeconds: +elapsed.toFixed(1),
  fpsOverall: +(total / elapsed).toFixed(2), fpsLoop: +((total - 1) / loop).toFixed(2), out,
}, null, 2));
server?.close();
