// Gera o fallback local dos contornos usado enquanto o servidor (/api/geo) não existe.
// Uso: node scripts/make-fallback-geo.mjs [ISO3,ISO3,...]
//   - sempre gera public/geo/countries.json a partir do world-atlas (50m)
//   - com a lista de ISO3, baixa as regiões ADM1 do geoBoundaries (gbOpen, CC BY 4.0)
//     para public/geo/admin1/{ISO3}.json
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, '..');
const pub = join(webRoot, 'public', 'geo');
const require = createRequire(import.meta.url);
const topojson = require('topojson-client');

const atlasDir = dirname(require.resolve('world-atlas/package.json'));
const topo = JSON.parse(readFileSync(join(atlasDir, 'countries-50m.json'), 'utf8'));
const codesDir = dirname(require.resolve('i18n-iso-countries/package.json'));
const codes = JSON.parse(readFileSync(join(codesDir, 'codes.json'), 'utf8'));
const toA2 = Object.fromEntries(codes.map(c => [c[2], c[0]]));
const toA3 = Object.fromEntries(codes.map(c => [c[2], c[1]]));

const round = v => Array.isArray(v) ? v.map(round) : Math.round(v * 1e4) / 1e4;
const features = topojson.feature(topo, topo.objects.countries).features
  .filter(f => f.properties.name !== 'Antarctica')
  .map(f => {
    const num = String(f.id).padStart(3, '0');
    return {
      type: 'Feature',
      properties: { name: f.properties.name, iso2: toA2[num] || '', iso3: toA3[num] || '' },
      geometry: { type: f.geometry.type, coordinates: round(f.geometry.coordinates) },
    };
  });
mkdirSync(pub, { recursive: true });
writeFileSync(join(pub, 'countries.json'), JSON.stringify({ type: 'FeatureCollection', features }));
console.log(`countries.json: ${features.length} paises`);

const list = (process.argv[2] || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
for (const iso3 of list) {
  const meta = await (await fetch(`https://www.geoboundaries.org/api/current/gbOpen/${iso3}/ADM1/`)).json();
  const gj = await (await fetch(String(meta.simplifiedGeometryGeoJSON).replace(/\s/g, ''))).json();
  mkdirSync(join(pub, 'admin1'), { recursive: true });
  writeFileSync(join(pub, 'admin1', `${iso3}.json`), JSON.stringify({
    type: 'FeatureCollection',
    features: gj.features.map((f, i) => ({
      type: 'Feature',
      properties: { shapeID: f.properties.shapeID || `${iso3}-${i}`, shapeName: f.properties.shapeName || '' },
      geometry: { type: f.geometry.type, coordinates: round(f.geometry.coordinates) },
    })),
  }));
  console.log(`admin1/${iso3}.json: ${gj.features.length} regioes`);
}
