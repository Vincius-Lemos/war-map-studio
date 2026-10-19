import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeScene } from './normalize.ts';
import { buildSlides, slideAt } from './presentation.ts';

const scene = (events: { id: string; t: number; lat: number; lon: number; text: string }[], title = 'Cena') =>
  normalizeScene({
    title,
    durationH: 48,
    region: { lon0: 0, lat0: 0, lon1: 10, lat1: 20 },
    events: events.map((e) => ({ kind: 'note' as const, dur: 1, ...e })),
  });

test('buildSlides: um slide por evento, em ordem de t, com zoom e espera padrão', () => {
  const slides = buildSlides(scene([
    { id: 'b', t: 12, lat: 2, lon: 3, text: 'Segundo' },
    { id: 'a', t: 4, lat: 1, lon: 1, text: 'Primeiro' },
  ]));
  assert.equal(slides.length, 2);
  assert.equal(slides[0]?.title, 'Primeiro');
  assert.equal(slides[1]?.title, 'Segundo');
  assert.equal(slides[0]?.t, 4);
  assert.equal(slides[0]?.lat, 1);
  assert.equal(slides[0]?.lon, 1);
  assert.equal(slides[0]?.zoom, 6);
  assert.equal(slides[0]?.holdSec, 6);
});

test('buildSlides: sem eventos, um slide em t=0 com o título da cena', () => {
  const slides = buildSlides(scene([], 'Minha cena'));
  assert.equal(slides.length, 1);
  assert.equal(slides[0]?.t, 0);
  assert.equal(slides[0]?.title, 'Minha cena');
  assert.equal(slides[0]?.lat, 10);
  assert.equal(slides[0]?.lon, 5);
});

test('slideAt: último slide com t <= instante, ou -1', () => {
  const slides = buildSlides(scene([
    { id: 'a', t: 4, lat: 0, lon: 0, text: 'A' },
    { id: 'b', t: 12, lat: 0, lon: 0, text: 'B' },
  ]));
  assert.equal(slideAt(slides, 0), -1);
  assert.equal(slideAt(slides, 4), 0);
  assert.equal(slideAt(slides, 11.9), 0);
  assert.equal(slideAt(slides, 12), 1);
  assert.equal(slideAt(slides, 40), 1);
  assert.equal(slideAt([], 5), -1);
});
