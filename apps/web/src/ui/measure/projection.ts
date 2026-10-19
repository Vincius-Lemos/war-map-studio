import { getMapHandle } from '../../app/mapRegistry.ts';

/* Projeção da tela do mapa. `toScreen` e `toLatLon` são métodos do contrato MapApi que o motor do mapa
   deve expor (pedidos ao agente de mapa). Enquanto não existirem, a régua calcula as distâncias
   mas não desenha nem recebe cliques. Coordenadas de tela são em px, relativas a `.map-host`. */
export interface ScreenPoint {
  x: number;
  y: number;
}

export interface Projector {
  toScreen(lat: number, lon: number): ScreenPoint | null;
  toLatLon(x: number, y: number): { lat: number; lon: number } | null;
}

export function currentProjector(): Projector | null {
  const api: unknown = getMapHandle()?.api;
  const m = api as Partial<Projector> | undefined;
  if (!m || typeof m.toScreen !== 'function' || typeof m.toLatLon !== 'function') return null;
  return {
    toScreen: (lat, lon) => m.toScreen?.(lat, lon) ?? null,
    toLatLon: (x, y) => m.toLatLon?.(x, y) ?? null,
  };
}
