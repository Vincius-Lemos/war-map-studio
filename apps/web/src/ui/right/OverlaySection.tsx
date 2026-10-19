import { pickFile, readFileDataURL } from '../../app/io.ts';
import { useStore } from '../../state/store.ts';

/* Imagem própria (planta, mapa escaneado, print): carregar, opacidade, calibrar os cantos e remover. */
export function OverlaySection() {
  const overlay = useStore((s) => s.scene.overlay);
  const setOverlay = useStore((s) => s.setOverlay);
  const removeOverlay = useStore((s) => s.removeOverlay);
  const setMode = useStore((s) => s.setMode);
  const editField = useStore((s) => s.editField);

  const load = async () => {
    const file = await pickFile('image/*');
    if (!file) return;
    setOverlay(await readFileDataURL(file));
  };

  return (
    <>
      <div className="h">Imagem própria</div>
      {overlay ? (
        <>
          <p className="muted small">Imagem carregada. Use “Calibrar imagem” e clique nos dois cantos opostos.</p>
          <label className="field">
            <span>Opacidade</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={overlay.opacity}
              onChange={(e) => editField({ kind: 'ov', field: 'opacity' }, e.target.value)}
            />
          </label>
          <div className="row">
            <button className="btn sm" onClick={() => setMode('calib')}>
              Calibrar cantos
            </button>
            <button className="btn sm danger" onClick={removeOverlay}>
              Remover imagem
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="muted small">Carregue uma planta, mapa escaneado ou print, e posicione nos dois cantos.</p>
          <button className="btn sm" onClick={() => void load()}>
            Carregar imagem
          </button>
        </>
      )}
    </>
  );
}
