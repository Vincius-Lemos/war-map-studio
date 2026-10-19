// Valida os arquivos gerados em data/out/. Uso: npm test -w data (ou dentro de data/: npm test)
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'out');
const errors = [];
const fail = msg => errors.push(msg);

function checkPos(p, file) {
  const [x, y] = p;
  if (typeof x !== 'number' || typeof y !== 'number') return fail(`${file}: coordenada não numérica`);
  if (x < -180 || x > 180) fail(`${file}: lon fora do intervalo: ${x}`);
  if (y < -90 || y > 90) fail(`${file}: lat fora do intervalo: ${y}`);
}

function checkFC(fc, file) {
  if (fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) return fail(`${file}: não é FeatureCollection`);
  for (const f of fc.features) {
    const g = f.geometry;
    if (!g || !['Polygon', 'MultiPolygon'].includes(g.type)) { fail(`${file}: geometria inválida (${g?.type})`); continue; }
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const rings of polys) for (const ring of rings) {
      if (ring.length < 4) fail(`${file}: anel com menos de 4 pontos`);
      for (const p of ring) checkPos(p, file);
    }
  }
}

async function loadJSON(path) {
  const text = await readFile(path, 'utf8');
  try { return JSON.parse(text); } catch (e) { fail(`${path}: JSON inválido (${e.message})`); return null; }
}

// 1. countries.json
const countries = await loadJSON(join(OUT, 'countries.json'));
if (countries) {
  checkFC(countries, 'countries.json');
  const sz = (await stat(join(OUT, 'countries.json'))).size;
  if (sz >= 5 * 1024 * 1024) fail(`countries.json com ${sz} bytes (alvo < 5 MB)`);
  for (const f of countries.features) {
    if (!f.properties?.iso3 || !('name' in f.properties) || !('iso2' in f.properties)) fail('countries.json: properties incompletas');
  }
  console.log(`countries.json: ${countries.features.length} países, ${(sz / 1048576).toFixed(2)} MB`);
}

// 2. admin1
const dir = join(OUT, 'admin1');
const files = (await readdir(dir)).filter(f => f.endsWith('.json'));
let regions = 0;
for (const file of files) {
  const iso3 = file.replace(/\.json$/, '');
  const fc = await loadJSON(join(dir, file));
  if (!fc) continue;
  checkFC(fc, `admin1/${file}`);
  const ids = new Set();
  for (const f of fc.features) {
    regions++;
    const p = f.properties ?? {};
    if (p.iso3 !== iso3) fail(`admin1/${file}: iso3 incorreto (${p.iso3})`);
    if (!p.shapeID || !p.shapeName) fail(`admin1/${file}: shapeID/shapeName ausente`);
    if (ids.has(p.shapeID)) fail(`admin1/${file}: shapeID duplicado ${p.shapeID}`);
    ids.add(p.shapeID);
  }
}
console.log(`admin1: ${files.length} países, ${regions} regiões`);

// 3. Ucrânia: 27 regiões
const ukr = files.includes('UKR.json') ? await loadJSON(join(dir, 'UKR.json')) : null;
if (!ukr) fail('admin1/UKR.json ausente');
else if (ukr.features.length !== 27) fail(`UKR tem ${ukr.features.length} regiões (esperado 27)`);
else console.log('UKR: 27 regiões OK');

// 4. manifest
const manifest = await loadJSON(join(OUT, 'manifest.json'));
if (manifest) {
  if (manifest.totals.countriesWithAdmin1 !== files.length) fail(`manifest: ${manifest.totals.countriesWithAdmin1} países com ADM1, arquivos: ${files.length}`);
  console.log(`manifest: ${manifest.countries.length} países listados, ${manifest.failures.length} falhas registradas`);
}

if (errors.length) {
  console.error(`\n${errors.length} erro(s):`);
  for (const e of errors.slice(0, 50)) console.error(' - ' + e);
  process.exit(1);
}
console.log('OK: todos os testes passaram');
