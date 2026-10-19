import { histYearFor, MAP_TYPE_LABELS, STYLE_OPTIONS, type FieldTarget } from '@map-draw/shared';
import { useStore } from '../../state/store.ts';
import { getMapHandle } from '../../app/mapRegistry.ts';
import { CommitInput } from '../fields/CommitInput.tsx';
import { OverlaySection } from './OverlaySection.tsx';

type SceneField = Extract<FieldTarget, { kind: 'scene' }>['field'];
const scn = (field: SceneField) => ({ kind: 'scene' as const, field });

/* Aba Cena: data, ano, duração, estilo, nomes, rastros, bandeiras, área do mapa e imagem própria. */
export function SceneForm() {
  const scene = useStore((s) => s.scene);
  const editField = useStore((s) => s.editField);
  const requestFit = useStore((s) => s.requestFit);
  const resetZoom = () => getMapHandle()?.resetZoom();

  return (
    <>
      <div className="card-info">
        <b>{MAP_TYPE_LABELS[scene.mapType]}</b>
        <div className="muted small" style={{ marginTop: 4 }}>
          Para trocar de escala, use “＋ Novo mapa”.
        </div>
      </div>

      <label className="field">
        <span>Início da cena (data e hora)</span>
        <input
          type="datetime-local"
          value={scene.startDate}
          onChange={(e) => editField(scn('startDate'), e.target.value)}
        />
      </label>
      <div className="muted small" style={{ margin: '-4px 0 6px' }}>
        Com data, o relógio mostra dia e hora reais. Sem data, mostra horas corridas.
      </div>

      <label className="field">
        <span>Ano do mapa (opcional, ex.: 1835)</span>
        <CommitInput
          type="number"
          min={100}
          max={2010}
          step={1}
          value={scene.year ?? ''}
          placeholder="Vazio = mapa atual"
          onCommit={(v) => editField(scn('year'), v)}
        />
      </label>
      <div className="muted small" style={{ margin: '-4px 0 6px' }}>
        {scene.year
          ? `Mapa de ${scene.year}: usando o instantâneo ${histYearFor(scene.year)}, o mais próximo anterior disponível.`
          : 'Mapa atual, com países reais e bandeiras.'}
      </div>

      <label className="field">
        <span>Duração (horas)</span>
        <CommitInput type="number" min={1} step={1} value={scene.durationH} onCommit={(v) => editField(scn('durationH'), v)} />
      </label>
      <label className="field">
        <span>Estilo dos símbolos</span>
        <select value={scene.symbolStyle} onChange={(e) => editField(scn('symbolStyle'), e.target.value)}>
          {STYLE_OPTIONS.map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Tamanho dos símbolos: {scene.unitSize.toFixed(2)}×</span>
        <input
          type="range"
          min={0.5}
          max={2.4}
          step={0.05}
          value={scene.unitSize}
          onChange={(e) => editField({ kind: 'scene', field: 'unitSize' }, e.target.value)}
        />
      </label>
      <label className="field inline">
        <input type="checkbox" checked={scene.showLabels} onChange={(e) => editField(scn('showLabels'), e.target.checked)} />
        <span>Mostrar nomes das unidades</span>
      </label>
      <label className="field inline">
        <input type="checkbox" checked={scene.showTrails} onChange={(e) => editField(scn('showTrails'), e.target.checked)} />
        <span>Mostrar rastros</span>
      </label>
      <label className="field inline">
        <input
          type="checkbox"
          checked={scene.showAllFlags}
          onChange={(e) => editField(scn('showAllFlags'), e.target.checked)}
        />
        <span>Bandeira de todos os países</span>
      </label>

      <div className="h">Área do mapa (graus)</div>
      <div className="grid2">
        <label className="field">
          <span>Oeste (lon)</span>
          <CommitInput type="number" step={0.01} value={scene.region.lon0} onCommit={(v) => editField(scn('region.lon0'), v)} />
        </label>
        <label className="field">
          <span>Sul (lat)</span>
          <CommitInput type="number" step={0.01} value={scene.region.lat0} onCommit={(v) => editField(scn('region.lat0'), v)} />
        </label>
        <label className="field">
          <span>Leste (lon)</span>
          <CommitInput type="number" step={0.01} value={scene.region.lon1} onCommit={(v) => editField(scn('region.lon1'), v)} />
        </label>
        <label className="field">
          <span>Norte (lat)</span>
          <CommitInput type="number" step={0.01} value={scene.region.lat1} onCommit={(v) => editField(scn('region.lat1'), v)} />
        </label>
      </div>
      <div className="row">
        <button className="btn sm" onClick={requestFit}>
          Ajustar à área
        </button>
        <button className="btn sm" onClick={resetZoom}>
          Resetar zoom
        </button>
      </div>

      <OverlaySection />

      <div className="h">Ajuda rápida</div>
      <p className="muted small">
        Os nomes dos países aparecem conforme você aproxima o zoom. Divisões internas (estados/províncias) aparecem ao pintar com
        “Estado / região”.
      </p>
    </>
  );
}
