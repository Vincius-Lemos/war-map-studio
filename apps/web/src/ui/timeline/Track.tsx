import { clockParts, tickStep, type Scene } from '@map-draw/shared';
import { useRuler } from './rulerStore.ts';

/* máximo de marcas na régua: evita milhares de rótulos em cenas longas com passo pequeno */
const MAX_TICKS = 150;

interface Props {
  scene: Scene;
  t: number;
  keys: number[];
  onSeek: (t: number) => void;
}

/* Trilho: barra de progresso, marcas dos instantes-chave (eventos em vermelho) e rótulos de hora. */
export function Track({ scene, t, keys, onSeek }: Props) {
  const dur = scene.durationH;
  const pct = (v: number) => ((v / dur) * 100).toFixed(3) + '%';
  const eventTimes = new Set(scene.events.map((e) => Math.round(e.t * 100)));
  const chosen = useRuler((s) => s.step);
  /* passo escolhido pelo usuário, ou o automático; nunca abaixo do que cabe em MAX_TICKS */
  const step = Math.max(chosen || tickStep(dur), dur / MAX_TICKS);
  const dayLabels = step >= 24;
  const ticks: number[] = [];
  for (let x = 0; x <= dur + 0.001; x += step) ticks.push(x);
  /* com muitas marcas, mostra um rótulo a cada N para não se sobreporem (as marcas continuam) */
  const labelEvery = ticks.length > 30 ? Math.ceil(ticks.length / 24) : 1;

  return (
    <>
      <div className="track">
        <div className="rail" />
        <div className="fill" style={{ width: pct(t) }} />
        <div className="marks">
          {keys.map((k) => {
            const isEvent = eventTimes.has(Math.round(k * 100));
            return (
              <button
                key={k}
                className={`mk${isEvent ? ' ev' : ''}`}
                style={{ left: pct(k), background: isEvent ? '#ff4b3e' : '#ffd166' }}
                onClick={() => onSeek(k)}
                title={clockParts(scene, k).main}
                aria-label={`Ir para ${clockParts(scene, k).main}`}
              />
            );
          })}
        </div>
        <input
          type="range"
          min={0}
          max={dur}
          step={0.01}
          value={t}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Linha do tempo"
        />
      </div>
      <div className="ticks">
        {ticks.map((x, i) => (
          <span key={x} style={{ left: pct(x) }}>
            {i % labelEvery === 0
              ? dayLabels ? clockParts(scene, x).main.split(' · ')[0] : clockParts(scene, x).main.replace(/^Dia \d+ · /, '')
              : ''}
          </span>
        ))}
      </div>
    </>
  );
}
