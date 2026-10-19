import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { GridConfig, Scene } from './scene.ts';
import { normalizeScene } from './normalize.ts';
import { snapToGrid } from './ops.ts';
import {
  defaultGrid,
  formatDeg,
  graticuleStep,
  lonLatToUtm,
  normalizeGrid,
  squareIdUtm,
  utmCentralMeridian,
  utmToLonLat,
  utmZone,
} from './grid.ts';

test('cena antiga (sem grid) continua sem grade', () => {
  const s = normalizeScene({ title: 'Antiga', region: { lon0: 0, lat0: 0, lon1: 5, lat1: 5 } });
  assert.equal(s.grid, undefined);
});

test('grade padrão: tudo desligado', () => {
  const g = defaultGrid();
  assert.equal(g.lonLat.enabled, false);
  assert.equal(g.mgrs.enabled, false);
  assert.equal(g.custom.enabled, false);
  assert.equal(g.snap, false);
});

test('normalizeGrid completa campos ausentes e limita valores', () => {
  const g = normalizeGrid({ opacity: 9, snapStep: -3, custom: { unit: 'x' } } as unknown as Partial<GridConfig>);
  assert.equal(g.opacity, 1);
  assert.ok(g.snapStep > 0);
  assert.equal(g.custom.unit, 'km');
  assert.equal(g.lonLat.enabled, false);
  assert.equal(normalizeGrid(undefined).mgrs.enabled, false);
});

test('normalizeScene preserva e normaliza a grade', () => {
  const s = normalizeScene({
    title: 'Nova',
    region: { lon0: 0, lat0: 0, lon1: 5, lat1: 5 },
    grid: { ...defaultGrid(), lonLat: { enabled: true, step: 1 }, opacity: 0.3 },
  } as Partial<Scene>);
  assert.equal(s.grid?.lonLat.enabled, true);
  assert.equal(s.grid?.lonLat.step, 1);
  assert.equal(s.grid?.opacity, 0.3);
});

test('passo automático da graticule acompanha a largura visível', () => {
  assert.equal(graticuleStep(360), 45);
  assert.equal(graticuleStep(20), 5);
  assert.equal(graticuleStep(1), 0.25);
  assert.equal(graticuleStep(0.5), 0.1);
});

test('rótulos de grau', () => {
  assert.equal(formatDeg(10, 'lat'), '10°N');
  assert.equal(formatDeg(-33.5, 'lat'), '33,5°S');
  assert.equal(formatDeg(-7, 'lon'), '7°W');
  assert.equal(formatDeg(0, 'lon'), '0°');
  assert.equal(formatDeg(12.25, 'lon'), '12,25°E');
});

test('zona UTM e meridiano central', () => {
  assert.equal(utmZone(-180), 1);
  assert.equal(utmZone(3), 31);
  assert.equal(utmCentralMeridian(31), 3);
});

test('UTM: meridiano central dá easting 500 km e ida e volta preserva o ponto', () => {
  const c = lonLatToUtm(45, 3, 31);
  assert.ok(Math.abs(c.e - 500000) < 1e-3);
  const samples: Array<[number, number]> = [[48.8566, 2.3522], [-23.55, -46.63], [60.5, 15.2], [-40, 170]];
  for (const [lat, lon] of samples) {
    const zone = utmZone(lon);
    const u = lonLatToUtm(lat, lon, zone);
    const back = utmToLonLat(u.e, u.n, zone);
    assert.ok(Math.abs(back.lat - lat) < 1e-6, `lat ${lat}`);
    assert.ok(Math.abs(back.lon - lon) < 1e-6, `lon ${lon}`);
  }
});

test('UTM: hemisfério sul tem northing negativo (sem falso norte)', () => {
  const u = lonLatToUtm(-10, 3, 31);
  assert.ok(u.n < 0);
});

test('letras do quadrado de 100 km: dentro das listas do esquema', () => {
  const id = squareIdUtm(31, 500000, 5000000);
  assert.equal(id.length, 2);
  assert.ok('ABCDEFGHJKLMNPQRSTUV'.includes(id[1] ?? ''));
  assert.ok('ABCDEFGHJKLMNPQRSTUVWXYZ'.includes(id[0] ?? ''));
});

test('encaixe: centro da célula de snapStep, só com snap ligado', () => {
  const on = { grid: { ...defaultGrid(), snap: true, snapStep: 0.5 } } as unknown as Scene;
  const p = snapToGrid(on, 10.3, 20.9);
  assert.equal(p.lat, 10.25);
  assert.equal(p.lon, 20.75);
  const off = { grid: { ...defaultGrid(), snap: false, snapStep: 0.5 } } as unknown as Scene;
  assert.deepEqual(snapToGrid(off, 10.3, 20.9), { lat: 10.3, lon: 20.9 });
  assert.deepEqual(snapToGrid({} as Scene, 1, 2), { lat: 1, lon: 2 });
});
