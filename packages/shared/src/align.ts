import type { Scene } from './scene.ts';
import { posAt } from './time.ts';
import { setWaypoint } from './ops.ts';

/* Alinhar e distribuir unidades. Eixos de um mapa: longitude = horizontal (x), latitude = vertical (y).
   "Centro horizontal" alinha as longitudes no centro do conjunto; "centro vertical" as latitudes. */

export type AlignMode = 'left' | 'right' | 'top' | 'bottom' | 'hcenter' | 'vcenter' | 'dist-h' | 'dist-v';

export const ALIGN_LABELS: Record<AlignMode, string> = {
  left: 'Alinhar à esquerda',
  right: 'Alinhar à direita',
  top: 'Alinhar ao topo',
  bottom: 'Alinhar à base',
  hcenter: 'Centralizar horizontalmente',
  vcenter: 'Centralizar verticalmente',
  'dist-h': 'Distribuir horizontalmente',
  'dist-v': 'Distribuir verticalmente',
};

export interface Pt {
  id: string;
  lat: number;
  lon: number;
}

function distribute(pts: readonly Pt[], axis: 'lat' | 'lon'): Pt[] {
  if (pts.length < 3) return pts.map((p) => ({ ...p }));
  const sorted = [...pts].sort((a, b) => a[axis] - b[axis] || a.id.localeCompare(b.id));
  const first = sorted[0]?.[axis] ?? 0;
  const last = sorted[sorted.length - 1]?.[axis] ?? first;
  const step = (last - first) / (sorted.length - 1);
  const pos = new Map(sorted.map((p, i) => [p.id, first + step * i]));
  return pts.map((p) => ({ ...p, [axis]: pos.get(p.id) ?? p[axis] }));
}

/* Devolve novas posições. Os extremos do conjunto são o ponto de referência; a distribuição mantém
   o primeiro e o último no lugar e espaça os demais igualmente (precisa de pelo menos 3 pontos). */
export function alignPoints(pts: readonly Pt[], mode: AlignMode): Pt[] {
  if (pts.length < 2) return pts.map((p) => ({ ...p }));
  const lats = pts.map((p) => p.lat);
  const lons = pts.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  switch (mode) {
    case 'left':
      return pts.map((p) => ({ ...p, lon: minLon }));
    case 'right':
      return pts.map((p) => ({ ...p, lon: maxLon }));
    case 'hcenter':
      return pts.map((p) => ({ ...p, lon: (minLon + maxLon) / 2 }));
    case 'top':
      return pts.map((p) => ({ ...p, lat: maxLat }));
    case 'bottom':
      return pts.map((p) => ({ ...p, lat: minLat }));
    case 'vcenter':
      return pts.map((p) => ({ ...p, lat: (minLat + maxLat) / 2 }));
    case 'dist-h':
      return distribute(pts, 'lon');
    case 'dist-v':
      return distribute(pts, 'lat');
  }
}

/* Alinha as unidades citadas no instante t, pela posição que cada uma ocupa nesse instante.
   Unidades sem posição em t são ignoradas. Grava um ponto do trajeto em t para cada unidade movida. */
export function alignUnitsAt(scene: Scene, t: number, unitIds: readonly string[], mode: AlignMode): Scene {
  const pts: Pt[] = [];
  for (const id of new Set(unitIds)) {
    const u = scene.units.find((x) => x.id === id);
    const p = u ? posAt(u.path, t) : null;
    if (p) pts.push({ id, lat: p.lat, lon: p.lon });
  }
  if (pts.length < 2) return scene;
  let out = scene;
  for (const m of alignPoints(pts, mode)) {
    const before = pts.find((p) => p.id === m.id);
    if (!before || (before.lat === m.lat && before.lon === m.lon)) continue;
    out = setWaypoint(out, m.id, t, m.lat, m.lon);
  }
  return out;
}
