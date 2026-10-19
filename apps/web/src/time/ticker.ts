import type { Api } from '../state/store.ts';

/* Relógio de reprodução: avança S.t pelo tempo real, na velocidade escolhida (horas de cena por segundo).
   Limita o passo a 0,1 s para não pular a animação quando a aba esteve em segundo plano. */
export function startTicker(api: Api): () => void {
  let raf = 0;
  let last = 0;
  const frame = (ts: number) => {
    const s = api.getState();
    if (s.playing) {
      const dt = Math.min(0.1, (ts - (last || ts)) / 1000);
      const t = s.t + dt * s.speed;
      if (t >= s.scene.durationH) api.setState({ t: s.scene.durationH, playing: false });
      else api.setState({ t });
    }
    last = ts;
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}
