import { useEffect, useMemo, useState } from 'react';
import {
  azimuthDeg,
  compassPoint,
  geodesicDistanceKm,
  KM_PER_MILE,
  kmToMiles,
  polygonAreaKm2,
  ringPerimeterKm,
  type LatLon,
} from '@map-draw/shared';
import { useStore } from '../../state/store.ts';
import { useMeasureStore } from './measureStore.ts';
import { currentProjector, type ScreenPoint } from './projection.ts';
import './measure.css';

/* Régua e medição de área (atalho R; Esc ou clique direito encerram).
   Não grava nada na cena: é uma camada visual que some ao encerrar. */

const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: n < 10 ? 2 : 1 });
const kmText = (km: number) => `${fmt(km)} km · ${fmt(kmToMiles(km))} mi`;
const bearingText = (az: number) => `${Math.round(az) % 360}° ${compassPoint(az)}`;

/* Liga a régua: atalhos, captura dos cliques sobre o mapa enquanto ativa, botão e painel. */
export function MeasureTool() {
  const active = useMeasureStore((s) => s.active);

  /* atalhos R e Esc: ignorados enquanto se digita, com diálogo aberto ou com modificadores */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target !== null && target.matches('input,select,textarea')) return;
      if (useStore.getState().dialog !== null) return;
      const m = useMeasureStore.getState();
      if (e.key === 'Escape') {
        if (m.active) m.stop();
        return;
      }
      if (e.key.toLowerCase() === 'r') m.toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* com a régua ativa, o clique vai para a régua e não chega ao motor do mapa (seleção, movimento etc.).
     A captura fica no elemento do mapa, na fase de captura, então é o único a receber o clique. */
  useEffect(() => {
    if (!active) return;
    const host = document.querySelector<HTMLElement>('.map-host');
    if (!host) return;
    const onClick = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (e.button !== 0) return;
      const p = currentProjector();
      if (!p) return;
      const r = host.getBoundingClientRect();
      const ll = p.toLatLon(e.clientX - r.left, e.clientY - r.top);
      if (ll) useMeasureStore.getState().addPoint(ll);
    };
    const onContext = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      useMeasureStore.getState().stop();
    };
    host.addEventListener('click', onClick, true);
    host.addEventListener('contextmenu', onContext, true);
    return () => {
      host.removeEventListener('click', onClick, true);
      host.removeEventListener('contextmenu', onContext, true);
    };
  }, [active]);

  return (
    <>
      <button
        type="button"
        className={`mt-btn measure-btn${active ? ' on' : ''}`}
        aria-pressed={active}
        aria-label="Régua (R)"
        title="Régua: medir distância e azimute (R)"
        onClick={() => useMeasureStore.getState().toggle()}
      >
        <RulerIcon />
      </button>
      {active && <RulerLayer />}
    </>
  );
}

function RulerLayer() {
  const points = useMeasureStore((s) => s.points);
  const kind = useMeasureStore((s) => s.kind);
  const [screen, setScreen] = useState<(ScreenPoint | null)[]>([]);
  const hasProjector = currentProjector() !== null;

  /* acompanha a câmera: relê a posição dos pontos a cada quadro e só atualiza quando muda */
  useEffect(() => {
    let raf = 0;
    let last = '';
    const tick = () => {
      const p = currentProjector();
      const arr = p ? points.map((q) => p.toScreen(q.lat, q.lon)) : [];
      const key = arr.map((q) => (q ? `${q.x.toFixed(1)},${q.y.toFixed(1)}` : '-')).join(';');
      if (key !== last) {
        last = key;
        setScreen(arr);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [points]);

  const m = useMemo(() => measure(points, kind), [points, kind]);

  return (
    <>
      <svg className="rl-svg" aria-hidden="true">
        {kind === 'line' && screen.length > 1 && (
          <polyline className="rl-line" points={screen.filter(Boolean).map((q) => `${q!.x},${q!.y}`).join(' ')} />
        )}
        {kind === 'area' && screen.length > 2 && screen.every(Boolean) && (
          <polygon className="rl-area" points={screen.map((q) => `${q!.x},${q!.y}`).join(' ')} />
        )}
        {screen.map((q, i) => (q ? <circle key={i} className="rl-dot" cx={q.x} cy={q.y} r={4.5} /> : null))}
      </svg>

      {kind === 'line' &&
        m.segments.map((seg, i) => {
          const a = screen[i];
          const b = screen[i + 1];
          if (!a || !b) return null;
          return (
            <div key={i} className="rl-label" style={{ left: (a.x + b.x) / 2, top: (a.y + b.y) / 2 }}>
              {kmText(seg.km)} · {bearingText(seg.az)}
            </div>
          );
        })}

      {kind === 'area' && m.area !== null && (
        <AreaLabel screen={screen} text={`${fmt(m.area)} km² · ${mi2Text(m.area)}`} />
      )}

      <div className="rl-panel" role="region" aria-label="Régua">
        <div className="rl-head">
          <b>Régua</b>
          <span className="rl-kbd">R · Esc</span>
        </div>
        <div className="rl-modes" role="group" aria-label="Tipo de medição">
          <button
            type="button"
            className={`btn sm${kind === 'line' ? ' primary' : ''}`}
            aria-pressed={kind === 'line'}
            onClick={() => useMeasureStore.getState().setKind('line')}
          >
            Distância
          </button>
          <button
            type="button"
            className={`btn sm${kind === 'area' ? ' primary' : ''}`}
            aria-pressed={kind === 'area'}
            onClick={() => useMeasureStore.getState().setKind('area')}
          >
            Área
          </button>
        </div>

        {!hasProjector && (
          <p className="rl-warn">O mapa ainda não expõe a projeção (toScreen / toLatLon). Os cliques não são lidos.</p>
        )}

        <div className="rl-result" aria-live="polite">
          {points.length === 0 && <span className="muted">Clique no mapa para marcar o primeiro ponto.</span>}
          {kind === 'line' && points.length > 0 && (
            <>
              <div>
                Distância total: <b>{kmText(m.totalKm)}</b>
              </div>
              {m.segments.length > 0 && (
                <ol className="rl-seg">
                  {m.segments.map((seg, i) => (
                    <li key={i}>
                      {i + 1} → {i + 2}: {kmText(seg.km)} · {bearingText(seg.az)}
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
          {kind === 'area' && points.length > 0 && (
            <>
              {m.area !== null ? (
                <>
                  <div>
                    Área: <b>{fmt(m.area)} km²</b> ({mi2Text(m.area)})
                  </div>
                  <div>Perímetro: {kmText(m.perimeterKm ?? 0)}</div>
                </>
              ) : (
                <span className="muted">Marque ao menos 3 pontos para medir a área.</span>
              )}
            </>
          )}
        </div>

        <div className="rl-actions">
          <button
            type="button"
            className="btn sm"
            disabled={points.length === 0}
            onClick={() => useMeasureStore.getState().undo()}
          >
            Desfazer ponto
          </button>
          <button type="button" className="btn sm" onClick={() => useMeasureStore.getState().clear()} disabled={points.length === 0}>
            Limpar
          </button>
          <button type="button" className="btn sm danger" onClick={() => useMeasureStore.getState().stop()}>
            Encerrar (Esc)
          </button>
        </div>
        <p className="muted rl-tip">Clique direito também encerra. Distâncias pela elipse WGS-84; área aproximada pela esfera.</p>
      </div>
    </>
  );
}

/* posição do rótulo da área: média dos vértices visíveis */
function AreaLabel({ screen, text }: { screen: (ScreenPoint | null)[]; text: string }) {
  const pts = screen.filter((q): q is ScreenPoint => q !== null);
  if (pts.length < 3) return null;
  const x = pts.reduce((s, q) => s + q.x, 0) / pts.length;
  const y = pts.reduce((s, q) => s + q.y, 0) / pts.length;
  return (
    <div className="rl-label rl-label-area" style={{ left: x, top: y }}>
      {text}
    </div>
  );
}

/* 1 milha² = 2,589988 km² */
const KM2_PER_MI2 = KM_PER_MILE * KM_PER_MILE;
const mi2Text = (km2: number) => `${fmt(km2 / KM2_PER_MI2)} mi²`;

interface Measure {
  totalKm: number;
  segments: { km: number; az: number }[];
  area: number | null;
  perimeterKm: number | null;
}

function measure(points: LatLon[], kind: 'line' | 'area'): Measure {
  const segments: { km: number; az: number }[] = [];
  let totalKm = 0;
  if (kind === 'line') {
    for (let i = 0; i + 1 < points.length; i++) {
      const a = points[i]!;
      const b = points[i + 1]!;
      const km = geodesicDistanceKm(a, b);
      segments.push({ km, az: azimuthDeg(a, b) });
      totalKm += km;
    }
    return { totalKm, segments, area: null, perimeterKm: null };
  }
  if (points.length < 3) return { totalKm: 0, segments: [], area: null, perimeterKm: null };
  return { totalKm: 0, segments: [], area: polygonAreaKm2(points), perimeterKm: ringPerimeterKm(points) };
}

function RulerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M3 17 17 3l4 4L7 21z" />
      <path d="M7 13l2 2M10 10l2 2M13 7l2 2" />
    </svg>
  );
}
