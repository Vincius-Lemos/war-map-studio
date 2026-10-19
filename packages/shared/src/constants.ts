import type { Affiliation, Echelon, MapType, SymbolStyle, UnitType } from './scene.ts';
import { UNIT_TYPE_LABELS } from './scene.ts';

export const UNIT_TYPE_KEYS = Object.keys(UNIT_TYPE_LABELS) as UnitType[];

export const ECHELON_LABELS: Record<Echelon, string> = {
  '': '—',
  co: 'Companhia (I)',
  bn: 'Batalhão (II)',
  reg: 'Regimento (III)',
  bde: 'Brigada (X)',
  div: 'Divisão (XX)',
  corps: 'Corpo (XXX)',
};

export const ECHELON_MARK: Record<Echelon, string> = {
  '': '',
  co: 'I',
  bn: 'II',
  reg: 'III',
  bde: 'X',
  div: 'XX',
  corps: 'XXX',
};

export const AFFIL_OPTIONS: ReadonlyArray<readonly [Affiliation, string]> = [
  ['friend', 'Amigo (azul)'],
  ['hostile', 'Inimigo (vermelho)'],
  ['neutral', 'Neutro (verde)'],
  ['unknown', 'Desconhecido (amarelo)'],
];

export const AFFIL_SHORT: Record<Affiliation, string> = {
  friend: 'Amigo',
  hostile: 'Inimigo',
  neutral: 'Neutro',
  unknown: '?',
};

export const STYLE_OPTIONS: ReadonlyArray<readonly [SymbolStyle, string]> = [
  ['nato', 'OTAN (APP-6)'],
  ['pact', 'Pacto de Varsóvia'],
  ['hist', 'Histórico'],
  ['block', 'Blocos (wargame)'],
];

export const MAP_TYPE_LABELS: Record<MapType, string> = {
  country: 'Países (fronteiras reais)',
  tiles: 'Ruas (OpenStreetMap)',
  free: 'Modo livre',
};

export const SPEEDS = [0.25, 0.5, 1, 2, 4, 8] as const;
