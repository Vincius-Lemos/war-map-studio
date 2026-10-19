import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Config } from '../src/config.js';

/** Cria diretórios temporários com geo, site e armazenamento, e devolve a configuração de teste. */
export function tempConfig(overrides: Partial<Config> = {}): { config: Config; cleanup: () => void } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mapdraw-test-'));
  const geoDir = path.join(root, 'geo');
  const webDist = path.join(root, 'web');
  fs.mkdirSync(path.join(geoDir, 'admin1'), { recursive: true });
  fs.mkdirSync(path.join(webDist, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(geoDir, 'countries.json'), JSON.stringify({ type: 'FeatureCollection', features: [] }));
  fs.writeFileSync(path.join(geoDir, 'admin1', 'USA.json'), JSON.stringify({ type: 'FeatureCollection', features: [] }));
  fs.writeFileSync(path.join(webDist, 'index.html'), '<!doctype html><title>mapa</title>');
  fs.writeFileSync(path.join(webDist, 'assets', 'app-1a2b3c4d.js'), 'console.log(1)');
  fs.writeFileSync(path.join(webDist, 'favicon.txt'), 'x');

  const config: Config = {
    port: 0,
    host: '127.0.0.1',
    basePath: '',
    webDist,
    geoDir,
    scenesDir: path.join(root, 'scenes'),
    exportsDir: path.join(root, 'exports'),
    adminToken: null,
    corsOrigins: [],
    trustProxy: 'loopback',
    bodyLimitBytes: 20 * 1024 * 1024,
    exportMaxPending: 4,
    exportTimeoutMs: 5_000,
    exportRateLimit: 100,
    logLevel: 'silent',
    ...overrides,
  };
  return {
    config,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

/** Cena mínima que passa na validação de forma (stub). */
export function sampleScene(title = 'Teste de cena'): Record<string, unknown> {
  return {
    title,
    startDate: '2022-02-24T00:00',
    durationH: 24,
    year: null,
    mapType: 'free',
    region: { lon0: 30, lat0: 44, lon1: 40, lat1: 52 },
    symbolStyle: 'nato',
    unitSize: 1,
    showLabels: true,
    showTrails: true,
    showAllFlags: true,
    factions: [{ id: 'f1', name: 'Forca', color: '#2e7d32', affil: 'friend' }],
    units: [],
    arrows: [],
    events: [],
    territories: [],
    orgFlags: [],
    overlay: null,
  };
}
