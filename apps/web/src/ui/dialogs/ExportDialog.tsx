import { useState } from 'react';
import { useStore } from '../../state/store.ts';
import { exportVideoFile } from '../../app/exporter.ts';

/* Exportar vídeo: escolhe a duração do arquivo; toda a linha do tempo é gravada na velocidade que couber. */
export function ExportDialog() {
  const closeDialog = useStore((s) => s.closeDialog);
  const exporting = useStore((s) => s.exporting);
  const status = useStore((s) => s.exportStatus);
  const [seconds, setSeconds] = useState('20');

  const start = () => {
    const n = Number.parseFloat(seconds);
    void exportVideoFile(Number.isFinite(n) ? n : 20);
  };

  return (
    <div className="overlay">
      <div className="dlg narrow" role="dialog" aria-modal="true" aria-labelledby="expTitle">
        <h2 id="expTitle">Exportar vídeo</h2>
        <p className="lead">Gera um arquivo WebM em 1920×1080, 30 quadros por segundo. Toda a linha do tempo é gravada.</p>
        <label className="field">
          <span>Duração do vídeo (segundos)</span>
          <input type="number" min={3} max={180} value={seconds} onChange={(e) => setSeconds(e.target.value)} />
        </label>
        <p className="muted small">Dica: se a batalha tem 38 horas, 20 segundos de vídeo mostram cerca de 2 horas por segundo.</p>
        <div className="muted small" aria-live="polite">
          {status}
        </div>
        <div className="foot">
          <button className="btn" onClick={closeDialog} disabled={exporting}>
            Fechar
          </button>
          <button className="btn primary" onClick={start} disabled={exporting}>
            Gravar e baixar
          </button>
        </div>
      </div>
    </div>
  );
}
