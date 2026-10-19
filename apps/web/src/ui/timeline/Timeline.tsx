import { useMemo } from 'react';
import { clockParts, keyframes, SPEEDS } from '@map-draw/shared';
import { useStore } from '../../state/store.ts';
import { Track } from './Track.tsx';
import { RULER_STEPS, useRuler } from './rulerStore.ts';

/* Linha do tempo: transporte, relógio, velocidade, trilho com instantes-chave e marcas de hora. */
export function Timeline() {
  const rulerStep = useRuler((s) => s.step);
  const setRulerStep = useRuler((s) => s.setStep);
  const scene = useStore((s) => s.scene);
  const t = useStore((s) => s.t);
  const playing = useStore((s) => s.playing);
  const speed = useStore((s) => s.speed);
  const setSpeed = useStore((s) => s.setSpeed);
  const togglePlay = useStore((s) => s.togglePlay);
  const setT = useStore((s) => s.setT);
  const jumpKey = useStore((s) => s.jumpKey);

  const clock = clockParts(scene, t);
  const keys = useMemo(() => keyframes(scene), [scene]);

  return (
    <footer id="timeline" className="timeline" aria-label="Linha do tempo">
      <div className="tl-row">
        <div className="seg" role="group" aria-label="Ir para">
          <button className="btn icon" onClick={() => setT(0)} title="Início (Home)" aria-label="Início">
            ⏮
          </button>
          <button className="btn icon" onClick={() => jumpKey(-1)} title="Instante anterior (↑)" aria-label="Instante anterior">
            ◀◀
          </button>
        </div>
        <button className="tbtn" onClick={togglePlay} title="Espaço" aria-label={playing ? 'Pausar' : 'Reproduzir'}>
          {playing ? '❚❚' : '▶'}
        </button>
        <div className="seg" role="group" aria-label="Ir para">
          <button className="btn icon" onClick={() => jumpKey(1)} title="Próximo instante (↓)" aria-label="Próximo instante">
            ▶▶
          </button>
          <button className="btn icon" onClick={() => setT(scene.durationH)} title="Fim (End)" aria-label="Fim">
            ⏭
          </button>
        </div>
        <div className="clock" aria-live="off">
          {clock.main}
          <small>{clock.sub}</small>
        </div>
        <div className="spacer" />
        <label className="ruler-pick" title="Espaçamento das marcas de hora na régua">
          Régua
          <select aria-label="Régua de tempo" value={rulerStep} onChange={(e) => setRulerStep(Number(e.target.value))}>
            {RULER_STEPS.map((s) => (
              <option key={s.hours} value={s.hours}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <div className="seg" role="group" aria-label="Velocidade">
          {SPEEDS.map((v) => (
            <button
              key={v}
              className={speed === v ? 'on' : ''}
              onClick={() => setSpeed(v)}
              title={`${v} h de cena por segundo`}
            >
              {v.toString().replace('.', ',')}×
            </button>
          ))}
        </div>
      </div>
      <Track scene={scene} t={t} keys={keys} onSeek={setT} />
    </footer>
  );
}
