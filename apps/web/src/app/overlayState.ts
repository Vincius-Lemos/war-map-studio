import { create } from 'zustand';
import type { RoutePlanView } from '../ui/planning/RoutePanel.tsx';

/* Estado visual das camadas extras: névoa de guerra, planejamento de movimento e apresentação.
   Não vai para a cena (não é gravado nem entra no desfazer). */
export interface OverlayState {
  fogOn: boolean;
  presenting: boolean;
  plan: RoutePlanView | null;
  /* Quando definido, o próximo clique no mapa é entregue a esta função (ex.: escolher o destino da rota). */
  pick: ((p: { lat: number; lon: number }) => void) | null;
  setFog(on: boolean): void;
  setPresenting(on: boolean): void;
  setPlan(plan: RoutePlanView): void;
  setPick(cb: ((p: { lat: number; lon: number }) => void) | null): void;
}

export const useOverlay = create<OverlayState>()((set) => ({
  fogOn: false,
  presenting: false,
  plan: null,
  pick: null,
  setFog: (fogOn) => set({ fogOn }),
  setPresenting: (presenting) => set({ presenting }),
  setPlan: (plan) => set({ plan }),
  setPick: (pick) => set({ pick }),
}));
