import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp, type BuiltApp } from '../src/app.js';
import { tempConfig, sampleScene } from './helpers.js';

let built: BuiltApp;
let cleanup: () => void;

async function start(adminToken: string | null = null): Promise<void> {
  const t = tempConfig({ adminToken });
  cleanup = t.cleanup;
  built = await buildApp({ config: t.config, logger: false, exporter: null });
}

beforeEach(() => start());
afterEach(async () => {
  await built.app.close();
  cleanup();
});

test('CRUD completo de cena', async () => {
  const created = await built.app.inject({ method: 'POST', url: '/api/scenes', payload: sampleScene('Ataque ao Norte') });
  assert.equal(created.statusCode, 201);
  const rec = JSON.parse(created.body);
  assert.match(rec.id, /^ataque-ao-norte-[a-z0-9]+$/);
  assert.equal(rec.title, 'Ataque ao Norte');

  const list = JSON.parse((await built.app.inject({ method: 'GET', url: '/api/scenes' })).body);
  assert.equal(list.length, 1);
  assert.deepEqual(Object.keys(list[0]).sort(), ['id', 'title', 'updatedAt']);

  const one = await built.app.inject({ method: 'GET', url: `/api/scenes/${rec.id}` });
  assert.equal(one.statusCode, 200);
  assert.equal(JSON.parse(one.body).scene.title, 'Ataque ao Norte');

  const put = await built.app.inject({ method: 'PUT', url: `/api/scenes/${rec.id}`, payload: sampleScene('Novo titulo') });
  assert.equal(put.statusCode, 200);
  assert.equal(JSON.parse(put.body).title, 'Novo titulo');

  const del = await built.app.inject({ method: 'DELETE', url: `/api/scenes/${rec.id}` });
  assert.equal(del.statusCode, 204);
  const gone = await built.app.inject({ method: 'GET', url: `/api/scenes/${rec.id}` });
  assert.equal(gone.statusCode, 404);
});

test('PUT cria cena com id proprio e depois atualiza', async () => {
  const first = await built.app.inject({ method: 'PUT', url: '/api/scenes/minha-cena-1', payload: sampleScene() });
  assert.equal(first.statusCode, 201);
  const second = await built.app.inject({ method: 'PUT', url: '/api/scenes/minha-cena-1', payload: sampleScene('B') });
  assert.equal(second.statusCode, 200);
});

test('rejeita ids invalidos (path traversal e maiusculas)', async () => {
  for (const id of ['..%2Fsecret', 'Maiusculas', 'a.b', '-inicio']) {
    const res = await built.app.inject({ method: 'GET', url: `/api/scenes/${id}` });
    assert.ok([400, 404].includes(res.statusCode), `${id} -> ${res.statusCode}`);
    const put = await built.app.inject({ method: 'PUT', url: `/api/scenes/${id}`, payload: sampleScene() });
    assert.equal(put.statusCode, 400, id);
  }
});

test('PUT com cena invalida retorna 400 com detalhes', async () => {
  const res = await built.app.inject({ method: 'PUT', url: '/api/scenes/x1', payload: { title: 5 } });
  assert.equal(res.statusCode, 400);
  assert.ok(JSON.parse(res.body).details.length > 0);
});

test('corpo acima de 20 MB e recusado', async () => {
  const big = { ...sampleScene(), blob: 'x'.repeat(21 * 1024 * 1024) };
  const res = await built.app.inject({ method: 'PUT', url: '/api/scenes/grande', payload: big });
  assert.equal(res.statusCode, 413);
});

test('escrita exige X-Token quando ADMIN_TOKEN esta definido', async () => {
  await built.app.close();
  cleanup();
  await start('segredo-123');

  const semToken = await built.app.inject({ method: 'PUT', url: '/api/scenes/a1', payload: sampleScene() });
  assert.equal(semToken.statusCode, 401);
  const errado = await built.app.inject({ method: 'PUT', url: '/api/scenes/a1', payload: sampleScene(), headers: { 'x-token': 'errado' } });
  assert.equal(errado.statusCode, 401);
  const certo = await built.app.inject({ method: 'PUT', url: '/api/scenes/a1', payload: sampleScene(), headers: { 'x-token': 'segredo-123' } });
  assert.equal(certo.statusCode, 201);

  // Leitura continua livre.
  const lista = await built.app.inject({ method: 'GET', url: '/api/scenes' });
  assert.equal(lista.statusCode, 200);
  const del = await built.app.inject({ method: 'DELETE', url: '/api/scenes/a1' });
  assert.equal(del.statusCode, 401);
});
