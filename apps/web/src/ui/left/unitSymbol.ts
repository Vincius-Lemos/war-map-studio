import ms from 'milsymbol';
import type { Affiliation, UnitType } from '@map-draw/shared';

/* Símbolo OTAN (APP-6) para a paleta: o mesmo gerador (milsymbol) e a mesma tabela de SIDC do mapa
   (apps/web/src/map/icons.ts). Sem escalão: a paleta mostra só o tipo. */
const SIDC: Record<UnitType, string> = {
  inf: 'SFGPUCI---', mech: 'SFGPUCIM--', motor: 'SFGPUCIW--', arm: 'SFGPUCA---', cav: 'SFGPUCR---',
  art: 'SFGPUCFA--', eng: 'SFGPUCE---', fort: 'SFGPUCF---', hq: 'SFGPUH----', civ: 'SFGPUCI---',
};
const AFFIL: Record<Affiliation, string> = { friend: 'F', hostile: 'H', neutral: 'N', unknown: 'U' };

const cache = new Map<string, string>();

/* SVG do símbolo (string). Cacheado: a paleta redesenha com frequência. */
export function unitSymbolSvg(type: UnitType, affil: Affiliation): string {
  const key = `${type}|${affil}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const sidc = ('S' + (AFFIL[affil] ?? 'U') + SIDC[type].slice(2)).padEnd(15, '-');
  const svg = new ms.Symbol(sidc, { size: 40 }).asSVG();
  cache.set(key, svg);
  return svg;
}
