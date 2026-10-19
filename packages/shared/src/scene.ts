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
}

export const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  inf: 'Infantaria', mech: 'Infantaria mecanizada', motor: 'Infantaria motorizada',
  arm: 'Blindados', cav: 'Cavalaria', art: 'Artilharia', eng: 'Engenharia',
  fort: 'Fortificação', hq: 'Comando / QG', civ: 'Milícia / civis',
};
