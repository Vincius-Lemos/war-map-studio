import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alignPoints, alignUnitsAt, type Pt } from './align.ts';
import { normalizeScene } from './normalize.ts';

const pts: Pt[] = [
  { id: 'a', lat: 10, lon: 2 },
  { id: 'b', lat: 4, lon: 6 },
  { id: 'c', lat: 7, lon: 12 },
];

const byId = (list: Pt[]) => Object.fromEntries(list.map((p) => [p.id, { lat: p.lat, lon: p.lon }]));

test('esquerda e direita usam a menor e a maior longitude', () => {
  assert.deepEqual(byId(alignPoints(pts, 'left')), {
    a: { lat: 10, lon: 2 }, b: { lat: 4, lon: 2 }, c: { lat: 7, lon: 2 },
  });
  assert.deepEqual(byId(alignPoints(pts, 'right')), {
    a: { lat: 10, lon: 12 }, b: { lat: 4, lon: 12 }, c: { lat: 7, lon: 12 },
  });
});

test('topo e base usam a maior e a menor latitude', () => {
  assert.deepEqual(alignPoints(pts, 'top').map((p) => p.lat), [10, 10, 10]);
  assert.deepEqual(alignPoints(pts, 'bottom').map((p) => p.lat), [4, 4, 4]);
});

test('centros alinham no ponto médio do conjunto e não mudam o outro eixo', () => {
  const h = alignPoints(pts, 'hcenter');
  assert.deepEqual(h.map((p) => p.lon), [7, 7, 7]);
  assert.deepEqual(h.map((p) => p.lat), [10, 4, 7]);
  const v = alignPoints(pts, 'vcenter');
  assert.deepEqual(v.map((p) => p.lat), [7, 7, 7]);
  assert.deepEqual(v.map((p) => p.lon), [2, 6, 12]);
});

test('distribuir horizontalmente mantém os extremos e espaça os demais igualmente', () => {
  const d = alignPoints([
    { id: 'x', lat: 0, lon: 0 },
    { id: 'y', lat: 0, lon: 1 },
    { id: 'z', lat: 0, lon: 10 },
  ], 'dist-h');
  assert.deepEqual(d.map((p) => p.lon), [0, 5, 10]);
  assert.deepEqual(d.map((p) => p.lat), [0, 0, 0]);
});

test('distribuir verticalmente com quatro pontos', () => {
  const d = alignPoints([
    { id: 'p', lat: 0, lon: 0 },
    { id: 'q', lat: 9, lon: 0 },
    { id: 'r', lat: 1, lon: 0 },
    { id: 's', lat: 3, lon: 0 },
  ], 'dist-v');
  // ordem por latitude: p(0), r(1), s(3), q(9) -> extremos fixos, meio em 3 e 6
  assert.deepEqual(d.map((p) => p.lat), [0, 9, 3, 6]);
});

test('distribuir precisa de pelo menos três pontos; com dois, nada muda', () => {
  const two = pts.slice(0, 2);
  assert.deepEqual(alignPoints(two, 'dist-h'), two);
});

test('com menos de dois pontos, devolve cópias iguais', () => {
  assert.deepEqual(alignPoints([pts[0]!], 'left'), [pts[0]]);
});

test('alignUnitsAt alinha pela posição de cada unidade no instante t e grava pontos nesse instante', () => {
  const s = normalizeScene({
    title: 'x',
    region: { lon0: 0, lat0: 0, lon1: 10, lat1: 10 },
    factions: [{ id: 'f1', name: 'A', color: '#111111', affil: 'friend' }],
    units: [
      { id: 'u1', name: '1', faction: 'f1', type: 'inf', echelon: '', note: '', path: [{ t: 0, lat: 1, lon: 1 }] },
      { id: 'u2', name: '2', faction: 'f1', type: 'inf', echelon: '', note: '', path: [{ t: 0, lat: 5, lon: 4 }] },
      { id: 'u3', name: '3', faction: 'f1', type: 'inf', echelon: '', note: '', path: [{ t: 3, lat: 9, lon: 9 }] },
    ],
  });
  const out = alignUnitsAt(s, 1, ['u1', 'u2', 'u3'], 'left');
  // u1 já está na menor longitude: não ganha ponto novo
  assert.deepEqual(out.units[0]?.path, s.units[0]?.path);
  // u2 vai para lon=1 neste instante
  assert.deepEqual(out.units[1]?.path.at(-1), { t: 1, lat: 5, lon: 1 });
  // u3 não tem posição em t=1 e fica de fora
  assert.deepEqual(out.units[2]?.path, s.units[2]?.path);
  assert.equal(s.units[1]?.path.length, 1, 'cena original intacta');
});

test('alignUnitsAt sem mudança devolve a mesma cena', () => {
  const s = normalizeScene({
    title: 'x',
    region: { lon0: 0, lat0: 0, lon1: 10, lat1: 10 },
    factions: [{ id: 'f1', name: 'A', color: '#111111', affil: 'friend' }],
    units: [{ id: 'u1', name: '1', faction: 'f1', type: 'inf', echelon: '', note: '', path: [{ t: 0, lat: 1, lon: 1 }] }],
  });
  assert.equal(alignUnitsAt(s, 0, ['u1'], 'left'), s);
});
