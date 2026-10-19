/* Motor do mapa: MapLibre GL (base e câmera) + deck.gl (países, bandeiras, unidades, setas,
   eventos e rótulos). Implementa o contrato MapApi usado pela interface. */
import { Map as MLMap } from 'maplibre-gl';
import type { StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapboxOverlay } from '@deck.gl/mapbox';
import type { Layer } from '@deck.gl/core';
import { BitmapLayer, IconLayer, PathLayer, PolygonLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { PathStyleExtension, type PathStyleExtensionProps } from '@deck.gl/extensions';
import { geoCentroid } from 'd3-geo';
import { controlAt, posAt, subControlAt } from '@map-draw/shared';
import type { GridConfig, MapEvent, OrgFlag, Region, Scene, Territory, Unit } from '@map-draw/shared';
import { normalizeGrid } from '@map-draw/shared';
import { type Bounds, type CountryProps, type GeoFeature, type GeoLoader, type RegionProps, boundsOf, containsLonLat, defaultLoadGeo, mainPart, normalizeCountries, normalizeRegions, polygonParts } from './geo';
import { FlagTextures, flagSrcFor, flagUrl } from './flags';
import { IconCache, type IconDef, echelonMark } from './icons';
import { arrowGeo, clamp, hexToRgb, trailPoints, wrapText, type ArrowGeo } from './motion';
import { gridDataFor, gridLayers, type GridView } from './grid';

/* ---------- contrato público ---------- */

export type HitKind = 'unit' | 'arrow' | 'event' | 'country' | 'region' | 'none';
export interface Hit { kind: HitKind; id?: string; iso?: string; sub?: string }
export interface MapClick { lat: number; lon: number; hit: Hit }
export interface UnitDragEvent { unitId: string; lat: number; lon: number; phase: 'start' | 'move' | 'end' }
export interface FactionDropEvent { factionId: string; lat: number; lon: number; hit: Hit }
/* Seleção feita pela interface (desenha o anel na unidade selecionada). */
export interface MapSelection { kind: 'unit' | 'arrow' | 'event' | 'country' | 'region'; id: string }

export interface MapApi {
  render(scene: Scene, t: number): void;
  fitRegion(region: Region): void;
  setViewport(v: { lon: number; lat: number; zoom: number }): void;
  /* Camadas extras (alcance, rota, névoa): recebidas da interface e desenhadas por cima do mapa. */
  setExtraLayers(layers: Layer[]): void;
  onClick(cb: (e: MapClick) => void): void;
  onDragUnit(cb: (e: UnitDragEvent) => void): void;
  onDropFaction(cb: (e: FactionDropEvent) => void): void;
  ready(): Promise<void>;
  exportPng(): Promise<Blob>;
  dispose(): void;
  /* Além do contrato: a interface informa a seleção (anel) e pode pedir as regiões de um país. */
  setSelection(sel: MapSelection | null): void;
  loadRegions(iso: string): Promise<void>;
  /* Projeção geográfico -> tela (pixels do contêiner do mapa); null se o ponto for inválido. */
  toScreen(lat: number, lon: number): { x: number; y: number } | null;
  /* Tela -> geográfico (x, y em px do contêiner do mapa); inverso de toScreen. */
  toLatLon(x: number, y: number): { lat: number; lon: number } | null;
  /* Troca a grade desenhada e redesenha. Vale até a cena receber outra grade (edição ou render com outra cena). */
  setGrid(g: GridConfig): void;
}

export interface MapOptions {
  loadGeo?: GeoLoader;
}

/* ---------- constantes visuais (mesmas da referência) ---------- */

const SEA = '#9fb8c4';
const FREE_BG = '#e9e4d4';
const LAND: [number, number, number, number] = [233, 228, 212, 255];
const BORDER: [number, number, number, number] = [138, 129, 112, 255];
const SUB_LINE: [number, number, number, number] = [75, 67, 51, 255];
const WHITE: [number, number, number, number] = [255, 255, 255, 255];
const BLACK: [number, number, number, number] = [0, 0, 0, 255];
const RING: [number, number, number, number] = [255, 213, 79, 255];
const EVENT_RED: [number, number, number, number] = [255, 59, 48, 255];
const NOTE_YELLOW: [number, number, number, number] = [255, 213, 79, 255];
const LABEL_PX = 15;
/* fonte sans-serif para todos os textos do mapa (o padrão do deck.gl é monoespaçada) */
const LABEL_FONT = 'Inter, "Segoe UI", system-ui, Roboto, Arial, sans-serif';
/* fundo "pílula" escuro e semitransparente atrás dos nomes de países */
const LABEL_BG: [number, number, number, number] = [8, 12, 18, 205];
const LABEL_PAD = 5;
/* país com a maior dimensão do bbox abaixo disto (px) não recebe rótulo */
const LABEL_MIN_DIM = 22;
/* distância mínima entre rótulos (px) */
const LABEL_GAP = 4;

/* nomes longos encurtados (chave: nome como vem em countries.json) */
const SHORT_NAMES: Record<string, string> = {
  'United States of America': 'United States',
  'Democratic Republic of the Congo': 'DR Congo',
  'Republic of the Congo': 'Congo',
  'Central African Republic': 'Central African Rep.',
  'Dominican Republic': 'Dominican Rep.',
  'Equatorial Guinea': 'Eq. Guinea',
  'United Arab Emirates': 'UAE',
  'Bosnia and Herzegovina': 'Bosnia-Herz.',
  'Trinidad and Tobago': 'Trinidad & Tobago',
  'Saint Vincent and the Grenadines': 'St. Vincent',
  'Papua New Guinea': 'Papua N. Guinea',
  'South Sudan': 'S. Sudan',
  'North Macedonia': 'N. Macedonia',
  'Solomon Islands': 'Solomon Is.',
  'Marshall Islands': 'Marshall Is.',
  'Falkland Islands': 'Falklands',
};

/* Quantos rótulos de países cabem pelo zoom: afastado, só os maiores. */
function countryLabelCap(z: number): number {
  return z < 2 ? 12 : z < 3 ? 22 : z < 4 ? 36 : z < 5 ? 60 : 110;
}

/* Nome em uma ou duas linhas: encurtado e, se ainda longo, quebrado no espaço mais próximo do meio. */
function countryNameLines(name: string): string[] {
  const s = SHORT_NAMES[name] ?? name;
  if (s.length <= 13) return [s];
  const words = s.split(' ');
  if (words.length < 2) return [s];
  let best = 1, bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const left = words.slice(0, i).join(' ');
    const diff = Math.abs(left.length - (s.length - left.length - 1));
    if (diff < bestDiff) { bestDiff = diff; best = i; }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}

const dashExt = new PathStyleExtension({ dash: true });

/* ---------- tipos internos ---------- */

interface UnitDatum {
  u: Unit;
  lon: number;
  lat: number;
  icon: IconDef;
  /* altura do símbolo em px (já com unitSize) */
  h: number;
  rgb: [number, number, number];
}
interface FlagItem { id: string; bounds: Bounds; canvas: HTMLCanvasElement; tex: string }
interface CountryLabel { text: string; pos: [number, number]; fs: number }
interface EventDatum { e: MapEvent; k: number; lines: string }
interface BoxT { x0: number; x1: number; y0: number; y1: number }

const polyCoords = (f: GeoFeature<object>): any => f.geometry.coordinates;
const flagBounds = (f: GeoFeature<object>): Bounds => boundsOf(mainPart(f));
const withAlpha = (rgb: [number, number, number], a: number): [number, number, number, number] => [rgb[0], rgb[1], rgb[2], a];

function keyOfMap(m: Map<string, Territory>): string {
  let s = '';
  for (const [k, e] of m) s += k + ':' + e.faction + ';';
  return s;
}

/* ---------- grade: vista e chave de cache ---------- */

function gridViewOf(m: MLMap): GridView {
  const b = m.getBounds();
  const c = m.getContainer();
  return {
    west: Math.max(-180, b.getWest()),
    east: Math.min(180, b.getEast()),
    south: Math.max(-85, b.getSouth()),
    north: Math.min(85, b.getNorth()),
    width: c.clientWidth,
    height: c.clientHeight,
    project: (lon, lat) => m.project([lon, lat]),
  };
}

/* Muda só com zoom, centro, tamanho da tela ou a configuração da grade. */
function gridKeyOf(m: MLMap, cfg: GridConfig): string {
  const c = m.getCenter();
  const box = m.getContainer();
  return `${m.getZoom().toFixed(5)}|${c.lng.toFixed(6)}|${c.lat.toFixed(6)}|${box.clientWidth}x${box.clientHeight}|${JSON.stringify(cfg)}`;
}

/* ---------- criação ---------- */

function baseStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 19,
        attribution: '© OpenStreetMap contributors',
      },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': SEA } },
      { id: 'osm', type: 'raster', source: 'osm', layout: { visibility: 'none' } },
    ],
  };
}

export function createMap(container: HTMLElement, opts: MapOptions = {}): MapApi {
  const loader: GeoLoader = opts.loadGeo ?? defaultLoadGeo;

  const map: MLMap = new MLMap({
    container,
    style: baseStyle(),
    center: [20, 40],
    zoom: 2,
    minZoom: 0,
    maxZoom: 14,
    doubleClickZoom: false,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    fadeDuration: 0,
    attributionControl: { compact: true },
  });
  map.touchZoomRotate.disableRotation();

  const overlay = new MapboxOverlay({ interleaved: true, layers: [] });
  map.addControl(overlay);

  let disposed = false;
  let scene: Scene | null = null;
  /* grade trocada por setGrid; some quando a cena recebe outra grade (ver render) */
  let gridOverride: GridConfig | null = null;
  let sceneGridSeen: GridConfig | undefined;
  let T = 0;
  let selection: MapSelection | null = null;
  let frame = 0;
  let baseKey = '';
  let regionVersion = 0;

  let countries: GeoFeature<CountryProps>[] = [];
  const countryByIso = new Map<string, GeoFeature<CountryProps>>();
  const regionsByIso = new Map<string, GeoFeature<RegionProps>[]>();
  const regionLoading = new Map<string, Promise<void>>();
  /* polígonos separados (um Polygon por feature): dados estáveis para o deck.gl não retessellar */
  let countryParts: GeoFeature<CountryProps>[] = [];
  let regionPartsCache: { v: number; data: GeoFeature<RegionProps>[] } = { v: -1, data: [] };
  /* rótulos dos países: recalculados só depois de mudar a câmera, o tamanho ou os dados (não a cada quadro) */
  let labelCache: CountryLabel[] = [];
  let labelsDirty = true;

  const clickCbs: Array<(e: MapClick) => void> = [];
  const dragCbs: Array<(e: UnitDragEvent) => void> = [];
  const dropCbs: Array<(e: FactionDropEvent) => void> = [];

  const schedule = (): void => {
    if (frame || disposed) return;
    frame = requestAnimationFrame(() => { frame = 0; commit(); });
  };
  const textures = new FlagTextures(schedule);
  const icons = new IconCache(schedule);

  /* ---- base do mapa (cor de fundo e ruas) ---- */
  function applyBase(): void {
    if (!scene || !map.isStyleLoaded()) return;
    const key = scene.mapType;
    if (key === baseKey) return;
    baseKey = key;
    map.setPaintProperty('bg', 'background-color', key === 'free' ? FREE_BG : SEA);
    map.setLayoutProperty('osm', 'visibility', key === 'tiles' ? 'visible' : 'none');
  }

  map.on('load', () => { applyBase(); schedule(); });
  map.on('move', () => { schedule(); });
  /* rótulos: recalculados ao fim de cada movimento/zoom e ao redimensionar */
  const invalidateLabels = () => { labelsDirty = true; };
  map.on('moveend', invalidateLabels);
  map.on('resize', invalidateLabels);

  /* ---- dados geográficos ---- */
  const countriesReady: Promise<void> = (async () => {
    const raw = await loader();
    countries = normalizeCountries(raw);
    countryParts = polygonParts(countries);
    for (const f of countries) if (f.properties.iso2) countryByIso.set(f.properties.iso2, f);
    labelsDirty = true;
    schedule();
  })();
  countriesReady.catch(() => { /* erro reportado por ready() */ });

  const styleReady = new Promise<void>(res => {
    if (map.loaded()) res();
    else map.once('load', () => res());
  });

  function loadRegions(iso: string): Promise<void> {
    if (regionsByIso.has(iso)) return Promise.resolve();
    const running = regionLoading.get(iso);
    if (running) return running;
    const p = (async () => {
      try {
        await countriesReady;
        const iso3 = countryByIso.get(iso)?.properties.iso3 ?? '';
        let feats: GeoFeature<RegionProps>[] = [];
        if (iso3) {
          try { feats = normalizeRegions(await loader(iso3), iso, iso3); } catch { feats = []; }
        }
        regionsByIso.set(iso, feats);
        regionVersion++;
      } catch {
        regionsByIso.set(iso, []);
      } finally {
        regionLoading.delete(iso);
        schedule();
      }
    })();
    regionLoading.set(iso, p);
    return p;
  }

  /* polígonos de todas as regiões carregadas; recalculado só quando uma região nova chega */
  function allRegionParts(): GeoFeature<RegionProps>[] {
    if (regionPartsCache.v !== regionVersion) {
      const all: GeoFeature<RegionProps>[] = [];
      for (const list of regionsByIso.values()) all.push(...list);
      regionPartsCache = { v: regionVersion, data: polygonParts(all) };
    }
    return regionPartsCache.data;
  }

  function factionColor(id: string): string {
    return scene?.factions.find(f => f.id === id)?.color ?? '#888888';
  }

  /* ---- camadas de mapa ---- */
  function overlayLayer(sc: Scene): Layer[] {
    const ov = sc.overlay;
    if (!ov || !ov.src || !ov.nw || !ov.se) return [];
    return [new BitmapLayer({
      id: 'overlay',
      image: ov.src,
      bounds: [ov.nw.lon, ov.se.lat, ov.se.lon, ov.nw.lat],
      opacity: ov.opacity ?? 1,
      pickable: false,
    })];
  }

  function countryBaseLayer(ctrl: Map<string, Territory>, fKey: string): Layer {
    return new PolygonLayer<GeoFeature<CountryProps>>({
      id: 'country-base',
      data: countryParts,
      getPolygon: polyCoords,
      filled: true,
      stroked: false,
      pickable: false,
      getFillColor: f => {
        const e = ctrl.get(f.properties.iso2);
        return e ? withAlpha(hexToRgb(factionColor(e.faction)), 153) : LAND;
      },
      updateTriggers: { getFillColor: keyOfMap(ctrl) + fKey },
    });
  }

  function countryBorderLayer(): Layer {
    return new PolygonLayer<GeoFeature<CountryProps>>({
      id: 'country-borders',
      data: countryParts,
      getPolygon: polyCoords,
      filled: false,
      stroked: true,
      pickable: false,
      getLineColor: BORDER,
      getLineWidth: 1,
      lineWidthUnits: 'pixels',
    });
  }

  function regionBaseLayer(subs: Map<string, Territory>, fKey: string, regs: GeoFeature<RegionProps>[]): Layer {
    return new PolygonLayer<GeoFeature<RegionProps>>({
      id: 'region-base',
      data: regs,
      getPolygon: polyCoords,
      filled: true,
      stroked: false,
      pickable: false,
      getFillColor: f => {
        const e = subs.get(f.properties.shapeID);
        return e ? withAlpha(hexToRgb(factionColor(e.faction)), 153) : LAND;
      },
      updateTriggers: { getFillColor: keyOfMap(subs) + fKey },
    });
  }

  function regionBorderLayer(regs: GeoFeature<RegionProps>[]): Layer {
    return new PolygonLayer<GeoFeature<RegionProps>>({
      id: 'region-borders',
      data: regs,
      getPolygon: polyCoords,
      filled: false,
      stroked: true,
      pickable: false,
      getLineColor: SUB_LINE,
      getLineWidth: 0.9,
      lineWidthUnits: 'pixels',
    });
  }

  function flagLayers(items: FlagItem[], prefix: string): Layer[] {
    return items.map(it => new BitmapLayer({
      id: prefix + it.id,
      image: it.canvas,
      bounds: [it.bounds[0][0], it.bounds[0][1], it.bounds[1][0], it.bounds[1][1]],
      pickable: false,
    }));
  }

  function countryFlagItems(ctrl: Map<string, Territory>, orgFlags: OrgFlag[], showAll: boolean): FlagItem[] {
    const out: FlagItem[] = [];
    for (const f of countries) {
      const iso = f.properties.iso2;
      if (!iso) continue;
      const e = ctrl.get(iso);
      if (!showAll && !e) continue;
      const src = flagSrcFor(e, iso, orgFlags);
      const bounds = flagBounds(f);
      const canvas = textures.get('c', iso, src, f, bounds);
      if (canvas) out.push({ id: 'c-' + iso, bounds, canvas, tex: textures.key('c', iso, src) });
    }
    return out;
  }

  function regionFlagItems(subs: Map<string, Territory>, orgFlags: OrgFlag[], showAll: boolean): FlagItem[] {
    const out: FlagItem[] = [];
    for (const [iso, list] of regionsByIso) {
      for (const f of list) {
        const id = f.properties.shapeID;
        const e = subs.get(id);
        if (!showAll && !e) continue;
        const src = flagSrcFor(e, iso, orgFlags);
        const bounds = flagBounds(f);
        const canvas = textures.get('r', id, src, f, bounds);
        if (canvas) out.push({ id: 'r-' + id, bounds, canvas, tex: textures.key('r', id, src) });
      }
    }
    return out;
  }

  /* Rótulos dos países para a projeção `m` (o mapa da tela ou o da exportação).
     Ordem por área (maiores primeiro); só os que estão na tela, têm tamanho mínimo, não colidem
     com rótulos já aceitos e cabem no limite do zoom. */
  function countryLabelData(m: MLMap, W: number, H: number): CountryLabel[] {
    const cands: { label: CountryLabel; box: BoxT; area: number }[] = [];
    for (const f of countries) {
      const b = boundsOf(f);
      const a = m.project([b[0][0], b[0][1]]);
      const c = m.project([b[1][0], b[1][1]]);
      const x0 = Math.min(a.x, c.x), x1 = Math.max(a.x, c.x);
      const y0 = Math.min(a.y, c.y), y1 = Math.max(a.y, c.y);
      const bw = x1 - x0, bh = y1 - y0;
      if (Math.max(bw, bh) < LABEL_MIN_DIM) continue;
      if (x1 < 0 || x0 > W || y1 < 0 || y0 > H) continue;
      /* rótulo no centroide; se ele saiu da tela, no centro da parte visível do bbox (país grande) */
      const cen = geoCentroid(f as never) as [number, number];
      let p = m.project(cen);
      let pos: [number, number] = cen;
      if (p.x < 0 || p.x > W || p.y < 0 || p.y > H) {
        const vx0 = Math.max(0, x0), vx1 = Math.min(W, x1), vy0 = Math.max(0, y0), vy1 = Math.min(H, y1);
        if (![vx0, vx1, vy0, vy1].every(Number.isFinite)) continue; /* coordenada inválida: não desenha esse rótulo */
        if (Math.max(vx1 - vx0, vy1 - vy0) < LABEL_MIN_DIM) continue;
        p = { x: (vx0 + vx1) / 2, y: (vy0 + vy1) / 2 } as typeof p;
        const ll = m.unproject([p.x, p.y]);
        /* o ponto escolhido precisa estar dentro do país, senão o rótulo cai no mar ou em outro país */
        if (!containsLonLat(f, ll.lng, ll.lat)) continue;
        pos = [ll.lng, ll.lat];
      }
      const fs = clamp(bw / 11, 12, 16);
      const lines = countryNameLines(f.properties.name);
      const maxLen = Math.max(...lines.map(s => s.length));
      const w = maxLen * fs * 0.58 + LABEL_PAD * 2;
      const h = lines.length * fs * 1.2 + LABEL_PAD * 2;
      cands.push({
        label: { text: lines.join('\n'), pos, fs },
        box: { x0: p.x - w / 2, x1: p.x + w / 2, y0: p.y - h / 2, y1: p.y + h / 2 },
        area: bw * bh,
      });
    }
    cands.sort((x, y) => y.area - x.area);
    const cap = countryLabelCap(m.getZoom());
    const placed: BoxT[] = [];
    const out: CountryLabel[] = [];
    for (const it of cands) {
      if (out.length >= cap) break;
      const b = it.box;
      const hit = placed.some(q => b.x0 < q.x1 + LABEL_GAP && b.x1 + LABEL_GAP > q.x0 && b.y0 < q.y1 + LABEL_GAP && b.y1 + LABEL_GAP > q.y0);
      if (hit) continue;
      placed.push(b);
      out.push(it.label);
    }
    return out;
  }

  /* rótulos da tela: recalculados só quando a câmera/tamanho mudou; a exportação calcula à parte */
  function countryLabelsFor(): CountryLabel[] {
    if (labelsDirty) {
      labelCache = countryLabelData(map, container.clientWidth, container.clientHeight);
      labelsDirty = false;
    }
    return labelCache;
  }

  /* ---- hit test ---- */
  function countryIsoAt(lon: number, lat: number): string {
    for (const f of countries) {
      if (f.properties.iso2 && containsLonLat(f, lon, lat)) return f.properties.iso2;
    }
    return '';
  }

  function resolveHit(x: number, y: number, lon: number, lat: number, forDrop: boolean): Hit {
    if (!scene) return { kind: 'none' };
    const layerIds = forDrop ? ['units'] : ['units', 'event-core', 'arrows', 'arrows-dash'];
    const picks = overlay.pickMultipleObjects({ x, y, radius: 6, layerIds });
    const first = (id: string) => picks.find(p => p.layer?.id === id)?.object;
    const u = first('units') as UnitDatum | undefined;
    if (u) return { kind: 'unit', id: u.u.id };
    if (!forDrop) {
      const ev = first('event-core') as EventDatum | undefined;
      if (ev) return { kind: 'event', id: ev.e.id };
      const ar = (first('arrows') ?? first('arrows-dash')) as ArrowGeo | undefined;
      if (ar) return { kind: 'arrow', id: ar.arrow.id };
    }
    const iso = countryIsoAt(lon, lat);
    if (!iso) return { kind: 'none' };
    if (!regionsByIso.has(iso)) void loadRegions(iso);
    const reg = regionsByIso.get(iso)?.find(f => containsLonLat(f, lon, lat));
    if (reg) return { kind: 'region', id: reg.properties.shapeID, iso, sub: reg.properties.shapeID };
    return { kind: 'country', id: iso, iso };
  }

  /* ---- desenho da cena ---- */
  /* `m` é o mapa cuja projeção vale (a tela, ou o mapa de exportação em 1920x1080). */
  function buildLayers(m: MLMap = map, cacheable = true): Layer[] {
    const sc = scene;
    if (!sc) return [];
    const ov = sc.overlay;
    const calibrated = !!(ov && ov.src && ov.nw && ov.se);
    const countriesOn = sc.mapType === 'country' && !calibrated;
    const ctrl = controlAt(sc.territories, T);
    const subs = subControlAt(sc.territories, T);
    const orgFlags = sc.orgFlags ?? [];
    const showAll = sc.showAllFlags !== false;
    const fKey = sc.factions.map(f => f.id + f.color).join(',');
    const layers: Layer[] = [];

    if (calibrated) layers.push(...overlayLayer(sc));

    if (countriesOn) {
      layers.push(countryBaseLayer(ctrl, fKey));
      layers.push(...flagLayers(countryFlagItems(ctrl, orgFlags, showAll), 'cf-'));
      layers.push(countryBorderLayer());

      const regs = allRegionParts();
      layers.push(regionBaseLayer(subs, fKey, regs));
      layers.push(...flagLayers(regionFlagItems(subs, orgFlags, showAll), 'rf-'));
      layers.push(regionBorderLayer(regs));

      const labels = cacheable
        ? countryLabelsFor()
        : countryLabelData(m, m.getContainer().clientWidth, m.getContainer().clientHeight);
      layers.push(new TextLayer<CountryLabel>({
        id: 'country-labels',
        data: labels,
        getPosition: d => d.pos,
        getText: d => d.text,
        getSize: d => d.fs,
        sizeUnits: 'pixels',
        getColor: WHITE,
        getTextAnchor: 'middle',
        getAlignmentBaseline: 'center',
        fontFamily: LABEL_FONT,
        fontSettings: { sdf: true, fontWeight: 600 },
        characterSet: 'auto',
        lineHeight: 1.15,
        outlineWidth: 0.2,
        outlineColor: BLACK,
        background: true,
        getBackgroundColor: LABEL_BG,
        backgroundPadding: [LABEL_PAD, 2, LABEL_PAD, 2],
        pickable: false,
      }));
    }

    /* grades de referência: por cima dos países, por baixo de rastros e unidades. Recalculadas só quando a vista muda. */
    const gcfg = gridOverride ?? sc.grid;
    if (gcfg && (gcfg.lonLat.enabled || gcfg.custom.enabled || gcfg.mgrs.enabled)) {
      const key = cacheable ? gridKeyOf(m, gcfg) : undefined;
      layers.push(...gridLayers(gridDataFor(gcfg, gridViewOf(m), key)));
    }

    /* rastros */
    if (sc.showTrails) {
      const trails = sc.units
        .map(u => ({ path: trailPoints(u, T), rgb: hexToRgb(factionColor(u.faction)) }))
        .filter(d => d.path.length >= 2);
      layers.push(new PathLayer<{ path: [number, number][]; rgb: [number, number, number] }, PathStyleExtensionProps<{ path: [number, number][]; rgb: [number, number, number] }>>({
        id: 'trails',
        data: trails,
        getPath: d => d.path,
        getColor: d => withAlpha(d.rgb, 204),
        getWidth: 3,
        widthUnits: 'pixels',
        extensions: [dashExt],
        getDashArray: [10, 8],
        dashUnits: 'pixels',
        pickable: false,
      }));
    }

    /* setas: a parte já percorrida; a ponta aparece quando a seta chega */
    const geos = sc.arrows.filter(a => T >= a.t0).map(a => arrowGeo(a, T));
    const solid = geos.filter(g => !(g.arrow.kind === 'withdraw' && g.p >= 1) && g.path.length >= 2);
    const dashed = geos.filter(g => g.arrow.kind === 'withdraw' && g.p >= 1 && g.path.length >= 2);
    const arrowRgb = (g: ArrowGeo) => hexToRgb(factionColor(g.arrow.faction));
    layers.push(new PathLayer<ArrowGeo>({
      id: 'arrows',
      data: solid,
      getPath: g => g.path,
      getColor: g => withAlpha(arrowRgb(g), 235),
      getWidth: 8,
      widthUnits: 'pixels',
      capRounded: true,
      pickable: true,
    }));
    layers.push(new PathLayer<ArrowGeo, PathStyleExtensionProps<ArrowGeo>>({
      id: 'arrows-dash',
      data: dashed,
      getPath: g => g.path,
      getColor: g => withAlpha(arrowRgb(g), 235),
      getWidth: 8,
      widthUnits: 'pixels',
      capRounded: true,
      extensions: [dashExt],
      getDashArray: [18, 12],
      dashUnits: 'pixels',
      pickable: true,
    }));
    const heads = geos.flatMap(g => {
      if (!g.head) return [];
      const def = icons.arrowHead(factionColor(g.arrow.faction));
      return def ? [{ lon: g.head.lon, lat: g.head.lat, angle: g.head.angleDeg, def }] : [];
    });
    layers.push(new IconLayer<{ lon: number; lat: number; angle: number; def: IconDef }>({
      id: 'arrow-heads',
      data: heads,
      getPosition: d => [d.lon, d.lat],
      getIcon: d => d.def,
      getSize: 20,
      sizeUnits: 'pixels',
      getAngle: d => -d.angle,
      pickable: false,
    }));

    /* eventos: pulso (ataque) + núcleo + texto com quebra de linha */
    const evs: EventDatum[] = sc.events
      .filter(e => T >= e.t && T <= e.t + (e.dur || 3))
      .map(e => ({ e, k: clamp((T - e.t) / (e.dur || 3), 0, 1), lines: wrapText(e.text, 30).join('\n') }));
    layers.push(new ScatterplotLayer<EventDatum>({
      id: 'event-pulse',
      data: evs.filter(d => d.e.kind !== 'note'),
      getPosition: d => [d.e.lon, d.e.lat],
      getRadius: d => 12 + 40 * d.k,
      radiusUnits: 'pixels',
      filled: false,
      stroked: true,
      lineWidthUnits: 'pixels',
      getLineWidth: 5,
      getLineColor: d => [EVENT_RED[0], EVENT_RED[1], EVENT_RED[2], Math.round(255 * (1 - d.k * 0.85))],
      updateTriggers: { getRadius: T, getLineColor: T },
      pickable: false,
    }));
    layers.push(new ScatterplotLayer<EventDatum>({
      id: 'event-core',
      data: evs,
      getPosition: d => [d.e.lon, d.e.lat],
      getRadius: 7,
      radiusUnits: 'pixels',
      filled: true,
      stroked: true,
      lineWidthUnits: 'pixels',
      getLineWidth: 1.5,
      getLineColor: BLACK,
      getFillColor: d => (d.e.kind === 'note' ? NOTE_YELLOW : EVENT_RED),
      pickable: true,
    }));
    layers.push(new TextLayer<EventDatum>({
      id: 'event-text',
      data: evs.filter(d => d.e.text),
      getPosition: d => [d.e.lon, d.e.lat],
      getText: d => d.lines,
      getSize: LABEL_PX,
      sizeUnits: 'pixels',
      getColor: WHITE,
      getTextAnchor: 'middle',
      getAlignmentBaseline: 'bottom',
      getPixelOffset: d => [0, -(30 + (d.lines.split('\n').length - 1) * LABEL_PX * 1.2)],
      fontFamily: LABEL_FONT,
      fontSettings: { sdf: true, fontWeight: 600 },
      characterSet: 'auto',
      outlineWidth: 0.3,
      outlineColor: BLACK,
      pickable: false,
    }));

    /* unidades */
    const unitData: UnitDatum[] = [];
    for (const u of sc.units) {
      const p = posAt(u.path, T);
      if (!p) continue;
      const fac = sc.factions.find(f => f.id === u.faction);
      const color = fac?.color ?? '#888888';
      const ic = icons.unitIcon(sc.symbolStyle, u.type, color, fac?.affil ?? 'unknown');
      if (!ic) continue;
      unitData.push({ u, lon: p.lon, lat: p.lat, icon: ic.def, h: ic.h * sc.unitSize, rgb: hexToRgb(color) });
    }
    const selUnit = selection?.kind === 'unit' ? selection.id : null;
    if (selUnit) {
      layers.push(new ScatterplotLayer<UnitDatum>({
        id: 'unit-ring',
        data: unitData.filter(d => d.u.id === selUnit),
        getPosition: d => [d.lon, d.lat],
        getRadius: 30 * sc.unitSize,
        radiusUnits: 'pixels',
        filled: false,
        stroked: true,
        lineWidthUnits: 'pixels',
        getLineWidth: 3,
        getLineColor: RING,
        pickable: false,
      }));
    }
    layers.push(new IconLayer<UnitDatum>({
      id: 'units',
      data: unitData,
      getPosition: d => [d.lon, d.lat],
      getIcon: d => d.icon,
      getSize: d => d.h,
      sizeUnits: 'pixels',
      pickable: true,
    }));
    const ech = unitData.filter(d => echelonMark(d.u.echelon));
    layers.push(new TextLayer<UnitDatum>({
      id: 'unit-echelon',
      data: ech,
      getPosition: d => [d.lon, d.lat],
      getText: d => echelonMark(d.u.echelon),
      getSize: 13,
      sizeUnits: 'pixels',
      getColor: WHITE,
      getTextAnchor: 'middle',
      getAlignmentBaseline: 'bottom',
      getPixelOffset: d => [0, -(d.h / 2 + 5)],
      fontFamily: LABEL_FONT,
      fontSettings: { sdf: true, fontWeight: 800 },
      characterSet: 'auto',
      outlineWidth: 0.3,
      outlineColor: BLACK,
      pickable: false,
    }));

    /* nomes das unidades, sem colisão (a selecionada tem prioridade) */
    if (sc.showLabels) {
      const items = unitData.map(d => {
        const P = m.project([d.lon, d.lat]);
        const ly = d.h / 2 + 16;
        const w = d.u.name.length * LABEL_PX * 0.6 / 2;
        return {
          d,
          selected: d.u.id === selUnit,
          box: { x0: P.x - w, x1: P.x + w, y0: P.y + ly - LABEL_PX * 0.85, y1: P.y + ly + LABEL_PX * 0.25 } as BoxT,
        };
      });
      items.sort((a, b) => Number(b.selected) - Number(a.selected));
      const placed: BoxT[] = [];
      const visible: UnitDatum[] = [];
      for (const it of items) {
        const b = it.box;
        const hit = placed.some(q => b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0);
        if (it.selected || !hit) {
          visible.push(it.d);
          placed.push(b);
        }
      }
      layers.push(new TextLayer<UnitDatum>({
        id: 'unit-labels',
        data: visible,
        getPosition: d => [d.lon, d.lat],
        getText: d => d.u.name,
        getSize: LABEL_PX,
        sizeUnits: 'pixels',
        getColor: WHITE,
        getTextAnchor: 'middle',
        getAlignmentBaseline: 'center',
        getPixelOffset: d => [0, d.h / 2 + 22],
        fontFamily: LABEL_FONT,
        fontSettings: { sdf: true, fontWeight: 600 },
        characterSet: 'auto',
        outlineWidth: 0.25,
        outlineColor: BLACK,
        pickable: false,
      }));
    }

    layers.push(...extraLayers);
    return layers;
  }

  /* Camadas extras (alcance, rota, névoa de guerra) vindas da interface; desenhadas por cima. */
  let extraLayers: Layer[] = [];

  function commit(): void {
    if (!scene || disposed) return;
    applyBase();
    overlay.setProps({ layers: buildLayers() });
    map.triggerRepaint();
  }

  /* ---- interação: clique ---- */
  map.on('click', e => {
    if (disposed) return;
    const lon = e.lngLat.lng, lat = e.lngLat.lat;
    const hit = resolveHit(e.point.x, e.point.y, lon, lat, false);
    for (const cb of clickCbs) cb({ lat, lon, hit });
  });

  /* ---- interação: arrastar unidade (desliga o arraste do mapa enquanto dura) ---- */
  let drag: { unitId: string } | null = null;
  const rel = (ev: MouseEvent | DragEvent) => {
    const r = container.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  };
  const emitDrag = (phase: UnitDragEvent['phase'], lon: number, lat: number) => {
    if (!drag) return;
    for (const cb of dragCbs) cb({ unitId: drag.unitId, lat, lon, phase });
  };
  const onMove = (ev: MouseEvent) => {
    if (!drag) return;
    const { x, y } = rel(ev);
    const ll = map.unproject([x, y]);
    emitDrag('move', ll.lng, ll.lat);
  };
  const onUp = (ev: MouseEvent) => {
    if (!drag) return;
    const { x, y } = rel(ev);
    const ll = map.unproject([x, y]);
    emitDrag('end', ll.lng, ll.lat);
    drag = null;
    map.dragPan.enable();
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };
  const onDown = (ev: MouseEvent) => {
    if (disposed || ev.button !== 0 || !scene) return;
    const { x, y } = rel(ev);
    const info = overlay.pickObject({ x, y, radius: 8, layerIds: ['units'] });
    const d = info?.object as UnitDatum | undefined;
    if (!d) return;
    drag = { unitId: d.u.id };
    map.dragPan.disable();
    const ll = map.unproject([x, y]);
    emitDrag('start', ll.lng, ll.lat);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };
  container.addEventListener('mousedown', onDown, true);

  /* ---- interação: soltar uma força (arrastada da interface) ---- */
  const onDragOver = (ev: DragEvent) => {
    if (ev.dataTransfer && Array.from(ev.dataTransfer.types).includes('text/plain')) {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'copy';
    }
  };
  const onDrop = (ev: DragEvent) => {
    ev.preventDefault();
    const factionId = ev.dataTransfer?.getData('text/plain') ?? '';
    if (!factionId) return;
    const { x, y } = rel(ev);
    const ll = map.unproject([x, y]);
    const hit = resolveHit(x, y, ll.lng, ll.lat, true);
    for (const cb of dropCbs) cb({ factionId, lat: ll.lat, lon: ll.lng, hit });
  };
  container.addEventListener('dragover', onDragOver);
  container.addEventListener('drop', onDrop);

  /* ---- exportação: quadro atual em 1920x1080 ---- */
  async function exportPng(): Promise<Blob> {
    await ready();
    if (!scene) throw new Error('nenhuma cena para exportar');
    const W = 1920, H = 1080;
    const host = document.createElement('div');
    host.style.cssText = `position:fixed;left:-20000px;top:0;width:${W}px;height:${H}px;`;
    document.body.append(host);
    const zoom = map.getZoom() + Math.log2(W / Math.max(1, container.clientWidth));
    const m = new MLMap({
      container: host,
      style: map.getStyle(),
      center: map.getCenter(),
      zoom,
      bearing: 0,
      pitch: 0,
      pixelRatio: 1,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    const ov = new MapboxOverlay({ interleaved: true, layers: [] });
    try {
      m.addControl(ov);
      await new Promise<void>(res => { if (m.loaded()) res(); else m.once('load', () => res()); });
      ov.setProps({ layers: buildLayers(m, false) });
      const idle = () => new Promise<void>(res => m.once('idle', () => res()));
      await idle();
      await new Promise(res => setTimeout(res, 600));
      m.triggerRepaint();
      await idle();
      return await new Promise<Blob>((res, rej) => {
        m.getCanvas().toBlob(b => (b ? res(b) : rej(new Error('falha ao gerar PNG'))), 'image/png');
      });
    } finally {
      m.remove();
      host.remove();
    }
  }

  /* ---- pronto: países, estilo e bandeiras de todos os países carregados ---- */
  async function ready(): Promise<void> {
    await countriesReady;
    await styleReady;
    await Promise.all(countries
      .filter(f => f.properties.iso2)
      .map(f => textures.wait('c', f.properties.iso2, flagUrl(f.properties.iso2), f, flagBounds(f))));
    schedule();
  }

  const api: MapApi = {
    render(sc, t) {
      if (disposed) return;
      scene = sc;
      T = t;
      if (sc.grid !== sceneGridSeen) {
        sceneGridSeen = sc.grid;
        gridOverride = null;
      }
      for (const e of sc.territories) {
        if (e.sub && !regionsByIso.has(e.iso)) void loadRegions(e.iso);
      }
      commit();
    },
    fitRegion(region) {
      if (disposed) return;
      map.fitBounds([[region.lon0, region.lat0], [region.lon1, region.lat1]], {
        padding: { top: 100, bottom: 170, left: 60, right: 60 },
        maxZoom: 14,
        duration: 0,
      });
    },
    setViewport(v) {
      if (disposed) return;
      map.jumpTo({ center: [v.lon, v.lat], zoom: v.zoom });
    },
    setExtraLayers(layers) {
      extraLayers = layers;
      if (!disposed) commit();
    },
    onClick(cb) { clickCbs.push(cb); },
    onDragUnit(cb) { dragCbs.push(cb); },
    onDropFaction(cb) { dropCbs.push(cb); },
    ready,
    exportPng,
    dispose() {
      if (disposed) return;
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      container.removeEventListener('mousedown', onDown, true);
      container.removeEventListener('dragover', onDragOver);
      container.removeEventListener('drop', onDrop);
      map.remove();
    },
    setSelection(sel) {
      selection = sel;
      if (!disposed) commit();
    },
    loadRegions,
    toScreen(lat, lon) {
      if (disposed || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      const p = map.project([lon, lat]);
      return Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: p.x, y: p.y } : null;
    },
    toLatLon(x, y) {
      if (disposed || !Number.isFinite(x) || !Number.isFinite(y)) return null;
      const ll = map.unproject([x, y]);
      return Number.isFinite(ll.lat) && Number.isFinite(ll.lng) ? { lat: ll.lat, lon: ll.lng } : null;
    },
    setGrid(g) {
      if (disposed) return;
      gridOverride = normalizeGrid(g);
      commit();
    },
  };
  return api;
}
