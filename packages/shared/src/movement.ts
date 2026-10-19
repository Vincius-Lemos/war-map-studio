import { haversineKm, type LatLon } from './geo-measure.ts';
import type { Unit, UnitType } from './scene.ts';

/* Planejamento de movimento: funções puras sobre uma malha hexagonal em lat/lon.
   Ideias do godot-hexgrid (distância, vizinhança, alcance por BFS, caminho mínimo por A*),
   adaptadas ao mapa geográfico. Sem desenho: a camada visual fica em apps/web/src/map/overlays.ts.

   Projeção local: x = lon · 111,32 · cos(lat) km, y = lat · 110,57 km. A malha é feita no plano (x, y)
   com hexágonos "pointy-top". `cellKm` é a distância entre centros de células vizinhas (= custo de um
   passo), então alcance e rota ficam em km reais. Longe do equador, a forma em graus se deforma. */

const KM_PER_DEG_LAT = 110.57;
const KM_PER_DEG_LON_EQUATOR = 111.32;
const SQRT3 = Math.sqrt(3);
const MIN_COS = 1e-6;

/* Limite de células do alcance (BFS) e de expansões do A* (segurança). */
export const MAX_REACH_CELLS = 5000;
const MAX_ROUTE_EXPANSIONS = 200_000;

/* Coordenadas axiais (q, r) de uma célula hexagonal. */
export interface HexCell {
  q: number;
  r: number;
}

/* Célula do alcance: centro geográfico e custo acumulado (km) desde a origem. */
export interface ReachCell extends HexCell, LatLon {
  costKm: number;
}

/* Rota: pontos (origem, centros intermediários e destino) e comprimento total em km. */
export interface RouteResult {
  cells: LatLon[];
  lengthKm: number;
}

/* Velocidades padrão de planejamento por tipo (km/h). */
const DEFAULT_SPEED_KMH: Record<UnitType, number> = {
  inf: 4,
  mech: 25,
  motor: 20,
  arm: 30,
  cav: 25,
  art: 10,
  eng: 8,
  fort: 0,
  hq: 15,
  civ: 5,
};

export function defaultSpeedKmh(type: UnitType): number {
  return DEFAULT_SPEED_KMH[type];
}

/* Velocidade da unidade: a própria, se válida; senão a padrão do tipo. */
export function unitSpeedKmh(unit: Pick<Unit, 'type' | 'speedKmh'>): number {
  const s = unit.speedKmh;
  return typeof s === 'number' && Number.isFinite(s) && s >= 0 ? s : defaultSpeedKmh(unit.type);
}

function assertCellKm(cellKm: number): void {
  if (!Number.isFinite(cellKm) || cellKm <= 0) throw new RangeError('cellKm deve ser um número > 0');
}

/* Raio do hexágono (centro ao vértice) para que centros vizinhos fiquem a `cellKm`. */
function radiusKm(cellKm: number): number {
  return cellKm / SQRT3;
}

/* Projeção local de (lat, lon) para o plano em km e volta. */
function toPlane(p: LatLon): { x: number; y: number } {
  const c = Math.max(Math.cos((p.lat * Math.PI) / 180), MIN_COS);
  return { x: p.lon * KM_PER_DEG_LON_EQUATOR * c, y: p.lat * KM_PER_DEG_LAT };
}

function fromPlane(x: number, y: number): LatLon {
  const lat = y / KM_PER_DEG_LAT;
  const c = Math.max(Math.cos((lat * Math.PI) / 180), MIN_COS);
  return { lat, lon: x / (KM_PER_DEG_LON_EQUATOR * c) };
}

/* Arredondamento cúbico: garante que (q, r, s) some zero. */
function cubeRound(qf: number, rf: number): HexCell {
  const sf = -qf - rf;
  let q = Math.round(qf);
  let r = Math.round(rf);
  const s = Math.round(sf);
  const dq = Math.abs(q - qf);
  const dr = Math.abs(r - rf);
  const ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return { q, r };
}

/* Distância em passos de hexágono entre duas células. */
export function hexDistance(a: HexCell, b: HexCell): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
}

/* Os 6 vizinhos axiais de uma célula. */
export function neighbors(q: number, r: number): HexCell[] {
  return [
    { q: q + 1, r },
    { q: q + 1, r: r - 1 },
    { q, r: r - 1 },
    { q: q - 1, r },
    { q: q - 1, r: r + 1 },
    { q, r: r + 1 },
  ];
}

/* Célula que contém (lat, lon). */
export function cellOf(lat: number, lon: number, cellKm: number): HexCell {
  assertCellKm(cellKm);
  const { x, y } = toPlane({ lat, lon });
  const size = radiusKm(cellKm);
  return cubeRound((SQRT3 / 3 * x - y / 3) / size, (2 / 3 * y) / size);
}

/* Centro geográfico de uma célula. */
export function cellCenter(q: number, r: number, cellKm: number): LatLon {
  assertCellKm(cellKm);
  const size = radiusKm(cellKm);
  return fromPlane(size * SQRT3 * (q + r / 2), size * 1.5 * r);
}

/* Os 6 vértices de uma célula, em lat/lon (para desenhar o polígono). */
export function hexCorners(q: number, r: number, cellKm: number): LatLon[] {
  assertCellKm(cellKm);
  const size = radiusKm(cellKm);
  const cx = size * SQRT3 * (q + r / 2);
  const cy = size * 1.5 * r;
  const out: LatLon[] = [];
  for (let i = 0; i < 6; i++) {
    const a = ((60 * i + 30) * Math.PI) / 180;
    out.push(fromPlane(cx + size * Math.cos(a), cy + size * Math.sin(a)));
  }
  return out;
}

const cellKey = (c: HexCell): string => `${c.q},${c.r}`;

/* Alcance: células atingíveis em `hours` horas a `speedKmh`, por BFS com custo uniforme (cellKm por passo).
   A célula inicial vem sempre (custo 0). Para em MAX_REACH_CELLS células. */
export function reachableCells(start: LatLon, hours: number, cellKm: number, speedKmh: number): ReachCell[] {
  assertCellKm(cellKm);
  const rangeKm = Math.max(0, hours) * Math.max(0, speedKmh);
  const maxSteps = Math.floor(rangeKm / cellKm + 1e-9);
  const origin = cellOf(start.lat, start.lon, cellKm);
  const out: ReachCell[] = [];
  const seen = new Set<string>([cellKey(origin)]);

  const push = (c: HexCell, steps: number): void => {
    const center = cellCenter(c.q, c.r, cellKm);
    out.push({ q: c.q, r: c.r, lat: center.lat, lon: center.lon, costKm: steps * cellKm });
  };
  push(origin, 0);

  let frontier: HexCell[] = [origin];
  for (let step = 1; step <= maxSteps && frontier.length > 0; step++) {
    const next: HexCell[] = [];
    for (const c of frontier) {
      for (const n of neighbors(c.q, c.r)) {
        if (out.length >= MAX_REACH_CELLS) return out;
        const k = cellKey(n);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push(n);
        push(n, step);
      }
    }
    frontier = next;
  }
  return out;
}

/* Heap mínimo simples para a fila aberta do A*. */
class MinHeap<T> {
  private items: Array<{ p: number; v: T }> = [];

  get size(): number {
    return this.items.length;
  }

  push(p: number, v: T): void {
    const a = this.items;
    a.push({ p, v });
    let i = a.length - 1;
    while (i > 0) {
      const par = (i - 1) >> 1;
      if (a[par].p <= a[i].p) break;
      [a[par], a[i]] = [a[i], a[par]];
      i = par;
    }
  }

  pop(): T | undefined {
    const a = this.items;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop();
    if (a.length > 0 && last) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].p < a[m].p) m = l;
        if (r < a.length && a[r].p < a[m].p) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top.v;
  }
}

/* Caminho mínimo entre dois pontos: A* na malha (custo uniforme, heurística = distância hex).
   Devolve origem, centros das células intermediárias e destino. Mesma célula: só o destino.
   Lança erro se a rota exceder MAX_ROUTE_EXPANSIONS expansões. */
export function shortestPath(from: LatLon, to: LatLon, cellKm: number): RouteResult {
  assertCellKm(cellKm);
  const a = cellOf(from.lat, from.lon, cellKm);
  const b = cellOf(to.lat, to.lon, cellKm);

  if (cellKey(a) === cellKey(b)) {
    return { cells: [{ lat: to.lat, lon: to.lon }], lengthKm: haversineKm(from, to) };
  }

  const gScore = new Map<string, number>([[cellKey(a), 0]]);
  const cameFrom = new Map<string, HexCell>();
  const closed = new Set<string>();
  const open = new MinHeap<HexCell>();
  open.push(hexDistance(a, b), a);

  let expansions = 0;
  let found = false;
  while (open.size > 0) {
    const cur = open.pop();
    if (!cur) break;
    const ck = cellKey(cur);
    if (closed.has(ck)) continue;
    if (cellKey(cur) === cellKey(b)) {
      found = true;
      break;
    }
    closed.add(ck);
    if (++expansions > MAX_ROUTE_EXPANSIONS) throw new Error('rota longa demais para o planejamento');

    const g = gScore.get(ck) ?? 0;
    for (const n of neighbors(cur.q, cur.r)) {
      const nk = cellKey(n);
      if (closed.has(nk)) continue;
      const ng = g + 1;
      if (ng < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, ng);
        cameFrom.set(nk, cur);
        open.push(ng + hexDistance(n, b), n);
      }
    }
  }
  if (!found) throw new Error('sem caminho');

  /* reconstrói a sequência de células, de b até a origem */
  const chain: HexCell[] = [b];
  let step = cameFrom.get(cellKey(b));
  while (step) {
    chain.push(step);
    step = cameFrom.get(cellKey(step));
  }
  chain.reverse();

  const points: LatLon[] = [{ lat: from.lat, lon: from.lon }];
  for (const c of chain.slice(1, -1)) {
    const center = cellCenter(c.q, c.r, cellKm);
    points.push({ lat: center.lat, lon: center.lon });
  }
  points.push({ lat: to.lat, lon: to.lon });

  let lengthKm = 0;
  for (let i = 1; i < points.length; i++) lengthKm += haversineKm(points[i - 1], points[i]);
  return { cells: points, lengthKm };
}

/* Horas para percorrer `lengthKm` a `speedKmh`. Velocidade zero: infinito. */
export function etaHours(lengthKm: number, speedKmh: number): number {
  if (!(speedKmh > 0)) return Infinity;
  return lengthKm / speedKmh;
}
