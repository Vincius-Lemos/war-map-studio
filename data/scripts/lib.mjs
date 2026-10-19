// Utilitários compartilhados: download com retentativas/validação e simplificação topológica.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import * as topojson from 'topojson-server';
import { presimplify, simplify } from 'topojson-simplify';
import { feature as topoFeature } from 'topojson-client';
import { geoArea } from 'd3-geo';

export const TWO_PI = 2 * Math.PI;

/** Baixa um arquivo, seguindo redirecionamentos. Valida que é GeoJSON (não ponteiro Git LFS). */
export async function downloadGeoJSON(url, dest, { retries = 3 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (res.status === 404) throw Object.assign(new Error('HTTP 404'), { noRetry: true });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      validateGeoJSONText(text);
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, text);
      return text;
    } catch (err) {
      lastErr = err;
      if (err.noRetry || attempt === retries) break;
      await new Promise(r => setTimeout(r, 800 * attempt));
    }
  }
  throw lastErr;
}

export function validateGeoJSONText(text) {
  const head = text.trimStart().slice(0, 1);
  if (head !== '{') throw new Error('resposta não é JSON (possível ponteiro Git LFS)');
  if (text.startsWith('version https://git-lfs')) throw new Error('ponteiro Git LFS, não o arquivo real');
  const obj = JSON.parse(text);
  if (!Array.isArray(obj.features) || obj.features.length === 0) throw new Error('GeoJSON sem features');
  return obj;
}

export async function readJSON(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

const round3 = x => Math.round(x * 1000) / 1000;
const clamp = x => Math.max(-180, Math.min(180, x));

/**
 * Converte uma FeatureCollection em topologia, simplifica (preservando fronteiras compartilhadas),
 * volta a GeoJSON, arredonda para 3 casas, corrige orientação dos anéis e remove geometrias degeneradas.
 * `features` deve ter propriedades já finais (serão mantidas).
 */
export function simplifyFeatures(features, { weight }) {
  const fc = { type: 'FeatureCollection', features };
  const topo = topojson.topology({ data: fc });
  const simp = simplify(presimplify(topo), weight);
  const out = topoFeature(simp, simp.objects.data);
  const kept = [];
  for (const f of out.features) {
    if (!f.geometry) continue;
    const g = normalizeGeometry(f.geometry);
    if (!g) continue;
    kept.push({ type: 'Feature', properties: f.properties, geometry: g });
  }
  return kept;
}

function normalizeGeometry(geom) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates]
    : geom.type === 'MultiPolygon' ? geom.coordinates : null;
  if (!polys) return null;
  const outPolys = [];
  for (const rings of polys) {
    const cleaned = rings.map(ring => {
      const pts = ring.map(([x, y]) => [round3(clamp(x)), round3(clamp(y))]);
      // remove pontos consecutivos repetidos
      const dedup = pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
      if (dedup.length > 1) {
        const a = dedup[0], b = dedup[dedup.length - 1];
        if (a[0] !== b[0] || a[1] !== b[1]) dedup.push([a[0], a[1]]);
      }
      return dedup;
    }).filter(r => r.length >= 4);
    if (rings.length === 0 || cleaned.length === 0 || cleaned[0] === undefined) continue;
    // mantém apenas o anel externo se o interno tiver ficado inválido
    const exterior = cleaned[0];
    const holes = cleaned.slice(1);
    outPolys.push([exterior, ...holes]);
  }
  if (outPolys.length === 0) return null;
  const geometry = outPolys.length === 1
    ? { type: 'Polygon', coordinates: outPolys[0] }
    : { type: 'MultiPolygon', coordinates: outPolys };
  return fixOrientation(geometry);
}

/** Se d3.geoArea > 2π, a orientação está invertida: inverte todos os anéis. */
export function fixOrientation(geometry) {
  const area = geoArea({ type: 'Feature', properties: null, geometry });
  if (area <= TWO_PI) return geometry;
  const invert = ring => ring.slice().reverse();
  if (geometry.type === 'Polygon') {
    return { type: 'Polygon', coordinates: geometry.coordinates.map(invert) };
  }
  return { type: 'MultiPolygon', coordinates: geometry.coordinates.map(p => p.map(invert)) };
}

export function inverted(geometry) {
  return geoArea({ type: 'Feature', properties: null, geometry }) > TWO_PI;
}
