import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  azimuthDeg,
  compassPoint,
  geodesicDistanceKm,
  haversineKm,
  kmToMiles,
  polygonAreaKm2,
  vincentyInverse,
} from './geo-measure.ts';

const PARIS = { lat: 48.8566, lon: 2.3522 };
const LONDON = { lat: 51.5074, lon: -0.1278 };

test('haversine: Paris–Londres ≈ 343 km', () => {
  const d = haversineKm(PARIS, LONDON);
  assert.ok(Math.abs(d - 343) < 1.5, `obtido ${d}`);
});

test('geodésica (Vincenty): Paris–Londres ≈ 343 km e próxima do haversine', () => {
  const d = geodesicDistanceKm(PARIS, LONDON);
  assert.ok(Math.abs(d - 343.5) < 1, `obtido ${d}`);
  assert.ok(Math.abs(d - haversineKm(PARIS, LONDON)) < 1);
});

test('equador: 1° de longitude ≈ 111,3 km (elipsoide WGS-84)', () => {
  const d = geodesicDistanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 1 });
  assert.ok(Math.abs(d - 111.32) < 0.05, `obtido ${d}`);
});

test('meridiano: 1° de latitude perto do equador ≈ 110,6 km', () => {
  const d = geodesicDistanceKm({ lat: 0, lon: 0 }, { lat: 1, lon: 0 });
  assert.ok(Math.abs(d - 110.57) < 0.05, `obtido ${d}`);
});

test('mesmo ponto: distância 0 e azimute 0', () => {
  assert.equal(geodesicDistanceKm(PARIS, PARIS), 0);
  assert.equal(azimuthDeg(PARIS, PARIS), 0);
});

test('azimutes cardeais', () => {
  const o = { lat: 0, lon: 0 };
  assert.ok(Math.abs(azimuthDeg(o, { lat: 1, lon: 0 })) < 1e-6); // norte
  assert.ok(Math.abs(azimuthDeg(o, { lat: 0, lon: 1 }) - 90) < 1e-6); // leste
  assert.ok(Math.abs(azimuthDeg(o, { lat: -1, lon: 0 }) - 180) < 1e-6); // sul
  assert.ok(Math.abs(azimuthDeg(o, { lat: 0, lon: -1 }) - 270) < 1e-6); // oeste
});

test('azimute Paris -> Londres ≈ 330° (NNW)', () => {
  const az = azimuthDeg(PARIS, LONDON);
  assert.ok(Math.abs(az - 330) < 2, `obtido ${az}`);
  assert.equal(compassPoint(az), 'NNW');
});

test('vincentyInverse devolve azimute de volta coerente', () => {
  const r = vincentyInverse(PARIS, LONDON);
  assert.ok(r);
  assert.equal(r.approximate, false);
  assert.ok(Math.abs(r.backAzimuthDeg - 148) < 2, `volta ${r.backAzimuthDeg}`);
});

test('quase antípodas não quebram (fallback)', () => {
  const d = geodesicDistanceKm({ lat: 0, lon: 0 }, { lat: 0.5, lon: 179.7 });
  assert.ok(Number.isFinite(d) && d > 19000);
});

test('compassPoint cobre 16 direções', () => {
  assert.equal(compassPoint(0), 'N');
  assert.equal(compassPoint(90), 'E');
  assert.equal(compassPoint(359), 'N');
  assert.equal(compassPoint(-90), 'W');
});

test('milhas', () => {
  assert.ok(Math.abs(kmToMiles(160.9344) - 100) < 1e-9);
});

test('área: quadrado de 1° x 1° no equador ≈ 12.364 km²', () => {
  const sq = [
    { lat: 0, lon: 0 },
    { lat: 0, lon: 1 },
    { lat: 1, lon: 1 },
    { lat: 1, lon: 0 },
  ];
  const a = polygonAreaKm2(sq);
  assert.ok(Math.abs(a - 12364) < 60, `obtido ${a}`);
});

test('área independe do sentido e do ponto inicial do anel', () => {
  const tri = [
    { lat: 10, lon: 10 },
    { lat: 12, lon: 14 },
    { lat: 9, lon: 15 },
  ];
  const a1 = polygonAreaKm2(tri);
  const a2 = polygonAreaKm2([...tri].reverse());
  const a3 = polygonAreaKm2([tri[1]!, tri[2]!, tri[0]!]);
  assert.ok(a1 > 0);
  assert.ok(Math.abs(a1 - a2) < 1e-6);
  assert.ok(Math.abs(a1 - a3) < 1e-6);
});

test('área com menos de 3 vértices é zero', () => {
  assert.equal(polygonAreaKm2([PARIS, LONDON]), 0);
});
