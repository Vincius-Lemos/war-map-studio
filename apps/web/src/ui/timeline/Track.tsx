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

/* Trilho: barra de progresso, marcas dos instantes-chave (eventos em vermelho) e rótulos de hora.
   Com zoom (régua), mostra só uma janela da cena que acompanha o instante atual. */
export function Track({ scene, t, keys, onSeek }: Props) {
  const dur = scene.durationH;
  const zoom = useRuler((s) => s.zoom);
  const chosen = useRuler((s) => s.step);
  /* janela visível: tamanho dur/zoom, centrada no instante atual e presa às bordas da cena */
  const span = dur / zoom;
  const start = Math.min(Math.max(0, t - span / 2), Math.max(0, dur - span));
  const end = start + span;
  const pct = (v: number) => (((v - start) / span) * 100).toFixed(3) + '%';
  const inView = (v: number) => v >= start - 1e-9 && v <= end + 1e-9;

  const eventTimes = new Set(scene.events.map((e) => Math.round(e.t * 100)));
  /* passo escolhido pelo usuário, se couber na janela; senão o automático da janela.
     Nunca abaixo do que cabe em MAX_TICKS. */
  const pick = chosen && chosen <= span ? chosen : tickStep(span);
  const step = Math.max(pick, span / MAX_TICKS);
  const dayLabels = step >= 24;
  const ticks: number[] = [];
  for (let x = Math.ceil(start / step) * step; x <= end + 1e-9; x += step) ticks.push(x);
  /* com muitas marcas, mostra um rótulo a cada N para não se sobreporem (as marcas continuam) */
  const labelEvery = ticks.length > 30 ? Math.ceil(ticks.length / 24) : 1;

  return (
    <>
      <div className="track">
        <div className="rail" />
        <div className="fill" style={{ width: pct(t) }} />
        <div className="marks">
          {keys.filter(inView).map((k) => {
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
          min={start}
          max={end}
          step={0.01}
          value={Math.min(end, Math.max(start, t))}
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
