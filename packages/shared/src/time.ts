import type { Scene, Territory, Waypoint } from './scene.ts';

/* Tempo da cena: tudo em horas desde o início. */

export function fmtHours(t: number): string {
  const h = Math.floor(t);
  const m = Math.round((t - h) * 60);
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

export function hhmm(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return String(hh + Math.floor(mm / 60)).padStart(2, '0') + ':' + String(mm % 60).padStart(2, '0');
}

export interface ClockParts {
  main: string;
  sub: string;
}

/* Com data de início: dia/mês/hora reais. Sem data: horas corridas (até 48 h) ou "Dia N · HH:MM". */
export function clockParts(scene: Pick<Scene, 'startDate' | 'durationH'>, t: number): ClockParts {
  const start = scene.startDate ? new Date(scene.startDate).getTime() : Number.NaN;
  if (!Number.isNaN(start)) {
    const d = new Date(start + t * 3_600_000);
    const main = d
      .toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      .replace(',', ' ·');
    return { main, sub: `${d.getFullYear()} · +${fmtHours(t)} desde o início` };
  }
  const short = scene.durationH <= 48;
  return {
    main: short ? `+${fmtHours(t)}` : `Dia ${Math.floor(t / 24) + 1} · ${hhmm(t % 24)}`,
    sub: short ? 'horas desde o início' : `${fmtHours(t)} desde o início`,
  };
}

/* Instantes-chave: início, fim, pontos de trajeto, eventos, setas e mudanças de controle. */
export function keyframes(scene: Scene): number[] {
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const set = new Set<number>([0, scene.durationH]);
  for (const u of scene.units) for (const p of u.path) set.add(r2(p.t));
  for (const e of scene.events) set.add(r2(e.t));
  for (const a of scene.arrows) {
    set.add(r2(a.t0));
    set.add(r2(a.t1));
  }
  for (const e of scene.territories) set.add(r2(e.t));
  return [...set].filter((t) => t >= 0 && t <= scene.durationH).sort((a, b) => a - b);
}

const EPS = 0.001;

export function nextKeyframe(scene: Scene, t: number): number | undefined {
  return keyframes(scene).find((k) => k > t + EPS);
}

export function prevKeyframe(scene: Scene, t: number): number | undefined {
  return [...keyframes(scene)].reverse().find((k) => k < t - EPS);
}

/* Posição interpolada (suavizada) de um trajeto no instante t. null = unidade ainda não apareceu. */
export function posAt(path: readonly Waypoint[], t: number): { lat: number; lon: number } | null {
  if (path.length === 0) return null;
  const first = path[0];
  const last = path[path.length - 1];
  if (!first || !last) return null;
  if (t < first.t) return null;
  if (t >= last.t) return { lat: last.lat, lon: last.lon };
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    if (!a || !b) continue;
    if (t >= a.t && t < b.t) {
      const k = smooth((t - a.t) / Math.max(0.0001, b.t - a.t));
      return { lat: a.lat + (b.lat - a.lat) * k, lon: a.lon + (b.lon - a.lon) * k };
    }
  }
  return { lat: last.lat, lon: last.lon };
}

const smooth = (k: number) => k * k * (3 - 2 * k);

/* Controle de cada país (iso) no instante t: vale o registro mais recente com t' <= t. */
export function controlAt(territories: readonly Territory[], t: number): Map<string, Territory> {
  const m = new Map<string, Territory>();
  for (const e of territories) {
    if (e.sub || e.t > t) continue;
    const cur = m.get(e.iso);
    if (!cur || e.t >= cur.t) m.set(e.iso, e);
  }
  return m;
}

/* Controle de cada região (sub = shapeID) no instante t. */
export function subControlAt(territories: readonly Territory[], t: number): Map<string, Territory> {
  const m = new Map<string, Territory>();
  for (const e of territories) {
    if (!e.sub || e.t > t) continue;
    const cur = m.get(e.sub);
    if (!cur || e.t >= cur.t) m.set(e.sub, e);
  }
  return m;
}

/* Passo das marcas de hora na linha do tempo. */
export function tickStep(durationH: number): number {
  return [1, 2, 3, 6, 12, 24, 48, 72, 168].find((s) => durationH / s <= 14) ?? 168;
}
