import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Scene } from './scene.ts';
import { normalizeScene } from './normalize.ts';
import { copyRefs, deleteRefs, existingRefs, moveRefs, pasteClip, wrapLon } from './batch.ts';

const scene = (): Scene =>
  normalizeScene({
    title: 'Cena',
    region: { lon0: 0, lat0: 0, lon1: 10, lat1: 10 },
    factions: [{ id: 'f1', name: 'A', color: '#111111', affil: 'hostile' }],
    units: [
      { id: 'u1', name: 'U1', faction: 'f1', type: 'inf', echelon: '', note: '', path: [{ t: 0, lat: 1, lon: 1 }, { t: 10, lat: 5, lon: 5 }] },
      { id: 'u2', name: 'U2', faction: 'f1', type: 'arm', echelon: '', note: '', path: [{ t: 0, lat: 2, lon: 2 }] },
    ],
    arrows: [{ id: 'a1', from: { lat: 1, lon: 1 }, to: { lat: 2, lon: 2 }, t0: 0, t1: 4, kind: 'attack', faction: 'f1' }],
    events: [{ id: 'e1', t: 1, lat: 3, lon: 3, kind: 'attack', text: 'x', dur: 2 }],
  });

test('deleteRefs apaga só os objetos citados, nos três tipos', () => {
  const s = scene();
  const n = deleteRefs(s, [
    { kind: 'unit', id: 'u1' },
    { kind: 'arrow', id: 'a1' },
  ]);
  assert.deepEqual(n.units.map((u) => u.id), ['u2']);
  assert.equal(n.arrows.length, 0);
  assert.equal(n.events.length, 1);
  assert.equal(s.units.length, 2, 'entrada não alterada');
});

test('existingRefs descarta referências a objetos que sumiram', () => {
  const n = deleteRefs(scene(), [{ kind: 'unit', id: 'u1' }]);
  const refs = existingRefs(n, [
    { kind: 'unit', id: 'u1' },
    { kind: 'unit', id: 'u2' },
    { kind: 'unit', id: 'u2' },
  ]);
  assert.deepEqual(refs, [{ kind: 'unit', id: 'u2' }]);
});

test('moveRefs desloca a unidade no instante t (grava ponto neste instante) e não mexe nas demais', () => {
  const s = scene();
  const n = moveRefs(s, [{ kind: 'unit', id: 'u2' }], 0, 1, -2);
  const u2 = n.units.find((u) => u.id === 'u2');
  assert.deepEqual(u2?.path, [{ t: 0, lat: 3, lon: 0 }]);
  assert.deepEqual(n.units.find((u) => u.id === 'u1'), s.units.find((u) => u.id === 'u1'));
});

test('moveRefs não move unidade sem posição no instante; desloca seta e evento inteiros', () => {
  const s = scene();
  const n = moveRefs(
    s,
    [
      { kind: 'unit', id: 'u1' }, // começa em t=0, então em t=-5 não tem posição
      { kind: 'arrow', id: 'a1' },
      { kind: 'event', id: 'e1' },
    ],
    -5,
    2,
    2,
  );
  assert.deepEqual(n.units.find((u) => u.id === 'u1')?.path, s.units[0]?.path);
  assert.deepEqual(n.arrows[0]?.from, { lat: 3, lon: 3 });
  assert.deepEqual(n.arrows[0]?.to, { lat: 4, lon: 4 });
  assert.equal(n.arrows[0]?.t0, 0, 'tempo da seta não muda');
  assert.deepEqual({ lat: n.events[0]?.lat, lon: n.events[0]?.lon }, { lat: 5, lon: 5 });
});

test('copiar e colar cria objetos novos com deslocamento, sem alterar os originais', () => {
  const s = scene();
  const clip = copyRefs(s, [
    { kind: 'unit', id: 'u1' },
    { kind: 'arrow', id: 'a1' },
  ]);
  clip.units[0]?.path.push({ t: 99, lat: 0, lon: 0 }); // a cópia é independente
  assert.equal(s.units[0]?.path.length, 2);
  let k = 0;
  const { scene: n, refs } = pasteClip(s, clip, 1, 1, () => `new${++k}`);
  assert.equal(n.units.length, 3);
  assert.equal(n.arrows.length, 2);
  assert.deepEqual(refs, [
    { kind: 'unit', id: 'new1' },
    { kind: 'arrow', id: 'new2' },
  ]);
  const pasted = n.units.find((u) => u.id === 'new1');
  assert.deepEqual(pasted?.path[0], { t: 0, lat: 2, lon: 2 });
  assert.equal(pasted?.name, 'U1');
  assert.deepEqual(n.arrows.find((a) => a.id === 'new2')?.from, { lat: 2, lon: 2 });
});

test('pasteClip é o mesmo que duplicar: os originais permanecem', () => {
  const s = scene();
  let k = 0;
  const { scene: n } = pasteClip(s, copyRefs(s, [{ kind: 'event', id: 'e1' }]), 0, 0, () => `d${++k}`);
  assert.equal(n.events.length, 2);
  assert.equal(n.events[0]?.id, 'e1');
});

test('coordenadas deslocadas para fora do mundo são limitadas (latitude) e dão a volta (longitude)', () => {
  const s = scene();
  const { scene: n } = pasteClip(s, copyRefs(s, [{ kind: 'event', id: 'e1' }]), 200, 200, () => 'z');
  const e = n.events.find((x) => x.id === 'z');
  assert.equal(e?.lat, 90);
  assert.equal(e?.lon, wrapLon(203));
  assert.equal(wrapLon(181), -179);
  assert.equal(wrapLon(-181), 179);
});
