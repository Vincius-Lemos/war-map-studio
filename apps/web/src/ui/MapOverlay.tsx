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
      <div className="mapctl">
        <button className="btn icon" onClick={() => getMapHandle()?.zoomBy(1.4)} title="Aproximar (+)">
          ＋
        </button>
        <button className="btn icon" onClick={() => getMapHandle()?.zoomBy(1 / 1.4)} title="Afastar (−)">
          −
        </button>
        <button className="btn icon" onClick={requestFit} title="Ajustar à área (F)">
          ⤢
        </button>
      </div>
      <div className="hint" role="status">
        {hint}
      </div>
      <div className="legend">
        {factions.map((f) => (
          <div key={f.id}>
            <span className="dot" style={{ background: f.color }} />
            {f.name}
          </div>
        ))}
      </div>
    </>
  );
}
