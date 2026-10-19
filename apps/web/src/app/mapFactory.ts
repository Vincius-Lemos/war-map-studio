/* Ponto único de ligação com o módulo do mapa (apps/web/src/map, agente de mapa). */
import type { FactionDropEvent as MapFactionDrop, UnitDragEvent as MapUnitDrag } from '../map';

export { createMap } from '../map';
export type { MapApi, MapClick, Hit, HitKind, MapOptions, MapSelection } from '../map';

export type UnitDragEvent = MapUnitDrag;
export type FactionDropEvent = MapFactionDrop;
