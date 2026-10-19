import { create } from 'zustand';
import type { LatLon } from '@map-draw/shared';

/* Estado da régua. É só visual: não entra na cena nem no histórico de desfazer. */
export type MeasureKind = 'line' | 'area';

interface MeasureStore {
  active: boolean;
  kind: MeasureKind;
  points: LatLon[];
  /* liga a ferramenta com a medição zerada */
  start(): void;
  /* encerra e limpa (Esc, clique direito, R de novo) */
  stop(): void;
  toggle(): void;
  setKind(kind: MeasureKind): void;
  addPoint(p: LatLon): void;
  undo(): void;
  clear(): void;
}

export const useMeasureStore = create<MeasureStore>()((set, get) => ({
  active: false,
  kind: 'line',
  points: [],
  start: () => set({ active: true, points: [] }),
  stop: () => set({ active: false, points: [] }),
  toggle: () => (get().active ? get().stop() : get().start()),
  setKind: (kind) => set({ kind, points: [] }),
  addPoint: (p) => set({ points: [...get().points, { lat: p.lat, lon: p.lon }] }),
  undo: () => set({ points: get().points.slice(0, -1) }),
  clear: () => set({ points: [] }),
}));
