import type { MapApi } from './mapFactory.ts';

/* Ponte entre a interface e o mapa atual. Preenchida por mapBridge ao montar o mapa. */
export interface MapHandle {
  api: MapApi;
  /* Desenha a cena atual agora (sem esperar o quadro de animação). */
  renderNow(): void;
  zoomBy(factor: number): void;
  resetZoom(): void;
}

let handle: MapHandle | null = null;

export function setMapHandle(h: MapHandle | null): void {
  handle = h;
}

export function getMapHandle(): MapHandle | null {
  return handle;
}
