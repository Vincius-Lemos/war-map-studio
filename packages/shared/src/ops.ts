import type { Echelon, Scene, Territory, UnitType } from './scene.ts';
import { sortPath } from './normalize.ts';

/* Operações puras sobre a cena: devolvem uma cena nova, nunca alteram a entrada. */

const r2 = (v: number) => Math.round(v * 100) / 100;
const copy = (s: Scene): Scene => structuredClone(s);

/* Grava um ponto do trajeto no instante t (substitui o ponto desse instante, se existir). */
export function setWaypoint(scene: Scene, unitId: string, t: number, lat: number, lon: number): Scene {
  const next = copy(scene);
  const unit = next.units.find((u) => u.id === unitId);
  if (!unit) return scene;
  const i = unit.path.findIndex((q) => Math.abs(q.t - t) < 0.02);
  const existing = unit.path[i];
  if (i >= 0 && existing) {
    existing.lat = lat;
    existing.lon = lon;
  } else {
    unit.path.push({ t: r2(t), lat, lon });
  }
  unit.path = sortPath(unit.path);
  return next;
}

export function removeWaypoint(scene: Scene, unitId: string, index: number): Scene {
  const next = copy(scene);
  const unit = next.units.find((u) => u.id === unitId);
  if (!unit) return scene;
  unit.path.splice(index, 1);
  return next;
}

/* Bandeira do território: a de organização escolhida (flag) e o país da força que pinta (fcode). */
function flagFields(scene: Scene, faction: string, flag: string | null): Pick<Territory, 'flag' | 'fcode'> {
  const out: Pick<Territory, 'flag' | 'fcode'> = {};
  if (flag) out.flag = flag;
  const fcode = scene.factions.find((f) => f.id === faction)?.flag;
  if (fcode) out.fcode = fcode;
  return out;
}

/* Pinta um país inteiro a partir de t. Substitui o registro do mesmo país nesse instante. */
export function setTerritory(
  scene: Scene,
  p: { t: number; iso: string; name: string; faction: string; flag?: string | null },
): Scene {
  const t = r2(p.t);
  const next = copy(scene);
  next.territories = next.territories.filter((e) => !(!e.sub && e.iso === p.iso && Math.abs(e.t - t) < 0.02));
  next.territories.push({ iso: p.iso, name: p.name, t, faction: p.faction, ...flagFields(scene, p.faction, p.flag ?? null) });
  return next;
}

/* Pinta uma região (estado/província, identificada por sub = shapeID) a partir de t. */
export function setSubTerritory(
  scene: Scene,
  p: { t: number; iso: string; sub: string; countryName: string; regionName: string; faction: string; flag?: string | null },
): Scene {
  const t = r2(p.t);
  const next = copy(scene);
  next.territories = next.territories.filter((e) => !(e.sub === p.sub && Math.abs(e.t - t) < 0.02));
  const entry: Territory = {
    iso: p.iso,
    sub: p.sub,
    name: `${p.regionName} (${p.countryName})`,
    t,
    faction: p.faction,
    ...flagFields(scene, p.faction, p.flag ?? null),
  };
  next.territories.push(entry);
  return next;
}

export function removeTerritoryAt(scene: Scene, index: number): Scene {
  const next = copy(scene);
  next.territories.splice(index, 1);
  return next;
}

export type FieldTarget =
  | { kind: 'unit'; id: string; field: 'name' | 'faction' | 'type' | 'echelon' | 'note' }
  | { kind: 'wp'; id: string; index: number; field: 't' | 'lat' | 'lon' }
  | { kind: 'arrow'; id: string; field: 't0' | 't1' | 'from.lat' | 'from.lon' | 'to.lat' | 'to.lon' | 'kind' | 'faction' }
  | { kind: 'event'; id: string; field: 'text' | 't' | 'dur' | 'lat' | 'lon' | 'kind' }
  | { kind: 'fac'; id: string; field: 'name' | 'color' | 'affil' | 'flag' }
  | {
      kind: 'scene';
      field:
        | 'title' | 'startDate' | 'year' | 'durationH' | 'symbolStyle' | 'unitSize'
        | 'showLabels' | 'showTrails' | 'showAllFlags'
        | 'region.lon0' | 'region.lat0' | 'region.lon1' | 'region.lat1';
    }
  | { kind: 'ov'; field: 'opacity' };

const NUMERIC = new Set([
  't', 'lat', 'lon', 't0', 't1', 'dur', 'durationH', 'unitSize', 'opacity',
  'region.lon0', 'region.lat0', 'region.lon1', 'region.lat1',
  'from.lat', 'from.lon', 'to.lat', 'to.lon',
]);
const BOOLEAN = new Set(['showLabels', 'showTrails', 'showAllFlags']);

export type ApplyResult = { ok: true; scene: Scene } | { ok: false; error: string };

function setDeep(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (k === undefined) return;
    cur = cur[k] as Record<string, unknown>;
  }
  const last = keys[keys.length - 1];
  if (last !== undefined) cur[last] = value;
}

/* Aplica a edição de um campo do inspetor. `value` vem do formulário (texto, número ou booleano). */
export function applyField(scene: Scene, target: FieldTarget, value: string | boolean): ApplyResult {
  const field: string = target.field;
  let v: unknown = value;
  if (NUMERIC.has(field)) {
    const n = typeof value === 'string' ? Number.parseFloat(value) : Number.NaN;
    if (!Number.isFinite(n)) return { ok: false, error: 'Use um número válido.' };
    v = n;
  } else if (BOOLEAN.has(field)) {
    v = Boolean(value);
  }

  const next = copy(scene);
  switch (target.kind) {
    case 'unit': {
      const u = next.units.find((x) => x.id === target.id);
      if (u) setDeep(u as unknown as Record<string, unknown>, field, v);
      break;
    }
    case 'wp': {
      const u = next.units.find((x) => x.id === target.id);
      const p = u?.path[target.index];
      if (p) {
        setDeep(p as unknown as Record<string, unknown>, field, v);
        if (u) u.path = sortPath(u.path);
      }
      break;
    }
    case 'arrow': {
      const a = next.arrows.find((x) => x.id === target.id);
      if (a) setDeep(a as unknown as Record<string, unknown>, field, v);
      break;
    }
    case 'event': {
      const e = next.events.find((x) => x.id === target.id);
      if (e) setDeep(e as unknown as Record<string, unknown>, field, v);
      break;
    }
    case 'fac': {
      const f = next.factions.find((x) => x.id === target.id);
      if (!f) break;
      if (field === 'flag') {
        if (value) f.flag = String(value);
        else delete f.flag;
      } else {
        setDeep(f as unknown as Record<string, unknown>, field, v);
      }
      break;
    }
    case 'scene': {
      if (field === 'year') {
        const s = String(value).trim();
        next.year = s === '' ? null : clampYear(Number.parseInt(s, 10));
      } else if (field === 'durationH') {
        next.durationH = Math.min(2000, Math.max(1, v as number));
      } else if (field === 'startDate' || field === 'title' || field === 'symbolStyle') {
        setDeep(next as unknown as Record<string, unknown>, field, String(value));
      } else {
        setDeep(next as unknown as Record<string, unknown>, field, v);
      }
      break;
    }
    case 'ov': {
      if (next.overlay) next.overlay.opacity = v as number;
      break;
    }
  }
  return { ok: true, scene: next };
}

function clampYear(y: number): number | null {
  return Number.isFinite(y) ? y : null;
}

/* ---------- colocação de unidades ---------- */

export const UNIT_SHORT: Record<UnitType, string> = {
  inf: 'Inf', mech: 'Mec', motor: 'Mot', arm: 'Bld', cav: 'Cav',
  art: 'Art', eng: 'Eng', fort: 'Fort', hq: 'QG', civ: 'Civ',
};

export const ECHELON_SHORT: Record<Echelon, string> = {
  '': '', co: 'Cia', bn: 'Bn', reg: 'Rgt', bde: 'Bde', div: 'Div', corps: 'C Ex',
};

export interface UnitSpec {
  type: UnitType;
  echelon: Echelon;
  factionId: string;
  lat: number;
  lon: number;
  t: number;
  name?: string;
}

export type PlaceResult = { ok: true; scene: Scene; unitId: string } | { ok: false; error: string };

/* Encaixe (scene.grid.snap ligado): vai para o centro da célula de lado snapStep graus em que o ponto cai.
   As células começam em (0, 0), como as linhas da graticule. Sem encaixe, devolve o ponto como veio. */
export function snapToGrid(scene: Scene, lat: number, lon: number): { lat: number; lon: number } {
  const g = scene.grid;
  if (!g?.snap || !(g.snapStep > 0)) return { lat, lon };
  const step = g.snapStep;
  const center = (v: number) => (Math.floor(v / step) + 0.5) * step;
  return { lat: r6(center(lat)), lon: r6(center(lon)) };
}

const r6 = (v: number) => Math.round(v * 1e6) / 1e6;

/* Nome sugerido no padrão da casa: "1º Bn Inf", "2º Bn Inf"... numerado entre unidades da mesma força, tipo e escalão. */
export function suggestUnitName(scene: Scene, p: { type: UnitType; echelon: Echelon; factionId: string }): string {
  const same = scene.units.filter((u) => u.faction === p.factionId && u.type === p.type && u.echelon === p.echelon).length;
  const n = same + 1;
  const ech = ECHELON_SHORT[p.echelon];
  return [`${n}º`, ech, UNIT_SHORT[p.type]].filter(Boolean).join(' ');
}

function newUnitId(scene: Scene): string {
  const used = new Set(scene.units.map((u) => u.id));
  let id: string;
  do {
    id = 'u' + Math.random().toString(36).slice(2, 9);
  } while (used.has(id));
  return id;
}

/* Coloca uma unidade nova no ponto dado, da força indicada, no instante t, com um ponto no trajeto.
   Com a grade ligada, o ponto vai para o centro da célula. Não altera a cena de entrada. */
export function placeUnit(scene: Scene, spec: UnitSpec): PlaceResult {
  if (!scene.factions.some((f) => f.id === spec.factionId)) {
    return { ok: false, error: 'Essa força não existe mais. Escolha outra na lista de forças.' };
  }
  if (![spec.lat, spec.lon, spec.t].every((v) => Number.isFinite(v))) {
    return { ok: false, error: 'Posição ou horário inválido para colocar a unidade.' };
  }
  const p = snapToGrid(scene, spec.lat, spec.lon);
  const next = copy(scene);
  const unitId = newUnitId(scene);
  next.units.push({
    id: unitId,
    name: spec.name?.trim() || suggestUnitName(scene, spec),
    faction: spec.factionId,
    type: spec.type,
    echelon: spec.echelon,
    note: '',
    path: [{ t: r2(spec.t), lat: p.lat, lon: p.lon }],
  });
  return { ok: true, scene: next, unitId };
}
