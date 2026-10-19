import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { GridConfig, Scene } from './scene.ts';
import { normalizeScene } from './normalize.ts';
import { applyField, placeUnit, removeWaypoint, setSubTerritory, setTerritory, setWaypoint } from './ops.ts';

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

/* ---------- colocação de unidades ---------- */

const placeSpec = { type: 'arm' as const, echelon: 'bn' as const, factionId: 'f2', lat: 4.2, lon: 6.8, t: 3 };

test('placeUnit cria a unidade no ponto, da força e no instante pedidos, sem alterar a cena de entrada', () => {
  const s = scene();
  const r = placeUnit(s, placeSpec);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(s.units.length, 1);
  assert.equal(r.scene.units.length, 2);
  const u = r.scene.units.find((x) => x.id === r.unitId);
  assert.equal(u?.faction, 'f2');
  assert.equal(u?.type, 'arm');
  assert.equal(u?.echelon, 'bn');
  assert.deepEqual(u?.path, [{ t: 3, lat: 4.2, lon: 6.8 }]);
});

test('placeUnit dá ids únicos a cada unidade colocada', () => {
  let s = scene();
  const ids = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const r = placeUnit(s, placeSpec);
    assert.ok(r.ok);
    if (!r.ok) return;
    ids.add(r.unitId);
    s = r.scene;
  }
  assert.equal(ids.size, 200);
  assert.equal(new Set(s.units.map((u) => u.id)).size, s.units.length);
  assert.ok(!ids.has('u1'));
});

test('placeUnit rejeita força inexistente e não cria unidade', () => {
  const s = scene();
  const r = placeUnit(s, { ...placeSpec, factionId: 'nao-existe' });
  assert.equal(r.ok, false);
  assert.equal(s.units.length, 1);
});

test('placeUnit sugere nome no padrão "1º Bn Inf" e numera por força, tipo e escalão', () => {
  const r1 = placeUnit(scene(), { ...placeSpec, type: 'inf', echelon: 'bn', factionId: 'f2' });
  assert.ok(r1.ok);
  if (!r1.ok) return;
  assert.equal(r1.scene.units.at(-1)?.name, '1º Bn Inf');
  const r2 = placeUnit(r1.scene, { ...placeSpec, type: 'inf', echelon: 'bn', factionId: 'f2' });
  assert.ok(r2.ok);
  if (r2.ok) assert.equal(r2.scene.units.at(-1)?.name, '2º Bn Inf');
  const r3 = placeUnit(r1.scene, { ...placeSpec, type: 'inf', echelon: 'bn', factionId: 'f1', name: 'Minha' });
  assert.ok(r3.ok);
  if (r3.ok) assert.equal(r3.scene.units.at(-1)?.name, 'Minha');
});

const gridWith = (snap: boolean, snapStep: number): GridConfig => ({
  lonLat: { enabled: false, step: 0 },
  mgrs: { enabled: false },
  custom: { enabled: false, step: 1, unit: 'deg', lat0: 0, lon0: 0 },
  opacity: 0.5,
  snap,
  snapStep,
});

test('placeUnit encaixa no centro da célula mais próxima quando grid.snap está ligado', () => {
  const gridOn = { ...scene(), grid: gridWith(true, 1) };
  // células de 1 grau a partir de (0, 0): centros em x.5
  const r = placeUnit(gridOn, { ...placeSpec, lat: 4.2, lon: 6.8 });
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.scene.units.at(-1)?.path[0], { t: 3, lat: 4.5, lon: 6.5 });
});

test('placeUnit não encaixa quando a grade está desligada ou ausente', () => {
  const off = placeUnit({ ...scene(), grid: gridWith(false, 1) }, { ...placeSpec, lat: 4.2, lon: 6.8 });
  assert.ok(off.ok);
  if (off.ok) assert.deepEqual(off.scene.units.at(-1)?.path[0], { t: 3, lat: 4.2, lon: 6.8 });
  const none = placeUnit(scene(), { ...placeSpec, lat: 4.2, lon: 6.8 });
  assert.ok(none.ok);
  if (none.ok) assert.deepEqual(none.scene.units.at(-1)?.path[0], { t: 3, lat: 4.2, lon: 6.8 });
});
