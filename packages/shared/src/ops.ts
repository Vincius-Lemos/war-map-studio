import type { Scene, Territory } from './scene.ts';
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
