import { normalizeScene, type Scene } from '@map-draw/shared';
import { useStore } from '../state/store.ts';
import { getMapHandle } from './mapRegistry.ts';

/* Contrato com o exportador de vídeo (apps/export): disponível em window.__mapa quando a página abre com ?export.
   Nada é gravado no navegador nesse modo. */
export interface MapaExportApi {
  loadScene(scene: Scene): void;
  setTime(t: number): void;
  ready(): Promise<void>;
  getScene(): Scene;
}

declare global {
  interface Window {
    __mapa?: MapaExportApi;
  }
}

const waitFor = async (test: () => boolean, maxMs = 15_000): Promise<void> => {
  const start = performance.now();
  while (!test()) {
    if (performance.now() - start > maxMs) throw new Error('tempo esgotado esperando o mapa');
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
  }
};

export function installExportApi(): void {
  window.__mapa = {
    loadScene(scene) {
      const normalized = normalizeScene(scene);
      const s = useStore.getState();
      useStore.setState({
        scene: normalized,
        t: 0,
        playing: false,
        sel: null,
        pending: null,
        mode: 'select',
        fitNonce: s.fitNonce + 1,
      });
    },
    setTime(t) {
      useStore.getState().setT(t);
      getMapHandle()?.renderNow();
    },
    async ready() {
      await waitFor(() => getMapHandle() !== null);
      await getMapHandle()?.api.ready();
    },
    getScene() {
      return useStore.getState().scene;
    },
  };
}
