import * as topojson from 'topojson-client';
import type { CountryInfo } from '../state/types.ts';

/* Dados geográficos: países (nomes, códigos e contornos), regiões (estados/províncias) e busca de ponto. */

const WORLD_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json';
const CODES_URL = 'https://cdn.jsdelivr.net/npm/i18n-iso-countries@7.14.0/codes.json';

type Topo = Parameters<typeof topojson.feature>[0];
type TopoGeometry = Parameters<typeof topojson.feature>[1];

export interface GeoFeature {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] };
}

export interface RegionFeature extends GeoFeature {
  properties: { shapeID: string; shapeName?: string; iso?: string; [key: string]: unknown };
}

async function fetchJson(url: string): Promise<unknown> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} em ${url}`);
  return (await r.json()) as unknown;
}

let worldPromise: Promise<Topo> | null = null;
/* Topojson do mundo (países). Compartilhado com o mapa via loadGeo(). */
export function loadWorldTopo(): Promise<Topo> {
  worldPromise ??= fetchJson(WORLD_URL).then((j) => j as Topo);
  return worldPromise;
}

interface CountryShape extends CountryInfo {
  feature: GeoFeature;
}

let shapesPromise: Promise<CountryShape[]> | null = null;

/* Países com código alfa-2 (sistema), alfa-3 (arquivos de regiões) e contorno. Lido uma vez. */
function loadCountryShapes(): Promise<CountryShape[]> {
  shapesPromise ??= (async () => {
    const [topo, codes] = await Promise.all([
      loadWorldTopo(),
      fetchJson(CODES_URL).then((j) => j as string[][]),
    ]);
    const objects = topo.objects as { countries: TopoGeometry };
    const fc = topojson.feature(topo, objects.countries) as unknown as {
      features: Array<GeoFeature & { id?: string | number }>;
    };
    const byNumeric = new Map(codes.map((c) => [c[2] ?? '', c]));
    const out: CountryShape[] = [];
    for (const f of fc.features) {
      const name = String(f.properties['name'] ?? '');
      if (!name || name === 'Antarctica') continue;
      const row = byNumeric.get(String(f.id ?? '').padStart(3, '0'));
      const iso = row?.[0] ?? '';
      if (!iso) continue;
      out.push({ iso, iso3: row?.[1] ?? '', name, feature: f });
    }
    return out;
  })();
  return shapesPromise;
}

/* Lista de países, ordenada por nome, para a busca. */
export async function loadCountries(): Promise<CountryInfo[]> {
  const shapes = await loadCountryShapes();
  return shapes
    .map(({ iso, iso3, name }) => ({ iso, iso3, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

/* Área inicial de um país, em graus [oeste, sul, leste, norte]. Para países que cruzam o antimeridiano
   ou são muito grandes, usa o anel exterior de maior extensão em torno do centro dele. */
export async function countryBounds(iso: string): Promise<[number, number, number, number] | null> {
  const shape = (await loadCountryShapes()).find((c) => c.iso === iso);
  if (!shape) return null;
  const g = shape.feature.geometry;
  const polys = g.type === 'MultiPolygon' ? (g.coordinates as number[][][][]) : [g.coordinates as number[][][]];
  let best: number[][] = [];
  let bestArea = -1;
  for (const p of polys) {
    const ring = p[0] ?? [];
    const area = ringArea(ring);
    if (ring.length && area > bestArea) {
      bestArea = area;
      best = ring;
    }
  }
  if (!best.length) return null;
  const lons = best.map((c) => c[0] ?? 0);
  const lats = best.map((c) => c[1] ?? 0);
  let w = Math.min(...lons), e = Math.max(...lons);
  const s = Math.min(...lats), n = Math.max(...lats);
  if (e - w > 120) {
    const cx = lons.reduce((a, b) => a + b, 0) / lons.length;
    const cy = lats.reduce((a, b) => a + b, 0) / lats.length;
    const span = Math.min(Math.max((n - s) * 1.3, 3), 80);
    w = cx - span / 2;
    e = cx + span / 2;
    return [w, Math.max(-85, cy - span / 2), e, Math.min(85, cy + span / 2)];
  }
  return [w, s, e, n];
}

function ringArea(ring: number[][]): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const p = ring[i];
    const q = ring[j];
    if (!p || !q) continue;
    a += ((q[0] ?? 0) - (p[0] ?? 0)) * ((q[1] ?? 0) + (p[1] ?? 0));
  }
  return Math.abs(a / 2);
}

const regionCache = new Map<string, Promise<RegionFeature[]>>();

/* Regiões de um país (alfa-3), carregadas sob demanda: primeiro o arquivo local (mesma origem),
   depois a fonte geoBoundaries. Cada região recebe shapeID estável. */
export function loadRegions(iso3: string): Promise<RegionFeature[]> {
  const cached = regionCache.get(iso3);
  if (cached) return cached;
  const p = (async () => {
    let r = await fetch(`geo/${iso3}.geojson`);
    if (!r.ok) {
      const meta = (await (await fetch(`https://www.geoboundaries.org/api/current/gbOpen/${iso3}/ADM1/`)).json()) as {
        simplifiedGeometryGeoJSON: string;
      };
      r = await fetch(String(meta.simplifiedGeometryGeoJSON).replace(/\s/g, ''));
    }
    if (!r.ok) throw new Error('geometria indisponível');
    const gj = (await r.json()) as { features: RegionFeature[] };
    return gj.features.map((f, i) => {
      f.properties.shapeID ??= `${iso3}-${i}`;
      return f;
    });
  })();
  regionCache.set(iso3, p);
  p.catch(() => regionCache.delete(iso3));
  return p;
}

/* Função passada ao mapa (createMap opts.loadGeo): sem argumento devolve o mundo; com iso3, as regiões. */
export async function loadGeoForMap(iso3?: string): Promise<unknown> {
  if (iso3) return loadRegions(iso3);
  /* O mapa desenha GeoJSON: usa o arquivo do servidor (ou o de public/geo) e não o TopoJSON do CDN. */
  const base = import.meta.env.BASE_URL;
  for (const url of [`${base}api/geo/countries.json`, `${base}geo/countries.json`]) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
    } catch {
      /* tenta o próximo */
    }
  }
  throw new Error('contornos dos países indisponíveis');
}

/* Ray casting: ponto [lon, lat] dentro de um anel. */
function inRing(ring: number[][], lon: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (!a || !b) continue;
    const xi = a[0] ?? 0;
    const yi = a[1] ?? 0;
    const xj = b[0] ?? 0;
    const yj = b[1] ?? 0;
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function regionContains(f: GeoFeature, lon: number, lat: number): boolean {
  const g = f.geometry;
  const polys = g.type === 'MultiPolygon' ? (g.coordinates as number[][][][]) : [g.coordinates as number[][][]];
  return polys.some((poly) => poly[0] !== undefined && inRing(poly[0], lon, lat));
}

export function findRegionAt(features: readonly RegionFeature[], lon: number, lat: number): RegionFeature | undefined {
  return features.find((f) => regionContains(f, lon, lat));
}
