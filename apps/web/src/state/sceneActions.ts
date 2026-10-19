import {
  applyField,
  clockParts,
  defaultFactions,
  normalizeScene,
  posAt,
  removeTerritoryAt,
  removeWaypoint,
  setSubTerritory,
  setTerritory,
  setWaypoint,
  type FieldTarget,
  type MapType,
  type Region,
  type Scene,
} from '@map-draw/shared';
import type { Point } from './types.ts';
import type { Api } from './store.ts';

export interface SceneActions {
  replaceScene(scene: Scene): void;
  newScene(kind: MapType, region?: Region, title?: string): void;
  setTitle(title: string): void;
  editField(target: FieldTarget, value: string | boolean): boolean;
  moveUnitTo(unitId: string, lat: number, lon: number): void;
  addUnit(): void;
  addWaypointNow(unitId: string): void;
  deleteWaypoint(unitId: string, index: number): void;
  deleteUnit(id: string): void;
  addArrow(from: Point, to: Point): void;
  deleteArrow(id: string): void;
  addEvent(p: Point): void;
  deleteEvent(id: string): void;
  deleteSelected(): void;
  addFaction(): void;
  deleteFaction(id: string): void;
  unitToFaction(unitId: string, faction: string): void;
  paintCountry(iso: string, name: string, faction: string): void;
  paintRegion(p: { iso: string; sub: string; countryName: string; regionName: string; faction: string }): void;
  deleteTerritory(index: number): void;
  clearTerritories(): void;
  setOverlay(src: string): void;
  removeOverlay(): void;
  calibrate(a: Point, b: Point): void;
  addOrgFlag(name: string, src: string): void;
}

const uid = () => Math.random().toString(36).slice(2, 9);
const r2 = (v: number) => Math.round(v * 100) / 100;
const DEFAULT_POINT = { lat: 54.7, lon: 25.3 };

export function createSceneActions(api: Api): SceneActions {
  const { setState: set, getState: get } = api;

  const facName = (scene: Scene, id: string) => scene.factions.find((f) => f.id === id)?.name ?? '—';
  const stamp = (scene: Scene, t: number) => clockParts(scene, t).main;

  /* Troca a cena inteira (novo mapa, importação, abrir arquivo): zera seleção e tempo e enquadra. */
  const replace = (scene: Scene) => {
    set({ scene, sel: null, pending: null, mode: 'select', t: 0, playing: false, fitNonce: get().fitNonce + 1 });
  };

  return {
    replaceScene: replace,

    newScene(kind, region, title) {
      const scene = normalizeScene({
        title: title || 'Nova cena',
        mapType: kind,
        region: region ?? { lon0: -5, lat0: -5, lon1: 5, lat1: 5 },
        factions: defaultFactions(),
      });
      replace(scene);
      get().closeDialog();
      get().toast(`Mapa criado: ${scene.title}`, 'ok');
    },

    setTitle(title) {
      const clean = title.trim() || 'Sem título';
      set({ scene: { ...get().scene, title: clean } });
    },

    editField(target, value) {
      const res = applyField(get().scene, target, value);
      if (!res.ok) {
        get().toast(res.error, 'warn');
        return false;
      }
      set({ scene: res.scene });
      if (target.kind === 'scene' && target.field.startsWith('region.')) get().requestFit();
      return true;
    },

    moveUnitTo(unitId, lat, lon) {
      const s = get();
      set({ scene: setWaypoint(s.scene, unitId, s.t, lat, lon) });
    },

    addUnit() {
      const s = get();
      const id = uid();
      const unit = {
        id,
        name: 'Nova unidade',
        faction: s.selFaction,
        type: 'inf' as const,
        echelon: 'bn' as const,
        note: '',
        path: [{ t: r2(s.t), lat: DEFAULT_POINT.lat, lon: DEFAULT_POINT.lon }],
      };
      set({ scene: { ...s.scene, units: [...s.scene.units, unit] } });
      get().select({ kind: 'unit', id });
    },

    addWaypointNow(unitId) {
      const s = get();
      const unit = s.scene.units.find((u) => u.id === unitId);
      if (!unit) return;
      const p = posAt(unit.path, s.t) ?? DEFAULT_POINT;
      set({ scene: setWaypoint(s.scene, unitId, s.t, p.lat, p.lon) });
    },

    deleteWaypoint(unitId, index) {
      set({ scene: removeWaypoint(get().scene, unitId, index) });
    },

    deleteUnit(id) {
      const s = get();
      set({ scene: { ...s.scene, units: s.scene.units.filter((u) => u.id !== id) } });
      get().select(null);
    },

    addArrow(from, to) {
      const s = get();
      const id = uid();
      const arrow = {
        id,
        from: { lat: from.lat, lon: from.lon },
        to: { lat: to.lat, lon: to.lon },
        t0: r2(s.t),
        t1: r2(s.t + 4),
        kind: 'attack' as const,
        faction: s.selFaction,
      };
      set({ scene: { ...s.scene, arrows: [...s.scene.arrows, arrow] }, pending: null, mode: 'select' });
      get().select({ kind: 'arrow', id });
    },

    deleteArrow(id) {
      const s = get();
      set({ scene: { ...s.scene, arrows: s.scene.arrows.filter((a) => a.id !== id) } });
      get().select(null);
    },

    addEvent(p) {
      const s = get();
      const id = uid();
      const ev = { id, t: r2(s.t), lat: p.lat, lon: p.lon, kind: 'attack' as const, text: '', dur: 2 };
      set({ scene: { ...s.scene, events: [...s.scene.events, ev] }, mode: 'select', pending: null });
      get().select({ kind: 'event', id });
    },

    deleteEvent(id) {
      const s = get();
      set({ scene: { ...s.scene, events: s.scene.events.filter((e) => e.id !== id) } });
      get().select(null);
    },

    deleteSelected() {
      const sel = get().sel;
      if (!sel) return;
      if (sel.kind === 'unit') get().deleteUnit(sel.id);
      else if (sel.kind === 'arrow') get().deleteArrow(sel.id);
      else if (sel.kind === 'event') get().deleteEvent(sel.id);
    },

    addFaction() {
      const id = 'f' + uid();
      const s = get();
      const faction = { id, name: 'Nova força', color: '#8e24aa', affil: 'unknown' as const };
      set({ scene: { ...s.scene, factions: [...s.scene.factions, faction] }, selFaction: id });
    },

    deleteFaction(id) {
      const s = get();
      if (s.scene.factions.length <= 1) {
        s.toast('Mantenha pelo menos uma força.', 'warn');
        return;
      }
      const factions = s.scene.factions.filter((f) => f.id !== id);
      const selFaction = s.selFaction === id ? (factions[0]?.id ?? id) : s.selFaction;
      set({ scene: { ...s.scene, factions }, selFaction });
    },

    unitToFaction(unitId, faction) {
      const s = get();
      const unit = s.scene.units.find((u) => u.id === unitId);
      if (!unit) return;
      const units = s.scene.units.map((u) => (u.id === unitId ? { ...u, faction } : u));
      set({ scene: { ...s.scene, units }, selFaction: faction });
      s.toast(`${unit.name} agora é de ${facName(s.scene, faction)}.`, 'ok');
    },

    paintCountry(iso, name, faction) {
      const s = get();
      const scene = setTerritory(s.scene, { t: s.t, iso, name, faction, flag: s.paintFlag });
      set({ scene, selFaction: faction });
      s.toast(`${name}: ${facName(scene, faction)} a partir de ${stamp(scene, r2(s.t))}.`, 'ok');
    },

    paintRegion(p) {
      const s = get();
      const scene = setSubTerritory(s.scene, { t: s.t, ...p, flag: s.paintFlag, regionName: p.regionName, countryName: p.countryName });
      set({ scene, selFaction: p.faction });
      s.toast(`${p.regionName} (${p.countryName}): ${facName(scene, p.faction)} a partir de ${stamp(scene, r2(s.t))}.`, 'ok');
    },

    deleteTerritory(index) {
      set({ scene: removeTerritoryAt(get().scene, index) });
    },

    clearTerritories() {
      set({ scene: { ...get().scene, territories: [] } });
    },

    setOverlay(src) {
      const s = get();
      const rg = s.scene.region;
      const overlay = { src, nw: { lat: rg.lat1, lon: rg.lon0 }, se: { lat: rg.lat0, lon: rg.lon1 }, opacity: 1 };
      set({ scene: { ...s.scene, overlay }, mode: 'calib', pending: null });
      s.toast('Imagem carregada. Clique nos dois cantos opostos para posicioná-la.', 'ok', 5000);
    },

    removeOverlay() {
      set({ scene: { ...get().scene, overlay: null } });
    },

    calibrate(a, b) {
      const s = get();
      const nw = { lat: Math.max(a.lat, b.lat), lon: Math.min(a.lon, b.lon) };
      const se = { lat: Math.min(a.lat, b.lat), lon: Math.max(a.lon, b.lon) };
      const padX = (se.lon - nw.lon) * 0.05;
      const padY = (nw.lat - se.lat) * 0.05;
      const region = { lon0: nw.lon - padX, lat0: se.lat - padY, lon1: se.lon + padX, lat1: nw.lat + padY };
      if (!s.scene.overlay) {
        s.toast('Carregue uma imagem primeiro.', 'warn');
        return;
      }
      set({
        scene: { ...s.scene, overlay: { ...s.scene.overlay, nw, se }, region },
        pending: null,
        mode: 'select',
      });
      s.requestFit();
      s.toast('Imagem calibrada.', 'ok');
    },

    addOrgFlag(name, src) {
      const s = get();
      const id = 'org' + uid();
      const orgFlags = [...s.scene.orgFlags, { id, name: name.trim(), src }];
      set({ scene: { ...s.scene, orgFlags }, paintFlag: id });
      s.toast('Bandeira adicionada. Ela será usada ao pintar.', 'ok');
    },
  };
}
