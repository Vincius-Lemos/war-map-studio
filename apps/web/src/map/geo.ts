import { geoArea, geoBounds, geoContains } from 'd3-geo';
import type { Feature, MultiPolygon, Polygon } from 'geojson';

/* [[lon0, lat0], [lon1, lat1]] */
export type Bounds = [[number, number], [number, number]];
export type GeoFeature<P = Record<string, unknown>> = Feature<Polygon | MultiPolygon, P>;
export interface CountryProps { name: string; iso2: string; iso3: string }
export interface RegionProps { shapeID: string; shapeName: string; iso2: string }
/* Carregador de dados: sem iso3 devolve os países; com iso3 devolve as regiões desse país. */
export type GeoLoader = (iso3?: string) => Promise<unknown>;

/* Rotas do servidor primeiro; enquanto ele não existe, os arquivos de public/geo. */
export async function defaultLoadGeo(iso3?: string): Promise<unknown> {
  /* BASE_URL respeita o subcaminho de publicação (ex.: /novo/) */
  const base = import.meta.env.BASE_URL;
  const urls = iso3
    ? [`${base}api/geo/admin1/${iso3}.json`, `${base}geo/admin1/${iso3}.json`]
    : [`${base}api/geo/countries.json`, `${base}geo/countries.json`];
  let lastErr: unknown = null;
  for (const url of urls) {
    try {
      const r = await fetch(url);
      if (!r.ok) { lastErr = new Error(`HTTP ${r.status} em ${url}`); continue; }
      return await r.json();
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error('dados geográficos indisponíveis');
}

type FC = { features?: Array<{ type: string; properties?: Record<string, unknown> | null; geometry: unknown }> };

/* Um anel invertido vira "o resto do mundo" para o d3: corrige a orientação. */
function orient<P>(f: GeoFeature<P>): GeoFeature<P> {
  const g = f.geometry;
  const polys = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates];
  for (const p of polys) {
    if (geoArea({ type: 'Polygon', coordinates: p }) > 2 * Math.PI) {
      for (let i = 0; i < p.length; i++) p[i] = p[i]!.slice().reverse();
    }
  }
  return f;
}

export function normalizeCountries(raw: unknown): GeoFeature<CountryProps>[] {
  const fc = raw as FC;
  const out: GeoFeature<CountryProps>[] = [];
  for (const f of fc.features ?? []) {
    if (!f.geometry) continue;
    const p = f.properties ?? {};
    const iso2 = String(p.iso2 ?? p['hc-a2'] ?? p.ISO_A2 ?? '').toUpperCase();
    const iso3 = String(p.iso3 ?? p['hc-a3'] ?? p.ISO_A3 ?? '').toUpperCase();
    const name = String(p.name ?? p.NAME ?? p.ADMIN ?? '');
    const feat = { type: 'Feature', properties: { name, iso2, iso3 }, geometry: f.geometry } as GeoFeature<CountryProps>;
    out.push(orient(feat));
  }
  return out;
}

export function normalizeRegions(raw: unknown, iso2: string, iso3: string): GeoFeature<RegionProps>[] {
  const fc = raw as FC;
  return (fc.features ?? []).filter(f => f.geometry).map((f, i) => {
    const p = f.properties ?? {};
    const feat = {
      type: 'Feature',
      properties: {
        shapeID: String(p.shapeID ?? `${iso3}-${i}`),
        shapeName: String(p.shapeName ?? p.name ?? ''),
        iso2,
      },
      geometry: f.geometry,
    } as GeoFeature<RegionProps>;
    return orient(feat);
  });
}

/* Cada polígono de um MultiPolygon vira um Feature de Polygon (mesmas propriedades):
   o deck.gl trata Polygon com segurança; MultiPolygon aninhado não. */
export function polygonParts<P>(list: GeoFeature<P>[]): GeoFeature<P>[] {
  const out: GeoFeature<P>[] = [];
  for (const f of list) {
    if (f.geometry.type === 'MultiPolygon') {
      for (const coords of f.geometry.coordinates) {
        out.push({ type: 'Feature', properties: f.properties, geometry: { type: 'Polygon', coordinates: coords } });
      }
    } else {
      out.push(f);
    }
  }
  return out;
}

const mainCache = new WeakMap<object, GeoFeature<unknown>>();
/* Parte principal do território (a maior polígono): ignora ilhas e ultramar ao enquadrar a bandeira. */
export function mainPart<P>(f: GeoFeature<P>): GeoFeature<P> {
  const cached = mainCache.get(f);
  if (cached) return cached as GeoFeature<P>;
  let res: GeoFeature<P> = f;
  if (f.geometry.type === 'MultiPolygon') {
    let best = f.geometry.coordinates[0]!, ba = -1;
    for (const p of f.geometry.coordinates) {
      const a = geoArea({ type: 'Polygon', coordinates: p });
      if (a > ba) { ba = a; best = p; }
    }
    res = { type: 'Feature', properties: f.properties, geometry: { type: 'Polygon', coordinates: best } };
  }
  mainCache.set(f, res);
  return res;
}

const boundsCache = new WeakMap<object, Bounds>();
export function boundsOf(f: GeoFeature<object>): Bounds {
  let b = boundsCache.get(f);
  if (!b) {
    const bb = geoBounds(f as never);
    b = [[bb[0][0]!, bb[0][1]!], [bb[1][0]!, bb[1][1]!]];
    boundsCache.set(f, b);
  }
  return b;
}

/* Bbox rápido antes do teste exato (geoContains é o caro). */
export function containsLonLat(f: GeoFeature<object>, lon: number, lat: number): boolean {
  const [[x0, y0], [x1, y1]] = boundsOf(f);
  if (lat < y0 - 0.01 || lat > y1 + 0.01) return false;
  if (x0 <= x1 ? (lon < x0 - 0.01 || lon > x1 + 0.01) : (lon < x0 && lon > x1)) return false;
  return geoContains(f as never, [lon, lat]);
}
