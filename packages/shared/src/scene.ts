/* Formato da cena: o contrato entre o editor (web), o servidor, os dados e o exportador de vídeo.
   Tudo em horas desde o início da cena. Coordenadas em graus decimais (lat, lon). */

export type Affiliation = 'friend' | 'hostile' | 'neutral' | 'unknown';
export type MapType = 'country' | 'tiles' | 'free';
export type SymbolStyle = 'nato' | 'pact' | 'hist' | 'block';
export type UnitType = 'inf' | 'mech' | 'motor' | 'arm' | 'cav' | 'art' | 'eng' | 'fort' | 'hq' | 'civ';
export type Echelon = '' | 'co' | 'bn' | 'reg' | 'bde' | 'div' | 'corps';

export interface Region {
  lon0: number;
  lat0: number;
  lon1: number;
  lat1: number;
}

export interface Faction {
  id: string;
  name: string;
  color: string;          // hex, ex.: #2e7d32
  affil: Affiliation;
  flag?: string;          // código ISO-3166 alfa-2 do país da força, ex.: 'RU'
}

export interface Waypoint {
  t: number;
  lat: number;
  lon: number;
}

export interface Unit {
  id: string;
  name: string;
  faction: string;        // id da força
  type: UnitType;
  echelon: Echelon;
  note: string;
  path: Waypoint[];       // ordenado por t
}

export interface Arrow {
  id: string;
  from: { lat: number; lon: number };
  to: { lat: number; lon: number };
  t0: number;
  t1: number;
  kind: 'attack' | 'withdraw';
  faction: string;
}

export interface MapEvent {
  id: string;
  t: number;
  lat: number;
  lon: number;
  kind: 'attack' | 'note';
  text: string;
  dur: number;
}

/* Controle de um território a partir de um instante.
   Sem `sub`: país inteiro (ISO alfa-2 em `iso`).
   Com `sub`: estado/província (shapeID do arquivo de regiões). */
export interface Territory {
  iso: string;
  name: string;
  t: number;
  faction: string;
  sub?: string;
  flag?: string;          // id de bandeira de organização
  fcode?: string;         // código ISO da bandeira (vinda da força)
}

export interface OrgFlag {
  id: string;
  name: string;
  src: string;            // data URL ou URL
}

export interface Overlay {
  src: string;
  nw: { lat: number; lon: number };
  se: { lat: number; lon: number };
  opacity: number;
}

/* Grades de referência. Opcional na cena: campo ausente = tudo desligado (ver defaultGrid em grid.ts). */
export interface GridConfig {
  /* graticule lat/lon; step em graus, 0 = automático pelo zoom */
  lonLat: { enabled: boolean; step: number };
  /* grade militar aproximada (UTM 100 km, com subdivisão de 10 km ao aproximar) */
  mgrs: { enabled: boolean };
  /* grade do usuário: passo em km ou graus, a partir da origem (lat0, lon0) */
  custom: { enabled: boolean; step: number; unit: 'km' | 'deg'; lat0: number; lon0: number };
  opacity: number;        // 0..1
  snap: boolean;          // encaixe: unidades colocadas vão para o centro da célula
  snapStep: number;       // tamanho da célula de encaixe, em graus
}

export interface Scene {
  title: string;
  startDate: string;      // ISO local, ex.: '2022-02-24T00:00' ('' = sem data)
  durationH: number;
  year: number | null;    // ano do mapa histórico (null = mapa atual)
  mapType: MapType;
  region: Region;
  symbolStyle: SymbolStyle;
  unitSize: number;
  showLabels: boolean;
  showTrails: boolean;
  showAllFlags: boolean;
  factions: Faction[];
  units: Unit[];
  arrows: Arrow[];
  events: MapEvent[];
  territories: Territory[];
  orgFlags: OrgFlag[];
  overlay: Overlay | null;
  grid?: GridConfig;
}

export const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  inf: 'Infantaria', mech: 'Infantaria mecanizada', motor: 'Infantaria motorizada',
  arm: 'Blindados', cav: 'Cavalaria', art: 'Artilharia', eng: 'Engenharia',
  fort: 'Fortificação', hq: 'Comando / QG', civ: 'Milícia / civis',
};
