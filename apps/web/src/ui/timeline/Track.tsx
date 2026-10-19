import { clockParts, tickStep, type Scene } from '@map-draw/shared';

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
  const step = tickStep(dur);
  const ticks: number[] = [];
  for (let x = 0; x <= dur + 0.001; x += step) ticks.push(x);

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
        {ticks.map((x) => (
          <span key={x} style={{ left: pct(x) }}>
            {clockParts(scene, x).main.replace(/^Dia \d+ · /, '')}
          </span>
        ))}
      </div>
    </>
  );
}
