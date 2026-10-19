import type { Scene } from './scene.ts';
import { fmtHours } from './time.ts';

/* Modo de apresentação: uma parada da câmera por evento, em ordem de tempo. */

export interface Slide {
  t: number;        // instante da cena (horas)
  lat: number;
  lon: number;
  zoom: number;
  title: string;
  body: string;
  holdSec: number;  // tempo de permanência no modo automático (segundos)
}

const DEFAULT_ZOOM = 6;
const DEFAULT_HOLD_SEC = 6;

/* Um slide por evento (ordem de t). Sem eventos: um slide no centro da área, com o título da cena. */
export function buildSlides(scene: Scene): Slide[] {
  if (scene.events.length === 0) {
    const r = scene.region;
    return [{
      t: 0,
      lat: (r.lat0 + r.lat1) / 2,
      lon: (r.lon0 + r.lon1) / 2,
      zoom: DEFAULT_ZOOM,
      title: scene.title,
      body: '',
      holdSec: DEFAULT_HOLD_SEC,
    }];
  }
  return [...scene.events]
    .sort((a, b) => a.t - b.t)
    .map((e) => ({
      t: e.t,
      lat: e.lat,
      lon: e.lon,
      zoom: DEFAULT_ZOOM,
      title: e.text,
      body: `+${fmtHours(e.t)}`,
      holdSec: DEFAULT_HOLD_SEC,
    }));
}

/* Índice do último slide com slide.t <= t (na ordem do array); -1 se nenhum. */
export function slideAt(slides: readonly Slide[], t: number): number {
  let idx = -1;
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    if (s && s.t <= t) idx = i;
  }
  return idx;
}
