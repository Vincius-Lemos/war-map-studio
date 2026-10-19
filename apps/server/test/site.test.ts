import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp, type BuiltApp } from '../src/app.js';
import { tempConfig } from './helpers.js';

const cleanups: Array<() => void> = [];
const apps: BuiltApp[] = [];
after(async () => {
  for (const a of apps) await a.app.close();
  for (const c of cleanups) c();
});

async function make(extra: Parameters<typeof tempConfig>[0] = {}): Promise<BuiltApp> {
  const t = tempConfig(extra);
  cleanups.push(t.cleanup);
  const built = await buildApp({ config: t.config, logger: false, exporter: null });
  apps.push(built);
  return built;
}

test('index.html sem cache e assets com hash com cache imutavel', async () => {
  const b = await make();
  const html = await b.app.inject({ method: 'GET', url: '/' });
  assert.equal(html.statusCode, 200);
  assert.match(String(html.headers['content-type']), /text\/html/);
  assert.equal(html.headers['cache-control'], 'no-cache');

  const asset = await b.app.inject({ method: 'GET', url: '/assets/app-1a2b3c4d.js' });
  assert.equal(asset.statusCode, 200);
  assert.match(String(asset.headers['cache-control']), /immutable/);
  assert.match(String(asset.headers['cache-control']), /max-age=31536000/);
});

test('asset inexistente retorna 404 JSON, nao o index', async () => {
  const b = await make();
  const res = await b.app.inject({ method: 'GET', url: '/assets/nao-existe.js' });
  assert.equal(res.statusCode, 404);
  assert.match(String(res.headers['content-type']), /application\/json/);
});

test('rota desconhecida do site cai no index (SPA) e /api desconhecido vira 404 JSON', async () => {
  const b = await make();
  const spa = await b.app.inject({ method: 'GET', url: '/cena/abc' });
  assert.equal(spa.statusCode, 200);
  assert.match(spa.body, /<title>mapa<\/title>/);
  const api = await b.app.inject({ method: 'GET', url: '/api/nao-existe' });
  assert.equal(api.statusCode, 404);
  assert.match(String(api.headers['content-type']), /application\/json/);
});

test('cabecalhos de seguranca presentes', async () => {
  const b = await make();
  const res = await b.app.inject({ method: 'GET', url: '/api/health' });
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.equal(res.headers['x-frame-options'], 'SAMEORIGIN');
  assert.ok(res.headers['referrer-policy']);
  assert.equal(res.headers['x-powered-by'], undefined);
});

test('CORS: origem estrangeira nao recebe cabecalho; mesmo host e CORS_ORIGIN recebem', async () => {
  const b = await make({ corsOrigins: ['https://amigo.example'] });
  const foreign = await b.app.inject({ method: 'GET', url: '/api/health', headers: { origin: 'https://evil.example', host: 'mapa.example' } });
  assert.equal(foreign.headers['access-control-allow-origin'], undefined);

  const own = await b.app.inject({ method: 'GET', url: '/api/health', headers: { origin: 'https://mapa.example', host: 'mapa.example' } });
  assert.equal(own.headers['access-control-allow-origin'], 'https://mapa.example');

  const listed = await b.app.inject({ method: 'GET', url: '/api/health', headers: { origin: 'https://amigo.example', host: 'mapa.example' } });
  assert.equal(listed.headers['access-control-allow-origin'], 'https://amigo.example');

  const pre = await b.app.inject({ method: 'OPTIONS', url: '/api/scenes', headers: { origin: 'https://mapa.example', host: 'mapa.example' } });
  assert.equal(pre.statusCode, 204);
  assert.match(String(pre.headers['access-control-allow-headers']), /X-Token/);
});

test('BASE_PATH: tudo sob o prefixo, sem duplicar na raiz', async () => {
  const b = await make({ basePath: '/mapas' });
  assert.equal((await b.app.inject({ method: 'GET', url: '/mapas/api/health' })).statusCode, 200);
  assert.equal((await b.app.inject({ method: 'GET', url: '/api/health' })).statusCode, 404);
  const home = await b.app.inject({ method: 'GET', url: '/mapas/' });
  assert.equal(home.statusCode, 200);
  assert.match(home.body, /<title>mapa<\/title>/);
  const redirect = await b.app.inject({ method: 'GET', url: '/mapas' });
  assert.equal(redirect.statusCode, 302);
  assert.equal(redirect.headers.location, '/mapas/');
});

test('sem site compilado, a raiz responde 404 JSON', async () => {
  const b = await make({ webDist: '/nao/existe/dist' });
  const res = await b.app.inject({ method: 'GET', url: '/' });
  assert.equal(res.statusCode, 404);
  assert.match(String(res.headers['content-type']), /application\/json/);
});
