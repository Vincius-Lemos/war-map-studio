import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeScene } from './normalize.ts';
import { defaultVisionKm, enemyUnitsVisible, isPointVisible, unitPosition, unitVisionKm, visibleTo } from './fog.ts';
import type { Unit } from './scene.ts';

const unit = (over: Partial<Unit>): Unit => ({
  id: 'u', name: 'U', faction: 'f1', type: 'inf', echelon: 'bn', note: '', path: [], ...over,
});

const scene = (units: Unit[]) =>
  normalizeScene({
    title: 'T',
    durationH: 10,
    region: { lon0: 0, lat0: 0, lon1: 10, lat1: 10 },
    factions: [
      { id: 'f1', name: 'A', color: '#000000', affil: 'friend' },
      { id: 'f2', name: 'B', color: '#ff0000', affil: 'hostile' },
      { id: 'f3', name: 'C', color: '#00ff00', affil: 'friend' },
    ],
    units,
  });

test('alcance padrão por tipo e override por unidade', () => {
  assert.equal(defaultVisionKm('cav'), 8);
  assert.equal(defaultVisionKm('civ'), 2);
  assert.equal(unitVisionKm(unit({ type: 'art' })), 6);
  assert.equal(unitVisionKm(unit({ type: 'art', visionKm: 20 })), 20);
});

test('unitPosition usa posAt e devolve null antes do primeiro ponto', () => {
  const u = unit({ path: [{ t: 2, lat: 0, lon: 0 }, { t: 4, lat: 2, lon: 2 }] });
  assert.equal(unitPosition(u, 1), null);
  assert.deepEqual(unitPosition(u, 3), { lat: 1, lon: 1 });
});

test('visibleTo devolve só círculos das unidades da força com posição', () => {
  const s = scene([
    unit({ id: 'a', faction: 'f1', visionKm: 10, path: [{ t: 0, lat: 5, lon: 5 }] }),
    unit({ id: 'b', faction: 'f1', path: [{ t: 5, lat: 1, lon: 1 }] }), // ainda não apareceu em t=0
    unit({ id: 'c', faction: 'f2', path: [{ t: 0, lat: 6, lon: 6 }] }),
  ]);
  const circles = visibleTo('f1', s, 0);
  assert.deepEqual(circles, [{ lat: 5, lon: 5, radiusKm: 10 }]);
});

test('isPointVisible respeita o raio em km', () => {
  const circles = [{ lat: 0, lon: 0, radiusKm: 50 }];
  assert.equal(isPointVisible(0.1, 0, circles), true); // ~11 km
  assert.equal(isPointVisible(1, 0, circles), false); // ~111 km
  assert.equal(isPointVisible(0, 0, []), false);
});

test('enemyUnitsVisible: inimigo dentro do alcance aparece, fora não', () => {
  const s = scene([
    unit({ id: 'mine', faction: 'f1', type: 'cav', path: [{ t: 0, lat: 5, lon: 5 }] }), // raio 8 km
    unit({ id: 'near', faction: 'f2', path: [{ t: 0, lat: 5.02, lon: 5 }] }), // ~2 km
    unit({ id: 'far', faction: 'f2', path: [{ t: 0, lat: 7, lon: 5 }] }), // ~222 km
  ]);
  const ids = enemyUnitsVisible(s, 'f1', 0).map((u) => u.id);
  assert.deepEqual(ids, ['near']);
});

test('enemyUnitsVisible: aliados nunca entram no resultado; força hostil é inimiga', () => {
  const s = scene([
    unit({ id: 'mine', faction: 'f1', visionKm: 100, path: [{ t: 0, lat: 5, lon: 5 }] }),
    unit({ id: 'ally', faction: 'f3', path: [{ t: 0, lat: 5, lon: 5.01 }] }), // friend ↔ friend
    unit({ id: 'hostile', faction: 'f2', path: [{ t: 0, lat: 5, lon: 5.02 }] }),
  ]);
  assert.deepEqual(enemyUnitsVisible(s, 'f1', 0).map((u) => u.id), ['hostile']);
});

test('enemyUnitsVisible: sem unidades próprias em posição, nada é visto', () => {
  const s = scene([
    unit({ id: 'mine', faction: 'f1', path: [{ t: 5, lat: 5, lon: 5 }] }),
    unit({ id: 'foe', faction: 'f2', path: [{ t: 0, lat: 5, lon: 5 }] }),
  ]);
  assert.deepEqual(enemyUnitsVisible(s, 'f1', 0), []);
});
