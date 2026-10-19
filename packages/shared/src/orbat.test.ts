import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Scene, Unit } from './scene.ts';
import { normalizeScene } from './normalize.ts';
import { buildOrbatTree, countByFaction, setParent, subtreeIds } from './orbat.ts';

const unit = (id: string, faction: string, parentId?: string, name = id): Unit => ({
  id,
  name,
  faction,
  type: 'inf',
  echelon: '',
  note: '',
  path: [],
  ...(parentId !== undefined ? { parentId } : {}),
});

const scene = (units: Unit[]): Scene =>
  normalizeScene({
    title: 'Cena',
    region: { lon0: 0, lat0: 0, lon1: 10, lat1: 10 },
    factions: [
      { id: 'f1', name: 'A', color: '#111111', affil: 'hostile' },
      { id: 'f2', name: 'B', color: '#222222', affil: 'friend' },
    ],
    units,
  });

test('setParent recusa criar ciclo (incluindo a própria unidade)', () => {
  const s = scene([unit('a', 'f1'), unit('b', 'f1', 'a'), unit('c', 'f1', 'b')]);
  const cycle = setParent(s, 'a', 'c');
  assert.equal(cycle.ok, false);
  if (!cycle.ok) assert.match(cycle.error, /ciclo/);
  const self = setParent(s, 'a', 'a');
  assert.equal(self.ok, false);
});

test('setParent recusa superior de outra força e não altera a cena', () => {
  const s = scene([unit('a', 'f1'), unit('x', 'f2')]);
  const res = setParent(s, 'a', 'x');
  assert.equal(res.ok, false);
  if (!res.ok) assert.match(res.error, /outra força/);
  assert.equal(s.units[0]?.parentId, undefined);
});

test('setParent subordina e devolve cena nova; null tira da hierarquia', () => {
  const s = scene([unit('a', 'f1'), unit('b', 'f1')]);
  const linked = setParent(s, 'b', 'a');
  assert.equal(linked.ok, true);
  if (!linked.ok) return;
  assert.equal(linked.scene.units[1]?.parentId, 'a');
  assert.equal(s.units[1]?.parentId, undefined);
  const root = setParent(linked.scene, 'b', null);
  assert.equal(root.ok, true);
  if (root.ok) assert.equal('parentId' in (root.scene.units[1] ?? {}), false);
});

test('subtreeIds devolve a unidade e todos os descendentes', () => {
  const units = [unit('a', 'f1'), unit('b', 'f1', 'a'), unit('c', 'f1', 'b'), unit('d', 'f1', 'a'), unit('e', 'f1')];
  assert.deepEqual([...subtreeIds(units, 'a')].sort(), ['a', 'b', 'c', 'd']);
  assert.deepEqual(subtreeIds(units, 'c'), ['c']);
  assert.deepEqual(subtreeIds(units, 'nao-existe'), []);
});

test('buildOrbatTree trata pai inexistente como raiz e ordena por nome', () => {
  const units = [
    unit('z', 'f1', undefined, 'Zulu'),
    unit('p', 'f1', 'fantasma', 'Pedro'),
    unit('a', 'f1', 'z', 'Alfa'),
  ];
  const tree = buildOrbatTree(units);
  assert.deepEqual(tree.map((n) => n.unit.id), ['p', 'z']);
  assert.deepEqual(tree[1]?.children.map((n) => n.unit.id), ['a']);
});

test('buildOrbatTree quebra ciclo tratando uma unidade como raiz', () => {
  const units = [unit('a', 'f1', 'b', 'Alfa'), unit('b', 'f1', 'a', 'Bravo')];
  const tree = buildOrbatTree(units);
  const total = (nodes: typeof tree): number => nodes.reduce((n, x) => n + 1 + total(x.children), 0);
  assert.equal(total(tree), 2);
  assert.equal(tree.length, 1);
});

test('countByFaction conta unidades por força', () => {
  const units = [unit('a', 'f1'), unit('b', 'f1'), unit('c', 'f2')];
  assert.deepEqual(countByFaction(units), { f1: 2, f2: 1 });
});
