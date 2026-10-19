import { create } from 'zustand';
import { ECHELON_LABELS, UNIT_TYPE_KEYS, type Echelon, type UnitType } from '@map-draw/shared';

/* Colocação de unidades: estado da paleta (aberta, tipo e escalão escolhidos, modo "colocar" ativo).
   Fica fora da store principal: só a paleta e o mapa o usam. */

export interface PlacementState {
  paletteOpen: boolean;
  active: boolean;
  type: UnitType;
  echelon: Echelon;
  openPalette(): void;
  togglePalette(): void;
  closePalette(): void;
  startPlacing(type: UnitType, echelon: Echelon): void;
  stopPlacing(): void;
  setEchelon(echelon: Echelon): void;
}

export const usePlacement = create<PlacementState>()((set, get) => ({
  paletteOpen: false,
  active: false,
  type: 'inf',
  echelon: 'bn',
  openPalette: () => set({ paletteOpen: true }),
  togglePalette: () => {
    if (get().paletteOpen) set({ paletteOpen: false, active: false });
    else set({ paletteOpen: true });
  },
  closePalette: () => set({ paletteOpen: false, active: false }),
  startPlacing: (type, echelon) => set({ type, echelon, active: true, paletteOpen: true }),
  stopPlacing: () => {
    if (get().active) set({ active: false });
  },
  setEchelon: (echelon) => set({ echelon }),
}));

/* Payload do arrastar da paleta. Vai no text/plain, que o mapa já aceita para soltar forças:
   o mapa entrega o texto como "factionId" e o interactions.ts reconhece o prefixo. */
const DRAG_PREFIX = 'mapdraw-unit:';

export function encodeUnitDrag(type: UnitType, echelon: Echelon): string {
  return `${DRAG_PREFIX}${type}:${echelon}`;
}

export function parseUnitDrag(text: string): { type: UnitType; echelon: Echelon } | null {
  if (!text.startsWith(DRAG_PREFIX)) return null;
  const [type, echelon] = text.slice(DRAG_PREFIX.length).split(':');
  if (!UNIT_TYPE_KEYS.includes(type as UnitType)) return null;
  if (!(echelon !== undefined && echelon in ECHELON_LABELS)) return null;
  return { type: type as UnitType, echelon: echelon as Echelon };
}

/* Teclas 1..9 e 0 escolhem os tipos, na ordem da paleta. */
export const TYPE_KEYS: readonly UnitType[] = ['inf', 'mech', 'motor', 'arm', 'cav', 'art', 'eng', 'fort', 'hq', 'civ'];
