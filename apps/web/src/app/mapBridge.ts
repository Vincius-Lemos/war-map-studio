import { createMap, type MapApi } from './mapFactory.ts';

import { loadGeoForMap } from './geo.ts';
import { handleFactionDrop, handleMapClick, handleUnitDrag } from './interactions.ts';
import { setMapHandle } from './mapRegistry.ts';
import { useStore } from '../state/store.ts';

/* Liga a store ao mapa: envia cena e tempo para o desenho, enquadra quando pedido e
   recebe cliques, arrastos e soltar de forças. Devolve a função de desligamento. */
export function startMap(container: HTMLElement): () => void {
  const api: MapApi = createMap(container, { loadGeo: loadGeoForMap });
  let zoom = 1;
  let scheduled = false;

  const renderNow = () => {
    const s = useStore.getState();
    api.render(s.scene, s.t);
  };
  /* Em exportação o desenho é síncrono (o exportador lê o quadro logo depois); na tela, um quadro por vez. */
  const schedule = () => {
    if (useStore.getState().exportMode) {
      renderNow();
      return;
    }
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      renderNow();
    });
  };
  const fit = () => {
    zoom = 1;
    api.fitRegion(useStore.getState().scene.region);
  };
  const center = () => {
    const r = useStore.getState().scene.region;
    return { lon: (r.lon0 + r.lon1) / 2, lat: (r.lat0 + r.lat1) / 2 };
  };

  const unsub = useStore.subscribe((s, p) => {
    if (s.fitNonce !== p.fitNonce) fit();
    if (s.sel !== p.sel) api.setSelection(s.sel);
    if (s.fitNonce !== p.fitNonce || s.scene !== p.scene || s.t !== p.t) schedule();
  });
  api.setSelection(useStore.getState().sel);

  api.onClick((e) => handleMapClick(e));
  api.onDragUnit((e) => handleUnitDrag(e));
  api.onDropFaction((e) => handleFactionDrop(e));

  setMapHandle({
    api,
    renderNow,
    zoomBy(factor) {
      zoom = Math.min(25, Math.max(0.3, zoom * factor));
      const c = center();
      api.setViewport({ lon: c.lon, lat: c.lat, zoom });
    },
    resetZoom() {
      fit();
    },
  });

  fit();
  renderNow();
  void api.ready().then(renderNow);

  return () => {
    unsub();
    setMapHandle(null);
    api.dispose();
  };
}
