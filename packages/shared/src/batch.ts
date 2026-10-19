import type { Arrow, MapEvent, Scene, Unit } from './scene.ts';
import { posAt } from './time.ts';
import { setWaypoint } from './ops.ts';

/* Operações em lote sobre a seleção (unidades, setas e eventos). Funções puras: devolvem cenas novas
   e nunca alteram a entrada. Territórios (países e regiões) não entram em lote. */

export type ObjectKind = 'unit' | 'arrow' | 'event';
export interface ObjectRef {
  kind: ObjectKind;
  id: string;
}

/* Conteúdo copiado: objetos inteiros (com os ids de origem; os ids são trocados ao colar). */
export interface Clip {
  units: Unit[];
  arrows: Arrow[];
  events: MapEvent[];
}

const keyOf = (r: ObjectRef) => `${r.kind}:${r.id}`;

export function uniqueRefs(refs: readonly ObjectRef[]): ObjectRef[] {
  const seen = new Set<string>();
  const out: ObjectRef[] = [];
  for (const r of refs) {
    const k = keyOf(r);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(r);
    }
  }
  return out;
}

/* Mantém só os objetos que ainda existem na cena (depois de desfazer, por exemplo). */
export function existingRefs(scene: Scene, refs: readonly ObjectRef[]): ObjectRef[] {
  const present = new Set<string>([
    ...scene.units.map((u) => `unit:${u.id}`),
    ...scene.arrows.map((a) => `arrow:${a.id}`),
    ...scene.events.map((e) => `event:${e.id}`),
  ]);
  return uniqueRefs(refs).filter((r) => present.has(keyOf(r)));
}

export function deleteRefs(scene: Scene, refs: readonly ObjectRef[]): Scene {
  const drop = new Set(refs.map(keyOf));
  return {
    ...scene,
    units: scene.units.filter((u) => !drop.has(`unit:${u.id}`)),
    arrows: scene.arrows.filter((a) => !drop.has(`arrow:${a.id}`)),
    events: scene.events.filter((e) => !drop.has(`event:${e.id}`)),
  };
}

export const clampLat = (v: number): number => Math.min(90, Math.max(-90, v));
export const wrapLon = (v: number): number => ((((v + 180) % 360) + 360) % 360) - 180;

/* Desloca a seleção em graus. Unidade: desloca o ponto que ela ocupa no instante t (grava um ponto
   neste instante); unidade sem posição em t não se move. Setas e eventos: deslocam-se inteiros. */
export function moveRefs(scene: Scene, refs: readonly ObjectRef[], t: number, dLat: number, dLon: number): Scene {
  let out = scene;
  for (const r of uniqueRefs(refs)) {
    if (r.kind !== 'unit') continue;
    const u = out.units.find((x) => x.id === r.id);
    const p = u ? posAt(u.path, t) : null;
    if (!p) continue;
    out = setWaypoint(out, r.id, t, clampLat(p.lat + dLat), wrapLon(p.lon + dLon));
  }
  const drop = new Set(refs.map(keyOf));
  const sh = (p: { lat: number; lon: number }) => ({ lat: clampLat(p.lat + dLat), lon: wrapLon(p.lon + dLon) });
  return {
    ...out,
    arrows: out.arrows.map((a) => (drop.has(`arrow:${a.id}`) ? { ...a, from: sh(a.from), to: sh(a.to) } : a)),
    events: out.events.map((e) => (drop.has(`event:${e.id}`) ? { ...e, ...sh(e) } : e)),
  };
}

/* Copia os objetos citados (cópias independentes). */
export function copyRefs(scene: Scene, refs: readonly ObjectRef[]): Clip {
  const pick = new Set(refs.map(keyOf));
  return structuredClone({
    units: scene.units.filter((u) => pick.has(`unit:${u.id}`)),
    arrows: scene.arrows.filter((a) => pick.has(`arrow:${a.id}`)),
    events: scene.events.filter((e) => pick.has(`event:${e.id}`)),
  });
}

/* Cola o conteúdo deslocado em (dLat, dLon), com ids novos (newId). Devolve as referências dos colados. */
export function pasteClip(
  scene: Scene,
  clip: Clip,
  dLat: number,
  dLon: number,
  newId: () => string,
): { scene: Scene; refs: ObjectRef[] } {
  const refs: ObjectRef[] = [];
  const sh = (p: { lat: number; lon: number }) => ({ lat: clampLat(p.lat + dLat), lon: wrapLon(p.lon + dLon) });
  const units: Unit[] = clip.units.map((u) => {
    const id = newId();
    refs.push({ kind: 'unit', id });
    return { ...u, id, path: u.path.map((p) => ({ ...p, ...sh(p) })) };
  });
  const arrows: Arrow[] = clip.arrows.map((a) => {
    const id = newId();
    refs.push({ kind: 'arrow', id });
    return { ...a, id, from: sh(a.from), to: sh(a.to) };
  });
  const events: MapEvent[] = clip.events.map((e) => {
    const id = newId();
    refs.push({ kind: 'event', id });
    return { ...e, id, ...sh(e) };
  });
  return {
    scene: { ...scene, units: [...scene.units, ...units], arrows: [...scene.arrows, ...arrows], events: [...scene.events, ...events] },
    refs,
  };
}
