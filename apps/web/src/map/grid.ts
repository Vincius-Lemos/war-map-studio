/* Grades de referência desenhadas com deck.gl: graticule lat/lon, grade personalizada (km ou graus)
   e grade militar APROXIMADA (UTM 100 km, com 10 km ao aproximar). A geometria é calculada a partir
   da vista visível e guardada em cache: o mapa só recalcula quando zoom, centro ou tamanho mudam,
   nunca a cada quadro de animação. */
import { PathLayer, TextLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';
import {
  type GridConfig,
  formatDeg,
  graticuleStep,
  lonLatToUtm,
  squareIdUtm,
  utmCentralMeridian,
  utmToLonLat,
  utmZone,
} from '@map-draw/shared';

export interface GridView {
  west: number;
  south: number;
  east: number;
  north: number;
  width: number;   // px
  height: number;  // px
  project(lon: number, lat: number): { x: number; y: number };
}

type Rgba = [number, number, number, number];
export interface GridLine { path: [number, number][]; color: Rgba; width: number }
export interface GridLabel {
  pos: [number, number];
  text: string;
  anchor: 'start' | 'middle' | 'end';
  baseline: 'top' | 'center' | 'bottom';
  off: [number, number];
}
export interface GridData { lines: GridLine[]; labels: GridLabel[] }

const LABEL_FONT = 'Inter, "Segoe UI", system-ui, Roboto, Arial, sans-serif';
const LABEL_BG: Rgba = [8, 12, 18, 190];
const WHITE_TEXT: Rgba = [255, 255, 255, 235];
const KM_PER_DEG_LAT = 110.574;
const KM_PER_DEG_LON = 111.32;
const DEG = Math.PI / 180;
/* grade militar só aparece com a vista até esta largura (km): mais que isso são centenas de linhas */
const MGRS_MAX_WIDTH_KM = 1500;
/* a partir desta largura (km) a grade militar usa 10 km; antes, 100 km */
const MGRS_FINE_WIDTH_KM = 250;

const round = (v: number) => Math.round(v * 1e6) / 1e6;

/* Rótulo na borda: ao longo da linha, no primeiro ponto (borda inferior para meridianos, esquerda para paralelos). */
function edgeLabel(view: GridView, path: [number, number][], text: string, axis: 'lon' | 'lat', labels: GridLabel[]): void {
  const first = path[0];
  if (!first) return;
  const p = view.project(first[0], first[1]);
  if (axis === 'lon') {
    if (p.x < 44 || p.x > view.width - 44) return;
    labels.push({ pos: first, text, anchor: 'middle', baseline: 'bottom', off: [0, -4] });
  } else {
    if (p.y < 14 || p.y > view.height - 14) return;
    labels.push({ pos: first, text, anchor: 'start', baseline: 'center', off: [5, 0] });
  }
}

/* Graticule lat/lon (passo automático pelo zoom, ou o passo escolhido). */
function addGraticule(cfg: GridConfig, view: GridView, lines: GridLine[], labels: GridLabel[]): void {
  const span = Math.max(view.east - view.west, view.north - view.south);
  const step = cfg.lonLat.step > 0 ? cfg.lonLat.step : graticuleStep(span);
  if ((view.east - view.west) / step > 200 || (view.north - view.south) / step > 200) return;
  const color: Rgba = [255, 255, 255, Math.round(150 * cfg.opacity)];
  for (let k = Math.ceil(view.west / step); k * step <= view.east; k++) {
    const lon = round(k * step);
    const path: [number, number][] = [[lon, view.south], [lon, view.north]];
    lines.push({ path, color, width: 1 });
    edgeLabel(view, path, formatDeg(lon, 'lon'), 'lon', labels);
  }
  for (let k = Math.ceil(view.south / step); k * step <= view.north; k++) {
    const lat = round(k * step);
    const path: [number, number][] = [[view.west, lat], [view.east, lat]];
    lines.push({ path, color, width: 1 });
    edgeLabel(view, path, formatDeg(lat, 'lat'), 'lat', labels);
  }
}

/* Grade do usuário: em graus (a partir de lon0/lat0) ou em km (plano local, aproximado). */
function addCustom(cfg: GridConfig, view: GridView, lines: GridLine[], labels: GridLabel[]): void {
  const c = cfg.custom;
  const s = c.step;
  const color: Rgba = [120, 200, 255, Math.round(170 * cfg.opacity)];
  if (c.unit === 'deg') {
    if ((view.east - view.west) / s > 200 || (view.north - view.south) / s > 200) return;
    for (let k = Math.ceil((view.west - c.lon0) / s); c.lon0 + k * s <= view.east; k++) {
      const lon = round(c.lon0 + k * s);
      const path: [number, number][] = [[lon, view.south], [lon, view.north]];
      lines.push({ path, color, width: 1 });
      edgeLabel(view, path, formatDeg(lon, 'lon'), 'lon', labels);
    }
    for (let k = Math.ceil((view.south - c.lat0) / s); c.lat0 + k * s <= view.north; k++) {
      const lat = round(c.lat0 + k * s);
      const path: [number, number][] = [[view.west, lat], [view.east, lat]];
      lines.push({ path, color, width: 1 });
      edgeLabel(view, path, formatDeg(lat, 'lat'), 'lat', labels);
    }
    return;
  }
  /* km: x = leste em km a partir da origem (varia com a latitude), y = norte em km (constante em paralelos) */
  const xs = [view.west, view.east].flatMap((lon) => [view.south, view.north].map((lat) => (lon - c.lon0) * KM_PER_DEG_LON * Math.cos(lat * DEG)));
  const ys = [view.south, view.north].map((lat) => (lat - c.lat0) * KM_PER_DEG_LAT);
  const xMin = Math.min(...xs) - s, xMax = Math.max(...xs) + s;
  const yMin = Math.min(...ys) - s, yMax = Math.max(...ys) + s;
  if ((xMax - xMin) / s > 200 || (yMax - yMin) / s > 200) return;
  const label = (v: number) => `${Number(v.toFixed(2)).toString().replace('.', ',')} km`;
  for (let k = Math.ceil(xMin / s); k * s <= xMax; k++) {
    const x = k * s;
    const path: [number, number][] = [];
    for (let i = 0; i <= 32; i++) {
      const lat = view.south + ((view.north - view.south) * i) / 32;
      const cl = Math.max(0.05, Math.cos(lat * DEG));
      path.push([round(c.lon0 + x / (KM_PER_DEG_LON * cl)), round(lat)]);
    }
    lines.push({ path, color, width: 1 });
    edgeLabel(view, path, label(x), 'lon', labels);
  }
  for (let k = Math.ceil(yMin / s); k * s <= yMax; k++) {
    const lat = round(c.lat0 + (k * s) / KM_PER_DEG_LAT);
    const path: [number, number][] = [[view.west, lat], [view.east, lat]];
    lines.push({ path, color, width: 1 });
    edgeLabel(view, path, label(k * s), 'lat', labels);
  }
}

/* Divide uma sequência de pontos em trechos contínuos dentro de `inside`. */
function splitRuns(pts: [number, number][], inside: (lon: number, lat: number) => boolean): [number, number][][] {
  const runs: [number, number][][] = [];
  let cur: [number, number][] = [];
  for (const p of pts) {
    if (inside(p[0], p[1])) cur.push(p);
    else {
      if (cur.length >= 2) runs.push(cur);
      cur = [];
    }
  }
  if (cur.length >= 2) runs.push(cur);
  return runs;
}

/* Grade militar aproximada: quadrados UTM de 100 km por zona (10 km ao aproximar). Não é a norma MGRS exata. */
function addMilitary(cfg: GridConfig, view: GridView, lines: GridLine[], labels: GridLabel[]): void {
  const midLat = (view.north + view.south) / 2;
  const widthKm = (view.east - view.west) * KM_PER_DEG_LON * Math.cos(midLat * DEG);
  if (widthKm > MGRS_MAX_WIDTH_KM) return;
  const fine = widthKm <= MGRS_FINE_WIDTH_KM;
  const minor = fine ? 1e4 : 1e5;
  const pxPerM = view.width / Math.max(1, widthKm * 1000);
  const minorLabels = fine && pxPerM * 1e4 >= 26;
  const squareLabels = pxPerM * 1e5 >= 60;
  const major: Rgba = [190, 255, 150, Math.round(230 * cfg.opacity)];
  const minorColor: Rgba = [190, 255, 150, Math.round(120 * cfg.opacity)];

  for (let zone = utmZone(view.west); zone <= utmZone(view.east); zone++) {
    const cm = utmCentralMeridian(zone);
    const box = {
      l0: Math.max(view.west, cm - 3), l1: Math.min(view.east, cm + 3),
      a0: Math.max(view.south, -80), a1: Math.min(view.north, 84),
    };
    if (box.l1 <= box.l0 || box.a1 <= box.a0) continue;
    const inside = (lon: number, lat: number) => lon >= box.l0 - 1e-9 && lon <= box.l1 + 1e-9 && lat >= box.a0 - 1e-9 && lat <= box.a1 + 1e-9;

    /* extensão da zona dentro da vista, em metros UTM */
    let eMin = Infinity, eMax = -Infinity, nMin = Infinity, nMax = -Infinity;
    for (let i = 0; i <= 8; i++) {
      for (let j = 0; j <= 8; j++) {
        const u = lonLatToUtm(box.a0 + ((box.a1 - box.a0) * j) / 8, box.l0 + ((box.l1 - box.l0) * i) / 8, zone);
        eMin = Math.min(eMin, u.e); eMax = Math.max(eMax, u.e);
        nMin = Math.min(nMin, u.n); nMax = Math.max(nMax, u.n);
      }
    }

    /* linhas de leste (E constante) */
    for (let k = Math.ceil(eMin / minor); k * minor <= eMax; k++) {
      const E = k * minor;
      const isMajor = Math.abs(E % 1e5) < 0.5;
      const pts: [number, number][] = [];
      for (let i = 0; i <= 48; i++) {
        const ll = utmToLonLat(E, nMin + ((nMax - nMin) * i) / 48, zone);
        pts.push([ll.lon, ll.lat]);
      }
      for (const run of splitRuns(pts, inside)) {
        lines.push({ path: run, color: isMajor ? major : minorColor, width: isMajor ? 1.4 : 0.8 });
        if (!isMajor && minorLabels) edgeLabel(view, run, String(Math.floor((E % 1e5) / 1e4)), 'lon', labels);
      }
    }
    /* linhas de norte (N constante) */
    for (let k = Math.ceil(nMin / minor); k * minor <= nMax; k++) {
      const N = k * minor;
      const isMajor = Math.abs(N % 1e5) < 0.5;
      const pts: [number, number][] = [];
      for (let i = 0; i <= 48; i++) {
        const ll = utmToLonLat(eMin + ((eMax - eMin) * i) / 48, N, zone);
        pts.push([ll.lon, ll.lat]);
      }
      for (const run of splitRuns(pts, inside)) {
        lines.push({ path: run, color: isMajor ? major : minorColor, width: isMajor ? 1.4 : 0.8 });
        if (!isMajor && minorLabels) edgeLabel(view, run, String(Math.floor((N % 1e5) / 1e4)), 'lat', labels);
      }
    }

    /* identificação do quadrado de 100 km, no centro */
    if (squareLabels) {
      let count = 0;
      for (let i = Math.floor(eMin / 1e5); i <= Math.floor(eMax / 1e5) && count < 120; i++) {
        for (let j = Math.floor(nMin / 1e5); j <= Math.floor(nMax / 1e5) && count < 120; j++) {
          const E = (i + 0.5) * 1e5, N = (j + 0.5) * 1e5;
          const ll = utmToLonLat(E, N, zone);
          if (!inside(ll.lon, ll.lat)) continue;
          count++;
          labels.push({ pos: [round(ll.lon), round(ll.lat)], text: squareIdUtm(zone, E, N), anchor: 'middle', baseline: 'center', off: [0, 0] });
        }
      }
    }
  }
}

/* Geometria das grades ativas para uma vista. Sem nada ligado, devolve listas vazias. */
export function buildGrid(cfg: GridConfig, view: GridView): GridData {
  const lines: GridLine[] = [];
  const labels: GridLabel[] = [];
  if (cfg.lonLat.enabled) addGraticule(cfg, view, lines, labels);
  if (cfg.custom.enabled) addCustom(cfg, view, lines, labels);
  if (cfg.mgrs.enabled) addMilitary(cfg, view, lines, labels);
  return { lines, labels };
}

/* Cache de uma só entrada: a chave descreve a vista e a configuração. Sem chave, não usa cache (exportação). */
let cache: { key: string; data: GridData } | null = null;

export function gridDataFor(cfg: GridConfig, view: GridView, key?: string): GridData {
  if (key !== undefined && cache && cache.key === key) return cache.data;
  const data = buildGrid(cfg, view);
  if (key !== undefined) cache = { key, data };
  return data;
}

/* Camadas deck.gl da grade: linhas (PathLayer) e rótulos (TextLayer, fundo escuro, sem interação). */
export function gridLayers(data: GridData): Layer[] {
  if (data.lines.length === 0 && data.labels.length === 0) return [];
  return [
    new PathLayer<GridLine>({
      id: 'grid-lines',
      data: data.lines,
      getPath: (l) => l.path,
      getColor: (l) => l.color,
      getWidth: (l) => l.width,
      widthUnits: 'pixels',
      pickable: false,
    }),
    new TextLayer<GridLabel>({
      id: 'grid-labels',
      data: data.labels,
      getPosition: (l) => l.pos,
      getText: (l) => l.text,
      getSize: 11,
      sizeUnits: 'pixels',
      getColor: WHITE_TEXT,
      getTextAnchor: (l) => l.anchor,
      getAlignmentBaseline: (l) => l.baseline,
      getPixelOffset: (l) => l.off,
      fontFamily: LABEL_FONT,
      fontSettings: { sdf: true, fontWeight: 600 },
      characterSet: 'auto',
      background: true,
      getBackgroundColor: LABEL_BG,
      backgroundPadding: [4, 1, 4, 1],
      pickable: false,
    }),
  ];
}
