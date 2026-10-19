import { useStore } from '../state/store.ts';
import { getMapHandle } from '../app/mapRegistry.ts';
import { modeInfo } from '../app/modes.ts';

/* Controles sobre o mapa: zoom, dica da ferramenta e legenda das forças. */
export function MapOverlay() {
  const mode = useStore((s) => s.mode);
  const dragging = useStore((s) => s.dragFac !== null);
  const factions = useStore((s) => s.scene.factions);
  const requestFit = useStore((s) => s.requestFit);

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
