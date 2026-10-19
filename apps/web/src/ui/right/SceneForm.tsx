import { histYearFor, MAP_TYPE_LABELS, normalizeGrid, STYLE_OPTIONS, type FieldTarget, type GridConfig } from '@map-draw/shared';
import { useStore } from '../../state/store.ts';
import { getMapHandle } from '../../app/mapRegistry.ts';
import { CommitInput } from '../fields/CommitInput.tsx';
import { OverlaySection } from './OverlaySection.tsx';

type SceneField = Extract<FieldTarget, { kind: 'scene' }>['field'];
const scn = (field: SceneField) => ({ kind: 'scene' as const, field });

const LONLAT_STEPS = [10, 5, 1, 0.5, 0.1];
const num = (text: string): number | null => {
  const n = Number.parseFloat(text.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/* Grades de referência: liga/desliga cada uma, passos, origem, opacidade e encaixe.
   Grava a grade direto na cena (normalizada), e o mapa redesenha pela assinatura da store. */
function GridSection() {
  const grid = normalizeGrid(useStore((s) => s.scene.grid));
  const update = (fn: (g: GridConfig) => GridConfig) => {
    const cur = useStore.getState().scene;
    useStore.setState({ scene: { ...cur, grid: normalizeGrid(fn(normalizeGrid(cur.grid))) } });
  };
  const pct = Math.round(grid.opacity * 100);

  return (
    <>
      <div className="h">Grades de referência</div>

      <label className="field inline">
        <input
          type="checkbox"
          checked={grid.lonLat.enabled}
          onChange={(e) => update((g) => ({ ...g, lonLat: { ...g.lonLat, enabled: e.target.checked } }))}
        />
        <span>Graticule (latitude e longitude)</span>
      </label>
      {grid.lonLat.enabled && (
        <label className="field">
          <span>Passo da graticule</span>
          <select
            value={grid.lonLat.step}
            onChange={(e) => update((g) => ({ ...g, lonLat: { ...g.lonLat, step: Number(e.target.value) } }))}
          >
            <option value={0}>Automático (pelo zoom)</option>
            {LONLAT_STEPS.map((s) => (
              <option key={s} value={s}>
                {String(s).replace('.', ',')}°
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="field inline">
        <input
          type="checkbox"
          checked={grid.mgrs.enabled}
          onChange={(e) => update((g) => ({ ...g, mgrs: { enabled: e.target.checked } }))}
        />
        <span>Grade militar (aproximada)</span>
      </label>
      <div className="muted small" style={{ margin: '-4px 0 6px' }}>
        Aproximação: quadrados UTM de 100 km por zona, com 10 km ao aproximar. Não é a norma MGRS exata. Aparece com a área
        até cerca de 1.500 km de largura.
      </div>

      <label className="field inline">
        <input
          type="checkbox"
          checked={grid.custom.enabled}
          onChange={(e) => {
            /* ao ligar pela primeira vez (origem em 0,0), a origem vai para o canto sudoeste da área do mapa */
            const r = useStore.getState().scene.region;
            update((g) => {
              const fresh = g.custom.lat0 === 0 && g.custom.lon0 === 0;
              return {
                ...g,
                custom: {
                  ...g.custom,
                  enabled: e.target.checked,
                  lat0: fresh ? r.lat0 : g.custom.lat0,
                  lon0: fresh ? r.lon0 : g.custom.lon0,
                },
              };
            });
          }}
        />
        <span>Grade personalizada</span>
      </label>
      {grid.custom.enabled && (
        <>
          <div className="grid2">
            <label className="field">
              <span>Passo</span>
              <CommitInput
                type="number"
                min={0.001}
                step="any"
                value={grid.custom.step}
                onCommit={(v) => {
                  const n = num(v);
                  if (n !== null && n > 0) update((g) => ({ ...g, custom: { ...g.custom, step: n } }));
                }}
              />
            </label>
            <label className="field">
              <span>Unidade</span>
              <select
                value={grid.custom.unit}
                onChange={(e) => update((g) => ({ ...g, custom: { ...g.custom, unit: e.target.value === 'deg' ? 'deg' : 'km' } }))}
              >
                <option value="km">quilômetros</option>
                <option value="deg">graus</option>
              </select>
            </label>
            <label className="field">
              <span>Origem: lat</span>
              <CommitInput
                type="number"
                min={-90}
                max={90}
                step="any"
                value={grid.custom.lat0}
                onCommit={(v) => {
                  const n = num(v);
                  if (n !== null) update((g) => ({ ...g, custom: { ...g.custom, lat0: n } }));
                }}
              />
            </label>
            <label className="field">
              <span>Origem: lon</span>
              <CommitInput
                type="number"
                min={-180}
                max={180}
                step="any"
                value={grid.custom.lon0}
                onCommit={(v) => {
                  const n = num(v);
                  if (n !== null) update((g) => ({ ...g, custom: { ...g.custom, lon0: n } }));
                }}
              />
            </label>
          </div>
          <div className="muted small" style={{ margin: '-4px 0 6px' }}>
            Em quilômetros, a grade é plana a partir da origem (aproximada para áreas grandes).
          </div>
        </>
      )}

      <label className="field">
        <span>Opacidade das grades: {pct}%</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={grid.opacity}
          onChange={(e) => update((g) => ({ ...g, opacity: Number(e.target.value) }))}
        />
      </label>

      <label className="field inline">
        <input type="checkbox" checked={grid.snap} onChange={(e) => update((g) => ({ ...g, snap: e.target.checked }))} />
        <span>Encaixar unidades na grade</span>
      </label>
      {grid.snap && (
        <>
          <label className="field">
            <span>Tamanho da célula de encaixe (graus)</span>
            <CommitInput
              type="number"
              min={0.0001}
              step="any"
              value={grid.snapStep}
              onCommit={(v) => {
                const n = num(v);
                if (n !== null && n > 0) update((g) => ({ ...g, snapStep: n }));
              }}
            />
          </label>
          <div className="muted small" style={{ margin: '-4px 0 6px' }}>
            Unidades colocadas no mapa vão para o centro da célula.
          </div>
        </>
      )}
    </>
  );
}

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

      <GridSection />

      <OverlaySection />

      <div className="h">Ajuda rápida</div>
      <p className="muted small">
        Os nomes dos países aparecem conforme você aproxima o zoom. Divisões internas (estados/províncias) aparecem ao pintar com
        “Estado / região”.
      </p>
    </>
  );
}
