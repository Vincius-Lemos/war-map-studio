import { useStore } from '../state/store.ts';
import { getMapHandle } from '../app/mapRegistry.ts';
import { modeInfo } from '../app/modes.ts';
import { useOverlay } from '../app/overlayState.ts';

/* Ligação do modo apresentação: além de mover a câmera, o instante da cena acompanha o slide. */
export function viewSlide(slide: { t: number; lat: number; lon: number; zoom: number }): void {
  getMapHandle()?.api.setViewport({ lon: slide.lon, lat: slide.lat, zoom: slide.zoom });
  useStore.getState().setT(slide.t);
}

/* Controles sobre o mapa: zoom, dica da ferramenta e legenda das forças. */
export function MapOverlay() {
  const mode = useStore((s) => s.mode);
  const dragging = useStore((s) => s.dragFac !== null);
  const factions = useStore((s) => s.scene.factions);
  const requestFit = useStore((s) => s.requestFit);
  const fogOn = useOverlay((s) => s.fogOn);
  const setFog = useOverlay((s) => s.setFog);
  const presenting = useOverlay((s) => s.presenting);
  const setPresenting = useOverlay((s) => s.setPresenting);

  const hint = dragging ? 'Solte sobre um país, uma região ou uma unidade.' : (modeInfo(mode)?.hint ?? '');

  return (
    <>
      <div className="mapctl" role="group" aria-label="Controles do mapa">
        <button className="btn icon" onClick={() => getMapHandle()?.zoomBy(1.4)} title="Aproximar (+)" aria-label="Aproximar">
          ＋
        </button>
        <button className="btn icon" onClick={() => getMapHandle()?.zoomBy(1 / 1.4)} title="Afastar (−)" aria-label="Afastar">
          −
        </button>
        <button className="btn icon" onClick={requestFit} title="Ajustar à área (F)" aria-label="Ajustar à área">
          ⤢
        </button>
        <button
          className={`btn icon${fogOn ? ' on' : ''}`}
          onClick={() => setFog(!fogOn)}
          title="Névoa de guerra: cada força só vê perto das suas unidades"
          aria-label="Névoa de guerra"
          aria-pressed={fogOn}
        >
          ◐
        </button>
        <button
          className={`btn icon${presenting ? ' on' : ''}`}
          onClick={() => setPresenting(!presenting)}
          title="Modo apresentação: passa pelos eventos com a câmera"
          aria-label="Modo apresentação"
          aria-pressed={presenting}
        >
          ▶
        </button>
      </div>
      <div className="hint" role="status">
        {hint}
      </div>
      {factions.length > 0 && (
        <div className="legend" aria-label="Legenda das forças">
          <div className="legend-title">Forças</div>
          {factions.map((f) => (
            <div key={f.id} title={f.name}>
              <span className="dot" style={{ background: f.color }} />
              <span className="lname">{f.name}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
