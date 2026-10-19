import type { GridConfig } from './scene.ts';

/* Funções puras das grades de referência: padrões, normalização, passo automático da graticule,
   projeção UTM (para a grade militar aproximada) e rótulos. O desenho fica em apps/web/src/map/grid.ts. */

/* Grade desligada: é o que vale para cenas antigas (campo `grid` ausente). */
export function defaultGrid(): GridConfig {
  return {
    lonLat: { enabled: false, step: 0 },
    mgrs: { enabled: false },
    custom: { enabled: false, step: 10, unit: 'km', lat0: 0, lon0: 0 },
    opacity: 0.6,
    snap: false,
    snapStep: 0.5,
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);

/* Completa e limita uma grade vinda de JSON. Não altera a entrada. */
export function normalizeGrid(input: Partial<GridConfig> | null | undefined): GridConfig {
  const d = defaultGrid();
  const ll: Partial<GridConfig['lonLat']> = input?.lonLat ?? {};
  const mg: Partial<GridConfig['mgrs']> = input?.mgrs ?? {};
  const cu: Partial<GridConfig['custom']> = input?.custom ?? {};
  return {
    lonLat: { enabled: bool(ll.enabled, d.lonLat.enabled), step: Math.max(0, num(ll.step, 0)) },
    mgrs: { enabled: bool(mg.enabled, d.mgrs.enabled) },
    custom: {
      enabled: bool(cu.enabled, d.custom.enabled),
      step: Math.max(0.0001, num(cu.step, d.custom.step)),
      unit: cu.unit === 'deg' ? 'deg' : 'km',
      lat0: clamp(num(cu.lat0, 0), -90, 90),
      lon0: clamp(num(cu.lon0, 0), -180, 180),
    },
    opacity: clamp(num(input?.opacity, d.opacity), 0, 1),
    snap: bool(input?.snap, d.snap),
    snapStep: Math.max(0.0001, num(input?.snapStep, d.snapStep)),
  };
}

/* Passos "bonitos" da graticule, em graus (do menor para o maior). */
export const GRATICULE_STEPS = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 30, 45, 90];

/* Passo automático: o menor passo que deixa no máximo `maxLines` linhas no vão visível (em graus). */
export function graticuleStep(spanDeg: number, maxLines = 8): number {
  for (const s of GRATICULE_STEPS) if (spanDeg / s <= maxLines) return s;
  return GRATICULE_STEPS[GRATICULE_STEPS.length - 1] ?? 90;
}

/* Rótulo de grau: "10°N", "0,5°E" (vírgula decimal, como no resto da interface).
   Usa só as casas decimais que o valor precisa (até 4). */
export function formatDeg(v: number, axis: 'lat' | 'lon'): string {
  let d = 0;
  while (d < 4 && Math.abs(Math.abs(v) * 10 ** d - Math.round(Math.abs(v) * 10 ** d)) > 1e-7) d++;
  const abs = Math.abs(v).toFixed(d).replace('.', ',');
  if (Math.abs(v) < 1e-9) return '0°';
  const hemi = axis === 'lat' ? (v > 0 ? 'N' : 'S') : (v > 0 ? 'E' : 'W');
  return `${abs}°${hemi}`;
}

/* ---------- UTM (WGS84) ----------
   Projeção transversa de Mercator, fórmulas de Snyder (USGS, 1987), com fator de escala 0,9996.
   Convenção: easting com falso leste de 500 km; northing medido a partir do equador, negativo no
   hemisfério sul (sem o falso norte de 10 000 km). É a base da grade militar aproximada. */

const A = 6378137;
const F = 1 / 298.257223563;
const E2 = F * (2 - F);
const EP2 = E2 / (1 - E2);
const K0 = 0.9996;
const SQ = Math.sqrt(1 - E2);
const E1 = (1 - SQ) / (1 + SQ);
const DEG = Math.PI / 180;

/* Zona UTM (1 a 60) de uma longitude; faixas de 6° a partir de 180° W. */
export function utmZone(lon: number): number {
  return clamp(Math.floor((lon + 180) / 6) + 1, 1, 60);
}

/* Meridiano central da zona, em graus. */
export function utmCentralMeridian(zone: number): number {
  return zone * 6 - 183;
}

export function lonLatToUtm(lat: number, lon: number, zone: number): { e: number; n: number } {
  const phi = lat * DEG;
  const lam = (lon - utmCentralMeridian(zone)) * DEG;
  const s = Math.sin(phi), c = Math.cos(phi), t = Math.tan(phi);
  const N = A / Math.sqrt(1 - E2 * s * s);
  const T = t * t;
  const C = EP2 * c * c;
  const Aa = lam * c;
  const M = A * ((1 - E2 / 4 - (3 * E2 * E2) / 64 - (5 * E2 ** 3) / 256) * phi
    - ((3 * E2) / 8 + (3 * E2 * E2) / 32 + (45 * E2 ** 3) / 1024) * Math.sin(2 * phi)
    + ((15 * E2 * E2) / 256 + (45 * E2 ** 3) / 1024) * Math.sin(4 * phi)
    - ((35 * E2 ** 3) / 3072) * Math.sin(6 * phi));
  const e = K0 * N * (Aa + ((1 - T + C) * Aa ** 3) / 6
    + ((5 - 18 * T + T * T + 72 * C - 58 * EP2) * Aa ** 5) / 120) + 500000;
  const n = K0 * (M + N * t * (Aa * Aa / 2
    + ((5 - T + 9 * C + 4 * C * C) * Aa ** 4) / 24
    + ((61 - 58 * T + T * T + 600 * C - 330 * EP2) * Aa ** 6) / 720));
  return { e, n };
}

export function utmToLonLat(e: number, n: number, zone: number): { lat: number; lon: number } {
  const x = e - 500000;
  const M = n / K0;
  const mu = M / (A * (1 - E2 / 4 - (3 * E2 * E2) / 64 - (5 * E2 ** 3) / 256));
  const phi1 = mu
    + ((3 * E1) / 2 - (27 * E1 ** 3) / 32) * Math.sin(2 * mu)
    + ((21 * E1 * E1) / 16 - (55 * E1 ** 4) / 32) * Math.sin(4 * mu)
    + ((151 * E1 ** 3) / 96) * Math.sin(6 * mu)
    + ((1097 * E1 ** 4) / 512) * Math.sin(8 * mu);
  const s = Math.sin(phi1), c = Math.cos(phi1), t = Math.tan(phi1);
  const N1 = A / Math.sqrt(1 - E2 * s * s);
  const T1 = t * t;
  const C1 = EP2 * c * c;
  const R1 = (A * (1 - E2)) / Math.pow(1 - E2 * s * s, 1.5);
  const D = x / (N1 * K0);
  const lat = phi1 - ((N1 * t) / R1) * (D * D / 2
    - ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * EP2) * D ** 4) / 24
    + ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * EP2 - 3 * C1 * C1) * D ** 6) / 720);
  const lon = utmCentralMeridian(zone) * DEG + (D
    - ((1 + 2 * T1 + C1) * D ** 3) / 6
    + ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * EP2 + 24 * T1 * T1) * D ** 5) / 120) / c;
  return { lat: lat / DEG, lon: lon / DEG };
}

/* ---------- letras da grade militar (aproximação) ----------
   Quadrado de 100 km: uma letra de coluna (leste) e uma de linha (norte). Segue o esquema de
   conjuntos de letras do MGRS, mas sem a norma exata: não há faixas de latitude (GZD), nem
   tratamento especial de exceções (Noruega, Svalbard) nem datum além do WGS84. */
const COL_SETS = ['ABCDEFGH', 'JKLMNPQR', 'STUVWXYZ'];
const ROW_LETTERS = 'ABCDEFGHJKLMNPQRSTUV';

const posMod = (v: number, m: number) => ((v % m) + m) % m;

/* Duas letras do quadrado de 100 km que contém o ponto (e, n) da zona. */
export function squareIdUtm(zone: number, e: number, n: number): string {
  const col = Math.floor(e / 100000);
  const colLetter = (COL_SETS[(zone - 1) % 3] ?? COL_SETS[0] ?? 'A')[posMod(col - 1, 8)] ?? '?';
  const rowLetter = ROW_LETTERS[posMod(Math.floor(n / 100000) + (zone % 2 === 0 ? 5 : 0), 20)] ?? '?';
  return colLetter + rowLetter;
}
