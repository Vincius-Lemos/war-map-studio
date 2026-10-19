// Gera data/out/countries.json, data/out/admin1/{ISO3}.json e data/out/manifest.json.
// Uso: npm run build -w data   (ou dentro de data/: npm run build)
import { mkdir, rm, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { downloadGeoJSON, readJSON, simplifyFeatures } from './lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const OUT = join(ROOT, 'out');
const OUT_ADMIN1 = join(OUT, 'admin1');

const COUNTRIES_URL = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';
const ADM1_URL = iso3 =>
  `https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/${iso3}/ADM1/geoBoundaries-${iso3}-ADM1_simplified.geojson`;

// Tolerâncias (área em graus² do triângulo mínimo, usada por topojson-simplify).
const COUNTRY_WEIGHT = Number(process.env.COUNTRY_WEIGHT ?? 0.0002);
const ADM1_WEIGHT = Number(process.env.ADM1_WEIGHT ?? 0.00005);

const PRIORITY = ['UKR', 'YEM', 'RUS', 'CAN', 'USA', 'BRA', 'FRA', 'DEU', 'CHN', 'IND', 'ITA', 'ESP', 'GBR', 'POL', 'MEX', 'ARG', 'AUS', 'IDN'];

const CONCURRENCY = 4;

function fc(features) {
  return { type: 'FeatureCollection', features };
}

function fmtKB(n) {
  return `${(n / 1024).toFixed(0)} KB`;
}

function pickIso3(p, feature) {
  const cands = [p['ISO3166-1-Alpha-3'], p.ISO_A3, p.ADM0_A3, feature.id];
  return cands.find(c => typeof c === 'string' && /^[A-Z]{3}$/.test(c)) ?? null;
}
function pickIso2(p) {
  const c = p['ISO3166-1-Alpha-2'] ?? p.ISO_A2;
  return typeof c === 'string' && /^[A-Z]{2}$/.test(c) ? c : null;
}

async function buildCountries() {
  console.log('> países: baixando', COUNTRIES_URL);
  const srcPath = join(SRC, 'countries.geojson');
  if (!existsSync(srcPath)) await downloadGeoJSON(COUNTRIES_URL, srcPath);
  const raw = await readJSON(srcPath);

  const features = raw.features.map(f => ({
    type: 'Feature',
    properties: {
      name: f.properties.name ?? f.properties.NAME ?? null,
      iso2: pickIso2(f.properties),
      iso3: pickIso3(f.properties, f),
    },
    geometry: f.geometry,
  })).filter(f => f.geometry && f.properties.iso3);

  const simplified = simplifyFeatures(features, { weight: COUNTRY_WEIGHT });
  // Mantém a ordem alfabética estável
  simplified.sort((a, b) => a.properties.name.localeCompare(b.properties.name));
  const text = JSON.stringify(fc(simplified));
  await writeFile(join(OUT, 'countries.json'), text);
  console.log(`> países: ${simplified.length} features, ${fmtKB(text.length)}`);
  return simplified.map(f => ({ iso2: f.properties.iso2, iso3: f.properties.iso3, name: f.properties.name }));
}

async function buildAdmin1(iso3) {
  const srcPath = join(SRC, 'admin1', `${iso3}.geojson`);
  let raw;
  if (existsSync(srcPath)) {
    raw = await readJSON(srcPath);
  } else {
    const text = await downloadGeoJSON(ADM1_URL(iso3), srcPath);
    raw = JSON.parse(text);
  }
  const seen = new Set();
  const features = raw.features.map((f, i) => {
    let id = f.properties?.shapeID ?? `${iso3}-${i}`;
    if (seen.has(id)) id = `${iso3}-${i}`;
    seen.add(id);
    return {
      type: 'Feature',
      properties: {
        shapeID: String(id),
        shapeName: f.properties?.shapeName ?? f.properties?.name ?? `${iso3} ${i}`,
        iso3,
      },
      geometry: f.geometry,
    };
  }).filter(f => f.geometry);

  const simplified = simplifyFeatures(features, { weight: ADM1_WEIGHT });
  if (simplified.length === 0) throw new Error('nenhuma geometria válida após simplificação');
  const text = JSON.stringify(fc(simplified));
  await writeFile(join(OUT_ADMIN1, `${iso3}.json`), text);
  return { regions: simplified.length, bytes: Buffer.byteLength(text) };
}

async function runPool(items, worker) {
  let idx = 0;
  const runners = Array.from({ length: CONCURRENCY }, async () => {
    while (idx < items.length) {
      const item = items[idx++];
      await worker(item);
    }
  });
  await Promise.all(runners);
}

async function main() {
  const t0 = Date.now();
  await mkdir(SRC, { recursive: true });
  await rm(OUT_ADMIN1, { recursive: true, force: true });
  await mkdir(OUT_ADMIN1, { recursive: true });

  const countries = await buildCountries();
  const countryByIso3 = new Map(countries.map(c => [c.iso3, c]));

  // Ordem: prioritários primeiro, depois os demais países do conjunto
  const rest = countries.map(c => c.iso3).filter(i => !PRIORITY.includes(i)).sort();
  const order = [...PRIORITY.filter(i => countryByIso3.has(i)), ...rest];
  const missingPriority = PRIORITY.filter(i => !countryByIso3.has(i));

  const generated = new Map();
  const failures = [];
  for (const iso3 of missingPriority) failures.push({ iso3, reason: 'ISO3 ausente em countries.geojson' });

  await runPool(order, async iso3 => {
    const c = countryByIso3.get(iso3);
    const label = `${iso3} (${c.name})`;
    try {
      const r = await buildAdmin1(iso3);
      generated.set(iso3, r);
      console.log(`  ok   ${label}: ${r.regions} regiões, ${fmtKB(r.bytes)}`);
    } catch (err) {
      failures.push({ iso3, reason: String(err.message ?? err).slice(0, 200) });
      console.log(`  skip ${label}: ${err.message}`);
    }
  });

  const manifestCountries = countries.map(c => {
    const g = generated.get(c.iso3);
    return {
      iso2: c.iso2,
      iso3: c.iso3,
      name: c.name,
      regions: g?.regions ?? 0,
      admin1Bytes: g?.bytes ?? 0,
      admin1File: g ? `admin1/${c.iso3}.json` : null,
    };
  });
  const countriesBytes = (await stat(join(OUT, 'countries.json'))).size;
  const manifest = {
    generatedAt: new Date().toISOString(),
    sources: {
      countries: COUNTRIES_URL,
      admin1: 'https://github.com/wmgeolab/geoBoundaries (gbOpen, commit 9469f09, ADM1 simplified)',
    },
    tolerance: { countries: COUNTRY_WEIGHT, admin1: ADM1_WEIGHT },
    totals: {
      countries: countries.length,
      countriesWithAdmin1: generated.size,
      regions: [...generated.values()].reduce((s, g) => s + g.regions, 0),
      countriesJsonBytes: countriesBytes,
      admin1Bytes: [...generated.values()].reduce((s, g) => s + g.bytes, 0),
    },
    countries: manifestCountries,
    failures,
  };
  await writeFile(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`> pronto em ${((Date.now() - t0) / 1000).toFixed(1)}s: ${generated.size}/${countries.length} países com ADM1, ${manifest.totals.regions} regiões, ${failures.length} falhas`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
