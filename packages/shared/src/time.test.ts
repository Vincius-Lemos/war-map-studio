import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Scene } from './scene.ts';
import { clockParts, fmtHours, hhmm, keyframes, nextKeyframe, posAt, prevKeyframe, tickStep, controlAt, subControlAt } from './time.ts';
import { histYearFor } from './history.ts';
import { normalizeScene } from './normalize.ts';

const base = (over: Partial<Scene> = {}): Scene =>
  normalizeScene({
    title: 'T',
    startDate: '',
    durationH: 72,
    region: { lon0: 0, lat0: 0, lon1: 10, lat1: 10 },
    factions: [{ id: 'f1', name: 'A', color: '#000000', affil: 'friend' }],
    units: [
      { id: 'u1', name: 'U', faction: 'f1', type: 'inf', echelon: 'bn', note: '', path: [{ t: 6, lat: 1, lon: 1 }, { t: 0, lat: 0, lon: 0 }] },
    ],
    arrows: [{ id: 'a1', from: { lat: 0, lon: 0 }, to: { lat: 1, lon: 1 }, t0: 5, t1: 9, kind: 'attack', faction: 'f1' }],
    events: [{ id: 'e1', t: 12, lat: 2, lon: 2, kind: 'note', text: '', dur: 1 }],
    territories: [{ iso: 'LT', name: 'Lituânia', t: 20, faction: 'f1' }],
    ...over,
  });

test('fmtHours e hhmm formatam horas fracionárias', () => {
  assert.equal(fmtHours(3), '3h');
  assert.equal(fmtHours(3.5), '3h30');
  assert.equal(hhmm(1.5), '01:30');
  assert.equal(hhmm(0), '00:00');
});

test('clockParts sem data usa horas corridas até 48 h e "Dia N" depois', () => {
  const short = clockParts({ startDate: '', durationH: 30 }, 5.5);
  assert.equal(short.main, '+5h30');
  assert.equal(short.sub, 'horas desde o início');
  const long = clockParts({ startDate: '', durationH: 100 }, 49.25);
  assert.equal(long.main, 'Dia 3 · 01:15');
});

test('clockParts com data mostra ano e o deslocamento', () => {
  const c = clockParts({ startDate: '2026-03-01T06:00', durationH: 72 }, 2);
  assert.match(c.sub, /^2026 · \+2h desde o início$/);
  assert.match(c.main, /\d{2}\/\d{2}/);
});

test('keyframes inclui início, fim, trajetos, eventos, setas e territórios, sem repetir', () => {
  const k = keyframes(base());
  assert.deepEqual(k, [0, 5, 6, 9, 12, 20, 72]);
});

test('nextKeyframe e prevKeyframe andam pelos instantes-chave', () => {
  const s = base();
  assert.equal(nextKeyframe(s, 0), 5);
  assert.equal(nextKeyframe(s, 72), undefined);
  assert.equal(prevKeyframe(s, 6), 5);
  assert.equal(prevKeyframe(s, 0), undefined);
});

test('posAt interpola, retorna null antes do primeiro ponto e fixa o último', () => {
  const path = [{ t: 0, lat: 0, lon: 0 }, { t: 10, lat: 10, lon: 10 }];
  assert.equal(posAt([], 1), null);
  assert.equal(posAt(path, -1), null);
  const mid = posAt(path, 5);
  assert.ok(mid);
  assert.ok(Math.abs(mid.lat - 5) < 1e-9);
  assert.deepEqual(posAt(path, 99), { lat: 10, lon: 10 });
});

test('controlAt vale o registro mais recente até t e ignora regiões', () => {
  const ts = [
    { iso: 'LT', name: 'L', t: 0, faction: 'a' },
    { iso: 'LT', name: 'L', t: 10, faction: 'b' },
    { iso: 'PL', name: 'P', t: 0, faction: 'a', sub: 'x' },
  ];
  assert.equal(controlAt(ts, 5).get('LT')?.faction, 'a');
  assert.equal(controlAt(ts, 10).get('LT')?.faction, 'b');
  assert.equal(controlAt(ts, 10).has('PL'), false);
  assert.equal(subControlAt(ts, 10).get('x')?.faction, 'a');
});

test('tickStep escolhe passo com no máximo 14 marcas', () => {
  assert.equal(tickStep(12), 1);
  assert.equal(tickStep(72), 6);
  assert.equal(tickStep(1000), 72);
  assert.equal(tickStep(5000), 168);
});

test('histYearFor usa o instantâneo anterior mais próximo', () => {
  assert.equal(histYearFor(1835), 1815);
  assert.equal(histYearFor(1945), 1945);
  assert.equal(histYearFor(2024), 2010);
});
