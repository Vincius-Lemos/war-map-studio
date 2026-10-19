import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cellCenter,
  cellOf,
  defaultSpeedKmh,
  etaHours,
  hexDistance,
  MAX_REACH_CELLS,
  neighbors,
  reachableCells,
  shortestPath,
  unitSpeedKmh,
} from './movement.ts';

const ORIGIN = { lat: 40, lon: 10 };

test('vizinhos: 6 células distintas, todas a distância 1', () => {
  const ns = neighbors(0, 0);
  assert.equal(ns.length, 6);
  const keys = new Set(ns.map((n) => `${n.q},${n.r}`));
  assert.equal(keys.size, 6);
  for (const n of ns) assert.equal(hexDistance({ q: 0, r: 0 }, n), 1);
});

test('centro e célula são consistentes (ida e volta)', () => {
  for (const [q, r] of [[0, 0], [3, -2], [-5, 4]] as const) {
    const c = cellCenter(q, r, 5);
    assert.deepEqual(cellOf(c.lat, c.lon, 5), { q, r });
  }
});

test('velocidade padrão e da unidade', () => {
  assert.equal(defaultSpeedKmh('mech'), 25);
  assert.equal(unitSpeedKmh({ type: 'art' }), 10);
  assert.equal(unitSpeedKmh({ type: 'art', speedKmh: 14 }), 14);
  assert.equal(unitSpeedKmh({ type: 'inf', speedKmh: Number.NaN }), 4);
});

test('alcance com 0 horas = só a célula inicial', () => {
  const cells = reachableCells(ORIGIN, 0, 5, 25);
  assert.equal(cells.length, 1);
  assert.equal(cells[0]?.costKm, 0);
});

test('alcance de 2 passos = hexágono de raio 2 (19 células)', () => {
  const cells = reachableCells(ORIGIN, 1, 5, 10); // 10 km, passo de 5 km
  assert.equal(cells.length, 19);
  assert.equal(Math.max(...cells.map((c) => c.costKm)), 10);
});

test('alcance é limitado a MAX_REACH_CELLS', () => {
  const cells = reachableCells(ORIGIN, 1000, 1, 1000);
  assert.equal(cells.length, MAX_REACH_CELLS);
});

test('A* de uma célula até a vizinha: 2 pontos', () => {
  const from = cellCenter(0, 0, 5);
  const to = cellCenter(1, 0, 5);
  const route = shortestPath(from, to, 5);
  assert.equal(route.cells.length, 2);
  assert.ok(Math.abs(route.lengthKm - 5) < 0.05);
});

test('A* na mesma célula devolve só o destino', () => {
  const from = { lat: 40, lon: 10 };
  const to = { lat: 40.0001, lon: 10.0001 };
  const route = shortestPath(from, to, 5);
  assert.equal(route.cells.length, 1);
  assert.deepEqual(route.cells[0], to);
});

test('A* até uma célula a 3 passos: 4 pontos (origem + 2 intermediários + destino)', () => {
  const from = cellCenter(0, 0, 5);
  const to = cellCenter(3, -1, 5); // distância hex 3
  const route = shortestPath(from, to, 5);
  assert.equal(route.cells.length, 4);
});

test('ETA: 100 km a 25 km/h = 4 h; velocidade zero = infinito', () => {
  assert.equal(etaHours(100, 25), 4);
  assert.equal(etaHours(10, 0), Infinity);
});
