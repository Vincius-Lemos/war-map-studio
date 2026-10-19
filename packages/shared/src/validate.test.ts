import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateScene } from './validate.ts';
import { extractJSON, importSceneText } from './importJson.ts';
import { normalizeScene } from './normalize.ts';

const good = () => ({
  title: 'Teste',
  startDate: '2026-03-01T06:00',
  durationH: 72,
  mapType: 'country',
  region: { lon0: 19, lat0: 53.4, lon1: 28.2, lat1: 57.6 },
  factions: [
    { id: 'f1', name: 'Verde', color: '#2e7d32', affil: 'hostile' },
    { id: 'f2', name: 'Azul', color: '#1565c0', affil: 'friend' },
  ],
  territories: [{ iso: 'LT', name: 'Lituânia', t: 30, faction: 'f1' }],
  units: [{ id: 'u1', name: '1ª Div.', faction: 'f1', type: 'arm', echelon: 'div', note: '', path: [{ t: 0, lat: 53.9, lon: 27 }] }],
  arrows: [{ id: 'a1', from: { lat: 54, lon: 27.3 }, to: { lat: 55.4, lon: 24.6 }, t0: 18, t1: 30, kind: 'attack', faction: 'f1' }],
  events: [{ id: 'e1', t: 30, lat: 55.7, lon: 24.3, kind: 'attack', text: 'Ponte', dur: 3 }],
});

test('cena válida não gera erros', () => {
  assert.deepEqual(validateScene(good()), []);
});

test('rejeita o que não é objeto', () => {
  assert.deepEqual(validateScene([]), ['O conteúdo precisa ser um objeto { ... }.']);
  assert.deepEqual(validateScene(null), ['O conteúdo precisa ser um objeto { ... }.']);
});

test('aponta força inexistente, cor inválida e tipo inválido com nomes em português', () => {
  const s = good();
  s.factions[0]!.color = 'verde';
  s.units[0]!.faction = 'f9';
  s.units[0]!.type = 'tanque';
  const errs = validateScene(s).join('\n');
  assert.match(errs, /"color" deve ser hex/);
  assert.match(errs, /a força "f9" não existe em factions/);
  assert.match(errs, /tipo "tanque" inválido/);
});

test('exige pelo menos um ponto de trajeto e números nos pontos', () => {
  const s = good();
  s.units[0]!.path = [];
  assert.match(validateScene(s).join('\n'), /"path" precisa de pelo menos um ponto/);
  const s2 = good();
  (s2.units[0]!.path as unknown[])[0] = { t: 'zero', lat: 1, lon: 1 };
  assert.match(validateScene(s2).join('\n'), /ponto 1: t, lat e lon devem ser números/);
});

test('valida território (iso de 2 letras) e região', () => {
  const s = good();
  s.territories[0]!.iso = 'LTU';
  s.region = { lon0: 1, lat0: 1, lon1: 2 } as unknown as typeof s.region;
  const errs = validateScene(s).join('\n');
  assert.match(errs, /"iso" deve ter 2 letras/);
  assert.match(errs, /"region" precisa de lon0, lat0, lon1 e lat1/);
});

test('extractJSON ignora texto e tags em volta', () => {
  const text = '<pasted_content>Aqui está:\n{"title":"X","n":{"a":1}}\nFim.</pasted_content>';
  assert.deepEqual(extractJSON(text), { title: 'X', n: { a: 1 } });
});

test('extractJSON falha sem chaves', () => {
  assert.throws(() => extractJSON('sem objeto aqui'), /não encontrei um objeto/);
});

test('importSceneText devolve a cena normalizada quando válida', () => {
  const raw = { ...good(), arrows: undefined, events: undefined, durationH: undefined };
  const r = importSceneText('texto antes ' + JSON.stringify(raw) + ' texto depois');
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.scene.durationH, 72);
    assert.deepEqual(r.scene.arrows, []);
    assert.equal(r.scene.overlay, null);
  }
});

test('importSceneText traz mensagem de JSON quebrado', () => {
  const r = importSceneText('{ "title": ');
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.errors[0] ?? '', /Não consegui ler o JSON/);
});

test('normalizeScene converte códigos antigos de país (numéricos) do navegador', () => {
  const raw = good();
  (raw.territories[0] as { iso: string }).iso = '440';
  const scene = normalizeScene(raw as Parameters<typeof normalizeScene>[0]);
  assert.equal(scene.territories[0]?.iso, 'LT');
});
