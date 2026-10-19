import type { Arrow, Unit } from '@map-draw/shared';
import { posAt } from '@map-draw/shared';

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/* Projeção de Mercator normalizada (0..1): é o espaço em que o deck.gl interpola texturas
   e posições na tela. Interpolar linearmente nele dá curvas e recortes corretos. */
export const wx = (lon: number) => (lon + 180) / 360;
export const wy = (lat: number) => {
  const r = lat * Math.PI / 180;
  return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2;
};
export function fromWorld(x: number, y: number): { lon: number; lat: number } {
  return {
    lon: x * 360 - 180,
    lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI,
  };
}

export interface ArrowGeo {
  arrow: Arrow;
  /* pontos [lon, lat] já percorridos pela seta */
  path: [number, number][];
  /* progresso 0..1 */
  p: number;
  /* ponta: só aparece quando a seta quase chegou (como na referência) */
  head: { lon: number; lat: number; angleDeg: number } | null;
}

/* Seta: curva quadrática com desvio de 15% do comprimento, desenhada de t0 até t1. */
export function arrowGeo(a: Arrow, t: number, steps = 48): ArrowGeo {
  const p = t >= a.t1 ? 1 : clamp((t - a.t0) / Math.max(0.01, a.t1 - a.t0), 0, 1);
  const A = { x: wx(a.from.lon), y: wy(a.from.lat) };
  const B = { x: wx(a.to.lon), y: wy(a.to.lat) };
  const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1e-9;
  const bend = len * 0.15;
  const C = { x: (A.x + B.x) / 2 - dy / len * bend, y: (A.y + B.y) / 2 + dx / len * bend };
  const n = Math.max(2, Math.round(steps * Math.max(p, 0.05)));
  const path: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const s = p * i / n;
    const x = (1 - s) * (1 - s) * A.x + 2 * (1 - s) * s * C.x + s * s * B.x;
    const y = (1 - s) * (1 - s) * A.y + 2 * (1 - s) * s * C.y + s * s * B.y;
    const ll = fromWorld(x, y);
    path.push([ll.lon, ll.lat]);
  }
  let head: ArrowGeo['head'] = null;
  if (p > 0.97) {
    /* direção da ponta: tangente em B (de C até B), em graus */
    head = { lon: a.to.lon, lat: a.to.lat, angleDeg: Math.atan2(B.y - C.y, B.x - C.x) * 180 / Math.PI };
  }
  return { arrow: a, path, p, head };
}

/* Rastro: trajeto já percorrido + a posição atual. */
export function trailPoints(u: Unit, t: number): [number, number][] {
  const pts: [number, number][] = u.path.filter(p => p.t <= t).map(p => [p.lon, p.lat]);
  const cur = posAt(u.path, t);
  if (cur && pts.length) pts.push([cur.lon, cur.lat]);
  return pts;
}

/* Quebra de texto por número de caracteres (mesma regra da referência). */
export function wrapText(text: string, max: number): string[] {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (next.length > max && cur) { lines.push(cur); cur = w; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

/* '#rrggbb' ou '#rgb' para [r, g, b]. Cor inválida vira cinza. */
export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return [136, 136, 136];
  let h = m[1]!;
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
