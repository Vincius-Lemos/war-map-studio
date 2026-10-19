import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Scene } from './scene.ts';
import { normalizeScene } from './normalize.ts';
import { applyField, removeWaypoint, setSubTerritory, setTerritory, setWaypoint } from './ops.ts';

const scene = (): Scene =>
  normalizeScene({
    title: 'Cena',
    region: { lon0: 0, lat0: 0, lon1: 10, lat1: 10 },
    factions: [
      { id: 'f1', name: 'A', color: '#111111', affil: 'hostile', flag: 'RU' },
      { id: 'f2', name: 'B', color: '#222222', affil: 'friend' },
    ],
    units: [{ id: 'u1', name: 'U', faction: 'f1', type: 'inf', echelon: '', note: '', path: [{ t: 0, lat: 1, lon: 1 }] }],
  });

test('setWaypoint cria o ponto no instante e não altera a cena original', () => {
  const s = scene();
  const n = setWaypoint(s, 'u1', 5, 2, 3);
  assert.equal(s.units[0]?.path.length, 1);
  assert.deepEqual(n.units[0]?.path.at(-1), { t: 5, lat: 2, lon: 3 });
});

test('setWaypoint substitui o ponto do mesmo instante e mantém a ordem', () => {
  let s = setWaypoint(scene(), 'u1', 9, 9, 9);
  s = setWaypoint(s, 'u1', 4, 4, 4);
  s = setWaypoint(s, 'u1', 9, 7, 7);
  assert.deepEqual(s.units[0]?.path.map((p) => p.t), [0, 4, 9]);
  assert.deepEqual(s.units[0]?.path[2], { t: 9, lat: 7, lon: 7 });
});

test('removeWaypoint tira um ponto pelo índice', () => {
  const s = removeWaypoint(setWaypoint(scene(), 'u1', 5, 2, 3), 'u1', 0);
  assert.deepEqual(s.units[0]?.path.map((p) => p.t), [5]);
});

test('setTerritory copia a bandeira do país da força e troca só o registro do mesmo instante', () => {
  let s = setTerritory(scene(), { t: 3, iso: 'LT', name: 'Lituânia', faction: 'f1' });
  assert.equal(s.territories[0]?.fcode, 'RU');
  s = setTerritory(s, { t: 3, iso: 'LT', name: 'Lituânia', faction: 'f2' });
  assert.equal(s.territories.length, 1);
  assert.equal(s.territories[0]?.faction, 'f2');
  assert.equal(s.territories[0]?.fcode, undefined);
});

test('setSubTerritory mantém regiões separadas de países e monta o nome', () => {
  let s = setTerritory(scene(), { t: 0, iso: 'UA', name: 'Ucrânia', faction: 'f2' });
  s = setSubTerritory(s, { t: 0, iso: 'UA', sub: 'UA-1', countryName: 'Ucrânia', regionName: 'Kiev', faction: 'f1', flag: 'org1' });
  assert.equal(s.territories.length, 2);
  const sub = s.territories.find((t) => t.sub === 'UA-1');
  assert.equal(sub?.name, 'Kiev (Ucrânia)');
  assert.equal(sub?.flag, 'org1');
});

test('applyField converte números e rejeita valor inválido', () => {
  const bad = applyField(scene(), { kind: 'scene', field: 'durationH' }, 'abc');
  assert.equal(bad.ok, false);
  const ok = applyField(scene(), { kind: 'scene', field: 'durationH' }, '5000');
  assert.ok(ok.ok);
  if (ok.ok) assert.equal(ok.scene.durationH, 2000);
});

test('applyField altera campos aninhados (região e seta)', () => {
  const r = applyField(scene(), { kind: 'scene', field: 'region.lon0' }, '-3.5');
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.scene.region.lon0, -3.5);
});

test('applyField limpa a bandeira de uma força quando o valor é vazio', () => {
  const r = applyField(scene(), { kind: 'fac', id: 'f1', field: 'flag' }, '');
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.scene.factions[0]?.flag, undefined);
});

test('applyField ordena o trajeto depois de mudar o horário de um ponto', () => {
  let s = setWaypoint(scene(), 'u1', 8, 2, 2);
  const r = applyField(s, { kind: 'wp', id: 'u1', index: 1, field: 't' }, '-1');
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.scene.units[0]?.path.map((p) => p.t), [-1, 0]);
});
