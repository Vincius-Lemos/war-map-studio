import type { Scene, Unit, UnitType } from './scene.ts';
import { posAt } from './time.ts';
import { haversineKm } from './geo-measure.ts';

/* Névoa de guerra: cada força vê só o que está dentro do alcance de visão das suas unidades. */

export interface VisionCircle {
  lat: number;
  lon: number;
  radiusKm: number;
}

const DEFAULT_VISION_KM: Record<UnitType, number> = {
  inf: 3, mech: 5, motor: 4, arm: 5, cav: 8, art: 6, eng: 3, fort: 4, hq: 6, civ: 2,
};

/* Alcance padrão de visão (km) de cada tipo de unidade. */
export function defaultVisionKm(type: UnitType): number {
  return DEFAULT_VISION_KM[type];
}

/* Alcance de visão da unidade: o valor próprio, se houver, senão o padrão do tipo. */
export function unitVisionKm(unit: Unit): number {
  return unit.visionKm ?? defaultVisionKm(unit.type);
}

/* Posição da unidade no instante t (interpolação do trajeto). null = ainda não apareceu. */
export function unitPosition(unit: Unit, t: number): { lat: number; lon: number } | null {
  return posAt(unit.path, t);
}

/* Círculos de visão das unidades da força que têm posição no instante t. */
export function visibleTo(viewerFactionId: string, scene: Scene, t: number): VisionCircle[] {
  const circles: VisionCircle[] = [];
  for (const u of scene.units) {
    if (u.faction !== viewerFactionId) continue;
    const p = unitPosition(u, t);
    if (!p) continue;
    circles.push({ lat: p.lat, lon: p.lon, radiusKm: unitVisionKm(u) });
  }
  return circles;
}

/* true se o ponto está dentro de algum dos círculos (distância de grande círculo). */
export function isPointVisible(lat: number, lon: number, circles: readonly VisionCircle[]): boolean {
  return circles.some((c) => haversineKm({ lat, lon }, c) <= c.radiusKm);
}

/* Unidades inimigas visíveis para a força no instante t.
   Aliado = mesma força, ou força com afiliação 'friend' quando a própria força também é 'friend'.
   Qualquer outra força (hostil, neutra, desconhecida) é inimiga. Aliados não entram no resultado. */
export function enemyUnitsVisible(scene: Scene, viewerFactionId: string, t: number): Unit[] {
  const affil = new Map(scene.factions.map((f) => [f.id, f.affil] as const));
  const viewerIsFriend = affil.get(viewerFactionId) === 'friend';
  const isAlly = (factionId: string) =>
    factionId === viewerFactionId || (viewerIsFriend && affil.get(factionId) === 'friend');

  const circles = visibleTo(viewerFactionId, scene, t);
  if (circles.length === 0) return [];

  const out: Unit[] = [];
  for (const u of scene.units) {
    if (isAlly(u.faction)) continue;
    const p = unitPosition(u, t);
    if (p && isPointVisible(p.lat, p.lon, circles)) out.push(u);
  }
  return out;
}
