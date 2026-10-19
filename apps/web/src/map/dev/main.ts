/* Página de teste do motor de mapa (map-test.html): cena de exemplo com a Ucrânia,
   regiões, bandeiras, setas, eventos e unidades. Não faz parte da interface. */
import { createMap, type MapApi } from '../index';
import type { Scene } from '@map-draw/shared';

const UA_REGION = { lon0: 22.0, lat0: 44.2, lon1: 40.4, lat1: 52.6 };

const scene: Scene = {
  title: 'Teste: Ucrânia (motor de mapa)',
  startDate: '2022-02-24T04:00',
  durationH: 72,
  year: null,
  mapType: 'country',
  region: UA_REGION,
  symbolStyle: 'nato',
  unitSize: 1,
  showLabels: true,
  showTrails: true,
  showAllFlags: true,
  factions: [
    { id: 'ru', name: 'Forças russas', color: '#b71c1c', affil: 'hostile', flag: 'RU' },
    { id: 'ua', name: 'Forças ucranianas', color: '#1565c0', affil: 'friend', flag: 'UA' },
  ],
  territories: [
    { iso: 'UA', name: 'Ucrânia', t: 0, faction: 'ua' },
    { iso: 'UA', sub: '14850775B65901307765467', name: 'Kherson Oblast (Ucrânia)', t: 0, faction: 'ua' },
    { iso: 'UA', sub: '14850775B24260608407062', name: 'Crimeia (Ucrânia)', t: 0, faction: 'ru', fcode: 'RU' },
    { iso: 'UA', sub: '14850775B15615817748403', name: 'Donetsk Oblast', t: 0, faction: 'ua' },
    { iso: 'UA', sub: '14850775B15615817748403', name: 'Donetsk Oblast', t: 20, faction: 'ru', fcode: 'RU' },
    { iso: 'UA', sub: '14850775B31033086218351', name: 'Luhansk Oblast', t: 0, faction: 'ua' },
    { iso: 'UA', sub: '14850775B31033086218351', name: 'Luhansk Oblast', t: 16, faction: 'ru', fcode: 'RU' },
  ],
  units: [
    { id: 'u1', name: '1ª Div. Blindada', faction: 'ru', type: 'arm', echelon: 'div', note: '',
      path: [{ t: 0, lat: 46.6, lon: 33.6 }, { t: 24, lat: 47.9, lon: 34.4 }, { t: 48, lat: 49.0, lon: 36.2 }] },
    { id: 'u2', name: 'Div. Motorizada', faction: 'ru', type: 'motor', echelon: 'div', note: '',
      path: [{ t: 8, lat: 51.5, lon: 31.0 }, { t: 40, lat: 50.4, lon: 30.5 }] },
    { id: 'u3', name: '3º Reg. Cavalaria', faction: 'ru', type: 'cav', echelon: 'reg', note: '',
      path: [{ t: 12, lat: 49.0, lon: 37.5 }, { t: 60, lat: 48.6, lon: 39.2 }] },
    { id: 'u4', name: 'Forças de defesa', faction: 'ua', type: 'inf', echelon: 'bde', note: '',
      path: [{ t: 0, lat: 48.7, lon: 37.7 }] },
    { id: 'u5', name: '2º Gr. Artilharia', faction: 'ua', type: 'art', echelon: 'bn', note: '',
      path: [{ t: 0, lat: 50.4, lon: 30.5 }] },
    { id: 'u6', name: 'Milícia local', faction: 'ua', type: 'civ', echelon: '', note: '',
      path: [{ t: 0, lat: 46.9, lon: 32.0 }] },
  ],
  arrows: [
    { id: 'a1', from: { lat: 49.9, lon: 36.8 }, to: { lat: 48.8, lon: 37.6 }, t0: 20, t1: 34, kind: 'attack', faction: 'ru' },
    { id: 'a2', from: { lat: 47.2, lon: 33.6 }, to: { lat: 46.0, lon: 34.5 }, t0: 6, t1: 16, kind: 'withdraw', faction: 'ua' },
  ],
  events: [
    { id: 'e1', t: 34, lat: 48.8, lon: 37.6, kind: 'attack', text: 'Ataque à linha de defesa em Donetsk', dur: 4 },
    { id: 'e2', t: 10, lat: 50.45, lon: 30.52, kind: 'note', text: 'Nota de inteligência', dur: 6 },
  ],
  orgFlags: [],
  overlay: null,
};

const $ = (s: string) => document.querySelector(s) as HTMLElement;
const log = (msg: string) => {
  const el = $('#log');
  el.textContent = `${new Date().toLocaleTimeString()}  ${msg}\n` + el.textContent;
};

const map: MapApi = createMap($('#map'));
let t = 20;

const slider = $('#t') as HTMLInputElement;
const label = $('#tl');
const draw = () => {
  label.textContent = `t = ${t.toFixed(1)} h`;
  map.render(scene, t);
};

map.onClick(e => {
  log(`clique ${e.lat.toFixed(3)}, ${e.lon.toFixed(3)} -> ${JSON.stringify(e.hit)}`);
  const id = e.hit.id;
  map.setSelection(e.hit.kind === 'unit' && id ? { kind: 'unit', id } : null);
  if (e.hit.kind === 'region' || e.hit.kind === 'country') {
    log(`   (país ${e.hit.iso}${e.hit.sub ? ', região ' + e.hit.sub : ''})`);
  }
});
map.onDragUnit(e => {
  if (e.phase !== 'move') log(`arrasto ${e.phase} ${e.unitId} ${e.lat.toFixed(3)}, ${e.lon.toFixed(3)}`);
  if (e.phase === 'move') {
    const u = scene.units.find(x => x.id === e.unitId);
    if (u) {
      const p = u.path.find(q => Math.abs(q.t - t) < 0.02);
      if (p) { p.lat = e.lat; p.lon = e.lon; } else u.path.push({ t: Math.round(t * 100) / 100, lat: e.lat, lon: e.lon });
      u.path.sort((a, b) => a.t - b.t);
      draw();
    }
  }
});
map.onDropFaction(e => log(`soltou ${e.factionId} em ${JSON.stringify(e.hit)}`));

slider.addEventListener('input', () => { t = Number(slider.value); draw(); });
$('#fit').addEventListener('click', () => map.fitRegion(scene.region));
$('#png').addEventListener('click', async () => {
  const blob = await map.exportPng();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'teste-mapa.png';
  a.click();
  log(`PNG exportado: ${blob.size} bytes`);
});
$('#region').addEventListener('click', () => {
  scene.mapType = scene.mapType === 'country' ? 'tiles' : 'country';
  draw();
  log(`mapType = ${scene.mapType}`);
});

map.ready().then(() => {
  map.fitRegion(scene.region);
  draw();
  log('pronto');
  (window as unknown as { map: MapApi; scene: Scene; setT: (v: number) => void }).map = map;
  (window as unknown as { scene: Scene }).scene = scene;
  (window as unknown as { setT: (v: number) => void }).setT = v => { t = v; slider.value = String(v); draw(); };
}).catch(err => log('erro: ' + String(err)));
