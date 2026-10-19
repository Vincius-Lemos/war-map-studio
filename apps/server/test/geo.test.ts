import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { buildApp } from '../src/app.js';
import { tempConfig } from './helpers.js';

const { config, cleanup } = tempConfig();
const built = await buildApp({ config, logger: false, exporter: null });
after(async () => {
  await built.app.close();
  cleanup();
});

test('countries.json com cache longo e gzip quando aceito', async () => {
  const res = await built.app.inject({ method: 'GET', url: '/api/geo/countries.json', headers: { 'accept-encoding': 'gzip' } });
  assert.equal(res.statusCode, 200);
  assert.match(String(res.headers['content-type']), /application\/json/);
  assert.match(String(res.headers['cache-control']), /max-age=\d{6,}/);
  assert.equal(res.headers['content-encoding'], 'gzip');
  const body = JSON.parse(zlib.gunzipSync(res.rawPayload).toString('utf8'));
  assert.equal(body.type, 'FeatureCollection');
});

test('countries.json responde 304 com ETag', async () => {
  const first = await built.app.inject({ method: 'GET', url: '/api/geo/countries.json' });
  const etag = String(first.headers.etag);
  assert.ok(etag.length > 0);
  const second = await built.app.inject({ method: 'GET', url: '/api/geo/countries.json', headers: { 'if-none-match': etag } });
  assert.equal(second.statusCode, 304);
});

test('admin1 existente retorna JSON', async () => {
  const res = await built.app.inject({ method: 'GET', url: '/api/geo/admin1/USA.json' });
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).type, 'FeatureCollection');
});

test('admin1 inexistente retorna 404 JSON sem caminhos do sistema', async () => {
  const res = await built.app.inject({ method: 'GET', url: '/api/geo/admin1/BRA.json' });
  assert.equal(res.statusCode, 404);
  assert.equal(typeof JSON.parse(res.body).error, 'string');
  assert.ok(!res.body.includes(config.geoDir));
});

test('admin1 com iso3 invalido retorna 404', async () => {
  for (const iso of ['usa', 'US', 'U5A', 'USAA', '..%2F..%2Fpackage']) {
    const res = await built.app.inject({ method: 'GET', url: `/api/geo/admin1/${iso}.json` });
    assert.equal(res.statusCode, 404, iso);
  }
});

test('countries.json ausente retorna 404 JSON', async () => {
  const other = tempConfig({ geoDir: config.geoDir + '-vazio' });
  const app2 = await buildApp({ config: other.config, logger: false, exporter: null });
  try {
    const res = await app2.app.inject({ method: 'GET', url: '/api/geo/countries.json' });
    assert.equal(res.statusCode, 404);
    assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');
  } finally {
    await app2.app.close();
    other.cleanup();
  }
});
